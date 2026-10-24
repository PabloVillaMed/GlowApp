package com.pablo.glowapp;

import android.app.Activity;
import android.os.Bundle;
import android.widget.SeekBar;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The widget's mood and energy window (2.26): the five faces and the energy
 * slider with its − and +, as on Today, floating over the home screen. The
 * app itself stays closed: each change goes into the snapshot, so the widget
 * shows it at once, and into the queue the page applies through its own
 * write path the next time it runs (GlowStore.setMood / setEnergy).
 *
 * As on Today, energy belongs to a mood: the slider waits until a face is
 * chosen. Its words come from the page, in the app's language.
 */
public class MoodActivity extends Activity {

  private static final int[] FACES = { R.id.m_face1, R.id.m_face2, R.id.m_face3, R.id.m_face4, R.id.m_face5 };

  private String date;
  private GlowDay day;
  private int score;
  private int energy = 50;
  private int savedEnergy = -1;
  private boolean dragging;
  private SeekBar slider;

  @Override
  protected void onCreate(Bundle saved) {
    super.onCreate(saved);
    setContentView(R.layout.mood_window);
    date = GlowStore.today();
    day = GlowDay.load(this, date);
    final JSONObject mood = GlowStore.moodOf(this, date);
    score = mood == null ? 0 : mood.optInt("score");
    energy = mood == null ? 50 : mood.optInt("energyPct", 50);
    savedEnergy = mood == null ? -1 : energy;

    ((TextView) findViewById(R.id.m_title)).setText(day.ui("moodTitle", getString(R.string.mood_title)));
    ((TextView) findViewById(R.id.m_energy_label)).setText(day.ui("energy", getString(R.string.energy)));
    final TextView close = findViewById(R.id.m_close);
    close.setText(day.ui("close", getString(R.string.close)));
    close.setOnClickListener(v -> finish());

    final JSONArray names = day.ui.optJSONArray("moods");
    for (int i = 0; i < FACES.length; i++) {
      final int value = i + 1;
      final TextView face = findViewById(FACES[i]);
      face.setText(GlowWidgetProvider.face(day, i));
      face.setContentDescription(names != null && names.length() == 5 ? names.optString(i) : face.getText());
      face.setOnClickListener(v -> choose(value));
    }

    slider = findViewById(R.id.m_energy);
    slider.setProgress(energy);
    slider.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
      @Override public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) {
        if (!fromUser) return;
        energy = progress;
        showEnergy();
        // TalkBack, a keyboard or a D-pad move it without a touch: saved at once.
        if (!dragging) saveEnergy();
      }
      @Override public void onStartTrackingTouch(SeekBar bar) { dragging = true; }
      @Override public void onStopTrackingTouch(SeekBar bar) { dragging = false; saveEnergy(); }
    });
    final TextView less = findViewById(R.id.m_less);
    final TextView more = findViewById(R.id.m_more);
    less.setContentDescription(day.ui("energyLess", "−1%"));
    more.setContentDescription(day.ui("energyMore", "+1%"));
    less.setOnClickListener(v -> step(-1));
    more.setOnClickListener(v -> step(1));
    show();
  }

  private void choose(int value) {
    // A first face starts at the default energy, which is not a reading: it
    // is saved only once the slider is moved, as on Today.
    if (score == 0) savedEnergy = energy;
    score = value;
    GlowStore.setMood(this, date, value);
    changed();
    show();
  }

  private void step(int delta) {
    if (score == 0) return;
    energy = Math.max(0, Math.min(100, energy + delta));
    slider.setProgress(energy);
    saveEnergy();
    showEnergy();
  }

  private void saveEnergy() {
    if (score == 0 || energy == savedEnergy) return;
    savedEnergy = energy;
    GlowStore.setEnergy(this, date, energy);
    changed();
  }

  /** Closed mid-drag, or by back or a tap outside: whatever was set is kept. */
  @Override
  protected void onPause() {
    super.onPause();
    saveEnergy();
  }

  /** The widget redraws, and the app, if it is open behind, takes the change in. */
  private void changed() {
    GlowWidgetProvider.refresh(this);
    MainActivity.pokePage();
  }

  private void show() {
    final JSONArray names = day.ui.optJSONArray("moods");
    for (int i = 0; i < FACES.length; i++) {
      findViewById(FACES[i]).setBackgroundResource(score == i + 1 ? R.drawable.widget_face_on : R.drawable.widget_face);
    }
    final TextView label = findViewById(R.id.m_label);
    label.setText(score > 0 && names != null && names.length() == 5 ? names.optString(score - 1)
        : day.ui("moodFirst", getString(R.string.mood_first)));
    final boolean on = score > 0;
    slider.setEnabled(on);
    findViewById(R.id.m_less).setEnabled(on);
    findViewById(R.id.m_more).setEnabled(on);
    findViewById(R.id.m_less).setAlpha(on ? 1f : 0.4f);
    findViewById(R.id.m_more).setAlpha(on ? 1f : 0.4f);
    slider.setAlpha(on ? 1f : 0.4f);
    showEnergy();
  }

  /** "62% · Media", with the words the app uses for low, middle and high. */
  private void showEnergy() {
    final TextView value = findViewById(R.id.m_energy_value);
    if (score == 0) {
      value.setText("–");
      return;
    }
    final JSONArray levels = day.ui.optJSONArray("energyLevels");
    final int level = energy < 34 ? 0 : energy >= 67 ? 2 : 1;
    final String word = levels != null && levels.length() == 3 ? levels.optString(level) : "";
    value.setText(energy + "%" + (word.isEmpty() ? "" : " · " + word));
  }
}
