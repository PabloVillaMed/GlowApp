package com.pablo.glowapp;

import android.annotation.SuppressLint;
import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedDispatcher;
import android.widget.FrameLayout;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Native shell for the GlowApp web app.
 *
 * The page is served from a synthetic https origin rather than a file:// URL.
 * That matters: local storage on file:// is treated as an opaque origin by some
 * WebView versions and can be dropped, and service workers refuse to register
 * outside a secure context. Requests to that origin never touch the network —
 * they are answered from the APK's assets.
 */
public class MainActivity extends Activity {

  static final String ASSET_ROOT = "www";
  /** Which screen to open: "chat" from a character's message, "today" from the widget. */
  static final String EXTRA_ROUTE = "route";

  private static final String ORIGIN = "https://appassets.androidplatform.net";
  private static final String START_URL = ORIGIN + "/index.html";

  /** Pulls in whatever happened natively: widget ticks, notification replies, new messages. */
  private static final String POKE =
      "window.__glow && window.__glow.applyPending && window.__glow.applyPending()";

  /** Reports the page's own background colour so the bars behind the insets match it. */
  private static final String THEME_WATCHER =
      "(function () {"
    + "  function report() {"
    + "    try { NativeShell.setBackgroundColor(getComputedStyle(document.body).backgroundColor); }"
    + "    catch (e) {}"
    + "  }"
    + "  report();"
    + "  new MutationObserver(report).observe(document.documentElement,"
    + "    { attributes: true, attributeFilter: ['data-theme'] });"
    + "})();";

  private static final Pattern RGB =
      Pattern.compile("rgba?[(]([0-9]+),[ ]*([0-9]+),[ ]*([0-9]+)");

  private static final int REQUEST_NOTIFICATIONS = 1;
  private static final int REQUEST_MIC = 2;

  /** The activity on screen, if any, so a receiver can tell the page something changed. */
  private static WeakReference<MainActivity> resumed = new WeakReference<>(null);

  private FrameLayout root;
  private WebView webView;
  private boolean pageReady;
  private String pendingRoute;
  /** The page's request for the microphone, waiting on Android's own permission dialog. */
  private PermissionRequest pendingMic;

