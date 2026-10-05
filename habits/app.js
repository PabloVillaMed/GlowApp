/* GlowApp — habit, exercise and mood tracker.
   Local-first: the whole state lives in one localStorage record, so the app
   works with no network, no account and no backend. */
(function () {
  'use strict';

  const t = (k, a) => I18N.t(k, a);
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const STORAGE_KEY = 'glow.v1';
  const LEGACY_STORAGE_KEY = 'habitos.v1';   // pre-GlowApp name, migrated on load
  const SCHEMA_VERSION = 1;

  /* Present only inside the Android shell; everything that depends on it is
     feature-detected so the browser build stays fully functional. */
  const shell = window.NativeShell || null;

  const LAYOUTS = ['comfortable', 'compact', 'grid', 'focus'];
  const DENSITIES = ['small', 'default', 'large'];

  const EMOJIS = [
    '🧘', '💪', '🏃', '🚶', '🚴', '🏋️', '🧠', '📓', '📖', '💧',
    '🥗', '🍎', '😴', '☀️', '🌙', '🙏', '💊', '🚭', '📵', '🧹',
    '🎯', '🎸', '🎨', '💻', '🗣️', '❤️', '🌱', '🧴', '🧎',
  ];

  const CATEGORIES = [
    { id: 'mental', key: 'catMental', color: 7 },
    { id: 'fitness', key: 'catFitness', color: 2 },
    { id: 'health', key: 'catHealth', color: 3 },
    { id: 'focus', key: 'catFocus', color: 1 },
    { id: 'social', key: 'catSocial', color: 5 },
    { id: 'other', key: 'catOther', color: 4 },
  ];

  const MOODS = [1, 2, 3, 4, 5];
  const MOOD_EMOJI = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };

  /* ── Date helpers (all local time; keys are plain YYYY-MM-DD) ─────── */
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseKey = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const todayKey = () => keyOf(new Date());
  const addDays = (d, n) => {
    const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    copy.setDate(copy.getDate() + n);
    return copy;
  };
  const dayDiff = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 86400000);

  /* Monday-or-Sunday aligned week id, e.g. "2026-W37". */
  function weekStartOf(date) {
    const ws = state.weekStart;
    const diff = (date.getDay() - ws + 7) % 7;
    return addDays(date, -diff);
  }
  function weekKey(date) {
    return keyOf(weekStartOf(date));
  }
  function lastNDays(n, endKey) {
    const end = parseKey(endKey || todayKey());
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(keyOf(addDays(end, -i)));
    return out;
  }
  const sentenceCase = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : str);

  function fmtDate(key, opts) {
    return parseKey(key).toLocaleDateString(I18N.locale(), opts || { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function dowNames(short) {
    /* Ordered by the user's week-start setting. */
    const sunday = new Date(2024, 0, 7); // a known Sunday, so dow 0 == this date
    const names = [];
    for (let i = 0; i < 7; i++) {
      const dow = (state.weekStart + i) % 7;
      names.push({
        dow: dow,
        label: addDays(sunday, dow).toLocaleDateString(I18N.locale(), { weekday: short ? 'narrow' : 'short' }),
      });
    }
    return names;
  }

  /* ── State ─────────────────────────────────────────────────────────── */
  const defaultState = () => ({
    version: SCHEMA_VERSION,
    /* Spanish on a first run regardless of the device language: this is a
     Spanish-first app, and the toggle in the bar switches it in one tap. */
    lang: 'es',
    theme: 'system',
    weekStart: 1,
    layout: 'comfortable',
    density: 'default',
    sound: true,
    onboarding: null,
    /* Who sends the reminders (an id from characters.js, or null for plain
       notifications), and the conversation they leave behind. */
    character: null,
    voiceAutoplay: false,
    chat: [],
    chatUnread: 0,
    castPromoDismissed: false,
    habits: [],
    entries: {},
    moods: {},
  });

  let state = defaultState();
  let view = 'today';
  let selectedDate = todayKey();
  let showAllToday = false;
  let range = 30;
  let heatHabitId = 'all';
  let editingId = null;
  /* Which descriptions are open. Kept outside the habit record because it is
     view state, not something worth saving. */
  const expandedDesc = new Set();
  let deferredInstall = null;

  function load() {
    try {
      /* The app was called Hábitos before GlowApp. Anyone who used it in a
         browser still has their history under the old key, so adopt it once. */
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          localStorage.setItem(STORAGE_KEY, legacy);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          raw = legacy;
        }
      }
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state = Object.assign(defaultState(), parsed);
        state.habits = Array.isArray(state.habits) ? state.habits : [];
        state.entries = state.entries && typeof state.entries === 'object' ? state.entries : {};
        state.moods = state.moods && typeof state.moods === 'object' ? state.moods : {};
      }
    } catch (err) {
      console.warn('Could not read saved data', err);
    }
  }

  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const cleanTimes = (list) => Array.from(new Set((list || []).filter((x) => TIME_RE.test(x)))).sort();

  /* Brings a record written by an older version, or imported from a file, up
     to the current shape. Returns true when anything had to change. */
  function normalizeState() {
    const before = JSON.stringify([state.chat, state.chatUnread, state.character, state.habits]);
    state.chat = Array.isArray(state.chat) ? state.chat : [];
    state.chatUnread = Math.max(0, Number(state.chatUnread) || 0);
    if (state.character && !GLOW_CAST.byId(state.character)) state.character = null;
    state.habits.forEach((habit) => {
      // One reminder time per habit until 2.8; now a short list of them.
      if (!Array.isArray(habit.reminders)) habit.reminders = habit.reminder ? [habit.reminder] : [];
      delete habit.reminder;
      habit.reminders = cleanTimes(habit.reminders);
    });
    return JSON.stringify([state.chat, state.chatUnread, state.character, state.habits]) !== before;
  }

  /**
   * Fills in descriptions for habits created before the field existed.
   *
   * Matches on the catalogue name in both languages, because someone may have
   * added "Beber agua" and since switched the interface to English. Anything
   * the user typed themselves is left alone — silence is better than a
   * description that describes the wrong thing.
   */
  function linkCatalogueKeys() {
    const needs = state.habits.filter((h) => !h.nameKey || !h.descKey);
    if (!needs.length) return false;

    /* Built from both languages, so a habit added as "Beber agua" is still
       recognised after the interface was switched to English. */
    const byName = {};
    ['es', 'en'].forEach((lang) => {
      const table = I18N.STRINGS[lang];
      const remember = (nameKey, descKey) => {
        const label = table[nameKey];
        if (label) byName[label.trim().toLowerCase()] = { nameKey: nameKey, descKey: descKey || '' };
      };
      HABIT_CATALOGUE.forEach((entry) => remember(entry.key, entry.desc));
      PRESETS.forEach((preset) => remember(preset.key, preset.desc));
    });

    let linked = 0;
    needs.forEach((habit) => {
      const match = byName[(habit.name || '').trim().toLowerCase()];
      if (!match) return;                       // typed by hand; leave it alone
      if (!habit.nameKey) { habit.nameKey = match.nameKey; linked++; }
      if (!habit.descKey && match.descKey) {
        habit.descKey = match.descKey;
        if (!habit.description) habit.description = t(match.descKey);
        linked++;
      }
    });
    return linked > 0;
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn('Could not save', err);
        toast(t('saveFailed'));
      }
      syncToShell();
    }, 120);
  }

  function uid() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ── Habit model helpers ───────────────────────────────────────────── */
  const activeHabits = () => state.habits.filter((h) => !h.archived);

  /* Habits built from the catalogue keep the key they came from, so switching
     language retranslates them. A habit the user renamed loses the key and
     keeps whatever they typed — their words are not ours to overwrite. */
  const habitName = (h) => (h.nameKey ? t(h.nameKey) : h.name) || '';
  const habitDesc = (h) => (h.descKey ? t(h.descKey) : h.description) || '';
  const habitById = (id) => state.habits.find((h) => h.id === id);
  const colorVar = (h) => 'var(--s' + (h.colorIndex || 1) + ')';

  function isScheduled(habit, key) {
    if (habit.createdAt && key < habit.createdAt) return false;
    const s = habit.schedule || { kind: 'daily' };
    if (s.kind === 'days') return (s.days || []).includes(parseKey(key).getDay());
    return true; // 'daily' and 'times' are both open every day
  }
  const targetOf = (habit) => (habit.type === 'quantity' ? Math.max(1, habit.target || 1) : 1);
  const valueOf = (habit, key) => (state.entries[habit.id] && state.entries[habit.id][key]) || 0;
  const isComplete = (habit, key) => valueOf(habit, key) >= targetOf(habit);

  function setValue(habit, key, value) {
    const bucket = state.entries[habit.id] || (state.entries[habit.id] = {});
    const clamped = Math.max(0, Math.min(value, targetOf(habit) * 4));
    if (clamped === 0) delete bucket[key];
    else bucket[key] = clamped;
    save();
  }

  function habitsFor(key) {
    return activeHabits().filter((h) => isScheduled(h, key));
  }

  /* ── Streaks ───────────────────────────────────────────────────────
     A streak only breaks on a day the habit was actually due. Today never
     breaks it: the day is not over yet. Habits with a weekly quota are
     counted in whole weeks instead of days, since a gap between the
     sessions is part of the plan rather than a miss. */
  function streakOf(habit) {
    const s = habit.schedule || { kind: 'daily' };
    return s.kind === 'times' ? weeklyStreak(habit, s) : dailyStreak(habit);
  }

  function dailyStreak(habit) {
    const today = todayKey();
    let count = 0;
    let cursor = parseKey(today);
    let guard = 0;
    while (guard++ < 800) {
      const key = keyOf(cursor);
      if (habit.createdAt && key < habit.createdAt) break;
      if (isScheduled(habit, key)) {
        if (isComplete(habit, key)) count++;
        else if (key !== today) break;   // an unfinished today is not a miss yet
      }
      cursor = addDays(cursor, -1);
    }
    return { count: count, unit: 'days' };
  }

  function weeklyStreak(habit, sched) {
    const quota = Math.max(1, Math.min(7, sched.times || 3));
    let count = 0;
    let cursor = weekStartOf(new Date());
    let guard = 0;
    let isCurrentWeek = true;
    while (guard++ < 200) {
      let done = 0;
      for (let i = 0; i < 7; i++) {
        const key = keyOf(addDays(cursor, i));
        if (key > todayKey()) break;
        if (habit.createdAt && key < habit.createdAt) continue;
        if (isComplete(habit, key)) done++;
      }
      const weekEnd = keyOf(addDays(cursor, 6));
      if (habit.createdAt && weekEnd < habit.createdAt) break;
      if (done >= quota) count++;
      else if (!isCurrentWeek) break;    // the week in progress can still be met
      isCurrentWeek = false;
      cursor = addDays(cursor, -7);
    }
    return { count: count, unit: 'weeks' };
  }

  const streakLabel = (streak) => t(streak.unit === 'weeks' ? 'streakWeeks' : 'streakDays', streak.count);

  /* ── Aggregates over a date range ──────────────────────────────────── */
  function dayStats(key) {
    const due = habitsFor(key);
    const done = due.filter((h) => isComplete(h, key)).length;
    return { due: due.length, done: done, pct: due.length ? Math.round((done / due.length) * 100) : 0 };
  }

  function rangeStats(days) {
    let due = 0;
    let done = 0;
    let perfect = 0;
    let moodSum = 0;
    let moodDays = 0;
    days.forEach((key) => {
      const d = dayStats(key);
      due += d.due;
      done += d.done;
      if (d.due > 0 && d.done === d.due) perfect++;
      const mood = state.moods[key];
      if (mood && mood.score) {
        moodSum += mood.score;
        moodDays++;
      }
    });
    return {
      completion: due ? Math.round((done / due) * 100) : 0,
      perfect: perfect,
      avgMood: moodDays ? moodSum / moodDays : null,
      moodDays: moodDays,
      due: due,
      done: done,
    };
  }

  function habitRate(habit, days) {
    let due = 0;
    let done = 0;
    days.forEach((key) => {
      if (!isScheduled(habit, key)) return;
      due++;
      if (isComplete(habit, key)) done++;
    });
    return { due: due, done: done, pct: due ? Math.round((done / due) * 100) : null };
  }

  /* ── Small UI utilities ────────────────────────────────────────────── */
  let toastTimer = null;
  function toast(message) {
    const box = $('#toast');
    box.textContent = message;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.hidden = true; }, 2200);
  }

  function confirmDialog(title, body) {
    return new Promise((resolve) => {
      const dlg = $('#confirmDialog');
      $('#confirmTitle').textContent = title;
      $('#confirmBody').textContent = body;
      const done = (value) => {
        dlg.close();
        $('#confirmOk').removeEventListener('click', ok);
        $('#confirmCancel').removeEventListener('click', cancel);
        resolve(value);
      };
      const ok = () => done(true);
      const cancel = () => done(false);
      $('#confirmOk').addEventListener('click', ok);
      $('#confirmCancel').addEventListener('click', cancel);
      dlg.showModal();
    });
  }

  function button(cls, label, attrs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    if (label !== null && label !== undefined) b.textContent = label;
    for (const k in attrs || {}) b.setAttribute(k, attrs[k]);
    return b;
  }

  function iconSvg(id, size) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" width="' + (size || 18) + '" height="' + (size || 18) + '"><use href="#' + id + '"></use></svg>';
  }

  /* ── Today view ────────────────────────────────────────────────────── */
  /* How far back the strip reaches. Deliberately generous: scrolling to an
     older day should never hit a wall mid-gesture. */
  const DAY_STRIP_DAYS = 120;

  let dayStripSignature = '';

  function dayChipDot(key) {
    const stats = dayStats(key);
    return stats.due > 0 && stats.done === stats.due;
  }

  function buildDayStrip(strip) {
    strip.innerHTML = '';
    lastNDays(DAY_STRIP_DAYS).forEach((key) => {
      const date = parseKey(key);
      const chip = button('day-chip', null, { role: 'tab', 'data-date': key });
      const dow = document.createElement('span');
      dow.textContent = date.toLocaleDateString(I18N.locale(), { weekday: 'narrow' });
      const num = document.createElement('span');
      num.className = 'dnum';
      num.textContent = date.getDate();
      const dot = document.createElement('span');
      dot.className = 'ddot';
      chip.append(dow, num, dot);

      if (date.getDate() === 1) {
        chip.classList.add('is-month-start');
        chip.title = fmtDate(key, { month: 'long', year: 'numeric' });
      }
      chip.addEventListener('click', () => {
        selectedDate = key;
        renderToday();
      });
      strip.appendChild(chip);
    });
  }

  function refreshDayDot(key) {
    const chip = $('#dayStrip .day-chip[data-date="' + key + '"]');
    if (!chip) return;
    const dot = $('.ddot', chip);
    if (dot) dot.classList.toggle('filled', dayChipDot(key));
  }

  function renderDayStrip() {
    const strip = $('#dayStrip');
    /* Only the day set itself forces a rebuild: a new day, a different week
       start, or a language change (the weekday letters are localised). */
    const signature = [todayKey(), state.weekStart, I18N.getLang()].join('|');

    if (signature !== dayStripSignature || !strip.children.length) {
      buildDayStrip(strip);
      dayStripSignature = signature;
      lastNDays(DAY_STRIP_DAYS).forEach(refreshDayDot);
      const selected = $('#dayStrip .day-chip[data-date="' + selectedDate + '"]');
      if (selected) {
        strip.scrollLeft = Math.max(
          0, selected.offsetLeft - (strip.clientWidth - selected.clientWidth) / 2);
      }
    } else {
      // A tap can only have changed the day being looked at.
      refreshDayDot(selectedDate);
    }

    $$('#dayStrip .day-chip').forEach((chip) => {
      chip.setAttribute('aria-selected', String(chip.dataset.date === selectedDate));
    });
  }

  function renderSummary() {
    const stats = dayStats(selectedDate);
    const circumference = 2 * Math.PI * 52;
    const ring = $('#ringValue');
    ring.setAttribute('stroke-dasharray', circumference.toFixed(1));
    ring.setAttribute('stroke-dashoffset', (circumference * (1 - stats.pct / 100)).toFixed(1));
    $('#summaryPct').textContent = stats.pct + '%';
    $('#summaryCount').textContent = stats.done + '/' + stats.due;
    $('#summaryDate').textContent = sentenceCase(fmtDate(selectedDate));

    const best = activeHabits().reduce((acc, h) => {
      const s = streakOf(h);
      return s.count > acc.count ? s : acc;
    }, { count: 0, unit: 'days' });
    $('#statStreak').textContent = streakLabel(best);
    $('#statWeek').textContent = rangeStats(lastNDays(7)).completion + '%';
  }

  const energyLabel = (v) => t(v <= 2 ? 'energyLow' : v >= 4 ? 'energyHigh' : 'energyMid');

  function renderMood() {
    const scale = $('#moodScale');
    const entry = state.moods[selectedDate] || null;
    scale.innerHTML = '';
    MOODS.forEach((score) => {
      const btn = button('mood-btn', null, {
        role: 'radio',
        'aria-checked': String(!!entry && entry.score === score),
        'aria-label': t('mood' + score),
      });
      btn.innerHTML = '<span class="emoji" aria-hidden="true">' + MOOD_EMOJI[score] + '</span>';
      const label = document.createElement('span');
      label.textContent = t('mood' + score);
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        const current = state.moods[selectedDate];
        if (current && current.score === score) delete state.moods[selectedDate];
        else state.moods[selectedDate] = Object.assign({ energy: 3, note: '' }, current, { score: score });
        save();
        Sounds.play('mood');
        renderMood();
        renderProgressIfVisible();
      });
      scale.appendChild(btn);
    });

    const extra = $('#moodExtra');
    extra.hidden = !entry;
    $('#moodHint').textContent = entry ? t('moodSaved') : '';
    if (entry) {
      $('#moodEnergy').value = entry.energy || 3;
      $('#moodEnergyOut').textContent = energyLabel(entry.energy || 3);
      $('#moodNote').value = entry.note || '';
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function scheduleLabel(habit) {
    const s = habit.schedule || { kind: 'daily' };
    if (s.kind === 'daily') return t('schedDaily');
    if (s.kind === 'times') return (s.times || 3) + '× / ' + (I18N.getLang() === 'es' ? 'semana' : 'week');
    const names = dowNames(false);
    return (s.days || []).slice().sort((a, b) => a - b)
      .map((d) => (names.find((n) => n.dow === d) || { label: '' }).label)
      .join(' ');
  }

  /* ── Completion feedback ───────────────────────────────────────────────
     A short buzz and a flash when something is completed, and a celebration
     when the day is finished. Silent if the browser has no vibration motor
     or the viewer asked for reduced motion. */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function buzz(pattern) {
    if (reducedMotion.matches) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (err) { /* not available; the animation still plays */ }
  }

  function celebrate(habit, wasComplete) {
    const nowComplete = isComplete(habit, selectedDate);
    if (!nowComplete || wasComplete) return;   // only on the transition to done

    buzz(15);
    Sounds.play('complete');
    const row = $$('#habitList .habit-row').find(
      (node) => node.dataset.habitId === habit.id
    );
    if (row && !reducedMotion.matches) {
      row.classList.add('just-done');
      const check = $('.check-btn', row);
      if (check) check.classList.add('just-done');
    }

    const stats = dayStats(selectedDate);
    if (stats.due > 0 && stats.done === stats.due) {
      buzz([0, 18, 60, 28]);
      Sounds.play('celebrate');
      const ring = $('.summary-ring');
      if (ring && !reducedMotion.matches) {
        ring.classList.add('celebrate');
        setTimeout(() => ring.classList.remove('celebrate'), 800);
      }
      toast('🎉 ' + t('allDoneTitle'));
    }
  }

  /* Water gets an actual drop; everything else counted gets a softer tick.
     Matching the sound to the habit is the whole charm of this. */
  const WATERY = /agua|water|hidrat|drink|bebe|vaso|glass/i;
  const soundForIncrement = (habit) =>
    WATERY.test(habitName(habit) + ' ' + (habit.unit || '')) || habit.emoji === '💧' ? 'drop' : 'tick';

  /* ── Press and hold on + / − ──────────────────────────────────────────
     A tap still moves one unit. Holding starts slow and speeds up, so ten
     minutes is a held thumb rather than ten taps.

     Nothing here calls renderToday(): rebuilding the list mid-hold would
     destroy the very button the finger is resting on. The row is patched in
     place instead, and the full render happens once, on release. */
  const HOLD_DELAY = 420;      // before the first repeat
  const HOLD_START = 260;      // first repeat interval
  const HOLD_FLOOR = 55;       // fastest it will ever go
  const HOLD_ACCEL = 0.82;     // each repeat is a little quicker
  const HOLD_SOUND_GAP = 140;  // one drop per this many ms, not per unit

  let hold = null;

  function patchQuantityRow(habit) {
    const row = $$('#habitList .habit-row').find((n) => n.dataset.habitId === habit.id);
    if (!row) return;
    const value = valueOf(habit, selectedDate);
    const readout = $('.qty-value strong', row);
    if (readout) readout.textContent = value;
    const fill = $('.progress-fill', row);
    if (fill) fill.style.width = Math.min(100, (value / targetOf(habit)) * 100) + '%';
    const minus = $('.qty-btn', row);
    if (minus) minus.disabled = value <= 0;
    row.classList.toggle('is-done', isComplete(habit, selectedDate));

    // Keep the ring honest while the counter runs; streaks can wait for release.
    const stats = dayStats(selectedDate);
    const circumference = 2 * Math.PI * 52;
    const ring = $('#ringValue');
    if (ring) ring.setAttribute('stroke-dashoffset', (circumference * (1 - stats.pct / 100)).toFixed(1));
    const pct = $('#summaryPct');
    if (pct) pct.textContent = stats.pct + '%';
    const count = $('#summaryCount');
    if (count) count.textContent = stats.done + '/' + stats.due;
  }

  function holdStep(habit, delta) {
    const before = valueOf(habit, selectedDate);
    const wasComplete = isComplete(habit, selectedDate);
    setValue(habit, selectedDate, before + delta);
    const after = valueOf(habit, selectedDate);
    if (after === before) return false;          // hit a limit; stop repeating

    const now = Date.now();
    if (now - hold.lastSound >= HOLD_SOUND_GAP) {
      hold.lastSound = now;
      Sounds.play(delta > 0 ? soundForIncrement(habit) : 'undo');
    }
    // The moment it crosses the target is worth marking, once.
    if (!wasComplete && isComplete(habit, selectedDate)) {
      Sounds.play('complete');
      buzz(15);
    }
    patchQuantityRow(habit);
    return true;
  }

  function stopHold() {
    if (!hold) return;
    clearTimeout(hold.timer);
    const { habit, wasComplete, repeats } = hold;
    hold = null;
    if (repeats > 0) {
      // Re-render once so streaks, ordering and the day strip catch up.
      renderToday();
      celebrate(habit, wasComplete);
      renderProgressIfVisible();
    }
  }

  function startHold(habit, delta, btn, evt) {
    stopHold();
    hold = {
      habit: habit,
      delta: delta,
      wasComplete: isComplete(habit, selectedDate),
      repeats: 0,
      interval: HOLD_START,
      lastSound: 0,
      timer: null,
    };

    try {
      btn.setPointerCapture(evt.pointerId);       // a small slip must not cancel it
    } catch (err) { /* mouse without capture support */ }

    holdStep(habit, delta);                        // the tap itself

    const repeat = () => {
      if (!hold) return;
      if (!holdStep(habit, delta)) { stopHold(); return; }
      hold.repeats++;
      hold.interval = Math.max(HOLD_FLOOR, hold.interval * HOLD_ACCEL);
      hold.timer = setTimeout(repeat, hold.interval);
    };
    hold.timer = setTimeout(repeat, HOLD_DELAY);
  }

  function bump(habit, delta) {
    const wasComplete = isComplete(habit, selectedDate);
    const before = valueOf(habit, selectedDate);
    setValue(habit, selectedDate, before + delta);
    const after = valueOf(habit, selectedDate);

    if (after !== before) {
      Sounds.play(delta > 0 ? soundForIncrement(habit) : 'undo');
    }
    renderToday();
    celebrate(habit, wasComplete);
    renderProgressIfVisible();
  }

  /**
   * Wires one +/− button for both a tap and a hold.
   *
   * Pointer events drive the hold, so the click listener would double-count —
   * except for keyboard activation, which produces a click with no pointer
   * behind it. detail === 0 is how that case is told apart.
   */
  function bindHold(btn, habit, delta) {
    btn.addEventListener('pointerdown', (evt) => {
      if (evt.button > 0) return;
      evt.preventDefault();                  // no text selection, no scroll
      startHold(habit, delta, btn, evt);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
      btn.addEventListener(type, stopHold);
    });
    btn.addEventListener('click', (evt) => {
      if (evt.detail !== 0) return;          // already handled by the pointer
      bump(habit, delta);
    });
  }

  function controlFor(habit, complete) {
    if (habit.type === 'quantity') {
      const wrap = document.createElement('div');
      wrap.className = 'qty-control';
      const value = valueOf(habit, selectedDate);
      const stepSize = habit.step || 1;

      const minus = button('qty-btn', '−', { 'aria-label': '-1' });
      minus.disabled = value <= 0;
      bindHold(minus, habit, -stepSize);

      const readout = document.createElement('span');
      readout.className = 'qty-value';
      readout.innerHTML = '<strong>' + value + '</strong> / ' + targetOf(habit) +
        (habit.unit ? ' ' + escapeHtml(habit.unit) : '');

      const plus = button('qty-btn', '+', { 'aria-label': '+1' });
      bindHold(plus, habit, stepSize);

      wrap.append(minus, readout, plus);
      return wrap;
    }

    const check = button('check-btn', null, {
      'aria-pressed': String(complete),
      'aria-label': habitName(habit) + ' — ' + t('doneToday'),
    });
    check.addEventListener('click', () => {
      setValue(habit, selectedDate, complete ? 0 : 1);
      if (complete) Sounds.play('uncomplete');   // celebrate() sounds the other way
      renderToday();
      celebrate(habit, complete);
      renderProgressIfVisible();
    });
    return check;
  }

  function renderHabitList() {
    const list = $('#habitList');
    const all = activeHabits();
    const due = habitsFor(selectedDate);
    const shown = showAllToday ? all : due;
    list.innerHTML = '';
    $('#todayEmpty').hidden = shown.length > 0;
    $('#todayEmpty').querySelector('p').textContent =
      all.length === 0 ? t('emptyHabitsTitle') : t('emptyTodayTitle');

    shown.forEach((habit) => {
      const scheduled = isScheduled(habit, selectedDate);
      const complete = isComplete(habit, selectedDate);
      const li = document.createElement('li');
      li.className = 'habit-row' + (complete ? ' is-done' : '') + (scheduled ? '' : ' is-off');
      li.dataset.habitId = habit.id;
      li.style.setProperty('--habit-color', colorVar(habit));

      const badge = document.createElement('span');
      badge.className = 'habit-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = habit.emoji || '✅';

      /* With a description the body of the row becomes a button that expands
         it. A real button, not a click handler on the <li>, so it is reachable
         by keyboard and announced as expandable. The tick and the +/- controls
         are siblings, so tapping them never opens the description. */
      const hasDescription = !!habitDesc(habit).trim();
      const expanded = hasDescription && expandedDesc.has(habit.id);
      const main = hasDescription
        ? button('habit-main', null, { 'aria-expanded': String(expanded) })
        : document.createElement('div');
      if (!hasDescription) main.className = 'habit-main';
      const name = document.createElement('span');
      name.className = 'habit-name';
      name.textContent = habitName(habit);

      const meta = document.createElement('span');
      meta.className = 'habit-meta';
      const streak = streakOf(habit);
      if (streak.count > 0) {
        const flame = document.createElement('span');
        flame.className = 'streak';
        flame.innerHTML = iconSvg('i-flame', 13);
        flame.appendChild(document.createTextNode(' ' + streakLabel(streak)));
        meta.appendChild(flame);
      }
      const sched = document.createElement('span');
      sched.className = 'sched';   // denser layouts hide this
      sched.textContent = scheduled ? scheduleLabel(habit) : t('notToday');
      meta.appendChild(sched);
      main.append(name, meta);

      if (habit.type === 'quantity') {
        const track = document.createElement('div');
        track.className = 'progress-track';
        const fill = document.createElement('div');
        fill.className = 'progress-fill';
        fill.style.width = Math.min(100, (valueOf(habit, selectedDate) / targetOf(habit)) * 100) + '%';
        track.appendChild(fill);
        main.appendChild(track);
      }

      li.append(badge, main, controlFor(habit, complete));

      if (hasDescription) {
        const chevron = document.createElement('span');
        chevron.className = 'habit-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.innerHTML = iconSvg('i-chevron', 14);
        name.appendChild(chevron);

        const note = document.createElement('p');
        note.className = 'habit-desc';
        note.textContent = habitDesc(habit);
        note.hidden = !expanded;
        li.appendChild(note);
        li.classList.toggle('is-expanded', expanded);
        main.addEventListener('click', () => {
          if (expandedDesc.has(habit.id)) expandedDesc.delete(habit.id);
          else expandedDesc.add(habit.id);
          Sounds.play('tick');
          renderHabitList();
        });
      }

      list.appendChild(li);
    });
  }

  function renderToday() {
    renderCastPromo();
    renderDayStrip();
    renderSummary();
    renderMood();
    renderHabitList();
  }

  /* ── Habits view ───────────────────────────────────────────────────── */
  const PRESETS = [
    { key: 'presetMeditate', desc: 'dsMeditate', emoji: '🧘', colorIndex: 7, category: 'mental', type: 'quantity', target: 10, unitKey: 'unitMin', schedule: { kind: 'daily' } },
    { key: 'presetGratitude', desc: 'dsGratitude', emoji: '🙏', colorIndex: 5, category: 'mental', type: 'binary', schedule: { kind: 'daily' } },
    { key: 'presetWalk', desc: 'dsWalk', emoji: '🚶', colorIndex: 3, category: 'fitness', type: 'binary', schedule: { kind: 'daily' } },
    { key: 'presetGym', desc: 'dsStrength', emoji: '💪', colorIndex: 2, category: 'fitness', type: 'binary', schedule: { kind: 'times', times: 3 } },
    { key: 'presetWater', desc: 'dsWater', emoji: '💧', colorIndex: 1, category: 'health', type: 'quantity', target: 8, unitKey: 'unitGlasses', schedule: { kind: 'daily' } },
    { key: 'presetSleep', desc: 'dsSleepEarly', emoji: '😴', colorIndex: 4, category: 'health', type: 'binary', schedule: { kind: 'daily' } },
    { key: 'presetRead', desc: 'dsRead', emoji: '📖', colorIndex: 6, category: 'focus', type: 'quantity', target: 20, unitKey: 'unitPages', schedule: { kind: 'daily' } },
    { key: 'presetNoPhone', desc: 'dsNoPhoneBed', emoji: '📵', colorIndex: 8, category: 'mental', type: 'binary', schedule: { kind: 'daily' } },
  ];

  function renderPresets() {
    const grid = $('#presetGrid');
    grid.innerHTML = '';

    /* Once the test has been taken, its suggestions replace the generic
       starters — same chips, but the habits and targets are the ones that
       matched the answers. */
    const answers = state.onboarding && state.onboarding.answers;
    if (answers) {
      const suggested = buildSuggestions(answers).suggested;
      if (suggested.length) {
        suggested.forEach((habit) => {
          const chip = button('preset-chip', null);
          chip.innerHTML = '<span aria-hidden="true">' + habit.emoji + '</span>';
          chip.appendChild(document.createTextNode(habitName(habit)));
          chip.addEventListener('click', () => {
            state.habits.push(Object.assign({
              id: uid(), reminders: [], schedule: { kind: 'daily' },
              createdAt: todayKey(), archived: false,
            }, {
              name: habit.name, nameKey: habit.nameKey || '',
              description: habit.description || '', descKey: habit.descKey || '',
              emoji: habit.emoji, colorIndex: habit.colorIndex,
              category: habit.category, type: habit.type,
              target: habit.target, unit: habit.unit,
            }));
            save();
            Sounds.play('complete');
            renderHabitsView();
            renderToday();
            toast(t('habitSaved'));
          });
          grid.appendChild(chip);
        });
        return;
      }
    }

    PRESETS.forEach((preset) => {
      const chip = button('preset-chip', null);
      chip.innerHTML = '<span aria-hidden="true">' + preset.emoji + '</span>';
      chip.appendChild(document.createTextNode(t(preset.key)));
      chip.addEventListener('click', () => {
        state.habits.push({
          id: uid(),
          name: t(preset.key),
          nameKey: preset.key,
          description: preset.desc ? t(preset.desc) : '',
          descKey: preset.desc || '',
          emoji: preset.emoji,
          colorIndex: preset.colorIndex,
          category: preset.category,
          type: preset.type,
          target: preset.target || 1,
          unit: preset.unitKey ? t(preset.unitKey) : '',
          schedule: JSON.parse(JSON.stringify(preset.schedule)),
          createdAt: todayKey(),
          archived: false,
        });
        save();
        renderHabitsView();
        renderToday();
        toast(t('habitSaved'));
      });
      grid.appendChild(chip);
    });
  }

  function manageRow(habit, archived) {
    const li = document.createElement('li');
    li.className = 'manage-row';
    li.dataset.habitId = habit.id;
    li.style.setProperty('--habit-color', colorVar(habit));

    if (!archived) {
      const handle = document.createElement('span');
      handle.className = 'drag-handle';
      handle.setAttribute('aria-hidden', 'true');   // arrows below are the accessible route
      handle.title = t('dragHint');
      handle.innerHTML = iconSvg('i-grip', 16);
      handle.addEventListener('pointerdown', (evt) => startDrag(evt, li, habit.id));
      li.appendChild(handle);
    }

    const badge = document.createElement('span');
    badge.className = 'habit-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = habit.emoji || '✅';

    const open = button('habit-main', null, { 'aria-label': t('editHabit') + ': ' + habitName(habit) });
    open.style.textAlign = 'left';
    const name = document.createElement('span');
    name.className = 'habit-name';
    name.textContent = habitName(habit);
    const meta = document.createElement('span');
    meta.className = 'habit-meta';
    meta.textContent = scheduleLabel(habit) + ' · ' +
      (habit.type === 'quantity' ? targetOf(habit) + ' ' + (habit.unit || '') : t('typeBinary'));
    open.append(name, meta);
    open.addEventListener('click', () => openHabitDialog(habit.id));

    const actions = document.createElement('div');
    actions.className = 'manage-actions';

    if (archived) {
      const restore = button('icon-btn', null, { 'aria-label': t('restore'), title: t('restore') });
      restore.innerHTML = iconSvg('i-restore');
      restore.addEventListener('click', () => {
        habit.archived = false;
        save();
        renderHabitsView();
        renderToday();
        toast(t('habitRestored'));
      });
      actions.appendChild(restore);
    } else {
      const archive = button('icon-btn', null, { 'aria-label': t('archive'), title: t('archive') });
      archive.innerHTML = iconSvg('i-archive');
      archive.addEventListener('click', () => {
        habit.archived = true;
        save();
        renderHabitsView();
        renderToday();
        toast(t('habitArchived'));
      });
      const up = button('icon-btn', '↑', { 'aria-label': t('moveUp'), title: t('moveUp') });
      up.addEventListener('click', () => reorder(habit.id, -1));
      const down = button('icon-btn', '↓', { 'aria-label': t('moveDown'), title: t('moveDown') });
      down.addEventListener('click', () => reorder(habit.id, 1));
      actions.append(up, down, archive);
    }

    li.append(badge, open, actions);
    return li;
  }

  /* ── Drag to reorder ────────────────────────────────────────────────
     Pointer-events based so one path covers touch, pen and mouse. The row
     follows the finger while its neighbours slide out of the way; the list
     is only rewritten once, on release. */
  let drag = null;

  function startDrag(evt, row, habitId) {
    if (drag || evt.button > 0) return;
    evt.preventDefault();

    const list = row.parentElement;
    const rows = Array.from(list.children);
    const rect = row.getBoundingClientRect();

    drag = {
      row: row,
      habitId: habitId,
      list: list,
      rows: rows,
      startY: evt.clientY,
      from: rows.indexOf(row),
      to: rows.indexOf(row),
      step: rect.height + 8,          // row height plus the list gap
      pointerId: evt.pointerId,
    };

    row.classList.add('is-dragging');
    row.setPointerCapture(evt.pointerId);
    row.addEventListener('pointermove', onDragMove);
    row.addEventListener('pointerup', endDrag);
    row.addEventListener('pointercancel', endDrag);
    buzz(8);
    Sounds.play('lift');
  }

  function onDragMove(evt) {
    if (!drag) return;
    const offset = evt.clientY - drag.startY;
    drag.row.style.transform = 'translateY(' + offset + 'px)';

    const moved = Math.round(offset / drag.step);
    const target = Math.max(0, Math.min(drag.rows.length - 1, drag.from + moved));
    if (target === drag.to) return;
    drag.to = target;

    // Shift the rows the dragged one has passed over.
    drag.rows.forEach((node, index) => {
      if (node === drag.row) return;
      let shift = 0;
      if (drag.from < drag.to && index > drag.from && index <= drag.to) shift = -drag.step;
      else if (drag.from > drag.to && index >= drag.to && index < drag.from) shift = drag.step;
      node.style.setProperty('--shift', shift + 'px');
      node.classList.toggle('is-shifted', shift !== 0);
    });
  }

  function endDrag() {
    if (!drag) return;
    const { row, from, to, habitId } = drag;

    row.removeEventListener('pointermove', onDragMove);
    row.removeEventListener('pointerup', endDrag);
    row.removeEventListener('pointercancel', endDrag);
    row.classList.remove('is-dragging');
    row.style.transform = '';
    drag.rows.forEach((node) => {
      node.classList.remove('is-shifted');
      node.style.removeProperty('--shift');
    });
    drag = null;

    if (from === to) return;
    reorder(habitId, to - from);
    toast(t('reordered'));
  }

  function reorder(id, delta) {
    const list = state.habits;
    const from = list.findIndex((h) => h.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    save();
    renderHabitsView();
    renderToday();
  }

  function renderHabitsView() {
    const active = activeHabits();
    const archived = state.habits.filter((h) => h.archived);
    const list = $('#manageList');
    list.innerHTML = '';
    active.forEach((h) => list.appendChild(manageRow(h, false)));
    $('#habitsEmpty').hidden = active.length > 0;
    if (active.length === 0) renderPresets();

    const block = $('#archiveBlock');
    block.hidden = archived.length === 0;
    const archList = $('#archiveList');
    archList.innerHTML = '';
    archived.forEach((h) => archList.appendChild(manageRow(h, true)));
  }

  /* ── Habit editor ──────────────────────────────────────────────────── */
  let draft = null;

  function blankDraft() {
    return {
      id: null,
      name: '',
      emoji: '🧘',
      colorIndex: 1,
      category: 'mental',
      description: '',
      type: 'binary',
      target: 1,
      unit: '',
      reminders: [],
      schedule: { kind: 'daily', days: [1, 3, 5], times: 3 },
    };
  }

  function buildEmojiGrid() {
    const grid = $('#emojiGrid');
    grid.innerHTML = '';
    EMOJIS.forEach((emoji) => {
      const btn = button('emoji-btn', emoji, { role: 'radio', 'aria-checked': String(draft.emoji === emoji), 'aria-label': emoji });
      btn.addEventListener('click', () => {
        draft.emoji = emoji;
        buildEmojiGrid();
      });
      grid.appendChild(btn);
    });
  }

  function buildColorRow() {
    const row = $('#colorRow');
    row.innerHTML = '';
    for (let i = 1; i <= 8; i++) {
      const btn = button('swatch', null, { role: 'radio', 'aria-checked': String(draft.colorIndex === i), 'aria-label': 'Color ' + i });
      btn.style.background = 'var(--s' + i + ')';
      btn.addEventListener('click', () => {
        draft.colorIndex = i;
        buildColorRow();
      });
      row.appendChild(btn);
    }
  }

  function buildSegmented(host, options, current, onPick) {
    host.innerHTML = '';
    options.forEach((opt) => {
      const btn = button('', opt.label, { role: 'radio', 'aria-checked': String(current === opt.value) });
      btn.addEventListener('click', () => onPick(opt.value));
      host.appendChild(btn);
    });
  }

  function buildDowRow() {
    const row = $('#dowRow');
    row.innerHTML = '';
    dowNames(false).forEach((day) => {
      const on = draft.schedule.days.includes(day.dow);
      const btn = button('dow-btn', day.label, { 'aria-pressed': String(on) });
      btn.addEventListener('click', () => {
        const days = draft.schedule.days;
        const at = days.indexOf(day.dow);
        if (at >= 0) days.splice(at, 1);
        else days.push(day.dow);
        buildDowRow();
      });
      row.appendChild(btn);
    });
  }

  function syncDialogFields() {
    $('#quantityFields').hidden = draft.type !== 'quantity';
    $('#daysField').hidden = draft.schedule.kind !== 'days';
    $('#timesField').hidden = draft.schedule.kind !== 'times';

    buildSegmented($('#typeSelect'), [
      { value: 'binary', label: t('typeBinary') },
      { value: 'quantity', label: t('typeQuantity') },
    ], draft.type, (value) => {
      draft.type = value;
      syncDialogFields();
    });

    buildSegmented($('#scheduleSelect'), [
      { value: 'daily', label: t('schedDaily') },
      { value: 'days', label: t('schedDays') },
      { value: 'times', label: t('schedTimes') },
    ], draft.schedule.kind, (value) => {
      draft.schedule.kind = value;
      syncDialogFields();
    });

    buildDowRow();
  }

  function openHabitDialog(id) {
    editingId = id || null;
    const existing = id ? habitById(id) : null;
    draft = existing
      ? {
          id: existing.id,
          name: habitName(existing),
          nameKey: existing.nameKey || '',
          description: habitDesc(existing),
          descKey: existing.descKey || '',
          emoji: existing.emoji || '🧘',
          colorIndex: existing.colorIndex || 1,
          category: existing.category || 'other',
          type: existing.type || 'binary',
          target: existing.target || 1,
          unit: existing.unit || '',
          reminders: (existing.reminders || []).slice(),
          schedule: Object.assign({ kind: 'daily', days: [1, 3, 5], times: 3 }, existing.schedule),
        }
      : blankDraft();
    if (!Array.isArray(draft.schedule.days)) draft.schedule.days = [1, 3, 5];

    $('#habitDialogTitle').textContent = existing ? t('editHabit') : t('addHabit');
    $('#fName').value = draft.name;
    $('#fDescription').value = draft.description || '';
    $('#fTarget').value = draft.target;
    $('#fUnit').value = draft.unit;
    $('#fTimes').value = draft.schedule.times || 3;
    $('#fCategory').value = draft.category;
    $('#formError').hidden = true;
    $('#btnDeleteHabit').hidden = !existing;

    // Reminders need the shell to schedule an alarm, so hide them in a browser.
    $('#reminderField').hidden = !shell;
    renderReminderTimes();

    buildEmojiGrid();
    buildColorRow();
    syncDialogFields();
    $('#habitDialog').showModal();
    setTimeout(() => $('#fName').focus(), 60);
  }

  function readDialog() {
    draft.name = $('#fName').value.trim();
    draft.description = $('#fDescription').value.trim();
    draft.target = parseInt($('#fTarget').value, 10) || 0;
    draft.unit = $('#fUnit').value.trim();
    draft.category = $('#fCategory').value;
    draft.reminders = cleanTimes(shell
      ? $$('#reminderList input').map((input) => input.value)
      : draft.reminders);
    draft.schedule.times = Math.max(1, Math.min(7, parseInt($('#fTimes').value, 10) || 3));
  }

  const MAX_REMINDERS = 4;

  /* The editor's reminder times. Each row is a real time input, so the
     platform's own picker does the work. */
  function renderReminderTimes() {
    const list = $('#reminderList');
    list.innerHTML = '';
    draft.reminders.forEach((time, index) => {
      const row = document.createElement('div');
      row.className = 'reminder-row';
      const input = document.createElement('input');
      input.type = 'time';
      input.value = time;
      input.setAttribute('aria-label', t('fieldReminders') + ' ' + (index + 1));
      input.addEventListener('change', () => {
        if (TIME_RE.test(input.value)) draft.reminders[index] = input.value;
      });
      const remove = button('icon-btn', null, { 'aria-label': t('reminderRemove'), title: t('reminderRemove') });
      remove.innerHTML = iconSvg('i-close', 16);
      remove.addEventListener('click', () => {
        draft.reminders = $$('#reminderList input').map((field) => field.value);
        draft.reminders.splice(index, 1);
        renderReminderTimes();
      });
      row.append(input, remove);
      list.appendChild(row);
    });
    $('#btnAddReminder').hidden = draft.reminders.length >= MAX_REMINDERS;

    const lines = castLines(state.character);
    $('#reminderHint').textContent = !draft.reminders.length ? t('reminderNone')
      : lines ? t('reminderFrom', lines.name) : t('reminderPlain');
  }

  function addReminderTime() {
    draft.reminders = $$('#reminderList input').map((field) => field.value);
    if (draft.reminders.length >= MAX_REMINDERS) return;
    // Nine in the morning, or three hours after the last one.
    const last = draft.reminders[draft.reminders.length - 1];
    draft.reminders.push(last && TIME_RE.test(last)
      ? pad((parseInt(last, 10) + 3) % 24) + last.slice(2)
      : '09:00');
    renderReminderTimes();
    const inputs = $$('#reminderList input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  function saveHabit() {
    readDialog();
    const fail = (msg) => {
      const box = $('#formError');
      box.textContent = msg;
      box.hidden = false;
      return false;
    };
    if (!draft.name) return fail(t('errName'));
    if (draft.type === 'quantity' && draft.target < 1) return fail(t('errTarget'));
    if (draft.schedule.kind === 'days' && draft.schedule.days.length === 0) return fail(t('errDays'));

    const payload = {
      name: draft.name,
      /* The key survives only while the text still matches its translation.
         Rename it and the habit becomes yours: a language switch will never
         overwrite your words again. */
      nameKey: draft.nameKey && draft.name === t(draft.nameKey) ? draft.nameKey : '',
      description: draft.description || '',
      descKey: draft.descKey && draft.description === t(draft.descKey) ? draft.descKey : '',
      emoji: draft.emoji,
      colorIndex: draft.colorIndex,
      category: draft.category,
      type: draft.type,
      target: draft.type === 'quantity' ? draft.target : 1,
      unit: draft.type === 'quantity' ? draft.unit : '',
      reminders: draft.reminders,
      schedule: draft.schedule,
    };

    if (editingId) {
      Object.assign(habitById(editingId), payload);
    } else {
      state.habits.push(Object.assign({ id: uid(), createdAt: todayKey(), archived: false }, payload));
    }
    save();
    // Ask for notification access only once the user actually wants a reminder.
    if (draft.reminders.length && shell && shell.requestNotificationPermission) {
      try { shell.requestNotificationPermission(); } catch (err) { /* older shell */ }
    }
    $('#habitDialog').close();
    renderHabitsView();
    renderToday();
    renderProgressIfVisible();
    toast(t(draft.reminders.length ? 'reminderSaved' : 'habitSaved'));
    return true;
  }

  /* ── Progress view ─────────────────────────────────────────────────── */
  function levelFor(ratio) {
    if (ratio <= 0) return 0;
    if (ratio >= 1) return 5;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  }

  function statTile(value, label) {
    const box = document.createElement('div');
    box.className = 'stat-tile';
    const v = document.createElement('span');
    v.className = 'stat-value';
    v.textContent = value;
    const l = document.createElement('span');
    l.className = 'stat-label';
    l.textContent = label;
    box.append(v, l);
    return box;
  }

  function renderRangeSelect() {
    buildSegmented($('#rangeSelect'), [
      { value: 7, label: t('range7') },
      { value: 30, label: t('range30') },
      { value: 90, label: t('range90') },
    ], range, (value) => {
      range = value;
      renderProgress();
    });
  }

  function renderProgressStats(days) {
    const stats = rangeStats(days);
    const grid = $('#progressStats');
    grid.innerHTML = '';
    grid.append(
      statTile(stats.completion + '%', t('statCompletion')),
      statTile(String(stats.perfect), t('statPerfectDays')),
      statTile(stats.avgMood ? stats.avgMood.toFixed(1) : t('noneYet'), t('statAvgMood')),
      statTile(String(stats.moodDays), t('statLogged'))
    );
  }

  function renderMoodChart(days) {
    const has = days.some((key) => state.moods[key] && state.moods[key].score);
    $('#chartMoodEmpty').hidden = has;
    const host = $('#chartMood');
    host.hidden = !has;
    if (!has) { host.innerHTML = ''; return; }

    const points = days.map((key) => {
      const mood = state.moods[key];
      const score = mood && mood.score ? mood.score : null;
      const dateLabel = fmtDate(key, { day: 'numeric', month: 'short' });
      let tip = '<b>' + dateLabel + '</b>';
      if (score) {
        tip += '<br>' + MOOD_EMOJI[score] + ' ' + t('mood' + score);
        if (mood.note) tip += '<br><span class="tip-sub">' + escapeHtml(mood.note.slice(0, 60)) + '</span>';
      }
      return { label: dateLabel, value: score, tip: tip };
    });

    Charts.line(host, {
      points: points,
      min: 1,
      max: 5,
      yTicks: [1, 2, 3, 4, 5],
      color: 'var(--s1)',
      ariaLabel: t('chartMoodTitle'),
    });
  }

  function renderRatesChart(days) {
    const items = activeHabits()
      .map((habit) => {
        const rate = habitRate(habit, days);
        return { habit: habit, rate: rate };
      })
      .filter((row) => row.rate.due > 0)
      .sort((a, b) => b.rate.pct - a.rate.pct);

    $('#chartRatesEmpty').hidden = items.length > 0;
    const host = $('#chartRates');
    host.hidden = items.length === 0;
    $('#chartRatesSub').textContent = t('chartRatesSubFmt', days.length);
    if (!items.length) { host.innerHTML = ''; return; }

    Charts.bars(host, {
      max: 100,
      ariaLabel: t('chartRatesTitle'),
      items: items.map((row) => ({
        label: row.habit.emoji + ' ' + habitName(row.habit),
        value: row.rate.pct,
        valueLabel: row.rate.pct + '%',
        color: colorVar(row.habit),
        sub: row.rate.done + '/' + row.rate.due,
        tip: '<b>' + escapeHtml(habitName(row.habit)) + '</b><br>' + row.rate.done + ' ' + t('of') + ' ' + row.rate.due,
      })),
    });
  }

  function renderHeatSelect() {
    const select = $('#heatHabit');
    const previous = heatHabitId;
    select.innerHTML = '';
    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = t('allHabits');
    select.appendChild(all);
    activeHabits().forEach((habit) => {
      const opt = document.createElement('option');
      opt.value = habit.id;
      opt.textContent = habit.emoji + ' ' + habitName(habit);
      select.appendChild(opt);
    });
    heatHabitId = habitById(previous) && !habitById(previous).archived ? previous : 'all';
    select.value = heatHabitId;
  }

  function renderHeatmap(days) {
    const host = $('#chartHeat');
    const habit = heatHabitId === 'all' ? null : habitById(heatHabitId);

    const cells = days.map((key) => {
      const dateLabel = fmtDate(key, { weekday: 'short', day: 'numeric', month: 'short' });
      let level = 0;
      let scheduled = true;
      let detail;
      if (habit) {
        scheduled = isScheduled(habit, key);
        const ratio = valueOf(habit, key) / targetOf(habit);
        level = levelFor(ratio);
        detail = habit.type === 'quantity'
          ? valueOf(habit, key) + ' / ' + targetOf(habit) + (habit.unit ? ' ' + habit.unit : '')
          : isComplete(habit, key) ? t('doneToday') : '—';
      } else {
        const stats = dayStats(key);
        scheduled = stats.due > 0;
        level = levelFor(stats.due ? stats.done / stats.due : 0);
        detail = stats.done + '/' + stats.due;
      }
      const date = parseKey(key);
      return {
        level: level,
        scheduled: scheduled,
        monthLabel: date.getDate() <= 7 ? date.toLocaleDateString(I18N.locale(), { month: 'short' }) : null,
        tip: '<b>' + dateLabel + '</b><br><span class="tip-sub">' + escapeHtml(detail) + '</span>',
      };
    });

    const first = parseKey(days[0]);
    Charts.heatmap(host, {
      days: cells,
      firstOffset: (first.getDay() - state.weekStart + 7) % 7,
      dowLabels: dowNames(true).map((d) => d.label),
      lessLabel: t('less'),
      moreLabel: t('more'),
      ariaLabel: t('chartHeatTitle'),
    });
  }

  /* Average mood on days the habit was completed versus days it was not.
     Needs at least two days on each side before it says anything. */
  function renderCorrelation(days) {
    const groups = [];
    activeHabits().forEach((habit) => {
      let doneSum = 0, doneN = 0, missSum = 0, missN = 0;
      days.forEach((key) => {
        const mood = state.moods[key];
        if (!mood || !mood.score || !isScheduled(habit, key)) return;
        if (isComplete(habit, key)) { doneSum += mood.score; doneN++; }
        else { missSum += mood.score; missN++; }
      });
      if (doneN < 2 || missN < 2) return;
      groups.push({
        label: habit.emoji + ' ' + habitName(habit),
        values: [
          { value: doneSum / doneN, valueLabel: (doneSum / doneN).toFixed(1), tip: '<b>' + t('legendDone') + '</b><br>' + doneN + ' ' + (I18N.getLang() === 'es' ? 'días' : 'days') },
          { value: missSum / missN, valueLabel: (missSum / missN).toFixed(1), tip: '<b>' + t('legendMissed') + '</b><br>' + missN + ' ' + (I18N.getLang() === 'es' ? 'días' : 'days') },
        ],
      });
    });

    $('#chartCorrEmpty').hidden = groups.length > 0;
    const host = $('#chartCorr');
    host.hidden = groups.length === 0;
    if (!groups.length) { host.innerHTML = ''; return; }

    Charts.groupedBars(host, {
      groups: groups,
      max: 5,
      series: [
        { name: t('legendDone'), color: 'var(--s1)' },
        { name: t('legendMissed'), color: 'var(--s2)' },
      ],
      ariaLabel: t('chartCorrTitle'),
    });
  }

  function renderTable(days) {
    const head = $('#dataTableHead');
    const body = $('#dataTableBody');
    head.innerHTML = '<tr><th>' + t('tableDate') + '</th><th>' + t('tableMood') + '</th><th>' + t('tableDone') + '</th></tr>';
    body.innerHTML = '';
    days.slice().reverse().forEach((key) => {
      const stats = dayStats(key);
      const mood = state.moods[key];
      const tr = document.createElement('tr');
      const cells = [
        fmtDate(key, { day: 'numeric', month: 'short', year: undefined }),
        mood && mood.score ? MOOD_EMOJI[mood.score] + ' ' + mood.score : t('noneYet'),
        stats.due ? stats.done + '/' + stats.due : t('noneYet'),
      ];
      cells.forEach((text) => {
        const td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  function renderProgress() {
    const days = lastNDays(range);
    renderRangeSelect();
    renderProgressStats(days);
    renderMoodChart(days);
    renderRatesChart(days);
    renderHeatSelect();
    renderHeatmap(days);
    renderCorrelation(days);
    renderTable(days);
  }

  function renderProgressIfVisible() {
    if (view === 'progress') renderProgress();
  }

  /* ── Theme & language ──────────────────────────────────────────────── */
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function applyBackupNote() {
    const note = $('#backupNote');
    if (note) note.hidden = !shell;     // only the Android build backs up
  }

  function applySound() {
    Sounds.setEnabled(state.sound !== false);
    const box = $('#soundToggle');
    if (box) box.checked = state.sound !== false;
    const label = $('#soundState');
    if (label) label.textContent = t(state.sound !== false ? 'soundOn' : 'soundOff');
  }

  function applyTheme() {
    const resolved = state.theme === 'system' ? (systemDark.matches ? 'dark' : 'light') : state.theme;
    document.documentElement.setAttribute('data-theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0D1117' : '#F4F5F7');
    $('#themeSelect').value = state.theme;
  }

  function fillCategorySelect() {
    const select = $('#fCategory');
    select.innerHTML = '';
    CATEGORIES.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = t(cat.key);
      select.appendChild(opt);
    });
  }

  function applyLang() {
    I18N.setLang(state.lang);
    document.documentElement.lang = state.lang;
    document.title = t('appName');

    $$('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
    $$('[data-i18n-placeholder]').forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
    $$('[data-i18n-label]').forEach((node) => {
      const label = t(node.dataset.i18nLabel);
      node.setAttribute('aria-label', label);
      node.title = label;
    });

    $('#langToggleLabel').textContent = state.lang === 'es' ? 'EN' : 'ES';
    $('#langSelect').value = state.lang;
    $('#weekStart').value = String(state.weekStart);
    applySound();                     // its label is translated
    fillCategorySelect();
    buildLayoutPickers();
    renderCastSettings();
    renderChatButton();
    if (isChatOpen()) renderChat();
    updateViewTitle();
    updateStorageInfo();
    renderAll();
  }

  /**
   * Takes the app behind an overlay out of play.
   *
   * aria-modal tells a screen reader to ignore the background but does not
   * stop Tab from walking into it, so the splash and the starting test had
   * roughly two hundred reachable controls behind them. inert does both.
   */
  function setBackgroundInert(on) {
    ['#main', '.app-bar', '.tab-bar'].forEach((sel) => {
      const node = $(sel);
      if (node) node.inert = !!on;
    });
  }

  /* ── Layout and size ───────────────────────────────────────────────── */
  function applyLayout() {
    const root = document.documentElement;
    root.setAttribute('data-layout', LAYOUTS.includes(state.layout) ? state.layout : 'comfortable');
    root.setAttribute('data-density', DENSITIES.includes(state.density) ? state.density : 'default');
  }

  function buildLayoutPickers() {
    buildSegmented($('#layoutSelect'), LAYOUTS.map((value) => ({
      value: value,
      label: t('layout' + value.charAt(0).toUpperCase() + value.slice(1)),
    })), state.layout, (value) => {
      state.layout = value;
      save();
      applyLayout();
      buildLayoutPickers();
      renderToday();
    });

    buildSegmented($('#sizeSelect'), DENSITIES.map((value) => ({
      value: value,
      label: t('size' + value.charAt(0).toUpperCase() + value.slice(1)),
    })), state.density, (value) => {
      state.density = value;
      save();
      applyLayout();
      buildLayoutPickers();
      renderProgressIfVisible();   // charts measure their container, so redraw
    });
  }

  /* ── Android shell bridge ──────────────────────────────────────────────
     Habit data lives in this page's localStorage, which native code cannot
     read. The shell needs a copy to render its widget and schedule
     reminders, so a snapshot goes over after every save.

     The snapshot covers two weeks ahead, not just today. The widget used to
     take "today" from the last sync, so after midnight it kept showing
     yesterday — and ticked yesterday — until the app was opened. Now the
     shell reads the real date and finds that day in the snapshot. */
  const SNAPSHOT_DAYS = 14;

  /* The streak as it stood the evening before `key`, so the shell can carry
     it on from its own record of the days since. Days for daily habits,
     whole weeks for the ones with a weekly quota, exactly as streakOf()
     counts them. */
  function streakBase(habit, key) {
    const s = habit.schedule || { kind: 'daily' };
    let count = 0;
    if (s.kind === 'times') {
      const quota = Math.max(1, Math.min(7, s.times || 3));
      let cursor = addDays(weekStartOf(parseKey(key)), -7);
      for (let guard = 0; guard < 200; guard++) {
        if (habit.createdAt && keyOf(addDays(cursor, 6)) < habit.createdAt) break;
        let done = 0;
        for (let i = 0; i < 7; i++) {
          const day = keyOf(addDays(cursor, i));
          if (!(habit.createdAt && day < habit.createdAt) && isComplete(habit, day)) done++;
        }
        if (done < quota) break;
        count++;
        cursor = addDays(cursor, -7);
      }
      return count;
    }
    let cursor = addDays(parseKey(key), -1);
    for (let guard = 0; guard < 800; guard++) {
      const day = keyOf(cursor);
      if (habit.createdAt && day < habit.createdAt) break;
      if (isScheduled(habit, day)) {
        if (!isComplete(habit, day)) break;
        count++;
      }
      cursor = addDays(cursor, -1);
    }
    return count;
  }

  function buildSnapshot() {
    const today = todayKey();
    const habits = activeHabits();
    const lang = I18N.getLang();

    /* From the start of this week (a weekly quota needs the days already
       behind us) to two weeks ahead. */
    const days = {};
    const last = keyOf(addDays(parseKey(today), SNAPSHOT_DAYS));
    for (let d = weekStartOf(parseKey(today)); keyOf(d) <= last; d = addDays(d, 1)) {
      const key = keyOf(d);
      const values = {};
      habits.forEach((h) => {
        const v = valueOf(h, key);
        if (v) values[h.id] = v;
      });
      days[key] = { due: habits.filter((h) => isScheduled(h, key)).map((h) => h.id), values: values };
    }

    const cast = currentCast();
    const lines = cast ? castLines(cast.id) : null;
    const plural = (k) => t(k, 1000).replace('1000', '%d');

    return {
      v: 2,
      lang: lang,
      generated: today,
      weekStart: state.weekStart,
      habits: habits.map((h) => {
        const s = h.schedule || { kind: 'daily' };
        return {
          id: h.id,
          name: habitName(h),
          emoji: h.emoji || '✅',
          color: h.colorIndex || 1,
          type: h.type === 'quantity' ? 'quantity' : 'binary',
          target: targetOf(h),
          unit: h.unit || '',
          weekly: s.kind === 'times' ? Math.max(1, Math.min(7, s.times || 3)) : 0,
          base: streakBase(h, today),
        };
      }),
      days: days,
      reminders: habits.reduce((out, h) => {
        (h.reminders || []).forEach((time) => {
          out.push({
            id: h.id, time: time, name: habitName(h), emoji: h.emoji || '✅',
            msgs: cast ? reminderMessages(h, cast.id) : [],
          });
        });
        return out;
      }, []),
      character: cast ? {
        id: cast.id,
        name: lines.name,
        autoplay: !!state.voiceAutoplay,
        praise: lines.praise.map((text, i) => ({ text: text, voice: GLOW_CAST.voicePath(cast.id, lang, 'p' + (i + 1)) })),
      } : null,
      /* Everything the widget and the notifications print, in the app's own
         language rather than the phone's. */
      ui: {
        today: t('navToday'),
        open: t('wgOpen'),
        free: t('wgFree'),
        stale: t('wgStale'),
        more: t('wgMore'),
        progress: [t('wgP0'), t('wgP1'), t('wgP2'), t('wgP3'), t('wgP4')],
        mark: t('wgMark'),
        addOne: t('wgAddOne'),
        isDone: t('wgIsDone'),
        day1: t('streakDays', 1),
        dayN: plural('streakDays'),
        week1: t('streakWeeks', 1),
        weekN: plural('streakWeeks'),
        done: t('ntfDone'),
        listen: t('ntfListen'),
        voice: t('ntfVoice'),
        you: t('ntfYou'),
        plainTitle: t('ntfPlainTitle'),
        plainBody: t('ntfPlainBody'),
        doneReply: t('chatDoneReply', '%s'),
      },
    };
  }

  function syncToShell() {
    if (!shell || !shell.syncState) return;
    try {
      shell.syncState(JSON.stringify(buildSnapshot()));
    } catch (err) {
      console.warn('Could not sync to shell', err);
    }
  }

  /* Ticks made from the widget or a notification queue up natively; drain
     them through the normal write path so streaks and charts stay correct. */
  function applyPendingFromShell() {
    if (!shell || !shell.takePending) return;
    let actions;
    try {
      actions = JSON.parse(shell.takePending() || '[]');
    } catch (err) {
      console.warn('Could not read pending actions', err);
      return;
    }
    if (!Array.isArray(actions) || !actions.length) return;

    let changed = false;
    actions.forEach((action) => {
      const habit = habitById(action.habitId);
      if (!habit || habit.archived) return;
      const key = action.date || todayKey();
      if (action.action === 'toggle') {
        setValue(habit, key, isComplete(habit, key) ? 0 : targetOf(habit));
        changed = true;
      } else if (action.action === 'increment') {
        setValue(habit, key, valueOf(habit, key) + 1);
        changed = true;
      } else if (action.action === 'complete') {
        // A reminder's Done button: complete, never undo, whatever the app shows.
        setValue(habit, key, Math.max(valueOf(habit, key), targetOf(habit)));
        changed = true;
      }
    });
    if (changed) renderAll();
  }

  /* Messages the shell posted while the app was closed, and replies made
     from a notification. Each carries its own id, so a message handed over
     twice is still shown once. */
  function applyInboxFromShell() {
    if (!shell || !shell.takeInbox) return;
    let items;
    try {
      items = JSON.parse(shell.takeInbox() || '[]');
    } catch (err) {
      console.warn('Could not read the inbox', err);
      return;
    }
    if (!Array.isArray(items) || !items.length) return;

    const known = new Set(state.chat.map((m) => m.id));
    let unread = 0;
    items.forEach((item) => {
      if (!item || !item.id || known.has(item.id) || !GLOW_CAST.byId(item.char)) return;
      known.add(item.id);
      state.chat.push({
        id: String(item.id),
        at: Number(item.at) || Date.now(),
        from: item.from === 'me' ? 'me' : 'char',
        char: item.char,
        kind: String(item.kind || 'remind'),
        habitId: item.habitId || null,
        date: item.date || todayKey(),
        text: String(item.text || ''),
        voice: typeof item.voice === 'string' && /^voices\/[\w/-]+\.webm$/.test(item.voice) ? item.voice : null,
      });
      if (item.from !== 'me') unread++;
    });
    state.chat.sort((a, b) => a.at - b.at);
    if (state.chat.length > CHAT_LIMIT) state.chat.splice(0, state.chat.length - CHAT_LIMIT);
    if (isChatOpen()) renderChat();
    else state.chatUnread += unread;
    save();
    renderChatButton();
  }

  /* What the activity calls: on resume, when a notification opens the app,
     when a message arrives while it is open, and for the back button. */
  window.__glow = {
    applyPending: () => {
      applyPendingFromShell();
      applyInboxFromShell();
      renderCastSettings();
    },
    applyInbox: applyInboxFromShell,
    route: (name) => routeTo(name),
    back: () => handleBack(),
  };

  /* ══ Reminder cast ═══════════════════════════════════════════════════
     A character from characters.js sends each reminder as a chat message
     with a voice note. The Android shell posts them while the app is
     closed and hands them back through takeInbox(); the conversation is
     kept here, in the same record as everything else.

     Lines are chosen on this side, not natively, so one place knows how a
     habit maps to a line in both languages. */
  const CHAT_LIMIT = 150;
  const castLines = (id) => (id ? GLOW_CAST.lines(id, I18N.getLang()) : null);
  const currentCast = () => (state.character ? GLOW_CAST.byId(state.character) : null);

  /* What a character says about a habit: its own line when it came from the
     catalogue, a generic one that names it otherwise. A few candidates, so
     the shell can rotate them from one day to the next. */
  function reminderMessages(habit, id) {
    const lines = castLines(id);
    if (!lines) return [];
    const lang = I18N.getLang();
    const generic = lines.generic.map((g, i) => ({
      text: g.text.replace('{habit}', habitName(habit)),
      voice: GLOW_CAST.voicePath(id, lang, 'g' + (i + 1)),
    }));
    const key = GLOW_CAST.lineKeyFor(habit.nameKey);
    if (!key) return generic;
    const own = { text: lines.habits[key], voice: GLOW_CAST.voicePath(id, lang, 'h-' + key) };
    return [own, generic[0], own, generic[1]];
  }

  function praiseMessage(id) {
    const lines = castLines(id);
    const i = Math.floor(Math.random() * lines.praise.length);
    return { text: lines.praise[i], voice: GLOW_CAST.voicePath(id, I18N.getLang(), 'p' + (i + 1)) };
  }

  function introMessage(id) {
    return { text: castLines(id).intro, voice: GLOW_CAST.voicePath(id, I18N.getLang(), 'intro') };
  }

  function pushChat(message) {
    state.chat.push(Object.assign({
      id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: Date.now(),
      char: state.character,
      date: todayKey(),
    }, message));
    if (state.chat.length > CHAT_LIMIT) state.chat.splice(0, state.chat.length - CHAT_LIMIT);
  }

  /* Duration and waveform of every recording, written by the generator.
     Fetched once, the first time a voice note is drawn. */
  let voiceIndex = null;
  let voiceIndexLoading = null;

  function loadVoiceIndex() {
    if (voiceIndex || voiceIndexLoading) return;
    voiceIndexLoading = fetch('voices/index.json')
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}))
      .then((data) => {
        voiceIndex = (data && data.clips) || {};
        if (isChatOpen()) renderChat();
      });
  }

  const clipInfo = (path) =>
    (voiceIndex && voiceIndex[path.replace(/^voices\//, '').replace(/\.webm$/, '')]) || null;
  const fmtClock = (seconds) => {
    const whole = Math.max(0, Math.round(seconds));
    return Math.floor(whole / 60) + ':' + pad(whole % 60);
  };

  /* One player for the whole app: starting a note stops the one playing,
     the way a messaging app behaves. onTick(fraction, ended) drives the UI. */
  const voice = { audio: null, path: null, onTick: null, raf: 0 };

  function stopVoice() {
    if (voice.audio) voice.audio.pause();
    cancelAnimationFrame(voice.raf);
    const tick = voice.onTick;
    voice.audio = null;
    voice.path = null;
    voice.onTick = null;
    if (tick) tick(0, true);
  }

  function playVoice(path, onTick) {
    const again = voice.path === path;
    stopVoice();
    if (again) return;                       // a second tap stops it
    const audio = new Audio(path);
    voice.audio = audio;
    voice.path = path;
    voice.onTick = onTick || null;
    const frame = () => {
      if (voice.audio !== audio) return;
      if (voice.onTick && audio.duration) voice.onTick(Math.min(1, audio.currentTime / audio.duration), false);
      voice.raf = requestAnimationFrame(frame);
    };
    const end = () => { if (voice.audio === audio) stopVoice(); };
    audio.addEventListener('ended', end);
    audio.addEventListener('error', end);
    if (voice.onTick) voice.onTick(0, false);
    audio.play().then(frame).catch(end);
  }

  /* ── The conversation ── */
  const isChatOpen = () => !$('#chat').hidden;
  let pendingRoute = null;

  function openChat() {
    if (!currentCast()) {
      openCastPicker();
      return;
    }
    applyInboxFromShell();
    $('#chat').hidden = false;
    document.documentElement.classList.add('is-splashing');   // the same scroll lock
    setBackgroundInert(true);
    state.chatUnread = 0;
    save();
    renderChatButton();
    loadVoiceIndex();
    renderChat();
    const log = $('#chatLog');
    log.scrollTop = log.scrollHeight;
    $('#chatBack').focus();
  }

  function closeChat() {
    stopVoice();
    $('#chat').hidden = true;
    document.documentElement.classList.remove('is-splashing');
    setBackgroundInert(false);
    const opener = $('#chatOpen');
    if (opener && !opener.hidden) opener.focus();
  }

  function dayLabel(key) {
    if (key === todayKey()) return t('chatToday');
    if (key === keyOf(addDays(new Date(), -1))) return t('chatYesterday');
    return sentenceCase(fmtDate(key));
  }

  function renderChat() {
    const cast = currentCast();
    if (!cast) return;
    const lines = castLines(cast.id);
    $('#chat').style.setProperty('--cast', cast.accent);
    $('#chatAvatar').src = GLOW_CAST.avatarPath(cast.id);
    $('#chatName').textContent = lines.name;
    $('#chatStatus').textContent = lines.tagline;

    const log = $('#chatLog');
    log.innerHTML = '';
    let lastDay = '';
    state.chat.filter((m) => m.char === cast.id).forEach((m) => {
      const day = keyOf(new Date(m.at));
      if (day !== lastDay) {
        lastDay = day;
        const sep = document.createElement('p');
        sep.className = 'chat-day';
        sep.textContent = dayLabel(day);
        log.appendChild(sep);
      }
      log.appendChild(chatBubble(m));
    });
    if (!log.children.length) {
      const empty = document.createElement('p');
      empty.className = 'chat-day';
      empty.textContent = t('chatEmpty');
      log.appendChild(empty);
    }
    renderQuickReplies(cast);
    log.scrollTop = log.scrollHeight;
  }

  function chatBubble(m) {
    const row = document.createElement('div');
    row.className = 'chat-row ' + (m.from === 'me' ? 'is-me' : 'is-them');
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (m.text) {
      const text = document.createElement('p');
      text.className = 'bubble-text';
      text.textContent = m.text;
      bubble.appendChild(text);
    }
    if (m.voice) bubble.appendChild(voiceNote(m.voice));
    const time = document.createElement('span');
    time.className = 'bubble-time';
    time.textContent = new Date(m.at).toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' });
    bubble.appendChild(time);
    row.appendChild(bubble);
    return row;
  }

  /* A voice note drawn the way a messaging app draws one: play button,
     waveform that fills as it plays, and the length. */
  function voiceNote(path) {
    const box = document.createElement('div');
    box.className = 'vn';
    const info = clipInfo(path);
    const play = button('vn-play', null, { 'aria-label': t('voicePlay') });
    play.innerHTML = iconSvg('i-play', 18);
    const wave = document.createElement('div');
    wave.className = 'vn-wave';
    wave.setAttribute('aria-hidden', 'true');
    const shape = info && info.w ? info.w : '2468765435678987654346787654';
    const bars = Array.from(shape).map((digit) => {
      const bar = document.createElement('i');
      bar.style.height = (16 + Number(digit) * 9.3) + '%';
      wave.appendChild(bar);
      return bar;
    });
    const time = document.createElement('span');
    time.className = 'vn-time';
    time.textContent = info ? fmtClock(info.d) : '';

    const paint = (fraction, ended) => {
      play.innerHTML = iconSvg(ended ? 'i-play' : 'i-pause', 18);
      play.setAttribute('aria-label', t(ended ? 'voicePlay' : 'voicePause'));
      box.classList.toggle('is-playing', !ended);
      const lit = ended ? 0 : Math.round(fraction * bars.length);
      bars.forEach((bar, i) => bar.classList.toggle('is-played', i < lit));
      if (info) time.textContent = fmtClock(ended ? info.d : info.d * fraction);
    };
    play.addEventListener('click', () => playVoice(path, paint));
    box.append(play, wave, time);
    return box;
  }

  /* Habits the character reminded about today and that are still open,
     newest first: each gets a one-tap reply. */
  function remindedAndPending(cast) {
    const today = todayKey();
    const seen = new Set();
    const list = [];
    state.chat.slice().reverse().forEach((m) => {
      if (m.char !== cast.id || m.kind !== 'remind' || m.date !== today) return;
      if (!m.habitId || seen.has(m.habitId)) return;
      seen.add(m.habitId);
      const habit = habitById(m.habitId);
      if (habit && !habit.archived && isScheduled(habit, today) && !isComplete(habit, today)) list.push(habit);
    });
    return list.slice(0, 3);
  }

  function renderQuickReplies(cast) {
    const foot = $('#chatFoot');
    foot.innerHTML = '';
    const pending = remindedAndPending(cast);
    pending.forEach((habit) => {
      const chip = button('chat-chip', '✓ ' + t('chatQuickDone', habitName(habit)));
      chip.addEventListener('click', () => replyDone(habit));
      foot.appendChild(chip);
    });
    if (!pending.length) {
      const hint = document.createElement('p');
      hint.className = 'chat-hint';
      hint.textContent = t('chatHint');
      foot.appendChild(hint);
    }
  }

  function replyDone(habit) {
    const today = todayKey();
    const wasComplete = isComplete(habit, today);
    setValue(habit, today, Math.max(valueOf(habit, today), targetOf(habit)));
    pushChat({ from: 'me', kind: 'reply', habitId: habit.id, text: t('chatDoneReply', habitName(habit)) });
    const praise = praiseMessage(state.character);
    pushChat({ from: 'char', kind: 'praise', habitId: habit.id, text: praise.text, voice: praise.voice });
    save();
    if (!wasComplete) {
      buzz(15);
      Sounds.play('complete');
    }
    renderChat();
    renderAll();
    // The answer is a voice note; the tap that asked for it may start it.
    if (state.sound !== false) {
      const notes = $$('#chatLog .vn-play');
      if (notes.length) notes[notes.length - 1].click();
    }
  }

  /* ── Choosing who writes ── */
  function openCastPicker() {
    renderCastPicker();
    $('#castDialog').showModal();
  }

  function renderCastPicker() {
    const list = $('#castList');
    list.innerHTML = '';
    const lang = I18N.getLang();
    GLOW_CAST.CAST.forEach((cast) => {
      const lines = castLines(cast.id);
      list.appendChild(castCard({
        id: cast.id,
        name: lines.name,
        desc: lines.tagline,
        accent: cast.accent,
        avatar: GLOW_CAST.avatarPath(cast.id),
        sample: GLOW_CAST.voicePath(cast.id, lang, 'intro'),
      }));
    });
    list.appendChild(castCard({ id: null, name: t('castNone'), desc: t('castNoneDesc') }));
  }

  function castCard(spec) {
    const selected = (state.character || null) === spec.id;
    const card = document.createElement('div');
    card.className = 'cast-card' + (selected ? ' is-selected' : '');
    if (spec.accent) card.style.setProperty('--cast', spec.accent);

    const pick = button('cast-pick', null, { role: 'radio', 'aria-checked': String(selected) });
    let face;
    if (spec.avatar) {
      face = document.createElement('img');
      face.src = spec.avatar;
      face.alt = '';
    } else {
      face = document.createElement('span');
      face.innerHTML = iconSvg('i-bell', 22);
    }
    face.className = 'cast-avatar' + (spec.avatar ? '' : ' cast-avatar-none');
    const text = document.createElement('span');
    text.className = 'cast-text';
    const name = document.createElement('strong');
    name.textContent = spec.name;
    const desc = document.createElement('span');
    desc.textContent = spec.desc;
    text.append(name, desc);
    pick.append(face, text);
    pick.addEventListener('click', () => chooseCharacter(spec.id));
    card.appendChild(pick);

    if (spec.sample) {
      const listen = button('cast-listen', null, { 'aria-label': t('castListen', spec.name), title: t('castListen', spec.name) });
      listen.innerHTML = iconSvg('i-play', 18);
      listen.addEventListener('click', () => {
        playVoice(spec.sample, (fraction, ended) => {
          listen.innerHTML = iconSvg(ended ? 'i-play' : 'i-pause', 18);
          listen.classList.toggle('is-playing', !ended);
        });
      });
      card.appendChild(listen);
    }
    return card;
  }

  function chooseCharacter(id) {
    const changed = (state.character || null) !== id;
    state.character = id;
    if (changed && id) {
      const intro = introMessage(id);
      pushChat({ from: 'char', kind: 'intro', text: intro.text, voice: intro.voice });
      if (shell && shell.requestNotificationPermission) {
        try { shell.requestNotificationPermission(); } catch (err) { /* older shell */ }
      }
    }
    save();
    renderCastPicker();
    renderCastSettings();
    renderChatButton();
    renderCastPromo();
    if (!changed) return;
    toast(id ? t('castPicked', castLines(id).name) : t('castNonePicked'));
    // Picking someone is answered with their hello.
    if (id && state.sound !== false) {
      const hello = $('#castList .cast-card.is-selected .cast-listen');
      if (hello) hello.click();
    }
  }

  /* ── Settings, the bar button and the Today card ── */
  function renderCastSettings() {
    const group = $('#castSettings');
    group.hidden = !shell;
    $('#voiceCredits').hidden = !shell;
    if (!shell) return;
    const cast = currentCast();
    const face = $('#castCurrentAvatar');
    face.hidden = !cast;
    if (cast) face.src = GLOW_CAST.avatarPath(cast.id);
    $('#castCurrentName').textContent = cast ? castLines(cast.id).name : t('castNone');
    $('#voiceAutoplayRow').hidden = !cast;
    $('#voiceAutoplay').checked = !!state.voiceAutoplay;
    $('#btnTestReminder').hidden = !shell.testReminder;

    // What Android allows can change behind the app's back, so ask each time.
    let notificationsOn = true;
    let exact = 'granted';
    try {
      if (shell.notificationsEnabled) notificationsOn = shell.notificationsEnabled();
      if (shell.exactAlarmState) exact = shell.exactAlarmState();
    } catch (err) { /* an older shell without these */ }
    $('#notifWarning').hidden = notificationsOn;
    $('#exactWarning').hidden = exact !== 'denied';
  }

  function renderChatButton() {
    const btn = $('#chatOpen');
    btn.hidden = !(shell && currentCast());
    const badge = $('#chatBadge');
    badge.hidden = !state.chatUnread;
    badge.textContent = state.chatUnread > 9 ? '9+' : String(state.chatUnread);
    const label = state.chatUnread ? t('chatOpenUnread', state.chatUnread) : t('chatTitle');
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }

  function renderCastPromo() {
    $('#castPromo').hidden = !shell || !!state.character || !!state.castPromoDismissed ||
      activeHabits().length === 0;
  }

  /* Sends one message now, with whichever habit is still open today. */
  function sendTestReminder() {
    if (!shell || !shell.testReminder) return;
    const today = todayKey();
    const habit = habitsFor(today).find((h) => !isComplete(h, today)) || activeHabits()[0] || null;
    const id = state.character;
    const payload = {
      id: habit ? habit.id : '',
      name: habit ? habitName(habit) : t('appName'),
      emoji: habit ? habit.emoji || '✅' : '✅',
      msg: id ? (habit ? reminderMessages(habit, id)[0] : introMessage(id)) : null,
    };
    try {
      if (shell.requestNotificationPermission) shell.requestNotificationPermission();
      shell.testReminder(JSON.stringify(payload));
    } catch (err) {
      console.warn('Test reminder failed', err);
      return;
    }
    toast(t('testSent'));
    applyInboxFromShell();
  }

  /* Android's back button closes whatever is on top before leaving. */
  function handleBack() {
    const dialogs = $$('dialog[open]');
    if (dialogs.length) {
      dialogs[dialogs.length - 1].close();
      return 'handled';
    }
    if (isChatOpen()) {
      closeChat();
      return 'handled';
    }
    if (!$('#onboarding').hidden) return 'exit';
    if (view !== 'today') {
      setView('today');
      return 'handled';
    }
    return 'exit';
  }

  /* A notification opens the app straight into the conversation — after
     the launch screen, which would otherwise sit on top of it. */
  function routeTo(name) {
    if (name !== 'chat') return;
    if ($('#splash') || !$('#onboarding').hidden) {
      pendingRoute = name;
      return;
    }
    openChat();
  }

  function updateViewTitle() {
    const titles = { today: 'navToday', habits: 'navHabits', progress: 'navProgress', settings: 'navSettings' };
    $('#viewTitle').textContent = t(titles[view]);
  }

  function updateStorageInfo() {
    const logged = new Set(Object.keys(state.moods));
    Object.keys(state.entries).forEach((id) => Object.keys(state.entries[id]).forEach((key) => logged.add(key)));
    $('#storageInfo').textContent = t('storageFmt', logged.size);
  }

  /* ── Navigation ────────────────────────────────────────────────────── */
  const VIEWS = ['today', 'habits', 'progress', 'settings'];

  function setView(name, fromHash) {
    view = VIEWS.includes(name) ? name : 'today';
    name = view;
    if (!fromHash && location.hash.slice(1) !== name) {
      history.replaceState(null, '', '#' + name);
    }
    VIEWS.forEach((id) => {
      $('#view-' + id).hidden = id !== name;
    });
    $$('#tabBar .tab').forEach((tab) => {
      if (tab.dataset.view === name) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    updateViewTitle();
    if (name === 'today') renderToday();
    if (name === 'habits') renderHabitsView();
    if (name === 'progress') renderProgress();
    if (name === 'settings') updateStorageInfo();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function renderAll() {
    renderToday();
    renderHabitsView();
    if (view === 'progress') renderProgress();
  }

  /* ── Import / export ───────────────────────────────────────────────── */
  function exportData() {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'habitos-' + todayKey() + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t('exported'));
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.habits)) throw new Error('bad shape');
        state = Object.assign(defaultState(), parsed);
        state.entries = state.entries || {};
        state.moods = state.moods || {};
        normalizeState();
        save();
        applyTheme();
        applyLang();
        toast(t('imported'));
      } catch (err) {
        console.warn(err);
        toast(t('importFailed'));
      }
    };
    reader.onerror = () => toast(t('importFailed'));
    reader.readAsText(file);
  }

  /* ── Install prompt ────────────────────────────────────────────────── */
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function updateInstallUi() {
    const btn = $('#btnInstall');
    const hint = $('#installHint');
    if (isStandalone()) {
      btn.hidden = true;
      hint.textContent = t('installHintInstalled');
      return;
    }
    if (deferredInstall) {
      btn.hidden = false;
      hint.textContent = t('installHintReady');
      return;
    }
    btn.hidden = true;
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    hint.textContent = iOS ? t('installHintIOS') : t('installHintOther');
  }

  window.addEventListener('beforeinstallprompt', (evt) => {
    evt.preventDefault();
    deferredInstall = evt;
    updateInstallUi();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    updateInstallUi();
  });

  /* ── Wiring ────────────────────────────────────────────────────────── */
  function wire() {
    $$('#tabBar .tab').forEach((tab) => {
      tab.addEventListener('click', () => setView(tab.dataset.view));
    });

    $$('[data-action="new-habit"]').forEach((btn) => {
      btn.addEventListener('click', () => openHabitDialog(null));
    });

    $('#showAllToggle').addEventListener('change', (evt) => {
      showAllToday = evt.target.checked;
      renderHabitList();
    });

    $('#moodEnergy').addEventListener('input', (evt) => {
      const entry = state.moods[selectedDate];
      if (!entry) return;
      entry.energy = Number(evt.target.value);
      $('#moodEnergyOut').textContent = energyLabel(entry.energy);
      save();
    });
    $('#moodNote').addEventListener('input', (evt) => {
      const entry = state.moods[selectedDate];
      if (!entry) return;
      entry.note = evt.target.value;
      save();
    });

    $('#heatHabit').addEventListener('change', (evt) => {
      heatHabitId = evt.target.value;
      renderHeatmap(lastNDays(range));
    });

    /* Habit dialog */
    $('#habitForm').addEventListener('submit', (evt) => {
      evt.preventDefault();
      saveHabit();
    });
    $$('#habitDialog [data-close]').forEach((btn) => {
      btn.addEventListener('click', () => $('#habitDialog').close());
    });
    $('#btnDeleteHabit').addEventListener('click', async () => {
      const ok = await confirmDialog(t('deleteHabitTitle'), t('deleteHabitBody'));
      if (!ok) return;
      state.habits = state.habits.filter((h) => h.id !== editingId);
      delete state.entries[editingId];
      save();
      $('#habitDialog').close();
      renderHabitsView();
      renderToday();
      renderProgressIfVisible();
      toast(t('habitDeleted'));
    });

    /* Settings */
    $('#langSelect').addEventListener('change', (evt) => {
      state.lang = evt.target.value;
      save();
      applyLang();
    });
    $('#langToggle').addEventListener('click', () => {
      state.lang = state.lang === 'es' ? 'en' : 'es';
      save();
      applyLang();
    });
    $('#themeSelect').addEventListener('change', (evt) => {
      state.theme = evt.target.value;
      save();
      applyTheme();
      renderProgressIfVisible();
    });
    $('#themeToggle').addEventListener('click', () => {
      const resolved = document.documentElement.getAttribute('data-theme');
      state.theme = resolved === 'dark' ? 'light' : 'dark';
      save();
      applyTheme();
      renderProgressIfVisible();
    });
    $('#soundToggle').addEventListener('change', (evt) => {
      state.sound = evt.target.checked;
      save();
      applySound();
      if (state.sound) Sounds.play('tick');   // let them hear what they just turned on
    });
    $('#weekStart').addEventListener('change', (evt) => {
      state.weekStart = Number(evt.target.value);
      save();
      renderAll();
    });

    $('#btnRetakeTest').addEventListener('click', () => startOnboarding());

    /* Reminder cast */
    $('#btnAddReminder').addEventListener('click', addReminderTime);
    $('#chatOpen').addEventListener('click', openChat);
    $('#chatBack').addEventListener('click', closeChat);
    $('#chatSwitch').addEventListener('click', openCastPicker);
    $('#btnPickCast').addEventListener('click', openCastPicker);
    $('#btnPromoPick').addEventListener('click', openCastPicker);
    $('#btnPromoLater').addEventListener('click', () => {
      state.castPromoDismissed = true;
      save();
      renderCastPromo();
    });
    $$('#castDialog [data-close]').forEach((btn) => {
      btn.addEventListener('click', () => $('#castDialog').close());
    });
    $('#castDialog').addEventListener('close', () => {
      stopVoice();
      if (isChatOpen()) renderChat();
    });
    $('#voiceAutoplay').addEventListener('change', (evt) => {
      state.voiceAutoplay = evt.target.checked;
      save();
    });
    $('#btnTestReminder').addEventListener('click', sendTestReminder);
    $('#btnNotifSettings').addEventListener('click', () => {
      if (shell && shell.openNotificationSettings) shell.openNotificationSettings();
    });
    $('#btnExactSettings').addEventListener('click', () => {
      if (shell && shell.openExactAlarmSettings) shell.openExactAlarmSettings();
    });
    $('#btnExport').addEventListener('click', exportData);
    $('#btnImport').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (evt) => {
      const file = evt.target.files && evt.target.files[0];
      if (file) importData(file);
      evt.target.value = '';
    });
    $('#btnReset').addEventListener('click', async () => {
      const ok = await confirmDialog(t('resetTitle'), t('resetBody'));
      if (!ok) return;
      state = defaultState();
      state.lang = I18N.getLang();
      save();
      applyTheme();
      applyLang();
      setView('today');
      toast(t('resetDone'));
      startOnboarding();          // a cleared app is a new app
    });
    $('#btnInstall').addEventListener('click', async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      updateInstallUi();
    });

    systemDark.addEventListener('change', () => {
      if (state.theme === 'system') {
        applyTheme();
        renderProgressIfVisible();
      }
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderProgressIfVisible, 180);
    });

    /* A tab left open past midnight should roll over to the new day. */
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (selectedDate < todayKey()) selectedDate = todayKey();
      applyPendingFromShell();
      applyInboxFromShell();
      renderCastSettings();
      renderAll();
    });
  }

  /* ══ Starting test ═══════════════════════════════════════════════════
     Six questions, asked once, that turn into habits the person can accept
     or drop. The catalogue below is scored against the answers; nothing is
     created until they press the button on the results screen.
     "cost" is rough minutes per day, used to keep suggestions inside the
     time someone actually said they have. */
  const HABIT_CATALOGUE = [
    { id: 'meditate', key: 'hbMeditate', desc: 'dsMeditate', emoji: '🧘', color: 7, area: 'mental', cat: 'mental', type: 'quantity', target: 10, unit: 'unitMin', cost: 10, moment: 'morning' },
    { id: 'gratitude', key: 'hbGratitude', desc: 'dsGratitude', emoji: '🙏', color: 5, area: 'mental', cat: 'mental', type: 'binary', cost: 3, moment: 'evening' },
    { id: 'journal', key: 'hbJournal', desc: 'dsJournal', emoji: '📓', color: 7, area: 'mental', cat: 'mental', type: 'quantity', target: 5, unit: 'unitMin', cost: 5, moment: 'evening' },
    { id: 'selfcare', key: 'hbSelfcare', desc: 'dsSelfcare', emoji: '❤️', color: 5, area: 'mental', cat: 'mental', type: 'binary', cost: 10 },
    { id: 'walk', key: 'hbWalk', desc: 'dsWalk', emoji: '🚶', color: 3, area: 'fitness', cat: 'fitness', type: 'quantity', target: 20, unit: 'unitMin', cost: 20 },
    { id: 'run', key: 'hbRun', desc: 'dsRun', emoji: '🏃', color: 3, area: 'fitness', cat: 'fitness', type: 'quantity', target: 3, unit: 'unitKm', cost: 25, moment: 'morning' },
    { id: 'strength', key: 'hbStrength', desc: 'dsStrength', emoji: '💪', color: 2, area: 'fitness', cat: 'fitness', type: 'binary', cost: 30 },
    { id: 'bike', key: 'hbBike', desc: 'dsBike', emoji: '🚴', color: 3, area: 'fitness', cat: 'fitness', type: 'quantity', target: 20, unit: 'unitMin', cost: 20 },
    { id: 'stretch', key: 'hbStretch', desc: 'dsStretch', emoji: '🧎', color: 4, area: 'fitness', cat: 'fitness', type: 'quantity', target: 5, unit: 'unitMin', cost: 5, moment: 'morning' },
    { id: 'water', key: 'hbWater', desc: 'dsWater', emoji: '💧', color: 1, area: 'health', cat: 'health', type: 'quantity', target: 8, unit: 'unitGlasses', cost: 1 },
    { id: 'fruit', key: 'hbFruit', desc: 'dsFruit', emoji: '🍎', color: 8, area: 'health', cat: 'health', type: 'quantity', target: 2, unit: 'unitServings', cost: 2 },
    { id: 'veggies', key: 'hbVeggies', desc: 'dsVeggies', emoji: '🥗', color: 6, area: 'health', cat: 'health', type: 'binary', cost: 5 },
    { id: 'vitamins', key: 'hbVitamins', desc: 'dsVitamins', emoji: '💊', color: 4, area: 'health', cat: 'health', type: 'binary', cost: 1 },
    { id: 'skincare', key: 'hbSkincare', desc: 'dsSkincare', emoji: '🧴', color: 5, area: 'health', cat: 'health', type: 'binary', cost: 3, moment: 'evening' },
    { id: 'sunlight', key: 'hbSunlight', desc: 'dsSunlight', emoji: '☀️', color: 4, area: 'health', cat: 'health', type: 'binary', cost: 10, moment: 'morning' },
    { id: 'sleepEarly', key: 'hbSleepEarly', desc: 'dsSleepEarly', emoji: '😴', color: 7, area: 'sleep', cat: 'health', type: 'binary', cost: 0, moment: 'evening' },
    { id: 'noPhoneBed', key: 'hbNoPhoneBed', desc: 'dsNoPhoneBed', emoji: '📵', color: 8, area: 'sleep', cat: 'mental', type: 'binary', cost: 0, moment: 'evening' },
    { id: 'nightRoutine', key: 'hbNightRoutine', desc: 'dsNightRoutine', emoji: '🌙', color: 7, area: 'sleep', cat: 'health', type: 'binary', cost: 10, moment: 'evening' },
    { id: 'read', key: 'hbRead', desc: 'dsRead', emoji: '📖', color: 6, area: 'focus', cat: 'focus', type: 'quantity', target: 20, unit: 'unitPages', cost: 20, moment: 'evening' },
    { id: 'study', key: 'hbStudy', desc: 'dsStudy', emoji: '💻', color: 1, area: 'focus', cat: 'focus', type: 'quantity', target: 25, unit: 'unitMin', cost: 25 },
    { id: 'planDay', key: 'hbPlanDay', desc: 'dsPlanDay', emoji: '🎯', color: 1, area: 'focus', cat: 'focus', type: 'binary', cost: 5, moment: 'morning' },
    { id: 'tidy', key: 'hbTidy', desc: 'dsTidy', emoji: '🧹', color: 4, area: 'focus', cat: 'focus', type: 'quantity', target: 10, unit: 'unitMin', cost: 10 },
    { id: 'callSomeone', key: 'hbCallSomeone', desc: 'dsCallSomeone', emoji: '🗣️', color: 5, area: 'social', cat: 'social', type: 'binary', cost: 10 },
  ];

  const OB_AREAS = ['mental', 'fitness', 'health', 'sleep', 'focus', 'social'];
  const OB_TIME = [
    { value: 5, key: 'obTime5' }, { value: 15, key: 'obTime15' },
    { value: 30, key: 'obTime30' }, { value: 60, key: 'obTime60' },
  ];
  const OB_COUNT = [
    { value: 3, key: 'obCountFew' }, { value: 5, key: 'obCountSome' }, { value: 7, key: 'obCountMany' },
  ];
  const OB_HARD = ['time', 'forget', 'motivation', 'consistency'];
  const OB_MOMENT = ['morning', 'afternoon', 'evening', 'anytime'];

  /* Shortlist for "what do you already do", drawn from the catalogue so the
     answers line up with what can be suggested. */
  const OB_CURRENT_IDS = ['water', 'walk', 'strength', 'read', 'meditate',
    'sleepEarly', 'veggies', 'planDay', 'noPhoneBed', 'stretch'];

  const catalogueById = (id) => HABIT_CATALOGUE.find((h) => h.id === id);

  /**
   * Turns the answers into concrete habits.
   *
   * Two groups come back: things already done (worth tracking from today, so
   * a streak starts straight away) and new suggestions scored on the chosen
   * areas, the time available and the preferred moment. Targets scale down
   * when someone has little time or says consistency is their problem — a
   * target missed on day two teaches the wrong lesson.
   */
  function buildSuggestions(answers) {
    const areas = answers.areas || [];
    const budget = answers.time || 15;
    const wanted = answers.count || 3;
    const already = answers.current || [];

    let scale = budget <= 5 ? 0.5 : budget <= 15 ? 0.75 : budget <= 30 ? 1 : 1.2;
    if (answers.hard === 'consistency' || answers.hard === 'motivation') scale *= 0.8;

    /* Only targets that actually cost time get scaled by the time budget.
       Eight glasses of water is not a ten-minute commitment, so trimming it
       because someone is busy would just make the goal meaningless. And a
       habit they already keep starts at its normal level, not a beginner's. */
    const shape = (entry, alreadyKept) => {
      let target = entry.target || 1;
      if (entry.type === 'quantity' && !alreadyKept && entry.cost > 5) {
        target = Math.max(1, Math.round(target * scale));
      }
      return {
        catalogueId: entry.id,
        name: t(entry.key),
        nameKey: entry.key,
        description: entry.desc ? t(entry.desc) : '',
        descKey: entry.desc || '',
        emoji: entry.emoji,
        colorIndex: entry.color,
        category: entry.cat,
        type: entry.type,
        target: entry.type === 'quantity' ? target : 1,
        unit: entry.type === 'quantity' ? t(entry.unit) : '',
      };
    };

    const scored = HABIT_CATALOGUE
      .filter((entry) => !already.includes(entry.id))
      .map((entry) => {
        let score = 0;
        if (areas.includes(entry.area)) score += 5;
        if (answers.moment && entry.moment === answers.moment) score += 2;
        if (!entry.moment) score += 1;                      // fits any schedule
        if (entry.cost > budget) score -= 4;                // more than they have
        if (answers.hard === 'time' && entry.cost <= 5) score += 2;
        return { entry: entry, score: score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);

    /* Spread across areas, so six suggestions are not six kinds of exercise. */
    const picked = [];
    const perArea = {};
    const cap = areas.length > 2 ? 2 : 3;
    scored.forEach((row) => {
      if (picked.length >= wanted) return;
      const used = perArea[row.entry.area] || 0;
      if (used >= cap) return;
      perArea[row.entry.area] = used + 1;
      picked.push(row.entry);
    });
    // If those filters were strict, top up with the best of what is left.
    scored.forEach((row) => {
      if (picked.length < wanted && picked.indexOf(row.entry) < 0) picked.push(row.entry);
    });

    return {
      already: already.map(catalogueById).filter(Boolean).map((e) => shape(e, true)),
      suggested: picked.map((e) => shape(e, false)),
    };
  }

  /* ── The test itself ──────────────────────────────────────────────── */
  let obStep = 0;                       // 0 is the intro, 1..6 the questions, 7 results
  let obAnswers = null;
  let obResult = null;
  let obChosen = null;                  // ids ticked on the results screen

  const OB_LAST_STEP = 7;

  function obOption({ label, meta, emoji, selected, onPick, multi }) {
    const btn = button('ob-option', null,
      multi ? { 'aria-pressed': String(selected) } : { role: 'radio', 'aria-checked': String(selected) });
    if (emoji) {
      const icon = document.createElement('span');
      icon.className = 'ob-emoji';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = emoji;
      btn.appendChild(icon);
    }
    const text = document.createElement('span');
    text.className = 'ob-label';
    text.textContent = label;
    if (meta) {
      const small = document.createElement('span');
      small.className = 'ob-meta';
      small.textContent = ' · ' + meta;
      text.appendChild(small);
    }
    const tick = document.createElement('span');
    tick.className = 'ob-tick';
    tick.textContent = '✓';
    btn.append(text, tick);
    btn.addEventListener('click', () => {
      Sounds.play('tick');
      onPick();
    });
    return btn;
  }

  function obQuestion({ step, question, hint, options }) {
    const body = $('#obBody');
    body.innerHTML = '';
    const stepLine = document.createElement('p');
    stepLine.className = 'ob-step';
    stepLine.textContent = t('obStepFmt', step);
    const heading = document.createElement('h2');
    heading.className = 'ob-question';
    heading.id = 'obHeading';
    heading.textContent = question;
    body.append(stepLine, heading);
    if (hint) {
      const hintLine = document.createElement('p');
      hintLine.className = 'ob-hint';
      hintLine.textContent = hint;
      body.appendChild(hintLine);
    }
    const list = document.createElement('div');
    list.className = 'ob-options';
    // Single-choice steps are a radio group; multi-choice ones are plain
    // toggles, and grouping those as radios would misreport them.
    if (options.length && !options[0].multi) {
      list.setAttribute('role', 'radiogroup');
      list.setAttribute('aria-label', question);
    }
    options.forEach((opt) => list.appendChild(obOption(opt)));
    body.appendChild(list);
  }

  function obFooter(buttons) {
    const foot = $('#obFoot');
    foot.innerHTML = '';
    buttons.forEach((spec) => {
      if (!spec) return;
      const btn = button('btn ' + (spec.cls || ''), spec.label);
      btn.addEventListener('click', spec.onClick);
      foot.appendChild(btn);
    });
  }

  function obProgress() {
    const bar = $('#obProgress');
    bar.innerHTML = '';
    for (let i = 1; i <= 6; i++) {
      const pip = document.createElement('span');
      pip.className = 'ob-pip' + (i <= obStep ? ' is-done' : '');
      bar.appendChild(pip);
    }
  }

  function obGo(step) {
    obStep = Math.max(0, Math.min(OB_LAST_STEP, step));
    obProgress();
    obRender();
    $('#onboarding').scrollTop = 0;
  }

  function obRender() {
    const next = (to) => () => obGo(to);
    const back = { label: t('obBack'), cls: 'btn-ghost', onClick: () => obGo(obStep - 1) };

    if (obStep === 0) {
      const body = $('#obBody');
      body.innerHTML = '';
      const heading = document.createElement('h2');
      heading.className = 'ob-question';
      heading.id = 'obHeading';
      heading.textContent = t('obTitle');
      const intro = document.createElement('p');
      intro.className = 'ob-hint';
      intro.textContent = t('obIntro');
      body.append(heading, intro);
      obFooter([
        { label: t('obSkip'), cls: 'btn-ghost', onClick: () => obFinish([]) },
        { label: t('obStart'), cls: 'btn-primary', onClick: next(1) },
      ]);
      return;
    }

    if (obStep === 1) {
      obQuestion({
        step: 1, question: t('obQAreas'), hint: t('obQAreasHint'),
        options: OB_AREAS.map((area) => ({
          label: t('obArea' + area.charAt(0).toUpperCase() + area.slice(1)),
          multi: true,
          selected: obAnswers.areas.includes(area),
          onPick: () => {
            const at = obAnswers.areas.indexOf(area);
            if (at >= 0) obAnswers.areas.splice(at, 1);
            else obAnswers.areas.push(area);
            obRender();
          },
        })),
      });
      obFooter([back, {
        label: t('obNext'), cls: 'btn-primary',
        onClick: () => (obAnswers.areas.length ? obGo(2) : obWarn()),
      }]);
      return;
    }

    if (obStep === 2) {
      const options = OB_CURRENT_IDS.map(catalogueById).filter(Boolean).map((entry) => ({
        label: t(entry.key), emoji: entry.emoji, multi: true,
        selected: obAnswers.current.includes(entry.id),
        onPick: () => {
          const at = obAnswers.current.indexOf(entry.id);
          if (at >= 0) obAnswers.current.splice(at, 1);
          else obAnswers.current.push(entry.id);
          obRender();
        },
      }));
      options.push({
        label: t('obNoneYet'), multi: true,
        selected: obAnswers.current.length === 0,
        onPick: () => { obAnswers.current = []; obRender(); },
      });
      obQuestion({ step: 2, question: t('obQCurrent'), hint: t('obQCurrentHint'), options: options });
      obFooter([back, { label: t('obNext'), cls: 'btn-primary', onClick: next(3) }]);
      return;
    }

    if (obStep === 3) {
      obQuestion({
        step: 3, question: t('obQTime'), hint: t('obQTimeHint'),
        options: OB_TIME.map((opt) => ({
          label: t(opt.key),
          selected: obAnswers.time === opt.value,
          onPick: () => { obAnswers.time = opt.value; obGo(4); },
        })),
      });
      obFooter([back]);
      return;
    }

    if (obStep === 4) {
      obQuestion({
        step: 4, question: t('obQCount'), hint: t('obQCountHint'),
        options: OB_COUNT.map((opt) => ({
          label: t(opt.key),
          selected: obAnswers.count === opt.value,
          onPick: () => { obAnswers.count = opt.value; obGo(5); },
        })),
      });
      obFooter([back]);
      return;
    }

    if (obStep === 5) {
      obQuestion({
        step: 5, question: t('obQHard'),
        options: OB_HARD.map((id) => ({
          label: t('obHard' + id.charAt(0).toUpperCase() + id.slice(1)),
          selected: obAnswers.hard === id,
          onPick: () => { obAnswers.hard = id; obGo(6); },
        })),
      });
      obFooter([back]);
      return;
    }

    if (obStep === 6) {
      const labels = { morning: 'obMorning', afternoon: 'obAfternoon', evening: 'obEvening', anytime: 'obAnyTime' };
      obQuestion({
        step: 6, question: t('obQMoment'),
        options: OB_MOMENT.map((id) => ({
          label: t(labels[id]),
          selected: obAnswers.moment === id,
          onPick: () => { obAnswers.moment = id; obGo(7); },
        })),
      });
      obFooter([back]);
      return;
    }

    obRenderResults();
  }

  function obWarn() {
    const body = $('#obBody');
    if ($('.ob-error', body)) return;
    const warning = document.createElement('p');
    warning.className = 'ob-error';
    warning.textContent = t('obPickSome');
    body.appendChild(warning);
  }

  function obRenderResults() {
    obResult = buildSuggestions(obAnswers);
    if (!obChosen) {
      // Everything starts ticked; dropping one is a single tap.
      obChosen = obResult.already.concat(obResult.suggested).map((h) => h.catalogueId);
    }

    const body = $('#obBody');
    body.innerHTML = '';
    const heading = document.createElement('h2');
    heading.className = 'ob-question';
    heading.id = 'obHeading';
    heading.textContent = t('obResultTitle');
    const hint = document.createElement('p');
    hint.className = 'ob-hint';
    hint.textContent = t('obResultHint');
    body.append(heading, hint);

    const group = (title, list) => {
      if (!list.length) return;
      const label = document.createElement('p');
      label.className = 'ob-group-title';
      label.textContent = title;
      const box = document.createElement('div');
      box.className = 'ob-suggestions';
      list.forEach((habit) => {
        box.appendChild(obOption({
          label: habit.name,
          meta: habit.type === 'quantity' ? habit.target + ' ' + habit.unit : null,
          emoji: habit.emoji,
          multi: true,
          selected: obChosen.includes(habit.catalogueId),
          onPick: () => {
            const at = obChosen.indexOf(habit.catalogueId);
            if (at >= 0) obChosen.splice(at, 1);
            else obChosen.push(habit.catalogueId);
            obRenderResults();
          },
        }));
      });
      body.append(label, box);
    };

    group(t('obResultAlready'), obResult.already);
    group(t('obResultNew'), obResult.suggested);

    obFooter([
      { label: t('obBack'), cls: 'btn-ghost', onClick: () => obGo(6) },
      {
        label: t('obAddSelected'), cls: 'btn-primary',
        onClick: () => {
          const all = obResult.already.concat(obResult.suggested);
          obFinish(all.filter((h) => obChosen.includes(h.catalogueId)));
        },
      },
    ]);
  }

  /** Creates the accepted habits, records the answers, and closes the test. */
  function obFinish(habits) {
    const today = todayKey();
    habits.forEach((habit) => {
      state.habits.push({
        id: uid(),
        name: habit.name,
        nameKey: habit.nameKey || '',
        description: habit.description || '',
        descKey: habit.descKey || '',
        emoji: habit.emoji,
        colorIndex: habit.colorIndex,
        category: habit.category,
        type: habit.type,
        target: habit.target,
        unit: habit.unit,
        reminders: [],
        schedule: { kind: 'daily' },
        createdAt: today,
        archived: false,
      });
    });

    // Keeping the answers is what lets the Habits tab suggest the same list
    // again later, and what the retake button reloads.
    state.onboarding = { done: true, at: today, answers: obAnswers };
    save();

    $('#onboarding').hidden = true;
    document.documentElement.classList.remove('is-splashing');
    setBackgroundInert(false);
    obAnswers = null;
    obResult = null;
    obChosen = null;

    renderAll();
    if (habits.length) {
      Sounds.play('complete');
      toast(t('obAddedFmt', habits.length));
      setView('today');
    } else {
      toast(t('obNothingPicked'));
    }
  }

  function startOnboarding() {
    obAnswers = { areas: [], current: [], time: null, count: null, hard: null, moment: null };
    obResult = null;
    obChosen = null;
    obStep = 0;
    $('#onboarding').hidden = false;
    // Reuses the splash lock so the app cannot be scrolled behind the test.
    document.documentElement.classList.add('is-splashing');
    setBackgroundInert(true);
    obProgress();
    obRender();
  }

  const needsOnboarding = () => !(state.onboarding && state.onboarding.done);

  /* ── Launch screen ─────────────────────────────────────────────────────
     Plays once per app start, then leaves the DOM entirely. Tapping skips it,
     because nobody wants to sit through a splash they have seen a hundred
     times. */
  const PHRASE_KEY = 'glow.lastPhrase';
  const SPLASH_HOLD = 2250;

  function pickPhrase() {
    const phrases = t('phrases');
    if (!Array.isArray(phrases) || !phrases.length) return '';
    if (phrases.length === 1) return phrases[0];

    // Never the same phrase twice in a row.
    let previous = -1;
    try {
      previous = parseInt(localStorage.getItem(PHRASE_KEY), 10);
    } catch (err) { /* storage may be unavailable */ }

    let index = Math.floor(Math.random() * phrases.length);
    if (index === previous) index = (index + 1) % phrases.length;

    try {
      localStorage.setItem(PHRASE_KEY, String(index));
    } catch (err) { /* not worth failing the launch over */ }
    return phrases[index];
  }

  function runSplash() {
    const splash = $('#splash');
    setBackgroundInert(true);          // the splash covers the app too
    if (!splash) {
      document.documentElement.classList.remove('is-splashing');
      if (needsOnboarding()) startOnboarding();
      else setBackgroundInert(false);
      return;
    }

    // index.html already chose one at first paint; only fill a gap.
    const phraseSlot = $('#splashPhrase');
    if (phraseSlot && !phraseSlot.textContent.trim()) phraseSlot.textContent = pickPhrase();

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      // The test picks the lock straight back up if it is going to run.
      if (needsOnboarding()) startOnboarding();
      else {
        document.documentElement.classList.remove('is-splashing');
        setBackgroundInert(false);
      }
      splash.classList.add('is-leaving');
      if (pendingRoute && !needsOnboarding()) {
        const route = pendingRoute;
        pendingRoute = null;
        // After the splash leaves the DOM, so routeTo() does not wait again.
        setTimeout(() => routeTo(route), 620);
      }
      splash.addEventListener('transitionend', () => splash.remove(), { once: true });
      // Belt and braces: a missed transitionend must not leave it on screen.
      setTimeout(() => splash.remove(), 600);
    };

    splash.addEventListener('click', dismiss);
    setTimeout(dismiss, SPLASH_HOLD);
  }

  /* ── Boot ──────────────────────────────────────────────────────────── */
  function init() {
    load();
    const migrated = normalizeState();
    wire();
    if (linkCatalogueKeys() || migrated) save();
    applyTheme();
    applySound();
    applyBackupNote();
    applyLayout();
    applyPendingFromShell();   // ticks made from the widget while the app was closed
    applyInboxFromShell();     // messages the characters sent meanwhile
    applyLang();
    syncToShell();
    setView(location.hash.slice(1) || 'today', true);
    updateInstallUi();
    runSplash();

    // Audio stays suspended until a gesture; the first tap anywhere frees it.
    document.addEventListener('pointerdown', () => Sounds.unlock(), { once: true });

    window.addEventListener('hashchange', () => setView(location.hash.slice(1) || 'today', true));

    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

    if (shell) {
      /* The APK serves every asset from its own package, so a worker adds no
         offline ability here — only the risk of answering with a stale copy
         after an app update. Retire any left by an earlier version. */
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()))
        .catch(() => {});
      if (window.caches && caches.keys) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
      }
      return;
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW failed', err));
    });
  }

  init();
})();
