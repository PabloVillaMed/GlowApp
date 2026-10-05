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
 * Voice notes the user records in the app for their own reminders.
 *
 * The page records them, since it has the microphone and the interface, and
 * hands each one over once as base64. They live here, in the app's private
 * storage, where a reminder can play them with the app closed and the page
 * can play them back as "mine/<id>.webm". Nothing else on the phone can read
 * them.
 */
final class OwnNotes {

  /** Thirty seconds of Opus is well under 200 KB; anything far larger is not a note. */
  private static final int MAX_BYTES = 2 * 1024 * 1024;
  private static final Pattern ID = Pattern.compile("[a-z0-9]{6,40}");
  private static final Pattern PATH = Pattern.compile("mine/([a-z0-9]{6,40})\\.webm");

  private OwnNotes() { }

  private static File dir(Context context) {
    return new File(context.getFilesDir(), "notes");
  }

  private static File file(Context context, String id) {
    return new File(dir(context), id + ".webm");
  }

  /** The id in "mine/<id>.webm", or null for any other path. */
  static String idOf(String path) {
    if (path == null) return null;
    final Matcher match = PATH.matcher(path);
    return match.matches() ? match.group(1) : null;
  }

  /** The recording behind a "mine/…" path, or null when there is none (any more). */
  static File existing(Context context, String path) {
    final String id = idOf(path);
    if (id == null) return null;
    final File file = file(context, id);
    return file.isFile() ? file : null;
  }

  /** Keeps a recording. False when it is not a WebM file of a sensible size, or cannot be written. */
  static boolean save(Context context, String id, String base64) {
    if (id == null || !ID.matcher(id).matches() || base64 == null) return false;
    final byte[] bytes;
    try {
      bytes = Base64.decode(base64, Base64.DEFAULT);
    } catch (IllegalArgumentException malformed) {
      return false;
    }
    // A WebM file starts with the EBML magic number.
    if (bytes.length < 64 || bytes.length > MAX_BYTES
        || (bytes[0] & 0xFF) != 0x1A || (bytes[1] & 0xFF) != 0x45
        || (bytes[2] & 0xFF) != 0xDF || (bytes[3] & 0xFF) != 0xA3) {
      return false;
    }
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
    if (part.renameTo(file(context, id))) return true;
    part.delete();
    return false;
  }

  static void delete(Context context, String id) {
    if (id != null && ID.matcher(id).matches()) file(context, id).delete();
  }

  /** Every recording on the phone, as a JSON array of ids. */
  static String list(Context context) {
    final JSONArray ids = new JSONArray();
    final String[] names = dir(context).list();
    if (names != null) {
      for (String name : names) {
        if (!name.endsWith(".webm")) continue;
        final String id = name.substring(0, name.length() - ".webm".length());
        if (ID.matcher(id).matches()) ids.put(id);
      }
    }
    return ids.toString();
  }
}
