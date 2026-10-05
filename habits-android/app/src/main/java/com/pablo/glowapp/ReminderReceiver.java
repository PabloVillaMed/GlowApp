package com.pablo.glowapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Fires reminders and answers the notification's buttons: Done records the
 * tick without opening the app, Listen plays the voice note. Ticks are queued
 * for the page to apply; messages are filed for its chat.
 */
public class ReminderReceiver extends BroadcastReceiver {

  static final String ACTION_MARK_DONE = "com.pablo.glowapp.MARK_DONE";
  static final String ACTION_PLAY = "com.pablo.glowapp.PLAY_VOICE";
  static final String EXTRA_VOICE = "voice";
  static final String EXTRA_DATE = "date";
  static final String EXTRA_TEXT = "text";

  /** A reminder delivered this late (the phone was off) would only be noise. */
  private static final long TOO_LATE = 2 * 60 * 60_000L;
  /** Lets the notification's own sound finish before the character speaks. */
  private static final long AUTOPLAY_DELAY = 1500L;

  @Override
  public void onReceive(Context context, Intent intent) {
    final String action = intent.getAction();
    if (ACTION_PLAY.equals(action)) {
      VoicePlayer.play(context, intent.getStringExtra(EXTRA_VOICE), goAsync());
      return;
    }
    final String habitId = intent.getStringExtra(ReminderScheduler.EXTRA_HABIT_ID);
    if (habitId == null) return;

    if (ACTION_MARK_DONE.equals(action)) {
      markDone(context, intent, habitId);
    } else if (ReminderScheduler.ACTION_FIRE.equals(action)) {
      if (intent.getData() == null) fireLegacy(context, intent, habitId);
      else fire(context, intent, habitId);
    }
  }

  private void fire(Context context, Intent intent, String habitId) {
    final String time = intent.getStringExtra(ReminderScheduler.EXTRA_TIME);
    final long at = intent.getLongExtra(ReminderScheduler.EXTRA_AT, System.currentTimeMillis());
    // Tomorrow's alarm first, whatever happens below.
    GlowStore.markFired(context, habitId + "@" + time, GlowStore.dateKey(at));
    ReminderScheduler.schedule(context, habitId, time);
    if (System.currentTimeMillis() - at > TOO_LATE) return;

    final JSONObject snapshot = GlowStore.readSnapshot(context);
    final JSONObject reminder = findReminder(snapshot, habitId, time);
    if (reminder == null) return;                         // removed since it was armed

    // The day the reminder was for, which is not always the day it arrives.
    final String date = GlowStore.dateKey(at);
    final GlowDay day = GlowDay.from(snapshot, date);
    if (day.state == GlowDay.State.READY) {
      final GlowDay.Habit habit = day.find(habitId);
      if (habit == null || habit.done()) return;         // not due that day, or already done
    }

    final String voice = ReminderNotifier.remind(context, habitId, reminder.optString("name"), date,
        pickMessage(reminder.optJSONArray("msgs"), date, reminder.optInt("slot")));
    autoplay(context, snapshot, voice);
  }

  /**
   * An alarm armed by 2.7 or earlier: one per habit, repeating, with no data
   * URI. Once the page has sent the new snapshot those are replaced, so the
   * old one is cancelled; before that it still reminds, so updating the app
   * never loses a reminder.
   */
  private void fireLegacy(Context context, Intent intent, String habitId) {
    if (GlowStore.isCurrent(GlowStore.readSnapshot(context))) {
      ReminderScheduler.cancelLegacy(context, habitId);
      ReminderScheduler.rescheduleAll(context);
      return;
    }
    ReminderNotifier.remind(context, habitId, intent.getStringExtra(ReminderScheduler.EXTRA_HABIT_NAME),
        GlowStore.today(), null);
  }

  private void markDone(Context context, Intent intent, String habitId) {
    if ("test".equals(habitId)) {                       // the settings' sample, tied to no habit
      ReminderNotifier.cancel(context, habitId);
      return;
    }
    final String requested = intent.getStringExtra(EXTRA_DATE);
    final String date = requested == null ? GlowStore.today() : requested;
    GlowStore.complete(context, habitId, date);
    GlowStore.queueAction(context, habitId, date, "complete");
    GlowWidgetProvider.refresh(context);
    final String voice = ReminderNotifier.answerDone(context, habitId, date, intent.getStringExtra(EXTRA_TEXT));
    MainActivity.pokePage();
    autoplay(context, GlowStore.readSnapshot(context), voice);
  }

  private void autoplay(Context context, JSONObject snapshot, String voice) {
    if (!autoplayWanted(snapshot, voice)) return;
    if (!VoicePlayer.mayAutoplay(context)) return;
    VoicePlayer.play(context, voice, goAsync(), AUTOPLAY_DELAY, true);
  }

  private static JSONObject findReminder(JSONObject snapshot, String habitId, String time) {
    final JSONArray reminders = snapshot == null ? null : snapshot.optJSONArray("reminders");
    if (reminders == null) return null;
    for (int i = 0; i < reminders.length(); i++) {
      final JSONObject reminder = reminders.optJSONObject(i);
      if (reminder != null && habitId.equals(reminder.optString("id"))
          && (time == null || time.equals(reminder.optString("time")))) {
        return reminder;
      }
    }
    return null;
  }

  /**
   * On unless the user turned it off. A snapshot written by 2.8 (v2) says off
   * for everyone who never touched the switch, its old default; 2.9 turns
   * the notes on for them, and so does this until the page has run once and
   * sent its own choice.
   */
  static boolean autoplayWanted(JSONObject snapshot, String voice) {
    final JSONObject cast = ReminderNotifier.character(snapshot);
    if (voice == null || cast == null) return false;
    return snapshot.optInt("v") < 3 || cast.optBoolean("autoplay", true);
  }

  /**
   * The page sends several lines per reminder. They take turns by day, and a
   * habit with several times a day (water at 10, 13 and 16) starts each time
   * at a different line, so no two reminders in a day say the same thing.
   */
  private static JSONObject pickMessage(JSONArray messages, String date, int slot) {
    if (messages == null || messages.length() == 0) return null;
    return messages.optJSONObject(Math.floorMod(GlowStore.dayNumber(date) + slot, messages.length()));
  }
}
