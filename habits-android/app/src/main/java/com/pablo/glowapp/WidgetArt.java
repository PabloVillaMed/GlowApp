package com.pablo.glowapp;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.SweepGradient;

/**
 * The widget's drawn parts. Only the day's progress ring is a bitmap — round
 * caps and the app's blue-to-green sweep cannot be had from a drawable — and
 * it is drawn to read on both a light and a dark home screen, because a bitmap
 * does not follow the system theme the way the XML colours do.
 */
final class WidgetArt {

  /** The app's habit colours (--s1 … --s8), in their mid tones so they work on either theme. */
  private static final int[] PALETTE = {
      0xFF3987E5, 0xFFD95926, 0xFF199E70, 0xFFC98500,
      0xFFD55181, 0xFF0E9A0E, 0xFF8F84E8, 0xFFE66767,
  };

  static final int GOOD = 0xFF0CA30C;
  private static final int BLUE = 0xFF2E7BE0;   // the app icon's gradient
  private static final int GREEN = 0xFF16A97B;
  private static final int TRACK = 0x4D8A94A3;  // grey at 30%: visible on white and on near-black

  private WidgetArt() { }

  static int habitColor(int index) {
    return PALETTE[Math.max(1, Math.min(PALETTE.length, index)) - 1];
  }

  /** The day's ring: a track, and an arc that sweeps from blue to green, solid green when complete. */
  static Bitmap dayRing(Context context, int sizeDp, float fraction) {
    final float density = context.getResources().getDisplayMetrics().density;
    final int size = Math.max(1, Math.round(sizeDp * density));
    final Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
    final Canvas canvas = new Canvas(bitmap);

    final float stroke = size * 0.115f;
    final RectF box = new RectF(stroke / 2f, stroke / 2f, size - stroke / 2f, size - stroke / 2f);

    final Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
    track.setStyle(Paint.Style.STROKE);
    track.setStrokeWidth(stroke);
    track.setColor(TRACK);
    canvas.drawOval(box, track);

    final float sweep = Math.max(0f, Math.min(1f, fraction));
    if (sweep <= 0f) return bitmap;

    final Paint arc = new Paint(Paint.ANTI_ALIAS_FLAG);
    arc.setStyle(Paint.Style.STROKE);
    arc.setStrokeWidth(stroke);
    arc.setStrokeCap(Paint.Cap.ROUND);
    if (sweep >= 1f) {
      arc.setColor(GOOD);
      canvas.drawOval(box, arc);
      return bitmap;
    }
    // The gradient runs along the arc itself, so a short arc is mostly blue
    // and a long one ends in green. Turned to start at twelve o'clock, ten
    // degrees early so the round cap does not pick up the far end's colour.
    final SweepGradient gradient = new SweepGradient(size / 2f, size / 2f,
        new int[] { BLUE, GREEN, GREEN }, new float[] { 0f, sweep, 1f });
    final Matrix turn = new Matrix();
    turn.setRotate(-100f, size / 2f, size / 2f);
    gradient.setLocalMatrix(turn);
    arc.setShader(gradient);
    canvas.drawArc(box, -90f, 360f * sweep, false, arc);
    return bitmap;
  }
}
