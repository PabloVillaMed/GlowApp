package com.pablo.glowapp;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * One day as the widget and the reminders see it: which habits are due, how
 * far along each one is, and its streak — all worked out from the snapshot for
 * a date the device clock chose.
 */
final class GlowDay {

  /** A habit due on this day. */
  static final class Habit {
    String id;
    String name;
    String emoji;
    String unit;
    int color;
    int target;
    int value;
    boolean quantity;
    /** Days for a daily habit, whole weeks for one with a weekly quota. */
    int streak;
    boolean streakInWeeks;

    boolean done() {
      return value >= target;
    }
  }

  enum State { READY, NO_DATA, STALE }

  final String date;
  final State state;
  final List<Habit> due;
  /** Strings the page sent in the app's language; empty when there is no snapshot. */
  final JSONObject ui;
  final String lang;

  private GlowDay(String date, State state, List<Habit> due, JSONObject ui, String lang) {
    this.date = date;
    this.state = state;
    this.due = due;
    this.ui = ui;
    this.lang = lang;
  }

  int doneCount() {
    int done = 0;
    for (Habit habit : due) if (habit.done()) done++;
    return done;
  }

  String ui(String key, String fallback) {
    final String value = ui.optString(key, "");
    return value.isEmpty() ? fallback : value;
  }

  static GlowDay load(Context context, String date) {
    return from(GlowStore.readSnapshot(context), date);
  }

  static GlowDay from(JSONObject snapshot, String date) {
    final List<Habit> none = Collections.emptyList();
    if (!GlowStore.isCurrent(snapshot)) {
      return new GlowDay(date, State.NO_DATA, none, new JSONObject(), "es");
    }
    final JSONObject ui = snapshot.optJSONObject("ui") == null ? new JSONObject() : snapshot.optJSONObject("ui");
    final String lang = snapshot.optString("lang", "es");
    final JSONObject day = GlowStore.dayOf(snapshot, date);
    if (day == null) return new GlowDay(date, State.STALE, none, ui, lang);

    final JSONArray dueIds = day.optJSONArray("due");
    final JSONObject values = day.optJSONObject("values");
    final JSONArray habits = snapshot.optJSONArray("habits");
    final List<Habit> due = new ArrayList<>();
    if (dueIds != null && habits != null) {
      // In the app's own order, which is the order of the habits array.
      for (int i = 0; i < habits.length(); i++) {
        final JSONObject h = habits.optJSONObject(i);
        if (h == null || !contains(dueIds, h.optString("id"))) continue;
        final Habit habit = new Habit();
        habit.id = h.optString("id");
        habit.name = h.optString("name");
        habit.emoji = h.optString("emoji", "✅");
        habit.unit = h.optString("unit");
        habit.color = h.optInt("color", 1);
        habit.target = Math.max(1, h.optInt("target", 1));
        habit.quantity = "quantity".equals(h.optString("type"));
        habit.value = values == null ? 0 : values.optInt(habit.id);
        habit.streakInWeeks = h.optInt("weekly") > 0;
        habit.streak = streak(snapshot, h, date);
        due.add(habit);
      }
    }
    return new GlowDay(date, State.READY, due, ui, lang);
  }

  /**
   * Carries the page's streak on from the day it was synced to `today`.
   *
   * The page sends `base`: the streak as it stood the evening before the sync.
   * Every day since is in the snapshot, ticks from the widget included, so the
   * rest can be counted here with the page's own rules — a missed day that was
   * due breaks it, today never does, and a weekly quota counts whole weeks.
   */
  static int streak(JSONObject snapshot, JSONObject habit, String today) {
    final JSONObject days = snapshot.optJSONObject("days");
    final String generated = snapshot.optString("generated", today);
    final String id = habit.optString("id");
    final int target = Math.max(1, habit.optInt("target", 1));
    final int base = habit.optInt("base");
    final int weekly = habit.optInt("weekly");
    if (days == null || today.compareTo(generated) < 0) return base;   // the clock went back

    if (weekly <= 0) {
      int count = 0;
      for (String d = today; d.compareTo(generated) >= 0; d = GlowStore.addDays(d, -1)) {
        final JSONObject day = days.optJSONObject(d);
        if (day == null) return count;
        if (!contains(day.optJSONArray("due"), id)) continue;
        if (valueOf(day, id) >= target) count++;
        else if (!d.equals(today)) return count;           // a past day that was missed
      }
      return count + base;
    }

    final int weekStart = snapshot.optInt("weekStart", 1);
    final String thisWeek = GlowStore.weekStartOf(today, weekStart);
    final String firstWeek = GlowStore.weekStartOf(generated, weekStart);
    int count = 0;
    for (String week = thisWeek; week.compareTo(firstWeek) >= 0; week = GlowStore.addDays(week, -7)) {
      int done = 0;
      for (int i = 0; i < 7; i++) {
        final String d = GlowStore.addDays(week, i);
        if (d.compareTo(today) > 0) break;
        final JSONObject day = days.optJSONObject(d);
        if (day != null && valueOf(day, id) >= target) done++;
      }
      if (done >= weekly) count++;
      else if (!week.equals(thisWeek)) return count;         // the week in progress can still make it
    }
    return count + base;
  }

  private static int valueOf(JSONObject day, String id) {
    final JSONObject values = day.optJSONObject("values");
    return values == null ? 0 : values.optInt(id);
  }

  private static boolean contains(JSONArray list, String id) {
    if (list == null || id == null) return false;
    for (int i = 0; i < list.length(); i++) {
      if (id.equals(list.optString(i))) return true;
    }
    return false;
  }

  Habit find(String habitId) {
    for (Habit habit : due) if (habit.id.equals(habitId)) return habit;
    return null;
  }
}
