package com.pablo.glowapp;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

/**
 * Arms one alarm per reminder time: a habit can have several ("water at 10,
 * 13 and 16"). Each alarm fires once and the receiver arms the next day's.
 *
 * Exact alarms are used when Android allows them, so a reminder set for 10:00
 * arrives at 10:00. Since Android 14 that needs the user's say-so ("Alarms &
 * reminders"); without it the alarm gets a ten-minute window instead. Until
 * 2.7 these were inexact repeating alarms, which Android may hold back by up
 * to three quarters of their interval — hours, for a daily reminder.
 */
final class ReminderScheduler {

  static final String ACTION_FIRE = "com.pablo.glowapp.REMIND";
  static final String EXTRA_HABIT_ID = "habitId";
  static final String EXTRA_TIME = "time";
  static final String EXTRA_AT = "at";
  /** Only on the alarms 2.7 and earlier set; see cancelLegacy(). */
  static final String EXTRA_HABIT_NAME = "habitName";

  private static final long WINDOW = 10 * 60_000L;

  private ReminderScheduler() { }

  /** Arms every reminder in the snapshot and cancels the ones that are gone. */
  static synchronized void rescheduleAll(Context context) {
    final JSONObject snapshot = GlowStore.readSnapshot(context);
    final Set<String> wanted = new HashSet<>();
    final JSONArray reminders = snapshot == null ? null : snapshot.optJSONArray("reminders");
    if (reminders != null) {
      for (int i = 0; i < reminders.length(); i++) {
        final JSONObject reminder = reminders.optJSONObject(i);
        if (reminder == null) continue;
        final String id = reminder.optString("id");
        final String time = reminder.optString("time");
        if (id.isEmpty() || nextOccurrence(time, System.currentTimeMillis()) < 0) continue;
        wanted.add(id + "@" + time);
        schedule(context, id, time);
      }
    }
    for (String key : GlowStore.scheduledKeys(context)) {
      if (!wanted.contains(key)) cancel(context, key);
    }
    GlowStore.setScheduledKeys(context, wanted);
    cancelLegacy(context, snapshot);
  }

  /**
   * Arms the next occurrence of one reminder time.
   *
   * Re-arming happens on every save in the app, so it must not lose a reminder
   * that is due but not yet delivered: without exact alarms Android may hold
   * one back for up to ten minutes. Inside that window, a time that has not
   * gone off today is armed again for today — a past time, which Android
   * delivers at once — rather than pushed to tomorrow.
   */
  static void schedule(Context context, String habitId, String time) {
    final AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    final long now = System.currentTimeMillis();
    final long todays = occurrenceOn(time, now, 0);
    if (alarms == null || todays < 0) return;
    final long at;
    if (todays > now) {
      at = todays;
    } else if (now - todays < WINDOW + 2 * 60_000L
        && !GlowStore.dateKey(todays).equals(GlowStore.firedOn(context, habitId + "@" + time))) {
      at = todays;                                     // due, not delivered yet
    } else {
      at = occurrenceOn(time, now, 1);
    }
    final PendingIntent pending = fireIntent(context, habitId, time, at);
    try {
      if (canScheduleExact(alarms)) {
        alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
      } else {
        alarms.setWindow(AlarmManager.RTC_WAKEUP, at, WINDOW, pending);
      }
    } catch (SecurityException revoked) {
      // The exact-alarm permission went away between the check and the call.
      alarms.setWindow(AlarmManager.RTC_WAKEUP, at, WINDOW, pending);
    }
  }

  static boolean canScheduleExact(AlarmManager alarms) {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms();
  }

  /** "granted" or "denied", as the page shows it; older Android never asks. */
  static String exactState(Context context) {
    final AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    return alarms == null || canScheduleExact(alarms) ? "granted" : "denied";
  }

  /** Milliseconds of the next "HH:MM" after `now`, or -1 if it is not a time. */
  static long nextOccurrence(String time, long now) {
    final long today = occurrenceOn(time, now, 0);
    return today < 0 || today > now ? today : occurrenceOn(time, now, 1);
  }

  /** "HH:MM" on the day of `now` plus `days`, by the calendar, so DST days come out right. */
  private static long occurrenceOn(String time, long now, int days) {
    if (time == null || !time.matches("([01]\\d|2[0-3]):[0-5]\\d")) return -1;
    final Calendar when = Calendar.getInstance();
    when.setTimeInMillis(now);
    when.add(Calendar.DAY_OF_MONTH, days);
    when.set(Calendar.HOUR_OF_DAY, Integer.parseInt(time.substring(0, 2)));
    when.set(Calendar.MINUTE, Integer.parseInt(time.substring(3, 5)));
    when.set(Calendar.SECOND, 0);
    when.set(Calendar.MILLISECOND, 0);
    return when.getTimeInMillis();
  }

  /** One PendingIntent per habit and time: the data URI keeps them apart. */
  private static PendingIntent fireIntent(Context context, String habitId, String time, long at) {
    final Intent intent = new Intent(context, ReminderReceiver.class)
        .setAction(ACTION_FIRE)
        .setData(Uri.parse("glowapp://remind/" + Uri.encode(habitId) + "/" + time))
        .putExtra(EXTRA_HABIT_ID, habitId)
        .putExtra(EXTRA_TIME, time)
        .putExtra(EXTRA_AT, at);
    return PendingIntent.getBroadcast(context, 0, intent, flags());
  }

  private static void cancel(Context context, String key) {
    final int split = key.lastIndexOf('@');
    if (split <= 0) return;
    final Intent intent = new Intent(context, ReminderReceiver.class)
        .setAction(ACTION_FIRE)
        .setData(Uri.parse("glowapp://remind/" + Uri.encode(key.substring(0, split)) + "/" + key.substring(split + 1)));
    final PendingIntent pending = PendingIntent.getBroadcast(context, 0, intent,
        PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
    if (pending == null) return;
    final AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (alarms != null) alarms.cancel(pending);
    pending.cancel();
  }

  /**
   * 2.7 and earlier armed one repeating alarm per habit, with the habit id's
   * hash as request code and no data URI. Left alone they keep firing beside
   * the new ones, so every habit the snapshot knows has its old alarm removed.
   */
  private static void cancelLegacy(Context context, JSONObject snapshot) {
    if (snapshot == null) return;
    final Set<String> ids = new HashSet<>();
    for (String list : new String[] { "habits", "reminders" }) {
      final JSONArray items = snapshot.optJSONArray(list);
      if (items == null) continue;
      for (int i = 0; i < items.length(); i++) {
        final JSONObject item = items.optJSONObject(i);
        if (item != null && !item.optString("id").isEmpty()) ids.add(item.optString("id"));
      }
    }
    for (String id : ids) cancelLegacy(context, id);
  }

  static void cancelLegacy(Context context, String habitId) {
    final Intent intent = new Intent(context, ReminderReceiver.class).setAction(ACTION_FIRE);
    final PendingIntent pending = PendingIntent.getBroadcast(context, habitId.hashCode(), intent,
        PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
    if (pending == null) return;
    final AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (alarms != null) alarms.cancel(pending);
    pending.cancel();
  }

  static int flags() {
    return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
  }
}
