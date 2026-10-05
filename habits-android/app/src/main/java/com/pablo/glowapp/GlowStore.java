package com.pablo.glowapp;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * The bridge between the web app's storage and native Android.
 *
 * Habit data lives in the WebView's local storage, which neither the widget nor
 * the alarm receiver can read. The page therefore pushes a snapshot here after
 * every save, and anything done natively is queued back for the page to apply
 * through its own write path the next time it runs.
 *
 * The snapshot covers the current week and two weeks ahead, and the date always
 * comes from the device clock, never from the snapshot: a widget that took
 * "today" from the last sync kept showing yesterday after midnight.
 *
 * Every method that reads and rewrites a record is synchronized: the widget,
 * the alarm receiver and the page's bridge thread can all arrive at once.
 */
final class GlowStore {

  private static final String PREFS = "glow_shell";
  private static final String KEY_SNAPSHOT = "snapshot";
  private static final String KEY_PENDING = "pending";
  private static final String KEY_INBOX = "inbox";
  private static final String KEY_SCHEDULED = "scheduled_reminders";
  private static final String KEY_FIRED = "reminders_fired";

  /** The page drains the inbox on every resume; this only bounds a long absence. */
  private static final int INBOX_LIMIT = 80;

  private GlowStore() { }

  private static SharedPreferences prefs(Context context) {
    return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  /* ── Snapshot, written by the page ── */

  static synchronized void writeSnapshot(Context context, String json) {
    prefs(context).edit().putString(KEY_SNAPSHOT, json).apply();
  }

  static synchronized JSONObject readSnapshot(Context context) {
    final String raw = prefs(context).getString(KEY_SNAPSHOT, null);
    if (raw == null) return null;
    try {
      return new JSONObject(raw);
    } catch (JSONException malformed) {
      return null;
    }
  }

  /** True once the page has sent the current format, with the days ahead. */
  static boolean isCurrent(JSONObject snapshot) {
    return snapshot != null && snapshot.optInt("v") >= 2 && snapshot.optJSONObject("days") != null;
  }

  /* ── Dates, in the page's own format: yyyy-MM-dd, local time ── */

  static String today() {
    return dateKey(Calendar.getInstance());
  }

  static String dateKey(Calendar day) {
    return String.format(Locale.US, "%04d-%02d-%02d",
        day.get(Calendar.YEAR), day.get(Calendar.MONTH) + 1, day.get(Calendar.DAY_OF_MONTH));
  }

  static String dateKey(long millis) {
    final Calendar day = Calendar.getInstance();
    day.setTimeInMillis(millis);
    return dateKey(day);
  }

  /** Noon on that day, so adding days never trips over a daylight-saving change. */
  static Calendar parseKey(String key) {
    final Calendar day = Calendar.getInstance();
    day.clear();
    try {
      day.set(Integer.parseInt(key.substring(0, 4)), Integer.parseInt(key.substring(5, 7)) - 1,
          Integer.parseInt(key.substring(8, 10)), 12, 0, 0);
    } catch (RuntimeException malformed) {
      return Calendar.getInstance();
    }
    return day;
  }

  static String addDays(String key, int days) {
    final Calendar day = parseKey(key);
    day.add(Calendar.DAY_OF_MONTH, days);
    return dateKey(day);
  }

  /** Days since the epoch, for rotating a character's lines from one day to the next. */
  static int dayNumber(String key) {
    return (int) (parseKey(key).getTimeInMillis() / 86_400_000L);
  }

  /** The first day of that week, with weekStart in the page's terms (0 Sunday, 1 Monday). */
  static String weekStartOf(String key, int weekStart) {
    final int dow = parseKey(key).get(Calendar.DAY_OF_WEEK) - 1;   // 0 = Sunday, like getDay()
    return addDays(key, -((dow - weekStart + 7) % 7));
  }

  /* ── Changes made natively ── */

  /**
   * Applies a widget tap to one day of the snapshot so the widget can redraw at
   * once. The queued action is what really counts; this only keeps the screen
   * honest until the app next opens.
   *
   * A counted habit (8 glasses of water) adds one unit per tap rather than
   * jumping to complete: tapping should feel like drinking a glass, not like
   * declaring the day done. Yes/no habits toggle. Returns the action to queue,
   * or null when the tap changes nothing.
   */
  static synchronized String applyTap(Context context, String habitId, String date) {
    final JSONObject snapshot = readSnapshot(context);
    final JSONObject habit = habitById(snapshot, habitId);
    final JSONObject day = dayOf(snapshot, date);
    if (habit == null || day == null) return null;
    try {
      final JSONObject values = valuesOf(day);
      final int target = Math.max(1, habit.optInt("target", 1));
      final int value = values.optInt(habitId);
      final String action;
      if ("quantity".equals(habit.optString("type"))) {
        if (value >= target) return null;            // already full; the app can undo it
        values.put(habitId, value + 1);
        action = "increment";
      } else {
        values.put(habitId, value >= target ? 0 : target);
        action = "toggle";
      }
      writeSnapshot(context, snapshot.toString());
      return action;
    } catch (JSONException ignored) {
      return null;                                   // replaced on the app's next sync
    }
  }

  /** Marks a habit complete on that day, never undoing it. True if anything changed. */
  static synchronized boolean complete(Context context, String habitId, String date) {
    final JSONObject snapshot = readSnapshot(context);
    final JSONObject habit = habitById(snapshot, habitId);
    final JSONObject day = dayOf(snapshot, date);
    if (habit == null || day == null) return false;
    try {
      final JSONObject values = valuesOf(day);
      final int target = Math.max(1, habit.optInt("target", 1));
      if (values.optInt(habitId) >= target) return false;
      values.put(habitId, target);
      writeSnapshot(context, snapshot.toString());
      return true;
    } catch (JSONException ignored) {
      return false;
    }
  }

  static JSONObject habitById(JSONObject snapshot, String habitId) {
    if (snapshot == null || habitId == null) return null;
    final JSONArray habits = snapshot.optJSONArray("habits");
    if (habits == null) return null;
    for (int i = 0; i < habits.length(); i++) {
      final JSONObject habit = habits.optJSONObject(i);
      if (habit != null && habitId.equals(habit.optString("id"))) return habit;
    }
    return null;
  }

  static JSONObject dayOf(JSONObject snapshot, String date) {
    if (!isCurrent(snapshot)) return null;
    return snapshot.optJSONObject("days").optJSONObject(date);
  }

  private static JSONObject valuesOf(JSONObject day) throws JSONException {
    JSONObject values = day.optJSONObject("values");
    if (values == null) {
      values = new JSONObject();
      day.put("values", values);
    }
    return values;
  }

  /* ── Actions taken natively, waiting for the page to apply them ── */

  static synchronized void queueAction(Context context, String habitId, String date, String action) {
    final SharedPreferences store = prefs(context);
    final JSONArray queue = readArray(store, KEY_PENDING);
    try {
      final JSONObject entry = new JSONObject();
      entry.put("habitId", habitId);
      entry.put("date", date);
      entry.put("action", action);
      queue.put(entry);
    } catch (JSONException ignored) {
      return;
    }
    store.edit().putString(KEY_PENDING, queue.toString()).apply();
  }

  /** Returns the queued actions and clears them in the same step. */
  static synchronized String takePending(Context context) {
    final SharedPreferences store = prefs(context);
    final String queued = store.getString(KEY_PENDING, "[]");
    store.edit().remove(KEY_PENDING).apply();
    return queued;
  }

  /* ── Messages for the in-app chat ── */

  /**
   * Keeps a message a character sent, or a reply made from a notification, until
   * the page collects it. Each gets an id so the page can tell a repeat apart.
   */
  static synchronized void addToInbox(Context context, JSONObject item) {
    final SharedPreferences store = prefs(context);
    final JSONArray inbox = readArray(store, KEY_INBOX);
    try {
      if (!item.has("id")) {
        item.put("id", "n" + Long.toString(System.currentTimeMillis(), 36)
            + Integer.toString((int) (Math.random() * 46656), 36));
      }
      if (!item.has("at")) item.put("at", System.currentTimeMillis());
    } catch (JSONException ignored) {
      return;
    }
    inbox.put(item);
    JSONArray kept = inbox;
    if (inbox.length() > INBOX_LIMIT) {
      kept = new JSONArray();
      for (int i = inbox.length() - INBOX_LIMIT; i < inbox.length(); i++) kept.put(inbox.opt(i));
    }
    store.edit().putString(KEY_INBOX, kept.toString()).apply();
  }

  static synchronized String takeInbox(Context context) {
    final SharedPreferences store = prefs(context);
    final String items = store.getString(KEY_INBOX, "[]");
    store.edit().remove(KEY_INBOX).apply();
    return items;
  }

  private static JSONArray readArray(SharedPreferences store, String key) {
    try {
      return new JSONArray(store.getString(key, "[]"));
    } catch (JSONException malformed) {
      return new JSONArray();
    }
  }

  /* ── Bookkeeping ── */

  /** The reminder alarms currently armed, as "habitId@HH:MM", so stale ones can be cancelled. */
  static synchronized Set<String> scheduledKeys(Context context) {
    return new HashSet<>(prefs(context).getStringSet(KEY_SCHEDULED, new HashSet<String>()));
  }

  static synchronized void setScheduledKeys(Context context, Set<String> keys) {
    prefs(context).edit().putStringSet(KEY_SCHEDULED, new HashSet<>(keys)).apply();
  }

  /** Notes that a reminder ("habitId@HH:MM") went off on that day. */
  static synchronized void markFired(Context context, String key, String date) {
    final SharedPreferences store = prefs(context);
    JSONObject fired;
    try {
      fired = new JSONObject(store.getString(KEY_FIRED, "{}"));
    } catch (JSONException malformed) {
      fired = new JSONObject();
    }
    try {
      fired.put(key, date);
    } catch (JSONException ignored) {
      return;
    }
    store.edit().putString(KEY_FIRED, fired.toString()).apply();
  }

  static synchronized String firedOn(Context context, String key) {
    try {
      return new JSONObject(prefs(context).getString(KEY_FIRED, "{}")).optString(key, "");
    } catch (JSONException malformed) {
      return "";
    }
  }

}
