package com.pablo.glowapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Re-arms the reminders whenever Android may have dropped or misplaced them:
 * after a reboot, after an app update, when the clock or the time zone moves,
 * and when the user grants exact alarms (so the next ones are on the minute).
 * The widget is redrawn too, since "today" may have changed under it.
 */
public class BootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    ReminderScheduler.rescheduleAll(context);
    GlowWidgetProvider.refresh(context);
  }
}
