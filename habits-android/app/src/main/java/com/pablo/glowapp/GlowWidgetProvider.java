package com.pablo.glowapp;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * Home-screen widget for today: a progress ring, then one row per habit due.
 * Tapping a habit's name opens the app; tapping its circle ticks it (or adds
 * one unit to a counted habit) without opening anything.
 *
 * Rows are plain nested views rather than a scrolling list. A list gives every
 * row a single click template, which cannot both open an activity and send a
 * broadcast; separate rows can, each with its own intents. The widget shows as
 * many rows as its height allows and says how many more there are.
 *
 * "Today" always comes from the device clock (see GlowStore), and an alarm
 * redraws the widget just after midnight.
 */
public class GlowWidgetProvider extends AppWidgetProvider {

  /* Layout budget, in dp, mirrored from widget_today.xml and widget_row.xml. */
  private static final int PADDING = 24;
  private static final int HEADER = 54;
  private static final int ROW = 50;
  private static final int MORE_LINE = 22;
  private static final int MAX_ROWS = 8;

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
    refresh(context);
  }

  @Override
  public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int widgetId, Bundle options) {
    // Resized: the number of rows that fit has changed.
    manager.updateAppWidget(widgetId, buildViews(context, widgetId, GlowStore.today(), heightOf(manager, widgetId)));
  }

  @Override
  public void onDisabled(Context context) {
    final AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (alarms != null) alarms.cancel(midnightIntent(context));
  }

  /** Redraws every placed widget; called after any change to the snapshot. */
  static void refresh(Context context) {
    final AppWidgetManager manager = AppWidgetManager.getInstance(context);
    final int[] ids = manager.getAppWidgetIds(new ComponentName(context, GlowWidgetProvider.class));
    if (ids == null || ids.length == 0) return;
    final String today = GlowStore.today();
    for (int id : ids) {
      manager.updateAppWidget(id, buildViews(context, id, today, heightOf(manager, id)));
    }
    scheduleMidnight(context);
  }

  /** The height the launcher gives the widget in portrait, or a sensible guess. */
  private static int heightOf(AppWidgetManager manager, int widgetId) {
    final Bundle options = manager.getAppWidgetOptions(widgetId);
    final int height = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
    return height > 0 ? height : 180;
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

  static RemoteViews buildViews(Context context, int widgetId, String date, int heightDp) {
    final RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
    final GlowDay day = GlowDay.load(context, date);

    views.setOnClickPendingIntent(R.id.w_header, openApp(context, "today"));
    views.removeAllViews(R.id.w_rows);
    views.setViewVisibility(R.id.w_more, View.GONE);
    views.setViewVisibility(R.id.w_message, View.GONE);
    views.setViewVisibility(R.id.w_streak, View.GONE);

    final int dueCount = day.due.size();
    final int doneCount = day.doneCount();
    final float fraction = dueCount == 0 ? 0f : doneCount / (float) dueCount;
    views.setImageViewBitmap(R.id.w_ring, WidgetArt.dayRing(context, 50, fraction));
    views.setTextViewText(R.id.w_pct, dueCount == 0 ? "—" : Math.round(fraction * 100) + "%");

    if (day.state == GlowDay.State.NO_DATA) {
      views.setTextViewText(R.id.w_title, context.getString(R.string.app_name));
      views.setTextViewText(R.id.w_sub, "");
      showMessage(views, context.getString(R.string.widget_empty));
      return views;
    }

    views.setTextViewText(R.id.w_title, day.ui("today", "Hoy") + " · " + dayLabel(date, day.lang));
    if (day.state == GlowDay.State.STALE) {
      views.setTextViewText(R.id.w_sub, "");
      showMessage(views, day.ui("stale", context.getString(R.string.widget_empty)));
      return views;
    }
    if (dueCount == 0) {
      views.setTextViewText(R.id.w_sub, "");
      showMessage(views, day.ui("free", ""));
      return views;
    }

    views.setTextViewText(R.id.w_sub, progressLine(day, doneCount, dueCount));
    final int best = bestDailyStreak(day);
    if (best > 0) {
      views.setViewVisibility(R.id.w_streak, View.VISIBLE);
      views.setTextViewText(R.id.w_streak, "🔥 " + best);
    }

    // As many rows as fit. When some must be left out, the open ones come
    // first: a widget is for ticking things off, not admiring what is done.
    int capacity = Math.max(0, (heightDp - PADDING - HEADER) / ROW);
    if (capacity < dueCount) capacity = Math.max(0, (heightDp - PADDING - HEADER - MORE_LINE) / ROW);
    capacity = Math.min(capacity, MAX_ROWS);
    final List<GlowDay.Habit> shown = new ArrayList<>(day.due);
    if (shown.size() > capacity) {
      final List<GlowDay.Habit> open = new ArrayList<>();
      final List<GlowDay.Habit> closed = new ArrayList<>();
      for (GlowDay.Habit habit : shown) (habit.done() ? closed : open).add(habit);
      shown.clear();
      shown.addAll(open);
      shown.addAll(closed);
    }
    final int count = Math.min(capacity, shown.size());
    for (int i = 0; i < count; i++) {
      views.addView(R.id.w_rows, row(context, day, shown.get(i)));
    }
    if (count < dueCount) {
      views.setViewVisibility(R.id.w_more, View.VISIBLE);
      views.setTextViewText(R.id.w_more, day.ui("more", "+%d").replace("%d", String.valueOf(dueCount - count)));
      views.setOnClickPendingIntent(R.id.w_more, openApp(context, "today"));
    }
    return views;
  }

  private static void showMessage(RemoteViews views, String message) {
    views.setViewVisibility(R.id.w_message, View.VISIBLE);
    views.setTextViewText(R.id.w_message, message);
  }

  private static RemoteViews row(Context context, GlowDay day, GlowDay.Habit habit) {
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
    if (habit.done()) {
      row.setImageViewResource(R.id.r_check, R.drawable.widget_check_done);
      row.setFloat(R.id.r_name, "setAlpha", 0.62f);
      row.setFloat(R.id.r_meta, "setAlpha", 0.62f);
    } else {
      row.setImageViewResource(R.id.r_check,
          habit.quantity ? R.drawable.widget_check_plus : R.drawable.widget_check_ring);
      row.setInt(R.id.r_check, "setColorFilter", color);
    }
    final String label = habit.done() ? day.ui("isDone", "%s ✓")
        : habit.quantity ? day.ui("addOne", "+1 %s") : day.ui("mark", "%s");
    row.setContentDescription(R.id.r_check, label.replace("%s", habit.name));

    row.setOnClickPendingIntent(R.id.r_open, openApp(context, "today"));
    row.setOnClickPendingIntent(R.id.r_check, tapIntent(context, habit.id));
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
    final String[] fallback = { "", "", "", "", "" };
    final org.json.JSONArray phrases = day.ui.optJSONArray("progress");
    final int step = done >= due ? 4 : done == 0 ? 0 : done * 2 < due ? 1 : done * 4 < due * 3 ? 2 : 3;
    final String phrase = phrases != null && phrases.length() == 5 ? phrases.optString(step) : fallback[step];
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
    final Intent intent = new Intent(context, MainActivity.class)
        .setAction(Intent.ACTION_MAIN)
        .addCategory(Intent.CATEGORY_LAUNCHER)
        .putExtra(MainActivity.EXTRA_ROUTE, route)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    return PendingIntent.getActivity(context, route.hashCode(), intent, ReminderScheduler.flags());
  }

  private static PendingIntent tapIntent(Context context, String habitId) {
    final Intent intent = new Intent(context, WidgetActionReceiver.class)
        .setAction(WidgetActionReceiver.ACTION_TAP)
        .setData(Uri.parse("glowapp://tap/" + Uri.encode(habitId)))
        .putExtra(WidgetActionReceiver.EXTRA_HABIT_ID, habitId);
    return PendingIntent.getBroadcast(context, 0, intent, ReminderScheduler.flags());
  }
}
