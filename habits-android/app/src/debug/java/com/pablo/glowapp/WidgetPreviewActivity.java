package com.pablo.glowapp;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.RemoteViews;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Debug-only screen that inflates the real widget views.
 *
 * Binding a widget to a launcher needs the signature-level BIND_APPWIDGET
 * permission, so a home screen cannot be scripted in a test. This renders the
 * same header and the same rows the launcher would, through the same provider
 * and list factory. An optional "date" extra (yyyy-MM-dd) draws another day,
 * which is how the after-midnight behaviour is checked without touching the
 * clock:
 *   adb shell am start -n com.pablo.glowapp/.WidgetPreviewActivity --es date 2026-10-06
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

    // The header, exactly as the provider builds it (its list stays empty
    // here: a list adapter needs a real widget host).
    final RemoteViews frame = GlowWidgetProvider.buildViews(this, 1, date);
    final View header = frame.apply(this, column).findViewById(R.id.w_header);
    ((ViewGroup) header.getParent()).removeView(header);
    column.addView(header, new LinearLayout.LayoutParams(Math.round(330 * density), Math.round(50 * density)));

    // The rows, straight from the real factory.
    final GlowWidgetService.HabitRows rows = new GlowWidgetService.HabitRows(getApplicationContext(), date);
    rows.onDataSetChanged();
    for (int i = 0; i < rows.getCount(); i++) {
      column.addView(rows.getViewAt(i).apply(this, column),
          new LinearLayout.LayoutParams(Math.round(330 * density), ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    final ScrollView scroll = new ScrollView(this);
    scroll.addView(column);
    setContentView(scroll);
  }
}