  @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Debuggable builds expose the page to Chrome DevTools; release builds
    // never do, so this cannot leak a user's data.
    if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
      WebView.setWebContentsDebuggingEnabled(true);
    }

    webView = new WebView(this);
    // The WebView draws its own scroll bar, and flashes it as the page first
    // lays out — right across the launch screen, which CSS cannot reach. It
    // stays off until the page says the launch screen has gone (splashDone).
    webView.setVerticalScrollBarEnabled(false);
    webView.setHorizontalScrollBarEnabled(false);
    root = new FrameLayout(this);
    root.addView(webView, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    setContentView(root);

    goEdgeToEdge();
    registerBack();

    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);          // the app's entire database
    settings.setDatabaseEnabled(true);
    settings.setSupportZoom(false);
    settings.setBuiltInZoomControls(false);
    settings.setMediaPlaybackRequiresUserGesture(true);
    settings.setAllowFileAccess(false);           // nothing is loaded over file://
    settings.setAllowContentAccess(false);
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    // The page has its own Size setting, so Android's font slider must not
    // scale it a second time on top.
    settings.setTextZoom(100);

    CookieManager.getInstance().setAcceptCookie(false);

    // Only reachable from the bundled page, which is the app's own code.
    webView.addJavascriptInterface(new ShellBridge(), "NativeShell");

    webView.setWebViewClient(new WebViewClient() {
      @Override
      public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        return serve(request.getUrl());
      }

      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (isOurs(uri)) return false;
        // Anything outside the bundled app belongs in the browser.
        try {
          startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException noBrowser) {
          // Nothing can open it; stay put.
        }
        return true;
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        view.evaluateJavascript(THEME_WATCHER, null);
        pageReady = true;
        deliverRoute();
      }
    });

    // The page asks for the microphone to record a voice note, and for
    // nothing else. Android's own permission is asked on the spot, the first
    // time the record button is pressed.
    webView.setWebChromeClient(new WebChromeClient() {
      @Override
      public void onPermissionRequest(PermissionRequest request) {
        runOnUiThread(() -> answerPermission(request));
      }

      @Override
      public void onPermissionRequestCanceled(PermissionRequest request) {
        if (pendingMic == request) pendingMic = null;
      }
    });

    // The page registers a service worker in a browser; its fetches bypass
    // WebViewClient and need their own interceptor.
    ServiceWorkerController controller = ServiceWorkerController.getInstance();
    controller.setServiceWorkerClient(new ServiceWorkerClient() {
      @Override
      public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
        return serve(request.getUrl());
      }
    });

    pendingRoute = routeOf(getIntent());
    if (savedInstanceState != null) {
      webView.restoreState(savedInstanceState);
    } else {
      webView.loadUrl(START_URL);
    }
  }

  /** Grants the microphone to the app's own page once Android has granted it to the app. */
  private void answerPermission(PermissionRequest request) {
    final String[] wanted = request.getResources();
    final boolean micOnly = wanted.length == 1 && PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(wanted[0]);
    if (!micOnly || !isOurs(request.getOrigin())) {
      request.deny();
      return;
    }
    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
      request.grant(wanted);
      return;
    }
    if (pendingMic != null) pendingMic.deny();
    pendingMic = request;
    requestPermissions(new String[] { Manifest.permission.RECORD_AUDIO }, REQUEST_MIC);
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(requestCode, permissions, results);
    if (requestCode != REQUEST_MIC || pendingMic == null) return;
    final PermissionRequest request = pendingMic;
    pendingMic = null;
    // Refused, or refused for good (no dialog at all): the page explains, and
    // offers Android's settings page for the app.
    if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
      request.grant(request.getResources());
    } else {
      request.deny();
    }
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    pendingRoute = routeOf(intent);
    deliverRoute();
  }

  private static String routeOf(Intent intent) {
    final String route = intent == null ? null : intent.getStringExtra(EXTRA_ROUTE);
    return route != null && route.matches("[a-z]{1,16}") ? route : null;
  }

  /** Hands a screen request to the page once it can take it. */
  private void deliverRoute() {
    if (!pageReady || pendingRoute == null || webView == null) return;
    final String route = pendingRoute;
    pendingRoute = null;
    webView.evaluateJavascript("window.__glow && window.__glow.route && window.__glow.route('" + route + "')", null);
  }

  /**
   * From targetSdk 35 Android draws every app edge to edge, and from 36 there
   * is no opting out. The page is padded clear of the bars (and of the
   * keyboard, which edge to edge no longer resizes the window for) while the
   * bars themselves show the page's own colour.
   */
  private void goEdgeToEdge() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      getWindow().setDecorFitsSystemWindows(false);
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
      }
    }
    root.setOnApplyWindowInsetsListener((view, insets) -> {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        final Insets bars = insets.getInsets(
            WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
        final Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
        view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
        return WindowInsets.CONSUMED;
      }
      view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
          insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
      return insets;
    });
  }

  /**
   * Back closes whatever the page has open first — a dialog, the chat, a tab
   * other than Today — and only then leaves. From Android 16 the old
   * onBackPressed() is no longer called for apps that target it, so the
   * callback route is registered wherever it exists.
   */
  private void registerBack() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
          OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
    }
  }

  @Override
  @SuppressWarnings("deprecation")
  public void onBackPressed() {
    handleBack();      // only reached before Android 13
  }

  private void handleBack() {
    if (webView == null) {
      finish();
      return;
    }
    webView.evaluateJavascript(
        "(window.__glow && window.__glow.back) ? window.__glow.back() : 'exit'",
        value -> {
          // Like any launcher app since Android 12: leave without finishing,
          // so coming back is instant and keeps the page as it was.
          if (value == null || value.contains("exit")) moveTaskToBack(true);
        });
  }

  /** The page's window onto the native shell. */
  private class ShellBridge {

    /** The launch screen has left; scrolling may show its bar again. */
    @JavascriptInterface
    public void splashDone() {
      runOnUiThread(() -> {
        if (webView != null) webView.setVerticalScrollBarEnabled(true);
      });
    }

    /** Called after every save so the widget and alarms have current data. */
    @JavascriptInterface
    public void syncState(String json) {
      if (json == null) return;
      GlowStore.writeSnapshot(MainActivity.this, json);
      GlowWidgetProvider.refresh(MainActivity.this);
      ReminderScheduler.rescheduleAll(MainActivity.this);
      ReminderNotifier.clearDone(MainActivity.this);
    }

    /** Asked for the first time the user sets a reminder or picks a character, not at launch. */
    @JavascriptInterface
    public void requestNotificationPermission() {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
      if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
          == PackageManager.PERMISSION_GRANTED) return;
      runOnUiThread(() ->
          requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST_NOTIFICATIONS));
    }

    /** False when Android would hide the reminders: app notifications or the character channel off. */
    @JavascriptInterface
    public boolean notificationsEnabled() {
      final NotificationManager manager =
          (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
      if (manager == null || !manager.areNotificationsEnabled()) return false;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        final NotificationChannel channel = manager.getNotificationChannel(ReminderNotifier.CHANNEL_CAST);
        if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
      }
      return true;
    }

    @JavascriptInterface
    public void openNotificationSettings() {
      final Intent intent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
          ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
              .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())
          : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
              Uri.parse("package:" + getPackageName()));
      openSettings(intent);
    }

    /** "granted" or "denied": whether reminders can be on the minute. */
    @JavascriptInterface
    public String exactAlarmState() {
      return ReminderScheduler.exactState(MainActivity.this);
    }

    @JavascriptInterface
    public void openExactAlarmSettings() {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;
      openSettings(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
          Uri.parse("package:" + getPackageName())));
    }

    /** Sends one reminder now, from the page's settings, so it can be tried out. */
    @JavascriptInterface
    public void testReminder(String json) {
      try {
        ReminderNotifier.test(MainActivity.this, new JSONObject(json));
      } catch (JSONException malformed) {
        // Nothing to send.
      }
    }

    /** Keeps a voice note the user recorded: `base64` is the WebM file, `id` its name. */
    @JavascriptInterface
    public boolean saveVoiceNote(String id, String base64) {
      return OwnNotes.save(MainActivity.this, id, base64);
    }

    @JavascriptInterface
    public void deleteVoiceNote(String id) {
      OwnNotes.delete(MainActivity.this, id);
    }

    /** The ids of every recorded note on the phone, as a JSON array. */
    @JavascriptInterface
    public String listVoiceNotes() {
      return OwnNotes.list(MainActivity.this);
    }

    /** Android's page for this app, where a permission refused for good can still be given. */
    @JavascriptInterface
    public void openAppSettings() {
      openSettings(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          Uri.parse("package:" + getPackageName())));
    }

    /** Hands over ticks made from the widget or a notification, and clears them. */
    @JavascriptInterface
    public String takePending() {
      return GlowStore.takePending(MainActivity.this);
    }

    /** Hands over messages the characters sent, and replies made from notifications. */
    @JavascriptInterface
    public String takeInbox() {
      return GlowStore.takeInbox(MainActivity.this);
    }

    @JavascriptInterface
    public void setBackgroundColor(final String css) {
      if (css == null) return;
      final Matcher match = RGB.matcher(css);
      if (!match.find()) return;
      final int red = Integer.parseInt(match.group(1));
      final int green = Integer.parseInt(match.group(2));
      final int blue = Integer.parseInt(match.group(3));
      final int color = 0xFF000000 | (red << 16) | (green << 8) | blue;
      // Dark icons on a light page, light icons on a dark one.
      final boolean lightPage = (0.299 * red + 0.587 * green + 0.114 * blue) > 150;
      runOnUiThread(() -> {
        root.setBackgroundColor(color);
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(color));
        tintBars(lightPage, color);
      });
    }
  }

  private void openSettings(Intent intent) {
    try {
      startActivity(intent);
    } catch (ActivityNotFoundException missing) {
      startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          Uri.parse("package:" + getPackageName())));
    }
  }

  /**
   * Edge to edge, the bars are transparent over the page's colour and only
   * their icons need to follow it. Before Android 11 the bars are painted
   * the page's colour instead.
   */
  @SuppressWarnings("deprecation")
  private void tintBars(boolean lightPage, int color) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      final WindowInsetsController controller = getWindow().getInsetsController();
      if (controller == null) return;
      final int both = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
          | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
      controller.setSystemBarsAppearance(lightPage ? both : 0, both);
      return;
    }
    final View decor = getWindow().getDecorView();
    int light = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) light |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
    final int flags = decor.getSystemUiVisibility();
    decor.setSystemUiVisibility(lightPage ? (flags | light) : (flags & ~light));
    getWindow().setStatusBarColor(color);
    getWindow().setNavigationBarColor(color);
  }

  private boolean isOurs(Uri uri) {
    return uri != null && ORIGIN.equals(uri.getScheme() + "://" + uri.getAuthority());
  }

  /** Answers a request from the APK's assets, or null to let it proceed normally. */
  private WebResourceResponse serve(Uri uri) {
    if (!isOurs(uri)) return null;

    String path = uri.getPath();
    if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
    if (path.contains("..")) return notFound();

    Map<String, String> headers = new HashMap<>();
    headers.put("Cache-Control", "no-cache");

    // The user's own recordings come from the app's private storage, not the APK.
    if (OwnNotes.idOf(path.substring(1)) != null) {
      final File note = OwnNotes.existing(this, path.substring(1));
      if (note == null) return notFound();
      try {
        return new WebResourceResponse(OwnNotes.mimeOf(path), null, 200, "OK", headers, new FileInputStream(note));
      } catch (FileNotFoundException gone) {
        return notFound();
      }
    }

    try {
      InputStream stream = getAssets().open(ASSET_ROOT + path);
      return new WebResourceResponse(mimeOf(path), "utf-8", 200, "OK", headers, stream);
    } catch (IOException missing) {
      return notFound();
    }
  }

  private WebResourceResponse notFound() {
    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
        new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
  }

  private static String mimeOf(String path) {
    if (path.endsWith(".html")) return "text/html";
    if (path.endsWith(".js")) return "text/javascript";
    if (path.endsWith(".css")) return "text/css";
    if (path.endsWith(".webmanifest")) return "application/manifest+json";
    if (path.endsWith(".json")) return "application/json";
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".svg")) return "image/svg+xml";
    if (path.endsWith(".webm")) return "audio/webm";
    return "application/octet-stream";
  }

  /** Called by receivers when something changed natively while the app may be on screen. */
  static void pokePage() {
    final MainActivity activity = resumed.get();
    if (activity == null) return;
    activity.runOnUiThread(() -> {
      if (activity.webView != null && activity.pageReady) activity.webView.evaluateJavascript(POKE, null);
    });
  }

  @Override
  protected void onResume() {
    super.onResume();
    resumed = new WeakReference<>(this);
    if (webView != null && pageReady) webView.evaluateJavascript(POKE, null);
  }

  @Override
  protected void onPause() {
    if (resumed.get() == this) resumed = new WeakReference<>(null);
    super.onPause();
  }

  @Override
  protected void onSaveInstanceState(Bundle outState) {
    super.onSaveInstanceState(outState);
    webView.saveState(outState);
  }

  @Override
  protected void onDestroy() {
    if (webView != null) webView.destroy();
    super.onDestroy();
  }
}
