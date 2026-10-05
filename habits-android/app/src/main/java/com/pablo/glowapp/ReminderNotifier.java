package com.pablo.glowapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Person;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Posts reminders. With a character chosen they arrive the way a chat message
 * does: the character's name and face, their line, a voice note to play from
 * the notification, and a Done button. On Android 11 and later they also sit
 * in the Conversations section, which needs a long-lived shortcut per
 * character. Without a character it is a plain reminder.
 *
 * Everything said in a notification is also filed in the inbox, so the
 * in-app chat shows the same conversation.
 */
final class ReminderNotifier {

  static final String CHANNEL_CAST = "glow_cast";
  static final String CHANNEL_PLAIN = "glow_reminders";
  private static final int NOTIFY_ID = 7;
  /** Marks the short-lived "done" exchange, which clearDone() leaves to time out. */
  private static final String EXTRA_CLOSING = "com.pablo.glowapp.closing";

  private ReminderNotifier() { }

  /* ── Reminders ── */

  /**
   * Shows one habit's reminder and files it in the chat. `message` is the
   * character's line ({text, voice}) or null for a plain reminder. Returns the
   * voice note's path when there is one, for the caller to autoplay.
   */
  static String remind(Context context, String habitId, String habitName, String date, JSONObject message) {
    final JSONObject snapshot = GlowStore.readSnapshot(context);
    final JSONObject cast = character(snapshot);
    final JSONObject ui = ui(snapshot);
    final String name = nameOf(snapshot, habitId, habitName);

    if (cast != null && message != null && !message.optString("text").isEmpty()) {
      final String voice = validVoice(message.optString("voice"));
      final Line line = new Line(message.optString("text"), voice);
      post(context, cast, ui, habitId, date, line, null, null, false);
      fileInChat(context, cast.optString("id"), "char", "remind", habitId, date, line.text, voice);
      return voice;
    }

    ensureChannels(context);
    final Notification.Builder builder = builder(context, CHANNEL_PLAIN)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(ui.optString("plainTitle", context.getString(R.string.reminder_title, "%s")).replace("%s", name))
        .setContentText(ui.optString("plainBody", context.getString(R.string.reminder_body)))
        .setCategory(Notification.CATEGORY_REMINDER)
        .setAutoCancel(true)
        .setContentIntent(GlowWidgetProvider.openApp(context, "today"))
        .addAction(action(context, R.drawable.ic_notification,
            ui.optString("done", context.getString(R.string.mark_done)), doneIntent(context, habitId, date, null)));
    notify(context, habitId, builder.build());
    return null;
  }

