package com.pablo.glowapp;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import java.io.IOException;

/**
 * Plays a character's voice note straight from the APK, without opening the
 * app: from a notification's Listen button, or by itself when a reminder
 * arrives if the user asked for that.
 *
 * It runs inside a broadcast receiver that has called goAsync(), which keeps
 * the process alive until finish(); a note is a few seconds long, and a
 * watchdog makes sure the receiver is always released.
 */
final class VoicePlayer {

  private static final long WATCHDOG = 20_000L;
  private static final Handler MAIN = new Handler(Looper.getMainLooper());

  private static MediaPlayer player;
  private static BroadcastReceiver.PendingResult pending;
  private static AudioManager audio;
  private static Object focusRequest;

  private VoicePlayer() { }

  /**
   * A note that plays by itself must not surprise anyone: only with the ringer
   * on, outside a call, and when Do Not Disturb is off.
   */
  static boolean mayAutoplay(Context context) {
    final AudioManager manager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
    final NotificationManager notifications =
        (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    return manager != null
        && manager.getRingerMode() == AudioManager.RINGER_MODE_NORMAL
        && manager.getMode() == AudioManager.MODE_NORMAL
        && (notifications == null
            || notifications.getCurrentInterruptionFilter() == NotificationManager.INTERRUPTION_FILTER_ALL);
  }

  /** Plays `voicePath` (e.g. "voices/crack/es/h-water.webm") now; always finishes `result`. */
  static void play(Context context, String voicePath, BroadcastReceiver.PendingResult result) {
    play(context, voicePath, result, 0);
  }

  /**
   * Same, after `delayMs`. A note that plays on arrival waits a moment so the
   * notification's own sound is not talked over.
   */
  static synchronized void play(Context context, String voicePath, BroadcastReceiver.PendingResult result,
                                long delayMs) {
    stop();
    final String path = ReminderNotifier.validVoice(voicePath);
    if (path == null) {
      finish(result);
      return;
    }
    final Context app = context.getApplicationContext();
    final MediaPlayer media = new MediaPlayer();
    // Voice notes are uncompressed in the APK (see noCompress in build.gradle),
    // which is what lets openFd() hand the player a plain file range.
    try (AssetFileDescriptor file = app.getAssets().openFd(MainActivity.ASSET_ROOT + "/" + path)) {
      media.setAudioAttributes(new AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build());
      media.setDataSource(file.getFileDescriptor(), file.getStartOffset(), file.getLength());
    } catch (IOException | RuntimeException unplayable) {
      media.release();
      finish(result);
      return;
    }

    player = media;
    pending = result;
    audio = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
    requestFocus();
    media.setOnPreparedListener(MediaPlayer::start);
    media.setOnCompletionListener(done -> stop());
    media.setOnErrorListener((failed, what, extra) -> {
      stop();
      return true;
    });
    MAIN.postDelayed(() -> {
      if (player == media) media.prepareAsync();
    }, delayMs);
    MAIN.postDelayed(VoicePlayer::stop, WATCHDOG + delayMs);
  }

  static synchronized void stop() {
    MAIN.removeCallbacksAndMessages(null);
    if (player != null) {
      try {
        player.release();
      } catch (RuntimeException ignored) {
        // Already released by an error path.
      }
      player = null;
    }
    abandonFocus();
    finish(pending);
    pending = null;
  }

  /* Music ducks under the note rather than stopping for it. */
  private static void requestFocus() {
    if (audio == null) return;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      final AudioFocusRequest request = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
          .setAudioAttributes(new AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_MEDIA)
              .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
              .build())
          .build();
      audio.requestAudioFocus(request);
      focusRequest = request;
    } else {
      requestFocusLegacy();
    }
  }

  @SuppressWarnings("deprecation")
  private static void requestFocusLegacy() {
    audio.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
  }

  private static void abandonFocus() {
    if (audio == null) return;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest instanceof AudioFocusRequest) {
      audio.abandonAudioFocusRequest((AudioFocusRequest) focusRequest);
    } else {
      abandonFocusLegacy();
    }
    focusRequest = null;
    audio = null;
  }

  @SuppressWarnings("deprecation")
  private static void abandonFocusLegacy() {
    audio.abandonAudioFocus(null);
  }

  private static void finish(BroadcastReceiver.PendingResult result) {
    if (result == null) return;
    try {
      result.finish();
    } catch (IllegalStateException alreadyFinished) {
      // Finished once already; nothing to release.
    }
  }
}
