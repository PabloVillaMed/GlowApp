package com.pablo.glowapp;

import android.content.Context;
import android.util.Base64;

import org.json.JSONArray;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Voice notes the user records in the app for their own reminders: a single
 * note for a habit (WebM/Opus, 2.10) or the lines of their own bot, cut from
 * a script they read aloud (WAV, 2.11).
 *
 * The page records them, since it has the microphone and the interface, and
 * hands each one over once as base64. They live here, in the app's private
 * storage, where a reminder can play them with the app closed and the page
 * can play them back as "mine/<id>.webm" or "mine/<id>.wav". Nothing else on
 * the phone can read them.
 */
final class OwnNotes {

  /** Thirty seconds of WAV at the bot's rate is about 1.3 MB; anything far larger is not a note. */
  private static final int MAX_BYTES = 2 * 1024 * 1024;
  private static final Pattern ID = Pattern.compile("[a-z0-9]{6,40}");
  private static final Pattern PATH = Pattern.compile("mine/([a-z0-9]{6,40})\\.(webm|wav)");
  private static final String[] KINDS = { "webm", "wav" };

  private OwnNotes() { }

  private static File dir(Context context) {
    return new File(context.getFilesDir(), "notes");
  }

  private static File file(Context context, String id, String kind) {
    return new File(dir(context), id + "." + kind);
  }

  /** The id in "mine/<id>.webm" or "mine/<id>.wav", or null for any other path. */
  static String idOf(String path) {
    if (path == null) return null;
    final Matcher match = PATH.matcher(path);
    return match.matches() ? match.group(1) : null;
  }

  /** The recording behind a "mine/…" path, or null when there is none (any more). */
  static File existing(Context context, String path) {
    if (path == null) return null;
    final Matcher match = PATH.matcher(path);
    if (!match.matches()) return null;
    final File file = file(context, match.group(1), match.group(2));
    return file.isFile() ? file : null;
  }

  static String mimeOf(String path) {
    return path != null && path.endsWith(".wav") ? "audio/wav" : "audio/webm";
  }

  /**
   * Keeps a recording. Its kind comes from its first bytes, never from the
   * page: WebM starts with the EBML magic number, WAV with RIFF…WAVE. False
   * when it is neither, of a silly size, or cannot be written.
   */
  static boolean save(Context context, String id, String base64) {
    if (id == null || !ID.matcher(id).matches() || base64 == null) return false;
    final byte[] bytes;
    try {
      bytes = Base64.decode(base64, Base64.DEFAULT);
    } catch (IllegalArgumentException malformed) {
      return false;
    }
    if (bytes.length < 64 || bytes.length > MAX_BYTES) return false;
    final String kind = isWebm(bytes) ? "webm" : isWav(bytes) ? "wav" : null;
    if (kind == null) return false;
    final File folder = dir(context);
    if (!folder.isDirectory() && !folder.mkdirs()) return false;
    // Written aside and then renamed, so a reminder never finds half a file.
    final File part = new File(folder, id + ".part");
    try (FileOutputStream out = new FileOutputStream(part)) {
      out.write(bytes);
      out.getFD().sync();
    } catch (IOException failed) {
      part.delete();
      return false;
    }
    if (part.renameTo(file(context, id, kind))) return true;
    part.delete();
    return false;
  }

  private static boolean isWebm(byte[] b) {
    return (b[0] & 0xFF) == 0x1A && (b[1] & 0xFF) == 0x45 && (b[2] & 0xFF) == 0xDF && (b[3] & 0xFF) == 0xA3;
  }

  private static boolean isWav(byte[] b) {
    return b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
        && b[8] == 'W' && b[9] == 'A' && b[10] == 'V' && b[11] == 'E';
  }

  static void delete(Context context, String id) {
    if (id == null || !ID.matcher(id).matches()) return;
    for (String kind : KINDS) file(context, id, kind).delete();
  }

  /** Every recording on the phone, as a JSON array of ids. */
  static String list(Context context) {
    final JSONArray ids = new JSONArray();
    final String[] names = dir(context).list();
    if (names != null) {
      for (String name : names) {
        final int dot = name.lastIndexOf('.');
        if (dot < 0) continue;
        final String id = name.substring(0, dot);
        final String kind = name.substring(dot + 1);
        if (("webm".equals(kind) || "wav".equals(kind)) && ID.matcher(id).matches()) ids.put(id);
      }
    }
    return ids.toString();
  }
}
