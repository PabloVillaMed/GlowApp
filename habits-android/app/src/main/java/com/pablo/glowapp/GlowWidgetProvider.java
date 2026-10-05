package com.pablo.glowapp;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * Home-screen widget for today: a progress ring that stays at the top, and a
 * scrolling list with every habit due, however small the widget is. Tapping
 * a habit's circle ticks it (or adds one unit to a counted habit) without
 * opening anything; tapping its name opens the app.
 *
 * A list item cannot carry PendingIntents of its own, only "fill-ins" for one
 * shared template, so both taps go to WidgetActionReceiver, which tells them
 * apart. The header is outside the list and opens the app directly.
 *
 * "Today" always comes from the device clock (see GlowStore), and an alarm
 * redraws the widget just after midnight.
 */
public class GlowWidgetProvider extends AppWidgetProvider {

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
    refresh(context);
  }

  @Override
  public void onDisabled(Context context) {
    final AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (alarms != null) alarms.cancel(midnightIntent(context));
  }

  /** Redraws every placed widget; called after any change to the snapshot. */
  @SuppressWarnings("deprecation")
  static void refresh(Context context) {
    final AppWidgetManager manager = AppWidgetManager.getInstance(context);
    final int[] ids = manager.getAppWidgetIds(new ComponentName(context, GlowWidgetProvider.class));
    if (ids == null || ids.length == 0) return;
    final String today = GlowStore.today();
    for (int id : ids) manager.updateAppWidget(id, buildViews(context, id, today));
    // The rows come from GlowWidgetService; this makes it read them again.
    manager.notifyAppWidgetViewDataChanged(ids, R.id.w_list);
    scheduleMidnight(context);
  }

  /**
   * A widget left alone over midnight must turn the page by itself. A
   * non-waking alarm is enough: if the phone sleeps through midnight, the
   * redraw happens the moment the screen comes back on, before anyone looks.
   */
  private static void scheduleMidnight(Context context) {
    final AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (alarms == null) return;
    final Calendar next = Calendar.getInstance();
    next.add(Calendar.DAY_OF_MONTH, 1);
    next.set(Calendar.HOUR_OF_DAY, 0);
    next.set(Calendar.MINUTE, 0);
    next.set(Calendar.SECOND, 5);
    next.set(Calendar.MILLISECOND, 0);
    alarms.setWindow(AlarmManager.RTC, next.getTimeInMillis(), 10 * 60_000L, midnightIntent(context));
  }

  private static PendingIntent midnightIntent(Context context) {
    final Intent intent = new Intent(context, WidgetActionReceiver.class)
        .setAction(WidgetActionReceiver.ACTION_MIDNIGHT);
    return PendingIntent.getBroadcast(context, 0, intent, ReminderScheduler.flags());
  }

  /** The header and the list for one widget, as of `date`. */
  @SuppressWarnings("deprecation")
  static RemoteViews buildViews(Context context, int widgetId, String date) {
    final RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
    final GlowDay day = GlowDay.load(context, date);

    views.setOnClickPendingIntent(R.id.w_header, openApp(context, "today"));
    views.setViewVisibility(R.id.w_streak, View.GONE);

    // The rows. One service intent per widget and day: the system keeps one
    // list adapter per distinct intent, so a new day starts a fresh one.
    final Intent rows = new Intent(context, GlowWidgetService.class)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        .putExtra(GlowWidgetService.EXTRA_DATE, date)
        .setData(Uri.parse("glowapp://widget/" + widgetId + "/" + date));
    views.setRemoteAdapter(R.id.w_list, rows);
    views.setEmptyView(R.id.w_list, R.id.w_message);
    views.setPendingIntentTemplate(R.id.w_list, rowTemplate(context));

    final int dueCount = day.due.size();
    final int doneCount = day.doneCount();
    final float fraction = dueCount == 0 ? 0f : doneCount / (float) dueCount;
    views.setImageViewBitmap(R.id.w_ring, WidgetArt.dayRing(context, 50, fraction));
    views.setTextViewText(R.id.w_pct, dueCount == 0 ? "—" : Math.round(fraction * 100) + "%");

    if (day.state == GlowDay.State.NO_DATA) {
      views.setTextViewText(R.id.w_title, context.getString(R.string.app_name));
      views.setTextViewText(R.id.w_sub, "");
      views.setTextViewText(R.id.w_message, context.getString(R.string.widget_empty));
      return views;
    }

    views.setTextViewText(R.id.w_title, day.ui("today", "Hoy") + " · " + dayLabel(date, day.lang));
    if (day.state == GlowDay.State.STALE) {
      views.setTextViewText(R.id.w_sub, "");
      views.setTextViewText(R.id.w_message, day.ui("stale", context.getString(R.string.widget_empty)));
      return views;
    }
    if (dueCount == 0) {
      views.setTextViewText(R.id.w_sub, "");
      views.setTextViewText(R.id.w_message, day.ui("free", ""));
      return views;
    }

    views.setTextViewText(R.id.w_sub, progressLine(day, doneCount, dueCount));
    final int best = bestDailyStreak(day);
    if (best > 0) {
      views.setViewVisibility(R.id.w_streak, View.VISIBLE);
      views.setTextViewText(R.id.w_streak, "🔥 " + best);
    }
    return views;
  }

  /** One habit's row, for GlowWidgetService. */
  static RemoteViews row(Context context, GlowDay day, GlowDay.Habit habit) {
    final RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.widget_row);
    final int color = WidgetArt.habitColor(habit.color);

    row.setTextViewText(R.id.r_emoji, habit.emoji);
    row.setInt(R.id.r_badge, "setColorFilter", color);
    row.setTextViewText(R.id.r_name, habit.name);

    // Second line: the count for a counted habit, then the streak.
    final StringBuilder meta = new StringBuilder();
    if (habit.quantity) {
      meta.append(habit.value).append('/').append(habit.target);
      if (!habit.unit.isEmpty()) meta.append(' ').append(habit.unit);
      row.setViewVisibility(R.id.r_bar, View.VISIBLE);
      row.setProgressBar(R.id.r_bar, 100, Math.min(100, Math.round(habit.value * 100f / habit.target)), false);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        row.setColorStateList(R.id.r_bar, "setProgressTintList",
            ColorStateList.valueOf(habit.done() ? WidgetArt.GOOD : color));
      }
    } else {
      row.setViewVisibility(R.id.r_bar, View.GONE);
    }
    if (habit.streak > 0) {
      if (meta.length() > 0) meta.append("  ·  ");
      meta.append("🔥 ").append(streakLabel(day, habit));
    }
    row.setTextViewText(R.id.r_meta, meta.toString());
    row.setViewVisibility(R.id.r_meta, meta.length() == 0 ? View.GONE : View.VISIBLE);

    // The circle: done, add one, or tick. A finished habit steps back a little.
    // The list recycles its rows, and a recycled row keeps whatever the last
    // habit drawn in it set, so both states set everything either one
    // changes: an unticked habit's colour filter left on a done circle
    // painted out its tick.
    final boolean done = habit.done();
    row.setImageViewResource(R.id.r_check, done ? R.drawable.widget_check_done
        : habit.quantity ? R.drawable.widget_check_plus : R.drawable.widget_check_ring);
    row.setInt(R.id.r_check, "setColorFilter", done ? Color.TRANSPARENT : color);   // transparent: drawn as is
    row.setFloat(R.id.r_name, "setAlpha", done ? 0.62f : 1f);
    row.setFloat(R.id.r_meta, "setAlpha", done ? 0.62f : 1f);
    final String label = done ? day.ui("isDone", "%s ✓")
        : habit.quantity ? day.ui("addOne", "+1 %s") : day.ui("mark", "%s");
    row.setContentDescription(R.id.r_check, label.replace("%s", habit.name));

    // Fill-ins for the list's shared template: which habit, and which tap.
    row.setOnClickFillInIntent(R.id.r_open, new Intent()
        .putExtra(WidgetActionReceiver.EXTRA_HABIT_ID, habit.id)
        .putExtra(WidgetActionReceiver.EXTRA_OP, WidgetActionReceiver.OP_OPEN));
    row.setOnClickFillInIntent(R.id.r_check, new Intent()
        .putExtra(WidgetActionReceiver.EXTRA_HABIT_ID, habit.id)
        .putExtra(WidgetActionReceiver.EXTRA_OP, WidgetActionReceiver.OP_TICK));
    return row;
  }

  private static String streakLabel(GlowDay day, GlowDay.Habit habit) {
    final String one = habit.streakInWeeks ? day.ui("week1", "1") : day.ui("day1", "1");
    final String many = habit.streakInWeeks ? day.ui("weekN", "%d") : day.ui("dayN", "%d");
    return habit.streak == 1 ? one : many.replace("%d", String.valueOf(habit.streak));
  }

  private static int bestDailyStreak(GlowDay day) {
    int best = 0;
    for (GlowDay.Habit habit : day.due) {
      if (!habit.streakInWeeks) best = Math.max(best, habit.streak);
    }
    return best;
  }

  /** "Vas muy bien · 3/5", with the phrase stepping up as the day fills. */
  private static String progressLine(GlowDay day, int done, int due) {
    final org.json.JSONArray phrases = day.ui.optJSONArray("progress");
    final int step = done >= due ? 4 : done == 0 ? 0 : done * 2 < due ? 1 : done * 4 < due * 3 ? 2 : 3;
    final String phrase = phrases != null && phrases.length() == 5 ? phrases.optString(step) : "";
    return (phrase.isEmpty() ? "" : phrase + "  ·  ") + done + "/" + due;
  }

  /** "domingo 4" or "Sunday 4", in the app's language. */
  private static String dayLabel(String date, String lang) {
    final SimpleDateFormat format = new SimpleDateFormat("EEEE d", new Locale(lang));
    return format.format(GlowStore.parseKey(date).getTime());
  }

  /**
   * Opens the app, optionally on a screen ("chat"). The intent is the
   * launcher's own MAIN/LAUNCHER one with the screen as an extra, so it still
   * matches the activity's intent filter on systems that insist explicit
   * intents do; the request code keeps one per screen.
   */
  static PendingIntent openApp(Context context, String route) {
    return PendingIntent.getActivity(context, route.hashCode(), openIntent(context, route),
        ReminderScheduler.flags());
  }

  static Intent openIntent(Context context, String route) {
    return new Intent(context, MainActivity.class)
        .setAction(Intent.ACTION_MAIN)
        .addCategory(Intent.CATEGORY_LAUNCHER)
        .putExtra(MainActivity.EXTRA_ROUTE, route)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
  }

  /**
   * The list's shared click target. It has to be mutable so each row can add
   * its habit and its tap; it names its receiver explicitly, which is what
   * keeps a mutable PendingIntent from being pointed anywhere else.
   */
  private static PendingIntent rowTemplate(Context context) {
    final Intent intent = new Intent(context, WidgetActionReceiver.class)
        .setAction(WidgetActionReceiver.ACTION_ROW);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
    return PendingIntent.getBroadcast(context, 0, intent, flags);
  }
}