  /**
   * After Done: the reply and the character's answer go into the chat, and the
   * notification shows the exchange for a few seconds before it goes. Returns
   * the answer's voice note, for the caller to autoplay.
   */
  static String answerDone(Context context, String habitId, String date, String remindedText) {
    final JSONObject snapshot = GlowStore.readSnapshot(context);
    final JSONObject cast = character(snapshot);
    if (cast == null) {
      cancel(context, habitId);
      return null;
    }
    final JSONObject ui = ui(snapshot);
    final String name = nameOf(snapshot, habitId, "");
    final String reply = ui.optString("doneReply", "✓ %s").replace("%s", name);

    final JSONArray praise = cast.optJSONArray("praise");
    final JSONObject pick = praise == null || praise.length() == 0 ? null
        : praise.optJSONObject((int) (Math.random() * praise.length()));
    final Line answer = pick == null ? null
        : new Line(pick.optString("text"), validVoice(pick.optString("voice")));

    final String id = cast.optString("id");
    fileInChat(context, id, "me", "reply", habitId, date, reply, null);
    if (answer != null) fileInChat(context, id, "char", "praise", habitId, date, answer.text, answer.voice);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && answer != null) {
      final Line reminded = remindedText == null ? null : new Line(remindedText, null);
      post(context, cast, ui, habitId, date, reminded, reply, answer, true);
    } else {
      cancel(context, habitId);
    }
    return answer == null ? null : answer.voice;
  }

  /** A message sent straight away from the app's settings, to try it out. */
  static void test(Context context, JSONObject request) {
    final String habitId = request.optString("id");
    final JSONObject message = request.optJSONObject("msg");
    final String key = habitId.isEmpty() ? "test" : habitId;
    remind(context, key, request.optString("name"), GlowStore.today(), message);
  }

  /* ── Building the conversation ── */

  /** One thing a character says. */
  private static final class Line {
    final String text;
    final String voice;

    Line(String text, String voice) {
      this.text = text;
      this.voice = voice;
    }
  }

  private static void post(Context context, JSONObject cast, JSONObject ui, String habitId, String date,
                           Line line, String reply, Line answer, boolean closing) {
    ensureChannels(context);
    final String id = cast.optString("id");
    final String name = cast.optString("name");
    final Bitmap avatar = avatar(context, id);
    final long now = System.currentTimeMillis();
    final String voiceLabel = "🎤 " + ui.optString("voice", "Voice note");
    final Line spoken = answer != null ? answer : line;

    final Notification.Builder builder = builder(context, CHANNEL_CAST)
        .setSmallIcon(R.drawable.ic_notification)
        .setColor(accent(id))
        .setContentTitle(name)
        .setContentText(spoken == null ? "" : spoken.text)
        .setLargeIcon(avatar)
        .setCategory(Notification.CATEGORY_MESSAGE)
        .setAutoCancel(true)
        .setOnlyAlertOnce(closing)
        .setShowWhen(true)
        .setWhen(now)
        .setContentIntent(GlowWidgetProvider.openApp(context, "chat"));

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      final Person me = new Person.Builder().setName(ui.optString("you", "You")).setKey("me").build();
      final Person them = new Person.Builder()
          .setName(name)
          .setKey("glow_cast_" + id)
          .setIcon(Icon.createWithBitmap(avatar))
          .setImportant(true)
          .build();
      final Notification.MessagingStyle style = new Notification.MessagingStyle(me);
      // The voice note goes first and the words last: a collapsed or heads-up
      // notification shows only the latest message, and that should be the line.
      if (line != null) {
        if (line.voice != null) style.addMessage(new Notification.MessagingStyle.Message(voiceLabel, now, them));
        style.addMessage(new Notification.MessagingStyle.Message(line.text, now, them));
      }
      if (reply != null) style.addMessage(new Notification.MessagingStyle.Message(reply, now, (Person) null));
      if (answer != null) {
        if (answer.voice != null) style.addMessage(new Notification.MessagingStyle.Message(voiceLabel, now, them));
        style.addMessage(new Notification.MessagingStyle.Message(answer.text, now, them));
      }
      builder.setStyle(style);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        builder.setShortcutId(publishShortcut(context, id, name, them, avatar));
      }
    } else {
      @SuppressWarnings("deprecation")
      final Notification.MessagingStyle style = new Notification.MessagingStyle(ui.optString("you", "You"));
      if (line != null) style.addMessage(line.text, now, name);
      if (reply != null) style.addMessage(reply, now, (CharSequence) null);
      if (answer != null) style.addMessage(answer.text, now, name);
      builder.setStyle(style);
    }

    if (spoken != null && spoken.voice != null) {
      builder.addAction(action(context, R.drawable.ic_action_play, ui.optString("listen", "Listen"),
          playIntent(context, habitId, spoken.voice)));
    }
    if (closing) {
      // The exchange stays long enough to be read, then clears itself.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) builder.setTimeoutAfter(9000);
      final android.os.Bundle extras = new android.os.Bundle();
      extras.putBoolean(EXTRA_CLOSING, true);
      builder.addExtras(extras);
    } else {
      builder.addAction(action(context, R.drawable.ic_notification, ui.optString("done", "Done"),
          doneIntent(context, habitId, date, line == null ? null : line.text)));
    }
    notify(context, habitId, builder.build());
  }

  /**
   * A long-lived shortcut per character is what lets Android 11+ file these
   * under Conversations, with the character's face. It also appears in the
   * app icon's long-press menu and opens the chat.
   */
  private static String publishShortcut(Context context, String id, String name, Person person, Bitmap avatar) {
    final String shortcutId = "cast_" + id;
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return shortcutId;
    try {
      final ShortcutManager shortcuts = context.getSystemService(ShortcutManager.class);
      if (shortcuts == null) return shortcutId;
      final Intent open = new Intent(context, MainActivity.class)
          .setAction(Intent.ACTION_MAIN)
          .addCategory(Intent.CATEGORY_LAUNCHER)
          .putExtra(MainActivity.EXTRA_ROUTE, "chat");
      shortcuts.pushDynamicShortcut(new ShortcutInfo.Builder(context, shortcutId)
          .setShortLabel(name)
          .setLongLived(true)
          .setPerson(person)
          .setIcon(Icon.createWithAdaptiveBitmap(adaptive(avatar)))
          .setIntent(open)
          .build());
    } catch (RuntimeException rateLimitedOrRefused) {
      // Without the shortcut the message still shows, just not as a conversation.
    }
    return shortcutId;
  }

  /* ── Notification plumbing ── */

  private static Notification.Builder builder(Context context, String channel) {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ? new Notification.Builder(context, channel)
        : new Notification.Builder(context);
  }

  private static Notification.Action action(Context context, int icon, String label, PendingIntent intent) {
    return new Notification.Action.Builder(Icon.createWithResource(context, icon), label, intent).build();
  }

  private static PendingIntent doneIntent(Context context, String habitId, String date, String remindedText) {
    final Intent intent = new Intent(context, ReminderReceiver.class)
        .setAction(ReminderReceiver.ACTION_MARK_DONE)
        .setData(Uri.parse("glowapp://done/" + Uri.encode(habitId)))
        .putExtra(ReminderScheduler.EXTRA_HABIT_ID, habitId)
        .putExtra(ReminderReceiver.EXTRA_DATE, date)
        .putExtra(ReminderReceiver.EXTRA_TEXT, remindedText);
    return PendingIntent.getBroadcast(context, 0, intent, ReminderScheduler.flags());
  }

  private static PendingIntent playIntent(Context context, String habitId, String voice) {
    final Intent intent = new Intent(context, ReminderReceiver.class)
        .setAction(ReminderReceiver.ACTION_PLAY)
        .setData(Uri.parse("glowapp://play/" + Uri.encode(habitId)))
        .putExtra(ReminderReceiver.EXTRA_VOICE, voice);
    return PendingIntent.getBroadcast(context, 0, intent, ReminderScheduler.flags());
  }

  private static void notify(Context context, String habitId, Notification notification) {
    try {
      manager(context).notify(habitId, NOTIFY_ID, notification);
    } catch (SecurityException denied) {
      // Notification permission was revoked; the chat still has the message.
    }
  }

  static void cancel(Context context, String habitId) {
    final NotificationManager manager = manager(context);
    manager.cancel(habitId, NOTIFY_ID);
    manager.cancel(habitId.hashCode());            // as 2.7 and earlier posted them
  }

  /** Takes down reminders for habits that have since been done, however they were done. */
  static void clearDone(Context context) {
    final StatusBarNotification[] active;
    try {
      active = manager(context).getActiveNotifications();
    } catch (RuntimeException unavailable) {
      return;
    }
    if (active == null || active.length == 0) return;
    final GlowDay today = GlowDay.load(context, GlowStore.today());
    if (today.state != GlowDay.State.READY) return;
    for (StatusBarNotification posted : active) {
      final String habitId = posted.getTag();
      if (habitId == null || posted.getId() != NOTIFY_ID) continue;
      if (posted.getNotification().extras.getBoolean(EXTRA_CLOSING)) continue;   // already answered; it times out
      final GlowDay.Habit habit = today.find(habitId);
      if (habit != null && habit.done()) cancel(context, habitId);
    }
  }

  private static void ensureChannels(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    final NotificationManager manager = manager(context);
    final NotificationChannel cast = new NotificationChannel(CHANNEL_CAST,
        context.getString(R.string.cast_channel), NotificationManager.IMPORTANCE_HIGH);
    cast.setDescription(context.getString(R.string.cast_channel_desc));
    final NotificationChannel plain = new NotificationChannel(CHANNEL_PLAIN,
        context.getString(R.string.reminder_channel), NotificationManager.IMPORTANCE_DEFAULT);
    plain.setDescription(context.getString(R.string.reminder_channel_desc));
    manager.createNotificationChannel(cast);
    manager.createNotificationChannel(plain);
  }

  private static NotificationManager manager(Context context) {
    return (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
  }

  /* ── Snapshot helpers ── */

  static JSONObject character(JSONObject snapshot) {
    final JSONObject cast = snapshot == null ? null : snapshot.optJSONObject("character");
    return cast == null || cast.optString("id").isEmpty() ? null : cast;
  }

  private static JSONObject ui(JSONObject snapshot) {
    final JSONObject ui = snapshot == null ? null : snapshot.optJSONObject("ui");
    return ui == null ? new JSONObject() : ui;
  }

  private static String nameOf(JSONObject snapshot, String habitId, String fallback) {
    final JSONObject habit = GlowStore.habitById(snapshot, habitId);
    final String name = habit == null ? "" : habit.optString("name");
    return name.isEmpty() ? (fallback == null ? "" : fallback) : name;
  }

  /** Voice notes ship inside the app; anything else is not ours to play. */
  static String validVoice(String path) {
    return path != null && path.matches("voices/[a-z]+/[a-z]{2}/[a-z0-9-]+\\.webm") ? path : null;
  }

  private static void fileInChat(Context context, String castId, String from, String kind, String habitId,
                                 String date, String text, String voice) {
    try {
      final JSONObject item = new JSONObject();
      item.put("from", from);
      item.put("char", castId);
      item.put("kind", kind);
      item.put("habitId", habitId);
      item.put("date", date);
      item.put("text", text);
      if (voice != null) item.put("voice", voice);
      GlowStore.addToInbox(context, item);
      MainActivity.pokePage();
    } catch (JSONException ignored) {
      // A message that cannot be filed is still shown in the notification.
    }
  }

  /* ── Faces and colours ── */

  private static Bitmap avatar(Context context, String id) {
    final int res = avatarRes(id);
    final Bitmap bitmap = res == 0 ? null : BitmapFactory.decodeResource(context.getResources(), res);
    return bitmap != null ? bitmap : Bitmap.createBitmap(4, 4, Bitmap.Config.ARGB_8888);
  }

  private static int avatarRes(String id) {
    switch (id) {
      case "crack": return R.drawable.avatar_crack;
      case "narrator": return R.drawable.avatar_narrator;
      case "grandma": return R.drawable.avatar_grandma;
      case "bip": return R.drawable.avatar_bip;
      case "zen": return R.drawable.avatar_zen;
      default: return 0;
    }
  }

  /** The same accents as characters.js. */
  private static int accent(String id) {
    switch (id) {
      case "crack": return Color.parseColor("#1F9D57");
      case "narrator": return Color.parseColor("#7B5CE0");
      case "grandma": return Color.parseColor("#D8507F");
      case "bip": return Color.parseColor("#1597B8");
      case "zen": return Color.parseColor("#C98A1E");
      default: return Color.parseColor("#3987E5");
    }
  }

  /** An adaptive icon keeps its subject inside the middle two thirds. */
  private static Bitmap adaptive(Bitmap avatar) {
    final int size = Math.round(avatar.getWidth() * 1.5f);
    final Bitmap canvasBitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
    final Canvas canvas = new Canvas(canvasBitmap);
    canvas.drawColor(Color.WHITE);
    final float inset = (size - avatar.getWidth()) / 2f;
    canvas.drawBitmap(avatar, inset, inset, null);
    return canvasBitmap;
  }
}
