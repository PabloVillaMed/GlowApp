package com.pablo.glowapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Handles taps on the widget's circles, and the redraw just after midnight.
 *
 * Kept apart from GlowWidgetProvider on purpose: the provider has to be
 * exported so the system can deliver widget updates to it, which would let any
 * app broadcast a tap. This receiver is not exported and has no intent filter,
 * so only this app's own PendingIntents can reach it.
 */
public class WidgetActionReceiver extends BroadcastReceiver {

  static final String ACTION_TAP = "com.pablo.glowapp.WIDGET_TAP";
  static final String ACTION_MIDNIGHT = "com.pablo.glowapp.WIDGET_MIDNIGHT";
  static final String EXTRA_HABIT_ID = "habitId";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (ACTION_TAP.equals(intent.getAction())) {
      final String habitId = intent.getStringExtra(EXTRA_HABIT_ID);
      if (habitId == null) return;
      // Ticks always land on the real today, even on a widget drawn before midnight.
      final String today = GlowStore.today();
      final String action = GlowStore.applyTap(context, habitId, today);
      if (action != null) {
        GlowStore.queueAction(context, habitId, today, action);
        final GlowDay day = GlowDay.load(context, today);
        final GlowDay.Habit habit = day.find(habitId);
        // Done from the widget: its reminder, if one is showing, has had its answer.
        if (habit != null && habit.done()) ReminderNotifier.cancel(context, habitId);
        MainActivity.pokePage();
      }
    }
    GlowWidgetProvider.refresh(context);
  }
}
