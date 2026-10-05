package com.pablo.glowapp;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import java.io.IOException;

/**
 * Plays a character's voice note straight from the APK, without opening the
 * app: by itself whenever a message arrives, or from a notification's Listen
 * button.
 *
 * A note that plays on arrival is part of the notification, so it plays at
 * the notification volume, right after the notification's own sound. Listen
 * is a request to hear it, so it plays at the media volume, like a voice
 * message in a chat app.
 *
 * It usually runs inside a broadcast receiver that has called goAsync(),
 * which keeps the process alive until finish(); a note is a few seconds long,
 * and a watchdog makes sure the receiver is always released.
 */
final class VoicePlayer {

  private static final long WATCHDOG = 20_000L;
  private static final Handler MAIN = new Handler(Looper.getMainLooper());

  private static MediaPlayer player;
  private static BroadcastReceiver.PendingResult pending;
  private static AudioManager audio;
  private static Object focusRequest;

  private VoicePlayer() { }

  /**
   * Whether a note may play by itself right now. It plays every time a
   * message arrives, except when the phone has been told to keep quiet:
   * ringer on silent or vibrate, a call in progress, Do Not Disturb, or the
   * app's notifications switched off (a voice out of nowhere, with no message
   * to go with it, would only confuse).
   */
  static boolean mayAutoplay(Context context) {
    final AudioManager manager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
    final NotificationManager notifications =
        (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager == null || notifications == null) return false;
    if (manager.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) return false;
    if (manager.getMode() != AudioManager.MODE_NORMAL) return false;
    if (notifications.getCurrentInterruptionFilter() != NotificationManager.INTERRUPTION_FILTER_ALL) return false;
    if (!notifications.areNotificationsEnabled()) return false;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      final NotificationChannel channel = notifications.getNotificationChannel(ReminderNotifier.CHANNEL_CAST);
      if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
    }
    return true;
  }

  /** Plays `voicePath` (e.g. "voices/crack/es/h-water-1.webm") at once, as media. */
  static void play(Context context, String voicePath, BroadcastReceiver.PendingResult result) {
    play(context, voicePath, result, 0, false);
  }

  /**
   * Plays `voicePath` after `delayMs`, as part of a notification or as media;
   * always finishes `result` (which may be null). A note that plays on arrival
   * waits a moment so the notification's own sound is not talked over.
   */
  static synchronized void play(Context context, String voicePath, BroadcastReceiver.PendingResult result,
                                long delayMs, boolean asNotification) {
    stop();
    final String path = ReminderNotifier.validVoice(voicePath);
    if (path == null) {
      finish(result);
      return;
    }
    final Context app = context.getApplicationContext();
    final AudioAttributes attributes = new AudioAttributes.Builder()
        .setUsage(asNotification ? AudioAttributes.USAGE_NOTIFICATION_EVENT : AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build();
    final MediaPlayer media = new MediaPlayer();
    // Voice notes are uncompressed in the APK (see noCompress in build.gradle),
    // which is what lets openFd() hand the player a plain file range.
    try (AssetFileDescriptor file = app.getAssets().openFd(MainActivity.ASSET_ROOT + "/" + path)) {
      media.setAudioAttributes(attributes);
      media.setDataSource(file.getFileDescriptor(), file.getStartOffset(), file.getLength());
    } catch (IOException | RuntimeException unplayable) {
      media.release();
      finish(result);
      return;
    }

    player = media;
    pending = result;
    audio = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
    media.setOnPreparedListener(prepared -> {
      requestFocus(attributes);
      prepared.start();
    });
    media.setOnCompletionListener(done -> stop());
    media.setOnErrorListener((failed, what, extra) -> {
      stop();
      return true;
    });
    MAIN.postDelayed(() -> {
      if (player == media) media.prepareAsync();
    }, delayMs);
    MAIN.postDelayed(VoicePlayer::stop, WATCHDOG + delayMs);
  }

  /** The same, from any thread: the player and its callbacks live on the main one. */
  static void playFromAnyThread(Context context, String voicePath, long delayMs, boolean asNotification) {
    final Context app = context.getApplicationContext();
    MAIN.post(() -> play(app, voicePath, null, delayMs, asNotification));
  }

  static synchronized void stop() {
    MAIN.removeCallbacksAndMessages(null);
    if (player != null) {
      try {
        player.release();
      } catch (RuntimeException ignored) {
        // Already released by an error path.
      }
      player = null;
    }
    abandonFocus();
    finish(pending);
    pending = null;
  }

  /* Music ducks under the note rather than stopping for it. */
  private static void requestFocus(AudioAttributes attributes) {
    if (audio == null) return;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      final AudioFocusRequest request =
          new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
              .setAudioAttributes(attributes)
              .build();
      audio.requestAudioFocus(request);
      focusRequest = request;
    } else {
      requestFocusLegacy(attributes);
    }
  }

  @SuppressWarnings("deprecation")
  private static void requestFocusLegacy(AudioAttributes attributes) {
    final int stream = attributes.getUsage() == AudioAttributes.USAGE_MEDIA
        ? AudioManager.STREAM_MUSIC : AudioManager.STREAM_NOTIFICATION;
    audio.requestAudioFocus(null, stream, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
  }

  private static void abandonFocus() {
    if (audio == null) return;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest instanceof AudioFocusRequest) {
      audio.abandonAudioFocusRequest((AudioFocusRequest) focusRequest);
    } else {
      abandonFocusLegacy();
    }
    focusRequest = null;
    audio = null;
  }

  @SuppressWarnings("deprecation")
  private static void abandonFocusLegacy() {
    audio.abandonAudioFocus(null);
  }

  private static void finish(BroadcastReceiver.PendingResult result) {
    if (result == null) return;
    try {
      result.finish();
    } catch (IllegalStateException alreadyFinished) {
      // Finished once already; nothing to release.
    }
  }
}
