package com.pablo.glowapp;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.RemoteViews;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Debug-only screen that inflates the real widget views.
 *
 * Binding a widget to a launcher needs the signature-level BIND_APPWIDGET
 * permission, so a home screen cannot be scripted in a test. This renders the
 * same RemoteViews the launcher would, through the same provider, at three
 * heights. An optional "date" extra (yyyy-MM-dd) draws another day, which is
 * how the after-midnight behaviour is checked without touching the clock:
 *   adb shell am start -n com.pablo.glowapp/.WidgetPreviewActivity --es date 2026-10-05
 */
public class WidgetPreviewActivity extends Activity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    final String requested = getIntent().getStringExtra("date");
    final String date = requested != null ? requested : GlowStore.today();
    final float density = getResources().getDisplayMetrics().density;

    final LinearLayout column = new LinearLayout(this);
    column.setOrientation(LinearLayout.VERTICAL);
    column.setPadding(24, 24, 24, 24);

    final TextView label = new TextView(this);
    label.setText("date " + date);
    column.addView(label);

    for (int height : new int[] { 110, 200, 330 }) {
      final RemoteViews views = GlowWidgetProvider.buildViews(this, 1, date, height);
      final View widget = views.apply(this, column);
      final LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
          Math.round(330 * density), Math.round(height * density));
      params.topMargin = Math.round(12 * density);
      column.addView(widget, params);
    }

    final ScrollView scroll = new ScrollView(this);
    scroll.addView(column);
    setContentView(scroll);
  }
}
