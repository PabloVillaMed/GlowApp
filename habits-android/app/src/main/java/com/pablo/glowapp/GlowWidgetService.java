package com.pablo.glowapp;

import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Feeds the widget's scrolling list: one row per habit due, from the snapshot. */
public class GlowWidgetService extends RemoteViewsService {

  static final String EXTRA_DATE = "date";

  @Override
  public RemoteViewsFactory onGetViewFactory(Intent intent) {
    return new HabitRows(getApplicationContext(), intent.getStringExtra(EXTRA_DATE));
  }

  /** Package-private so the debug preview can draw the same rows. */
  static class HabitRows implements RemoteViewsService.RemoteViewsFactory {

    private final Context context;
    private final String date;
    private GlowDay day;
    private List<GlowDay.Habit> habits = Collections.emptyList();

    HabitRows(Context context, String date) {
      this.context = context;
      this.date = date;
    }

    @Override
    public void onCreate() { }

    @Override
    public void onDataSetChanged() {
      day = GlowDay.load(context, date != null ? date : GlowStore.today());
      habits = day.state == GlowDay.State.READY ? new ArrayList<>(day.due) : Collections.<GlowDay.Habit>emptyList();
    }

    @Override
    public void onDestroy() {
      habits = Collections.emptyList();
    }

    @Override
    public int getCount() {
      return habits.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
      if (position < 0 || position >= habits.size()) return null;
      return GlowWidgetProvider.row(context, day, habits.get(position));
    }

    @Override
    public RemoteViews getLoadingView() {
      return null;          // the launcher's own placeholder, for the instant it takes
    }

    @Override
    public int getViewTypeCount() {
      return 1;
    }

    @Override
    public long getItemId(int position) {
      return position < habits.size() ? habits.get(position).id.hashCode() : position;
    }

    @Override
    public boolean hasStableIds() {
      return true;
    }
  }
}
