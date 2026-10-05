package com.pablo.glowapp;

import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Handles taps on the widget's rows, and the redraw just after midnight.
 *
 * Kept apart from GlowWidgetProvider on purpose: the provider has to be
 * exported so the system can deliver widget updates to it, which would let any
 * app broadcast a tap. This receiver is not exported and has no intent filter,
 * so only this app's own PendingIntents can reach it.
 */
public class WidgetActionReceiver extends BroadcastReceiver {

  /** A tap on a row of the list; EXTRA_OP says which part was tapped. */
  static final String ACTION_ROW = "com.pablo.glowapp.WIDGET_ROW";
  /** A tap on a circle, from the 2.8 widget that a launcher may still be showing. */
  static final String ACTION_TAP = "com.pablo.glowapp.WIDGET_TAP";
  static final String ACTION_MIDNIGHT = "com.pablo.glowapp.WIDGET_MIDNIGHT";
  static final String EXTRA_HABIT_ID = "habitId";
  static final String EXTRA_OP = "op";
  static final String OP_TICK = "tick";
  static final String OP_OPEN = "open";

  @Override
  public void onReceive(Context context, Intent intent) {
    final String action = intent.getAction();
    final String habitId = intent.getStringExtra(EXTRA_HABIT_ID);

    if (ACTION_ROW.equals(action) && OP_OPEN.equals(intent.getStringExtra(EXTRA_OP))) {
      // The launcher sent this tap, and launchers let a widget's broadcast
      // open its app straight after: this is how a list row opens GlowApp.
      try {
        context.startActivity(GlowWidgetProvider.openIntent(context, "today"));
      } catch (ActivityNotFoundException | SecurityException blocked) {
        // Nothing else to do; the header still opens the app.
      }
      return;
    }

    if ((ACTION_ROW.equals(action) || ACTION_TAP.equals(action)) && habitId != null) {
      // Ticks always land on the real today, even on a widget drawn before midnight.
      final String today = GlowStore.today();
      final String change = GlowStore.applyTap(context, habitId, today);
      if (change != null) {
        GlowStore.queueAction(context, habitId, today, change);
        final GlowDay.Habit habit = GlowDay.load(context, today).find(habitId);
        // Done from the widget: its reminder, if one is showing, has had its answer.
        if (habit != null && habit.done()) ReminderNotifier.cancel(context, habitId);
        MainActivity.pokePage();
      }
    }
    GlowWidgetProvider.refresh(context);
  }
}
