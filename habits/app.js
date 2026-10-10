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

  /* Colour palettes (2.13): each is a set of tokens in styles.css keyed by
     data-palette on the root. Ultra oscura exists only in dark. */
  const PALETTES = ['classic', 'electric', 'pastel', 'ultra', 'forest', 'sunset', 'ocean', 'contrast'];
  const DARK_ONLY_PALETTES = ['ultra'];

  const EMOJIS = [
    '🧘', '💪', '🏃', '🚶', '🚴', '🏋️', '🧠', '📓', '📖', '💧',
    '🥗', '🍎', '😴', '☀️', '🌙', '🙏', '💊', '🚭', '📵', '🧹',
    '🎯', '🎸', '🎨', '💻', '🗣️', '❤️', '🌱', '🧴', '🧎', '🦷',
    '🧵', '🛡️',
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
  /* Weigh-ins in kilograms by day and the height in centimetres, whatever
     units are shown (2.12). */
  const defaultBody = () => ({ height: null, unit: 'kg', goal: null, weights: {}, show: true });

  const defaultState = () => ({
    version: SCHEMA_VERSION,
    /* Spanish on a first run regardless of the device language: this is a
     Spanish-first app, and the toggle in the bar switches it in one tap. */
    lang: 'es',
    theme: 'system',
    palette: 'classic',
    weekStart: 1,
    layout: 'comfortable',
    density: 'default',
    sound: true,
    onboarding: null,
    /* Who sends the reminders (an id from characters.js, or null for plain
       notifications), and the conversation they leave behind. */
    character: null,
    voiceAutoplay: true,
    autoplayDefaulted: true,
    chat: [],
    chatUnread: 0,
    castPromoDismissed: false,
    /* The day of the last backup saved (2.14), to say how old it is. */
    lastBackup: null,
    /* Pico's tour (2.13): taken or skipped, and whether its invitation on
       Today was put off for good. */
    tourDone: false,
    tourPromoDismissed: false,
    habits: [],
    entries: {},
    moods: {},
    body: defaultBody(),
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
    const snapshot = () => JSON.stringify([state.chat, state.chatUnread, state.character, state.habits,
      state.voiceAutoplay, state.autoplayDefaulted, state.bot]);
    const before = snapshot();
    state.chat = Array.isArray(state.chat) ? state.chat : [];
    state.chatUnread = Math.max(0, Number(state.chatUnread) || 0);
    normalizeBot();
    normalizeBody();
    if (!PALETTES.includes(state.palette)) state.palette = 'classic';
    state.tourDone = state.tourDone === true;
    if (typeof state.lastBackup !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(state.lastBackup)) state.lastBackup = null;
    state.tourPromoDismissed = state.tourPromoDismissed === true;
    if (state.character && !castById(state.character)) state.character = null;
    state.habits.forEach((habit) => {
      // One reminder time per habit until 2.8; now a short list of them.
      if (!Array.isArray(habit.reminders)) habit.reminders = habit.reminder ? [habit.reminder] : [];
      delete habit.reminder;
      habit.reminders = cleanTimes(habit.reminders);
      // Your own voice note (2.10): only an id and what the editor draws.
      if (habit.voiceNote !== undefined && !hasOwnNote(habit)) delete habit.voiceNote;
      // Which of your bot's lines this habit plays (2.11): line ids, or absent for its own.
      if (habit.botPick !== undefined && !(Array.isArray(habit.botPick) &&
          habit.botPick.every((id) => typeof id === 'string'))) delete habit.botPick;
    });
    // Until 2.9 each habit had one recorded line, h-<habit>; it is now the first of three.
    state.chat.forEach((message) => {
      if (message.voice) message.voice = GLOW_CAST.upgradeVoicePath(message.voice);
    });
    // 2.8 shipped with voice notes off unless switched on. From 2.9 they play
    // by themselves; anyone who already had a character gets that once too,
    // and can still switch it off in Ajustes.
    if (!state.autoplayDefaulted) {
      state.voiceAutoplay = true;
      state.autoplayDefaulted = true;
    }
    return snapshot() !== before;
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

  function confirmDialog(title, body, okLabel) {
    return new Promise((resolve) => {
      const dlg = $('#confirmDialog');
      $('#confirmTitle').textContent = title;
      $('#confirmBody').textContent = body;
      $('#confirmOk').textContent = okLabel || t('confirm');
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

  /* ── Weight and BMI (2.12) ─────────────────────────────────────────────
     One weigh-in per day, kept in kilograms; the height in centimetres; the
     units shown are a setting (kg and cm, or lb and ft/in). BMI is weight
     over height squared, read against the WHO's bands for adults. */
  const KG_PER_LB = 0.45359237;
  const CM_PER_IN = 2.54;
  const WEIGHT_MIN = 20;
  const WEIGHT_MAX = 400;
  const HEIGHT_MIN = 50;
  const HEIGHT_MAX = 250;
  const BMI_BANDS = [
    { band: 'Under', from: 15, to: 18.5 },
    { band: 'Normal', from: 18.5, to: 25 },
    { band: 'Over', from: 25, to: 30 },
    { band: 'Obese', from: 30, to: 40 },
  ];
  const inLb = () => state.body.unit === 'lb';
  const weightUnit = () => (inLb() ? 'lb' : 'kg');
  const fmtNum = (value, digits) =>
    value.toLocaleString(I18N.locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const shownWeight = (kg) => (inLb() ? kg / KG_PER_LB : kg);
  const fmtWeight = (kg) => fmtNum(shownWeight(kg), 1) + ' ' + weightUnit();
  const fmtWeightChange = (kg) => (kg > 0.04 ? '+' : kg < -0.04 ? '−' : '±') + fmtWeight(Math.abs(kg));
  const weighIns = () => Object.keys(state.body.weights).sort().map((key) => ({ key: key, kg: state.body.weights[key] }));
  const bmiOf = (kg) => (state.body.height ? kg / Math.pow(state.body.height / 100, 2) : null);
  const bmiBand = (bmi) => (bmi < 18.5 ? 'Under' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Over' : 'Obese');
  const bmiText = (bmi) => t('bodyBmi') + ' ' + fmtNum(bmi, 1) + ' · ' + t('bmi' + bmiBand(bmi));
  // A number input wants a dot, whatever the language.
  const inputNumber = (value) => String(Math.round(value * 10) / 10);

  function normalizeBody() {
    const raw = state.body && typeof state.body === 'object' ? state.body : {};
    const body = defaultBody();
    const inRange = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
    if (inRange(raw.height, HEIGHT_MIN, HEIGHT_MAX)) body.height = raw.height;
    if (raw.unit === 'lb') body.unit = 'lb';
    if (inRange(raw.goal, WEIGHT_MIN, WEIGHT_MAX)) body.goal = raw.goal;
    if (raw.show === false) body.show = false;
    if (raw.weights && typeof raw.weights === 'object') {
      Object.keys(raw.weights).forEach((key) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && inRange(raw.weights[key], WEIGHT_MIN, WEIGHT_MAX)) {
          body.weights[key] = raw.weights[key];
        }
      });
    }
    state.body = body;
  }

  function bmiChip(bmi) {
    const chip = document.createElement('span');
    chip.className = 'bmi-chip';
    chip.dataset.band = bmiBand(bmi);
    chip.textContent = bmiText(bmi);
    return chip;
  }

  /* Today's card: the latest weigh-in, its BMI, the change since the one
     before, and the way to the goal. */
  function renderBody() {
    const card = $('#bodyCard');
    card.hidden = !state.body.show;
    if (card.hidden) return;
    const now = $('#bodyNow');
    now.innerHTML = '';
    const entries = weighIns();
    const latest = entries[entries.length - 1];
    if (!latest) {
      $('#bodyHint').textContent = '';
      const empty = document.createElement('p');
      empty.className = 'muted small';
      empty.textContent = t('bodyEmpty');
      now.appendChild(empty);
      return;
    }
    $('#bodyHint').textContent = t('bodyLast', dayLabel(latest.key));
    const top = document.createElement('div');
    top.className = 'body-top';
    const value = document.createElement('span');
    value.className = 'body-value';
    value.textContent = fmtWeight(latest.kg);
    top.appendChild(value);
    const bmi = bmiOf(latest.kg);
    if (bmi) {
      top.appendChild(bmiChip(bmi));
    } else {
      const ask = document.createElement('span');
      ask.className = 'muted small';
      ask.textContent = t('bodyNoHeight');
      top.appendChild(ask);
    }
    now.appendChild(top);
    const notes = [];
    if (entries.length > 1) notes.push(t('bodySince', fmtWeightChange(latest.kg - entries[entries.length - 2].kg)));
    if (state.body.goal) {
      const left = latest.kg - state.body.goal;
      notes.push(Math.abs(left) < 0.05 ? t('bodyGoalReached') : t('bodyToGoal', fmtWeight(Math.abs(left))));
    }
    if (notes.length) {
      const line = document.createElement('p');
      line.className = 'body-notes';
      line.textContent = notes.join(' · ');
      now.appendChild(line);
    }
  }

  /* ── The weigh-in dialog ── */
  function openWeightDialog() {
    const today = todayKey();
    $('#fWeightDate').max = today;
    $('#weightError').hidden = true;
    fillWeighIn(selectedDate <= today ? selectedDate : today);
    renderHeightInputs();
    renderWeightPreview();
    $('#weightDialog').showModal();
    setTimeout(() => $('#fWeight').focus(), 60);
  }

  /* That day's weigh-in if there is one, else the latest, as a starting point. */
  function fillWeighIn(date) {
    $('#fWeightDate').value = date;
    const existing = state.body.weights[date];
    const latest = weighIns().slice(-1)[0];
    const kg = existing || (latest && latest.kg);
    $('#fWeight').value = kg ? inputNumber(shownWeight(kg)) : '';
    $('#fWeightLabel').textContent = t('bodyWeight', weightUnit());
    $('#btnDeleteWeight').hidden = !existing;
  }

  function renderHeightInputs() {
    const host = $('#heightInputs');
    host.innerHTML = '';
    const cm = state.body.height;
    const field = (id, value, suffix) => {
      const wrap = document.createElement('label');
      wrap.className = 'height-input';
      const input = document.createElement('input');
      input.type = 'number';
      input.id = id;
      input.inputMode = 'decimal';
      input.min = '0';
      input.step = '1';
      input.value = value === null ? '' : String(value);
      input.addEventListener('input', renderWeightPreview);
      const unit = document.createElement('span');
      unit.textContent = suffix;
      wrap.append(input, unit);
      return wrap;
    };
    if (inLb()) {
      let feet = null;
      let inches = null;
      if (cm) {
        const total = Math.round(cm / CM_PER_IN);
        feet = Math.floor(total / 12);
        inches = total - feet * 12;
      }
      host.append(field('fHeightFt', feet, t('bodyFeet')), field('fHeightIn', inches, t('bodyInches')));
    } else {
      host.append(field('fHeightCm', cm ? Math.round(cm) : null, 'cm'));
    }
  }

  function readWeightKg() {
    const value = parseFloat(String($('#fWeight').value).replace(',', '.'));
    if (!isFinite(value)) return null;
    return inLb() ? value * KG_PER_LB : value;
  }

  /* null when left empty, NaN when filled in wrongly. */
  function readHeightCm() {
    if (inLb()) {
      const ft = $('#fHeightFt').value;
      const inch = $('#fHeightIn').value;
      if (ft === '' && inch === '') return null;
      const total = (parseFloat(ft) || 0) * 12 + (parseFloat(inch) || 0);
      return total > 0 ? total * CM_PER_IN : NaN;
    }
    const cm = $('#fHeightCm').value;
    if (cm === '') return null;
    const value = parseFloat(String(cm).replace(',', '.'));
    return isFinite(value) ? value : NaN;
  }

  function renderWeightPreview() {
    const box = $('#weightPreview');
    box.innerHTML = '';
    const kg = readWeightKg();
    const cm = readHeightCm();
    if (!kg || !cm || kg < WEIGHT_MIN || kg > WEIGHT_MAX || cm < HEIGHT_MIN || cm > HEIGHT_MAX) return;
    box.appendChild(bmiChip(kg / Math.pow(cm / 100, 2)));
  }

  function saveWeighIn() {
    const fail = (message) => {
      const box = $('#weightError');
      box.textContent = message;
      box.hidden = false;
      return false;
    };
    const kg = readWeightKg();
    const cm = readHeightCm();
    const date = $('#fWeightDate').value;
    if (!kg || kg < WEIGHT_MIN || kg > WEIGHT_MAX) return fail(t('errWeight'));
    if (cm !== null && !(cm >= HEIGHT_MIN && cm <= HEIGHT_MAX)) return fail(t('errHeight'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayKey()) return fail(t('errWeight'));
    state.body.weights[date] = Math.round(kg * 100) / 100;
    if (cm !== null) state.body.height = Math.round(cm * 10) / 10;
    save();
    $('#weightDialog').close();
    renderBody();
    renderProgressIfVisible();
    toast(t('weightSaved'));
    return true;
  }

  function deleteWeighIn() {
    const date = $('#fWeightDate').value;
    if (!state.body.weights[date]) return;
    delete state.body.weights[date];
    save();
    $('#weightDialog').close();
    renderBody();
    renderProgressIfVisible();
    toast(t('weightDeleted'));
  }

  /* ── Settings ── */
  function renderBodySettings() {
    $('#bodyUnit').value = state.body.unit;
    $('#bodyGoalLabel').textContent = t('bodyGoal') + ' (' + weightUnit() + ')';
    $('#bodyGoal').value = state.body.goal ? inputNumber(shownWeight(state.body.goal)) : '';
    $('#bodyShow').checked = state.body.show;
  }

  /* ── Progress: the weight line and where the BMI sits ── */
  function niceTicks(lo, hi) {
    const step = [0.5, 1, 2, 2.5, 5, 10, 20, 50].find((s) => (hi - lo) / s <= 4) || 100;
    const from = Math.floor(lo / step) * step;
    const to = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = from; v <= to + step / 2; v += step) ticks.push(Math.round(v * 10) / 10);
    return { min: from, max: to, ticks: ticks, digits: step < 1 ? 1 : 0 };
  }

  function renderWeightChart(days) {
    const entries = weighIns();
    const figure = $('#figWeight');
    figure.hidden = !entries.length;
    if (!entries.length) return;
    const host = $('#chartWeight');
    const inRange = days.filter((key) => state.body.weights[key]);
    const latest = entries[entries.length - 1];
    const bmi = bmiOf(latest.kg);
    const change = inRange.length > 1
      ? fmtWeightChange(state.body.weights[inRange[inRange.length - 1]] - state.body.weights[inRange[0]]) : '';
    $('#chartWeightSub').textContent = t('chartWeightSub', { change: change, bmi: bmi ? bmiText(bmi) : '' });
    const enough = inRange.length > 1;
    $('#chartWeightEmpty').hidden = enough;
    $('#chartWeightEmpty').textContent = enough ? '' : t('chartNoWeight');
    host.hidden = !enough;
    if (enough) {
      const shown = inRange.map((key) => shownWeight(state.body.weights[key]));
      const goal = state.body.goal ? shownWeight(state.body.goal) : null;
      let lo = Math.min(...shown);
      let hi = Math.max(...shown);
      // The goal is drawn only when it is near enough not to flatten the line.
      const showGoal = goal !== null && goal > lo - (hi - lo + 2) && goal < hi + (hi - lo + 2);
      if (showGoal) {
        lo = Math.min(lo, goal);
        hi = Math.max(hi, goal);
      }
      const pad = Math.max(0.5, (hi - lo) * 0.15);
      const scale = niceTicks(lo - pad, hi + pad);
      Charts.line(host, {
        points: days.map((key) => {
          const kg = state.body.weights[key];
          const dateLabel = fmtDate(key, { day: 'numeric', month: 'short' });
          const tip = '<b>' + dateLabel + '</b>' + (kg ? '<br>' + escapeHtml(fmtWeight(kg)) +
            (bmiOf(kg) ? '<br><span class="tip-sub">' + escapeHtml(bmiText(bmiOf(kg))) + '</span>' : '') : '');
          return { label: dateLabel, value: kg ? shownWeight(kg) : null, tip: tip };
        }),
        min: scale.min,
        max: scale.max,
        yTicks: scale.ticks,
        tickFormat: (v) => fmtNum(v, scale.digits),
        connect: true,
        color: 'var(--s3)',
        ref: showGoal ? { value: goal, label: t('chartWeightGoal') } : null,
        ariaLabel: t('chartWeightTitle'),
      });
    } else {
      host.innerHTML = '';
    }
    renderBmiScale(bmi);
  }

  /* A strip from 15 to 40 in the four bands, with a mark where the latest
     weigh-in puts the BMI. */
  function renderBmiScale(bmi) {
    const box = $('#bmiScale');
    box.hidden = !bmi;
    box.innerHTML = '';
    if (!bmi) return;
    const span = 40 - 15;
    const track = document.createElement('div');
    track.className = 'bmi-track';
    BMI_BANDS.forEach((band) => {
      const part = document.createElement('span');
      part.className = 'bmi-band';
      part.dataset.band = band.band;
      part.style.width = ((band.to - band.from) / span) * 100 + '%';
      part.title = t('bmi' + band.band);
      track.appendChild(part);
    });
    const mark = document.createElement('span');
    mark.className = 'bmi-mark';
    mark.style.left = (Math.max(0, Math.min(1, (bmi - 15) / span)) * 100) + '%';
    track.appendChild(mark);
    const labels = document.createElement('div');
    labels.className = 'bmi-labels';
    BMI_BANDS.forEach((band) => {
      const label = document.createElement('span');
      label.style.width = ((band.to - band.from) / span) * 100 + '%';
      label.textContent = t('bmi' + band.band);
      labels.appendChild(label);
    });
    box.append(track, labels, bmiChip(bmi));
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

  function celebrate(habit, wasComplete, opts) {
    const nowComplete = isComplete(habit, selectedDate);
    if (!nowComplete || wasComplete) return;   // only on the transition to done

    // A press of + has already buzzed and sounded the moment it crossed.
    if (!(opts && opts.sounded)) {
      buzz(15);
      Sounds.play('complete');
    }
    const row = $$('#habitList .habit-row').find(
      (node) => node.dataset.habitId === habit.id
    );
    if (row && !reducedMotion.matches) {
      row.classList.add('just-done');
      // A counted habit has no tick: its sparks come from the count.
      const check = $('.check-btn', row) || $('.qty-value', row);
      if (check) {
        check.classList.add('just-done');
        sparkBurst(check, 8, 46, 24);
      }
    }

    const stats = dayStats(selectedDate);
    if (stats.due > 0 && stats.done === stats.due) {
      buzz([0, 18, 60, 28]);
      Sounds.play('celebrate');
      const ring = $('.summary-ring');
      if (ring && !reducedMotion.matches) {
        ring.classList.add('celebrate');
        setTimeout(() => ring.classList.remove('celebrate'), 800);
        sparkBurst(ring, 14, 82, 56);
      }
      picoCheer();
    } else if (row) {
      picoPeek(row);
    }
  }

  /* Pico peeks in from an edge beside something, does one thing, and goes
     (2.15; any edge, pose and gesture since 2.16). By default he leans in
     from the left beside the habit just done and winks with a wing up.
     Brief, never in the way of a touch, not again while one is on screen or
     within a few seconds of the last, not over a sheet or the tour, and not
     at all under reduced motion. The day's last habit gets his cheer
     instead. Returns whether he came. */
  let peekBusy = false;
  let peekLast = 0;
  function picoPeek(near, opts) {
    const o = Object.assign({ side: 'left', at: 'beside', pose: 'wink', aim: null, gesture: null, then: null, hold: 1700 }, opts);
    if (reducedMotion.matches || peekBusy || Date.now() - peekLast < 4000) return false;
    if (!near || !near.isConnected || !$('#tour').hidden || $('dialog[open]')) return false;
    const box = $('#picoPeek');
    const art = $('#picoPeekArt');
    const r = near.getBoundingClientRect();
    if (r.bottom < 56 || r.top > window.innerHeight - 80) return false;   // off screen: nothing to look at
    const size = box.offsetHeight || 84;
    const floor = window.innerHeight - 90 - size;
    const middle = r.top + r.height / 2;
    // Beside: level with it (a habit). Away: at the far end of the screen
    // from it, under the app bar or over the tab bar, so he never covers
    // the thing he is looking at (a setting just changed, a chart).
    const top = o.at === 'away'
      ? (middle > window.innerHeight / 2 ? 64 : floor)
      : Math.max(64, Math.min(floor, middle - size * 0.7));
    peekBusy = true;
    peekLast = Date.now();
    box.dataset.side = o.side;
    box.hidden = false;
    box.style.top = Math.round(top) + 'px';
    Pico.mount(art, o.pose);
    if (o.aim) {
      // Where his head is once he has leaned in (styles.css: 30 % past the
      // edge, turned 24 degrees about the bottom corner), and which way the
      // target lies from there, in his own turned frame.
      const hx = o.side === 'left' ? size * 0.41 : window.innerWidth - size * 0.41;
      const hy = top + size * 0.63;
      const deg = Math.atan2(middle - hy, r.left + r.width / 2 - hx) * 180 / Math.PI + (o.side === 'left' ? -24 : 24);
      if (o.aim === 'point') Pico.point(art, deg);
      else Pico.look(art, Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180));
    }
    if (o.gesture) setTimeout(() => Pico.gesture(art, o.gesture), 420);
    if (o.then) setTimeout(() => Pico.pose(art, o.then), 1000);
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('is-in')));
    setTimeout(() => box.classList.remove('is-in'), o.hold);
    setTimeout(() => {
      box.hidden = true;
      Pico.unmount(art);
      peekBusy = false;
    }, o.hold + 700);
    return true;
  }

  /* Now and then, not every time (2.16): Pico drops by while you look at
     your charts or change a setting. At most one such visit a minute, and
     only on about half of the chances even then, so he stays a surprise. */
  const CAMEO_GAP = 60000;
  const CAMEO_CHANCE = 0.5;
  let cameoLast = -CAMEO_GAP;
  function picoCameo(near, opts) {
    if (Date.now() - cameoLast < CAMEO_GAP || Math.random() >= CAMEO_CHANCE) return;
    if (picoPeek(near, opts)) cameoLast = Date.now();
  }

  /* On Progress he leans in from the right, away from the first chart in
     view, and points at it (look at this) or considers it, wing at his chin. */
  function picoAtCharts() {
    if (view !== 'progress') return;
    const chart = $$('#view-progress .chart-card').find((fig) => {
      const r = fig.getBoundingClientRect();
      return !fig.hidden && r.height > 0 && r.top > 60 && r.top < window.innerHeight - 220;
    });
    picoCameo(chart, { side: 'right', at: 'away', pose: Math.random() < 0.6 ? 'point' : 'think', aim: 'point', hold: 2200 });
  }

  /* In Ajustes, a change: he leans in from the left, away from the row,
     looks at it, nods, and is glad. */
  function picoNoticeSetting(node) {
    if (view !== 'settings' || !node) return;
    const row = node.closest('.setting-row, .setting-row-stack, .palette-grid, .setting-group') || node;
    // After the change has painted (a theme or palette cross-fades first).
    setTimeout(() => picoCameo(row, { side: 'left', at: 'away', pose: 'idle', aim: 'look', gesture: 'nod', then: 'happy', hold: 2100 }), 650);
  }

  /* A new habit: he leans in beside it on the list it landed in, and waves. */
  function picoWelcome(habitId) {
    const list = view === 'habits' ? '#manageList .manage-row' : '#habitList .habit-row';
    const row = $$(list).find((node) => node.dataset.habitId === habitId);
    setTimeout(() => picoPeek(row, { pose: 'wave' }), 380);
  }

  /* Sparks flung out from the middle of node: count of them, travelling
     about reach pixels, starting from start pixels out. */
  function sparkBurst(node, count, reach, start) {
    if (!node || reducedMotion.matches) return;
    const r = node.getBoundingClientRect();
    const burst = document.createElement('div');
    burst.className = 'spark-burst';
    burst.setAttribute('aria-hidden', 'true');
    burst.style.left = (r.left + r.width / 2) + 'px';
    burst.style.top = (r.top + r.height / 2) + 'px';
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('i');
      spark.style.setProperty('--a', ((360 / count) * i + Math.random() * 18).toFixed(1) + 'deg');
      spark.style.setProperty('--d', (reach * (0.8 + Math.random() * 0.4)).toFixed(1) + 'px');
      if (start) spark.style.setProperty('--r0', start + 'px');
      spark.style.animationDelay = Math.round(Math.random() * 50) + 'ms';
      burst.appendChild(spark);
    }
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 800);
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
    // A hold that repeated, or a single tap that reached the target: re-render
    // once so streaks, ordering and the day strip catch up, and celebrate.
    // Through 2.16 a plain tap that finished a counted habit only beeped: no
    // sparks, no Pico, no cheer for the day's last habit.
    const crossed = !wasComplete && isComplete(habit, selectedDate);
    if (repeats > 0 || crossed) {
      renderToday();
      celebrate(habit, wasComplete, { sounded: crossed });   // holdStep already sounded the crossing
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
    perchPico('#todayEmptyPico', !shown.length);
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

  /* Pico perches in an empty list, thinking about what could go there. */
  function perchPico(sel, empty) {
    const host = $(sel);
    if (empty && !host.firstChild) Pico.mount(host, 'think');
  }

  function renderToday() {
    renderTourPromo();
    renderCastPromo();
    renderDayStrip();
    renderSummary();
    renderMood();
    renderBody();
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
    { key: 'hbBrushTeeth', desc: 'dsBrushTeeth', emoji: '🦷', colorIndex: 1, category: 'health', type: 'quantity', target: 2, unitKey: 'unitTimes', schedule: { kind: 'daily' } },
    { key: 'hbFloss', desc: 'dsFloss', emoji: '🧵', colorIndex: 3, category: 'health', type: 'binary', schedule: { kind: 'daily' } },
    { key: 'hbNoFap', desc: 'dsNoFap', emoji: '🛡️', colorIndex: 8, category: 'mental', type: 'binary', schedule: { kind: 'daily' } },
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
            const id = uid();
            state.habits.push(Object.assign({
              id, reminders: [], schedule: { kind: 'daily' },
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
            picoWelcome(id);
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
        const id = uid();
        state.habits.push({
          id,
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
        picoWelcome(id);
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
      (habit.type === 'quantity' ? targetOf(habit) + ' ' + (habit.unit || '') : t('typeBinary')) +
      (shell && hasOwnNote(habit) ? ' · 🎙️' : '');
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
    perchPico('#habitsEmptyPico', !active.length);
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
      voiceNote: null,
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
          voiceNote: hasOwnNote(existing) ? Object.assign({}, existing.voiceNote) : null,
        }
      : blankDraft();
    if (!Array.isArray(draft.schedule.days)) draft.schedule.days = [1, 3, 5];
    // A recording made in this editor stays in memory until Save; dropNote
    // marks the saved one for removal, also only on Save.
    draft.newNote = null;
    draft.dropNote = false;
    noteError = null;
    // Which of your bot's lines it plays; null until changed here (then its own lines apply).
    draft.botPick = existing && Array.isArray(existing.botPick) ? existing.botPick.slice() : null;

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
    renderOwnVoice();
    renderBotPicks();

    buildEmojiGrid();
    buildColorRow();
    renderIdeas(!existing);
    syncDialogFields();
    // A new habit gets Pico's company; editing one is quieter.
    $('#sheetPico').hidden = !!existing;
    if (existing) Pico.unmount($('#sheetPico'));
    else Pico.mount($('#sheetPico'), 'wave');
    $('#habitDialog').showModal();
    setTimeout(() => $('#fName').focus(), 60);
  }

  /* Quick ideas (2.13): catalogue habits the list does not have yet, one tap
     to fill the form with the name, icon, colour, target and description
     that the characters' own lines belong to. The newest catalogue habits
     come first. Shown only for a new habit. */
  const IDEAS_FIRST = ['brushTeeth', 'floss', 'noFap'];

  function renderIdeas(show) {
    const field = $('#ideaField');
    const row = $('#ideaRow');
    row.innerHTML = '';
    const taken = new Set(activeHabits().map((h) => h.nameKey).filter(Boolean));
    const ideas = IDEAS_FIRST.map(catalogueById)
      .concat(HABIT_CATALOGUE.filter((entry) => !IDEAS_FIRST.includes(entry.id)))
      .filter((entry) => entry && !taken.has(entry.key));
    field.hidden = !show || !ideas.length;
    if (field.hidden) return;
    ideas.forEach((entry) => {
      const chip = button('idea-chip', null, { 'aria-pressed': String(draft.nameKey === entry.key), 'data-key': entry.key });
      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = entry.emoji;
      chip.append(icon, document.createTextNode(t(entry.key)));
      chip.addEventListener('click', () => applyIdea(entry));
      row.appendChild(chip);
    });
  }

  function applyIdea(entry) {
    readDialog();
    Object.assign(draft, {
      name: t(entry.key),
      nameKey: entry.key,
      description: entry.desc ? t(entry.desc) : '',
      descKey: entry.desc || '',
      emoji: entry.emoji,
      colorIndex: entry.color,
      category: entry.cat,
      type: entry.type,
      target: entry.type === 'quantity' ? entry.target : 1,
      unit: entry.type === 'quantity' ? t(entry.unit) : '',
    });
    $('#fName').value = draft.name;
    $('#fDescription').value = draft.description;
    $('#fTarget').value = draft.target;
    $('#fUnit').value = draft.unit;
    $('#fCategory').value = draft.category;
    $('#formError').hidden = true;
    buildEmojiGrid();
    buildColorRow();
    syncDialogFields();
    $$('#ideaRow .idea-chip').forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.key === entry.key)));
    Sounds.play('tick');
    sheetPicoPose('happy', 'nod');
  }

  /* The editor's Pico (2.16): glad and nodding at a quick idea, thoughtful
     at a form that cannot be saved yet, and back to calm after a moment.
     He looks at whatever has the focus. */
  let sheetPicoTimer = 0;
  function sheetPicoPose(pose, gesture) {
    const host = $('#sheetPico');
    if (host.hidden) return;
    clearTimeout(sheetPicoTimer);
    Pico.pose(host, pose);
    if (gesture) Pico.gesture(host, gesture);
    sheetPicoTimer = setTimeout(() => Pico.pose(host, 'idle'), 1800);
  }

  function sheetPicoLook(node) {
    const host = $('#sheetPico');
    if (host.hidden || !node || !node.getBoundingClientRect) return;
    const p = host.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    const dx = r.left + Math.min(r.width / 2, 120) - (p.left + p.width / 2);
    const dy = r.top + r.height / 2 - (p.top + p.height / 2);
    const length = Math.hypot(dx, dy) || 1;
    Pico.look(host, dx / length, dy / length);
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
    renderReminderHint();
  }

  /* Who will speak at these times: your own note, the character, or nobody. */
  function renderReminderHint() {
    const lines = castLines(state.character);
    $('#reminderHint').textContent = !draft.reminders.length ? t('reminderNone')
      : draftNote() ? t('reminderOwn')
      : state.character === BOT_ID ? t('reminderBot', lines.name)
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
    if (recording || noteBusy) return false;        // a take is still on its way
    readDialog();
    const fail = (msg) => {
      const box = $('#formError');
      box.textContent = msg;
      box.hidden = false;
      sheetPicoPose('think');
      return false;
    };
    if (!draft.name) return fail(t('errName'));
    if (draft.type === 'quantity' && draft.target < 1) return fail(t('errTarget'));
    if (draft.schedule.kind === 'days' && draft.schedule.days.length === 0) return fail(t('errDays'));

    // A new recording goes to the phone's storage before the habit points at
    // it; the note it replaces, or one removed, is deleted once saved.
    const existing = editingId ? habitById(editingId) : null;
    const previousNote = hasOwnNote(existing) ? existing.voiceNote.id : null;
    let voiceNote = draft.dropNote ? null : draft.voiceNote;
    if (draft.newNote) {
      let stored = false;
      try {
        stored = !!shell.saveVoiceNote(draft.newNote.id, draft.newNote.base64);
      } catch (err) {
        stored = false;
      }
      if (!stored) return fail(t('ownVoiceSaveFailed'));
      voiceNote = { id: draft.newNote.id, d: draft.newNote.d, w: draft.newNote.w };
    }

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
    if (voiceNote) payload.voiceNote = voiceNote;
    if (draft.botPick) payload.botPick = draft.botPick.slice();

    let added = null;
    if (existing) {
      Object.assign(existing, payload);
      if (!voiceNote) delete existing.voiceNote;
    } else {
      added = uid();
      state.habits.push(Object.assign({ id: added, createdAt: todayKey(), archived: false }, payload));
    }
    save();
    if (previousNote && (!voiceNote || voiceNote.id !== previousNote)) deleteNoteFile(previousNote);
    // Ask for notification access only once the user actually wants a reminder.
    if (draft.reminders.length && shell && shell.requestNotificationPermission) {
      try { shell.requestNotificationPermission(); } catch (err) { /* older shell */ }
    }
    $('#habitDialog').close();
    renderHabitsView();
    renderToday();
    renderProgressIfVisible();
    renderCastSettings();             // the voice-note switch shows once any habit has a note
    toast(t(draft.reminders.length ? 'reminderSaved' : 'habitSaved'));
    if (added) picoWelcome(added);
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
      setTimeout(picoAtCharts, 500);
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
    // A weight column once there is any weigh-in to show (2.12).
    const withWeight = Object.keys(state.body.weights).length > 0;
    head.innerHTML = '<tr><th>' + t('tableDate') + '</th><th>' + t('tableMood') + '</th><th>' + t('tableDone') + '</th>' +
      (withWeight ? '<th>' + escapeHtml(t('chartWeightTitle')) + '</th>' : '') + '</tr>';
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
      if (withWeight) cells.push(state.body.weights[key] ? fmtWeight(state.body.weights[key]) : '');
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
    renderWeightChart(days);
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

  /* ── Theme and palette ─────────────────────────────────────────────
     Choosing a palette is one attribute; the stylesheet does the rest. While
     a dark-only palette is chosen the theme resolves to dark whatever the
     setting says, and the setting waits, disabled, for another palette. */
  const currentPalette = () => (PALETTES.includes(state.palette) ? state.palette : 'classic');
  const paletteIsDarkOnly = () => DARK_ONLY_PALETTES.includes(currentPalette());
  const paletteKey = (id) => 'pal' + id.charAt(0).toUpperCase() + id.slice(1);

  function resolvedTheme() {
    if (paletteIsDarkOnly()) return 'dark';
    return state.theme === 'system' ? (systemDark.matches ? 'dark' : 'light') : state.theme;
  }

  function applyTheme() {
    const root = document.documentElement;
    root.setAttribute('data-palette', currentPalette());
    root.setAttribute('data-theme', resolvedTheme());
    // The browser's bar takes the palette's own background (the Android
    // shell reads the body's for the system bars).
    const meta = document.querySelector('meta[name="theme-color"]');
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (meta && bg) meta.setAttribute('content', bg);
    const select = $('#themeSelect');
    select.value = state.theme;
    select.disabled = paletteIsDarkOnly();
    $('#themeLockedHint').hidden = !paletteIsDarkOnly();
    renderPalettePicker();
  }

  /* One card per palette, each painted by its own tokens (styles.css gives
     .palette-card[data-palette] the palette's variables). */
  function buildPalettePicker() {
    const host = $('#paletteGrid');
    host.innerHTML = '';
    PALETTES.forEach((id) => {
      const card = button('palette-card', null, { role: 'radio', 'data-palette': id, 'aria-checked': 'false' });
      const preview = document.createElement('span');
      preview.className = 'pc-preview';
      preview.setAttribute('aria-hidden', 'true');
      preview.innerHTML = '<span class="pc-ring"></span><span class="pc-lines"><i></i><i></i><i></i></span>';
      const name = document.createElement('span');
      name.className = 'pc-name';
      const note = document.createElement('span');
      note.className = 'pc-note';
      card.append(preview, name, note);
      card.addEventListener('click', () => pickPalette(id));
      host.appendChild(card);
    });
    // One stop in the tab order; the arrows move between palettes, as in any
    // radio group, and choose as they go.
    host.addEventListener('keydown', (evt) => {
      const steps = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      const at = PALETTES.indexOf(currentPalette());
      let next = null;
      if (evt.key in steps) next = (at + steps[evt.key] + PALETTES.length) % PALETTES.length;
      else if (evt.key === 'Home') next = 0;
      else if (evt.key === 'End') next = PALETTES.length - 1;
      if (next === null) return;
      evt.preventDefault();
      pickPalette(PALETTES[next]);
      const card = $('.palette-card[data-palette="' + PALETTES[next] + '"]', host);
      if (card) card.focus();
    });
  }

  function renderPalettePicker() {
    const current = currentPalette();
    $$('#paletteGrid .palette-card').forEach((card) => {
      const id = card.dataset.palette;
      card.setAttribute('aria-checked', String(id === current));
      card.tabIndex = id === current ? 0 : -1;
      $('.pc-name', card).textContent = t(paletteKey(id));
      $('.pc-note', card).textContent = DARK_ONLY_PALETTES.includes(id) ? t('palDarkOnly') : '';
    });
  }

  function pickPalette(id) {
    if (!PALETTES.includes(id) || id === currentPalette()) return;
    state.palette = id;
    save();
    withFade(() => {
      applyTheme();
      renderProgressIfVisible();
    });
    picoNoticeSetting($('#paletteGrid'));
    Sounds.play('tick');
  }

  /* Colour changes cross-fade where the browser can (View Transitions)
     rather than snapping from one palette to the next. */
  function withFade(change) {
    if (document.startViewTransition && !reducedMotion.matches && !document.hidden) {
      // A second change before the first has faded skips the first fade
      // (the change itself still happens); its promise then rejects, which
      // is expected, not an error to leave unhandled.
      document.startViewTransition(change).ready.catch(() => {});
    } else {
      change();
    }
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
    renderPalettePicker();
    renderBackupInfo();
    if (tour.open) showTourStep(tour.at);
    renderCastSettings();
    renderBodySettings();
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
      // 3 from 2.9: each reminder carries its slot, and character.autoplay is
      // a real choice. In a v2 snapshot, false was mostly 2.8's default.
      v: 3,
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
        (h.reminders || []).forEach((time, slot) => {
          const reminder = {
            // `slot` lets the shell give each of a habit's times a different line.
            id: h.id, time: time, slot: slot, name: habitName(h), emoji: h.emoji || '✅',
            msgs: cast ? reminderMessages(h, cast.id) : [],
          };
          // Your own recording plays instead of the character's note (2.10).
          if (hasOwnNote(h)) reminder.own = notePath(h.voiceNote.id);
          out.push(reminder);
        });
        return out;
      }, []),
      // Whether notes play by themselves. Also inside `character` below, which
      // is where shells before 2.10 look; a habit's own note needs no character.
      autoplay: !!state.voiceAutoplay,
      character: cast ? {
        id: cast.id,
        name: lines.name,
        autoplay: !!state.voiceAutoplay,
        praise: cast.id === BOT_ID
          ? recordedBotLines('praise').map((line) => ({ text: line.text, voice: clipPath(line.clip) }))
          : lines.praise.map((text, i) => ({ text: text, voice: GLOW_CAST.voicePath(cast.id, lang, 'p' + (i + 1)) })),
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
        ownVoice: t('ownVoiceLabel'),
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
      if (!item || !item.id || known.has(item.id) || !castById(item.char)) return;
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
        // A character's note from the APK, or one of yours from the phone.
        voice: typeof item.voice === 'string' && /^voices\/[\w/-]+\.webm$/.test(item.voice)
          ? GLOW_CAST.upgradeVoicePath(item.voice)
          : typeof item.voice === 'string' && OWN_PATH_RE.test(item.voice) ? item.voice : null,
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
    // Android's "save as" answers here: 'saved', 'cancelled' or 'failed'.
    fileSaved: (status) => {
      const done = fileSaved;
      fileSaved = null;
      if (done) done(status);
    },
  };

  /* ══ Reminder cast ═══════════════════════════════════════════════════
     A character from characters.js sends each reminder as a chat message
     with a voice note. The Android shell posts them while the app is
     closed and hands them back through takeInbox(); the conversation is
     kept here, in the same record as everything else.

     Lines are chosen on this side, not natively, so one place knows how a
     habit maps to a line in both languages. */
  const CHAT_LIMIT = 150;
  /* The five characters, and your own bot (2.11) dressed the same way. */
  const castLines = (id) => (id === BOT_ID ? botCastLines() : id ? GLOW_CAST.lines(id, I18N.getLang()) : null);
  const currentCast = () => (state.character ? castById(state.character) : null);

  /* What a character says about a habit: its own three lines when it came
     from the catalogue, generic ones that name it otherwise. The shell takes
     them in turn, a different one each day and for each of a habit's times. */
  function reminderMessages(habit, id) {
    if (id === BOT_ID) return botMessages(habit);
    const lines = castLines(id);
    if (!lines) return [];
    const lang = I18N.getLang();
    const generic = lines.generic.map((g, i) => ({
      text: g.text.replace('{habit}', habitName(habit)),
      voice: GLOW_CAST.voicePath(id, lang, 'g' + (i + 1)),
    }));
    const key = GLOW_CAST.lineKeyFor(habit.nameKey);
    if (!key) return generic;
    const own = lines.habits[key].map((text, i) => ({
      text: text,
      voice: GLOW_CAST.voicePath(id, lang, 'h-' + key + '-' + (i + 1)),
    }));
    // The generic lines say the habit's name, which a discreet habit keeps
    // off the lock screen: its own lines never say what it is about.
    const entry = catalogueById(key);
    if (entry && entry.discreet) return own;
    // Mostly its own lines, with a generic one now and then for variety.
    return [own[0], own[1], generic[0], own[2], generic[2]];
  }

  function praiseMessage(id) {
    if (id === BOT_ID) {
      const said = recordedBotLines('praise');
      const line = said[Math.floor(Math.random() * said.length)];
      return line ? { text: line.text, voice: clipPath(line.clip) } : { text: t('botPraise1'), voice: null };
    }
    const lines = castLines(id);
    const i = Math.floor(Math.random() * lines.praise.length);
    return { text: lines.praise[i], voice: GLOW_CAST.voicePath(id, I18N.getLang(), 'p' + (i + 1)) };
  }

  function introMessage(id) {
    if (id === BOT_ID) {
      const line = botLines().find((l) => l.kind === 'intro');
      return { text: line ? line.text : t('botIntroLine'), voice: line && line.clip ? clipPath(line.clip) : null };
    }
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

  /* Length and waveform of a note: a character's from the index, one of
     yours from this record. */
  const clipInfo = (path) => (OWN_PATH_RE.test(path) ? ownClipInfo(path)
    : (voiceIndex && voiceIndex[path.replace(/^voices\//, '').replace(/\.webm$/, '')]) || null);
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

  function playVoice(path, onTick, knownLength) {
    const again = voice.path === path;
    stopVoice();
    if (again) return;                       // a second tap stops it
    const audio = new Audio(path);
    voice.audio = audio;
    voice.path = path;
    voice.onTick = onTick || null;
    const frame = () => {
      if (voice.audio !== audio) return;
      // A note recorded in the app carries no length of its own (the browser's
      // recorder never writes one), so the measured one stands in.
      const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : knownLength;
      if (voice.onTick && total) voice.onTick(Math.min(1, audio.currentTime / total), false);
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
     waveform that fills as it plays, and the length. A recording of your own
     brings its length and waveform along (`known`); the characters' come
     from the index. */
  function voiceNote(path, known) {
    const box = document.createElement('div');
    box.className = 'vn';
    const info = known || clipInfo(path);
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
    play.addEventListener('click', () => playVoice(path, paint, info && info.d));
    box.append(play, wave, time);
    return box;
  }

  /* ══ Your own voice note ═════════════════════════════════════════════
     A habit's reminders can play a note you record yourself instead of the
     character's. It is recorded here with the microphone and kept by the
     Android shell in the app's private storage (OwnNotes), where reminders
     play it with the app closed and this page reads it back as
     mine/<id>.webm. Until the habit is saved the take lives only in memory,
     so cancelling the editor simply lets it go. A browser has no reminders,
     so it gets no recorder either. */
  const NOTE_MAX = 30;                                  // seconds
  const NOTE_ID_RE = /^[a-z0-9]{6,40}$/;
  const notePath = (id) => 'mine/' + id + '.webm';
  const hasOwnNote = (habit) => !!(habit && habit.voiceNote && typeof habit.voiceNote.id === 'string' &&
    NOTE_ID_RE.test(habit.voiceNote.id));
  const canRecord = () => !!(shell && shell.saveVoiceNote && navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  /* What the editor shows: a take just recorded, else the saved note unless removed. */
  const draftNote = () => (draft ? draft.newNote || (draft.dropNote ? null : draft.voiceNote) : null);
  const noteId = () => 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const stopTracks = (stream) => { if (stream) stream.getTracks().forEach((track) => track.stop()); };

  let recording = null;      // the take in progress
  let noteBusy = false;      // between Stop and the take being ready to keep
  let noteError = null;      // 'denied', 'failed' or 'short', shown under the recorder

  function deleteNoteFile(id) {
    if (!shell || !shell.deleteVoiceNote || !NOTE_ID_RE.test(id || '')) return;
    try {
      shell.deleteVoiceNote(id);
    } catch (err) { /* an older shell */ }
  }

  /* Recordings live on the phone, not in this record. A file no habit points
     at (the app closed mid-save, a habit deleted) is removed, and a habit
     whose file is gone (a backup imported on another phone) forgets it. */
  function reconcileVoiceNotes() {
    if (!shell || !shell.listVoiceNotes) return false;
    let onPhone;
    try {
      onPhone = new Set(JSON.parse(shell.listVoiceNotes() || '[]'));
    } catch (err) {
      return false;
    }
    let changed = false;
    const used = new Set();
    state.habits.forEach((habit) => {
      if (!hasOwnNote(habit)) return;
      if (onPhone.has(habit.voiceNote.id)) {
        used.add(habit.voiceNote.id);
      } else {
        delete habit.voiceNote;
        changed = true;
      }
    });
    // Your bot's lines (2.11): one whose recording is gone is simply unrecorded again.
    botLines().forEach((line) => {
      if (!line.clip) return;
      if (onPhone.has(line.clip.id)) {
        used.add(line.clip.id);
      } else {
        line.clip = null;
        changed = true;
      }
    });
    onPhone.forEach((id) => { if (!used.has(id)) deleteNoteFile(id); });
    return changed;
  }

  async function startRecording() {
    if (recording || noteBusy || !draft) return;
    stopVoice();
    noteError = null;
    const forDraft = draft;
    // Made in the tap itself, where Android always lets an audio context run.
    let ctx = null;
    try {
      ctx = new AudioContext();
    } catch (err) {
      ctx = null;       // it records all the same, without the live level
    }
    const dropCtx = () => { if (ctx) ctx.close().catch(() => {}); };
    let stream;
    try {
      // A memo, not a call: echo cancelling would put the phone in call mode
      // for nothing, while an even level and less hiss do help.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      noteError = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError') ? 'denied' : 'failed';
      dropCtx();
      renderOwnVoice();
      return;
    }
    // The editor may have closed while Android asked for the permission.
    if (draft !== forDraft || !$('#habitDialog').open) {
      stopTracks(stream);
      dropCtx();
      return;
    }
    const mime = ['audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type));
    let media = null;
    try {
      if (mime) media = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
    } catch (err) {
      media = null;
    }
    if (!media) {
      stopTracks(stream);
      dropCtx();
      noteError = 'failed';
      renderOwnVoice();
      return;
    }
    const take = {
      media: media, stream: stream, mime: mime, draft: forDraft, chunks: [], levels: [],
      started: performance.now(), timer: 0, raf: 0, ctx: null, analyser: null, discarded: false, finished: false,
    };
    recording = take;
    media.addEventListener('dataavailable', (evt) => { if (evt.data && evt.data.size) take.chunks.push(evt.data); });
    media.addEventListener('stop', () => finishRecording(take));
    try {
      take.ctx = ctx;
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      take.analyser = take.ctx.createAnalyser();
      take.analyser.fftSize = 1024;
      take.ctx.createMediaStreamSource(stream).connect(take.analyser);
    } catch (err) {
      take.analyser = null;    // it records all the same, without the live level
    }
    media.start(250);
    take.timer = setTimeout(() => stopRecording(), NOTE_MAX * 1000);
    renderOwnVoice();
    meter(take);
  }

  /* Stops the take in progress: kept, or thrown away when `discard`. */
  function stopRecording(discard) {
    const take = recording;
    if (!take) return;
    recording = null;
    take.discarded = !!discard;
    noteBusy = !discard;
    clearTimeout(take.timer);
    cancelAnimationFrame(take.raf);
    try {
      if (take.media.state !== 'inactive') take.media.stop();     // its 'stop' event finishes the take
      else finishRecording(take);
    } catch (err) {
      finishRecording(take);
    }
    if (!discard) renderOwnVoice();
  }

  async function finishRecording(take) {
    if (take.finished) return;
    take.finished = true;
    stopTracks(take.stream);                       // the microphone indicator goes off
    const stale = () => take.discarded || draft !== take.draft || !$('#habitDialog').open;
    let info = null;
    let blob = null;
    let base64 = null;
    if (!stale()) {
      blob = new Blob(take.chunks, { type: take.mime });
      try {
        take.ctx = take.ctx || new AudioContext();
        info = describeRecording(await take.ctx.decodeAudioData(await blob.arrayBuffer()));
        if (info.d >= 1) base64 = await blobBase64(blob);
      } catch (err) {
        info = null;
      }
    }
    if (take.ctx) take.ctx.close().catch(() => {});
    if (take.discarded) return;
    noteBusy = false;
    if (stale()) return;
    if (!info || (info.d >= 1 && !base64)) {
      noteError = 'failed';
    } else if (info.d < 1) {
      noteError = 'short';
    } else {
      if (draft.newNote) URL.revokeObjectURL(draft.newNote.url);
      draft.newNote = {
        id: noteId(), d: info.d, w: info.w, quiet: info.peak < 0.05,
        url: URL.createObjectURL(blob), base64: base64,
      };
    }
    renderOwnVoice();
  }

  /* Length, a 28-bar waveform in the voice index's digits, and the loudest
     sample of a decoded take. */
  function describeRecording(audio) {
    const data = audio.getChannelData(0);
    const BARS = 28;
    const rms = [];
    let peak = 0;
    for (let i = 0; i < BARS; i++) {
      const from = Math.floor((i * data.length) / BARS);
      const to = Math.floor(((i + 1) * data.length) / BARS);
      let sum = 0;
      for (let j = from; j < to; j++) {
        sum += data[j] * data[j];
        if (Math.abs(data[j]) > peak) peak = Math.abs(data[j]);
      }
      rms.push(Math.sqrt(sum / Math.max(1, to - from)));
    }
    const top = Math.max(...rms) || 1;
    return {
      d: Math.round(audio.duration * 100) / 100,
      w: rms.map((r) => Math.min(9, Math.round((r / top) * 9))).join(''),
      peak: peak,
    };
  }

  const blobBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  /* While recording: the clock, and one bar per tenth of a second with the
     newest on the right. */
  function meter(take) {
    if (recording !== take) return;
    const elapsed = (performance.now() - take.started) / 1000;
    if (take.analyser) {
      const data = new Uint8Array(take.analyser.fftSize);
      take.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += ((data[i] - 128) / 128) ** 2;
      const level = Math.sqrt(sum / data.length);
      while (take.levels.length < Math.floor(elapsed * 10)) take.levels.push(level);
    }
    const clock = $('#ownVoiceBody .rec-time');
    if (clock) clock.textContent = fmtClock(Math.floor(elapsed)) + ' / ' + fmtClock(NOTE_MAX);
    const bars = $$('#ownVoiceBody .rec-wave i');
    const recent = take.levels.slice(-bars.length);
    const offset = bars.length - recent.length;
    bars.forEach((bar, i) => {
      const level = i < offset ? 0 : recent[i - offset];
      bar.style.height = (12 + Math.min(1, Math.sqrt(level * 6)) * 88) + '%';
    });
    take.raf = requestAnimationFrame(() => meter(take));
  }

  function renderOwnVoice() {
    const box = $('#ownVoice');
    box.hidden = !draft || !canRecord();
    $('#btnSaveHabit').disabled = !!(recording || noteBusy);
    if (!draft) return;
    renderReminderHint();
    if (box.hidden) return;

    const body = $('#ownVoiceBody');
    body.innerHTML = '';
    const note = draftNote();
    let hint = t('ownVoiceHint');

    if (recording) {
      const row = document.createElement('div');
      row.className = 'rec-row';
      const dot = document.createElement('span');
      dot.className = 'rec-dot';
      dot.setAttribute('aria-hidden', 'true');
      const clock = document.createElement('span');
      clock.className = 'rec-time';
      clock.textContent = '0:00 / ' + fmtClock(NOTE_MAX);
      const wave = document.createElement('div');
      wave.className = 'vn-wave rec-wave';
      wave.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 28; i++) wave.appendChild(document.createElement('i'));
      const stop = button('btn btn-sm btn-primary', t('ownVoiceStop'));
      stop.addEventListener('click', () => stopRecording());
      row.append(dot, clock, wave, stop);
      body.appendChild(row);
      hint = t('ownVoiceRecording') + '…';
      stop.focus();
    } else if (noteBusy) {
      hint = '…';
    } else if (note) {
      const path = draft.newNote ? draft.newNote.url : notePath(note.id);
      const actions = document.createElement('div');
      actions.className = 'own-voice-actions';
      const redo = button('btn btn-sm', t('ownVoiceRedo'));
      redo.addEventListener('click', startRecording);
      const remove = button('btn btn-sm btn-danger ghost', t('ownVoiceRemove'));
      remove.addEventListener('click', () => {
        stopVoice();
        if (draft.newNote) URL.revokeObjectURL(draft.newNote.url);
        draft.newNote = null;
        draft.dropNote = true;
        noteError = null;
        renderOwnVoice();
      });
      actions.append(redo, remove);
      body.append(voiceNote(path, note), actions);
      if (draft.newNote) hint = draft.newNote.quiet ? t('ownVoiceQuiet') : t('ownVoiceUnsaved');
    } else {
      const record = button('btn btn-sm own-voice-record', null);
      record.innerHTML = iconSvg('i-mic', 18);
      record.append(t('ownVoiceRecord'));
      record.addEventListener('click', startRecording);
      body.appendChild(record);
    }

    if (noteError) {
      hint = t({ denied: 'ownVoiceDenied', short: 'ownVoiceShort', failed: 'ownVoiceFailed' }[noteError]);
      if (noteError === 'denied' && shell.openAppSettings) {
        const open = button('btn btn-sm', t('ownVoiceOpenSettings'));
        open.addEventListener('click', () => {
          try { shell.openAppSettings(); } catch (err) { /* an older shell */ }
        });
        body.appendChild(open);
      }
    }
    $('#ownVoiceHint').textContent = hint;
    renderBotPicks();             // its hint says when your own note takes over
  }

  /* ══ Your own bot (2.11) ═════════════════════════════════════════════
     Picked like the five characters, but every line is yours. The studio
     shows a script (a greeting, two lines per habit, answers for "done",
     lines for any habit) and you read it aloud in one go. Each phrase is
     found by the pause after it, cut out of the take, levelled, saved as a
     WAV of its own and kept with its habit; in each habit's editor you then
     tick which of its lines play. Nothing is transcribed and the voice never
     leaves the phone: the script's order says which phrase is which line. */
  const BOT_ID = 'mine';
  const BOT_ACCENT = '#E0663A';
  const BOT_CAST = { id: BOT_ID, accent: BOT_ACCENT };
  const BOT_KINDS = ['intro', 'habit', 'praise', 'generic'];
  const BOT_RATE = 22050;        // Hz, for the cut lines (16-bit WAV)
  const OWN_PATH_RE = /^mine\/[a-z0-9]{6,40}\.(webm|wav)$/;

  const castById = (id) => (id === BOT_ID ? (state.bot ? BOT_CAST : null) : GLOW_CAST.byId(id));
  const botLines = () => (state.bot && Array.isArray(state.bot.lines) ? state.bot.lines : []);
  const recordedBotLines = (kind) => botLines().filter((line) => line.clip && (!kind || line.kind === kind));
  const botReady = () => botLines().some((line) => line.clip);
  const clipPath = (clip) => 'mine/' + clip.id + '.' + (clip.ext === 'webm' ? 'webm' : 'wav');
  const lineId = () => 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const lowerFirst = (text) => text.charAt(0).toLocaleLowerCase(I18N.locale()) + text.slice(1);
  const needsTake = (line) => !line.clip;

  function botCastLines() {
    const intro = botLines().find((line) => line.kind === 'intro');
    return {
      name: (state.bot && state.bot.name) || t('botDefaultName'),
      tagline: t('botTagline'),
      intro: intro ? intro.text : t('botIntroLine'),
    };
  }

  /* Length and waveform of one of your recordings, from this record. */
  function ownClipInfo(path) {
    const id = path.slice('mine/'.length).replace(/\.(webm|wav)$/, '');
    const line = botLines().find((l) => l.clip && l.clip.id === id);
    if (line) return line.clip;
    const habit = state.habits.find((h) => hasOwnNote(h) && h.voiceNote.id === id);
    return habit ? habit.voiceNote : null;
  }

  /* Keeps the bot to the shape this code writes. A line for a habit that no
     longer exists goes, and the start-up check then deletes its recording. */
  function normalizeBot() {
    const bot = state.bot;
    if (!bot || typeof bot !== 'object' || !Array.isArray(bot.lines)) {
      state.bot = null;
      return;
    }
    if (typeof bot.name !== 'string') bot.name = '';
    if (!Array.isArray(bot.seen)) bot.seen = [];
    const habits = new Set(state.habits.map((h) => h.id));
    bot.lines = bot.lines.filter((line) => line && typeof line.id === 'string' && /^[a-z0-9]{4,40}$/.test(line.id) &&
      BOT_KINDS.includes(line.kind) && typeof line.text === 'string' &&
      (line.kind !== 'habit' || habits.has(line.habitId)));
    bot.lines.forEach((line) => {
      if (line.kind !== 'habit') line.habitId = null;
      if (line.clip && !(typeof line.clip.id === 'string' && NOTE_ID_RE.test(line.clip.id))) line.clip = null;
    });
  }

  /* What your bot says for a habit: the lines ticked in its editor, else the
     ones recorded for it, else the ones for any habit. Its own come first,
     as the editor lists them. */
  function botMessages(habit) {
    const recorded = recordedBotLines();
    const own = (line) => line.kind === 'habit' && line.habitId === habit.id;
    const picked = Array.isArray(habit.botPick)
      ? recorded.filter((line) => habit.botPick.includes(line.id)).sort((a, b) => own(b) - own(a))
      : recorded.filter(own);
    const lines = picked.length ? picked : recorded.filter((line) => line.kind === 'generic');
    return lines.map((line) => ({ text: line.text, voice: clipPath(line.clip) }));
  }

  function dropBotLinesOf(habitId) {
    if (!state.bot) return;
    state.bot.lines = state.bot.lines.filter((line) => {
      if (line.kind !== 'habit' || line.habitId !== habitId) return true;
      if (line.clip) deleteNoteFile(line.clip.id);
      return false;
    });
  }

  /* The script grows with your habits: a habit not seen before gets its two
     lines; a line you removed stays removed. */
  function ensureScript() {
    if (!state.bot) state.bot = { name: '', lines: [], seen: [] };
    const bot = state.bot;
    const add = (kind, habitId, text) =>
      bot.lines.push({ id: lineId(), kind: kind, habitId: habitId, text: text, clip: null });
    if (!bot.started) {
      add('intro', null, t('botIntroLine'));
      [1, 2, 3].forEach((n) => add('praise', null, t('botPraise' + n)));
      [1, 2].forEach((n) => add('generic', null, t('botGeneric' + n)));
      bot.started = true;
    }
    activeHabits().forEach((habit) => {
      if (bot.seen.includes(habit.id)) return;
      bot.seen.push(habit.id);
      const name = habitName(habit);
      add('habit', habit.id, t('botHabitLine1', name));
      add('habit', habit.id, t('botHabitLine2', lowerFirst(name)));
    });
  }

  /* The script in reading order: greeting, each habit, answers, any habit. */
  function scriptSections() {
    const lines = botLines();
    const of = (kind, habitId) => lines.filter((line) => line.kind === kind && (habitId === undefined || line.habitId === habitId));
    return [{ kind: 'intro', title: t('studioIntro'), lines: of('intro') }]
      .concat(activeHabits().map((habit) => ({
        kind: 'habit', habitId: habit.id, title: (habit.emoji || '✅') + ' ' + habitName(habit), lines: of('habit', habit.id),
      })))
      .concat([
        { kind: 'praise', title: t('studioPraise'), lines: of('praise') },
        { kind: 'generic', title: t('studioGeneric'), lines: of('generic') },
      ]);
  }

  /* ── The studio ── */
  let studio = null;     // the open session: { pick, focus, mode, reading, note, error }

  function openStudio(opts) {
    if (!canRecord()) return;
    stopVoice();
    ensureScript();
    save();
    studio = {
      pick: !!(opts && opts.pick), focus: (opts && opts.habitId) || null,
      mode: 'script', reading: null, note: '', error: null,
    };
    renderStudio();
    $('#studio').showModal();
    $('#studioBody').scrollTop = 0;
    if (studio.focus) {
      const section = $$('#studioBody .script-section').find((el) => el.dataset.habit === studio.focus);
      if (section) section.scrollIntoView({ block: 'start' });
    }
  }

  /* However it closes, a take in progress is still cut and kept. */
  function onStudioClosed() {
    const session = studio;
    studio = null;
    stopVoice();
    if (!session) return;
    if (session.reading) finishReading(session.reading);     // afterStudio once the lines are cut
    else afterStudio(session);
  }

  function afterStudio(session) {
    if (session.pick && botReady()) chooseCharacter(BOT_ID);
    if ($('#castDialog').open) renderCastPicker();
    if ($('#habitDialog').open && draft) renderBotPicks();
    renderCastSettings();
  }

  function renderStudio() {
    if (!studio) return;
    const body = $('#studioBody');
    const foot = $('#studioFoot');
    const scroll = body.scrollTop;
    body.innerHTML = '';
    foot.innerHTML = '';
    body.classList.toggle('is-reading', studio.mode !== 'script');
    if (studio.mode === 'reading') {
      renderPrompter(body, foot);
    } else if (studio.mode === 'cutting') {
      const wait = document.createElement('p');
      wait.className = 'studio-wait';
      wait.textContent = t('studioCutting');
      body.appendChild(wait);
    } else {
      renderScript(body, foot);
      body.scrollTop = scroll;
    }
  }

  function renderScript(body, foot) {
    const bot = state.bot;
    const nameField = document.createElement('label');
    nameField.className = 'field';
    const nameLabel = document.createElement('span');
    nameLabel.className = 'field-label';
    nameLabel.textContent = t('studioName');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'studioName';
    nameInput.maxLength = 40;
    nameInput.value = bot.name;
    nameInput.placeholder = t('botDefaultName');
    nameInput.addEventListener('change', () => {
      bot.name = nameInput.value.trim().slice(0, 40);
      save();
    });
    nameField.append(nameLabel, nameInput);
    const how = document.createElement('p');
    how.className = 'muted small';
    how.textContent = t('studioHow');
    body.append(nameField, how);

    if (studio.error || studio.note) {
      const message = document.createElement('div');
      message.className = 'studio-message' + (studio.error ? ' is-error' : '');
      message.setAttribute('role', 'status');
      const words = document.createElement('span');
      words.textContent = studio.error === 'denied' ? t('ownVoiceDenied')
        : studio.error === 'none' ? t('studioNoneHeard')
        : studio.error ? t('ownVoiceFailed') : studio.note;
      message.appendChild(words);
      if (studio.error === 'denied' && shell.openAppSettings) {
        const open = button('btn btn-sm', t('ownVoiceOpenSettings'));
        open.addEventListener('click', () => {
          try { shell.openAppSettings(); } catch (err) { /* an older shell */ }
        });
        message.appendChild(open);
      }
      body.appendChild(message);
    }

    const sections = scriptSections();
    sections.forEach((section) => body.appendChild(scriptSection(section)));

    const shown = [].concat(...sections.map((section) => section.lines));
    const missing = shown.filter(needsTake);
    const done = button('btn', t('studioDone'));
    done.addEventListener('click', () => $('#studio').close());
    const spacer = document.createElement('span');
    spacer.className = 'spacer';
    const read = button('btn btn-primary', missing.length ? t('studioReadMissing', missing.length) : t('studioReadAll'));
    read.id = 'studioRead';
    read.disabled = !shown.length;
    read.addEventListener('click', () => startReading((missing.length ? missing : shown).map((line) => line.id)));
    foot.append(done, spacer, read);
  }

  function scriptSection(section) {
    const box = document.createElement('section');
    box.className = 'script-section';
    if (section.habitId) box.dataset.habit = section.habitId;
    const title = document.createElement('h3');
    title.textContent = section.title;
    box.appendChild(title);
    section.lines.forEach((line) => box.appendChild(scriptRow(line)));
    const add = button('btn btn-sm script-add', '+ ' + t('studioAddLine'));
    add.addEventListener('click', () => {
      const habit = section.habitId ? habitById(section.habitId) : null;
      const text = section.kind === 'habit' ? t('botHabitLine1', habit ? habitName(habit) : '')
        : section.kind === 'praise' ? t('botPraise1')
        : section.kind === 'intro' ? t('botIntroLine') : t('botGeneric1');
      const line = { id: lineId(), kind: section.kind, habitId: section.habitId || null, text: text, clip: null };
      state.bot.lines.push(line);
      save();
      renderStudio();
      const input = $$('#studioBody .script-line').find((el) => el.dataset.line === line.id);
      if (input) input.querySelector('input').focus();
    });
    box.appendChild(add);
    return box;
  }

  function scriptRow(line) {
    const row = document.createElement('div');
    row.className = 'script-line' + (line.clip ? ' is-recorded' : '');
    row.dataset.line = line.id;
    // A box that grows with its words: a line is a sentence or two, never a paragraph.
    const input = document.createElement('textarea');
    input.rows = 1;
    input.className = 'script-text';
    input.maxLength = 160;
    input.value = line.text;
    input.setAttribute('aria-label', t('studioLineText'));
    input.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        input.blur();
      }
    });
    input.addEventListener('change', () => {
      // The words can change after recording: they are what the message shows.
      const text = input.value.trim();
      if (text) line.text = text;
      if (line.clip) line.clip.said = line.text;
      save();
      renderStudio();
    });
    const tools = document.createElement('div');
    tools.className = 'script-tools';
    if (line.clip) {
      tools.appendChild(voiceNote(clipPath(line.clip), line.clip));
    } else {
      const none = document.createElement('span');
      none.className = 'script-missing';
      none.textContent = t('studioNotRecorded');
      tools.appendChild(none);
    }
    const mic = button('icon-btn script-mic', null, { 'aria-label': t('studioRecordLine'), title: t('studioRecordLine') });
    mic.innerHTML = iconSvg('i-mic', 18);
    mic.addEventListener('click', () => startReading([line.id]));
    const remove = button('icon-btn', null, { 'aria-label': t('studioRemoveLine'), title: t('studioRemoveLine') });
    remove.innerHTML = iconSvg('i-close', 16);
    remove.addEventListener('click', () => {
      stopVoice();
      if (line.clip) deleteNoteFile(line.clip.id);
      state.bot.lines = state.bot.lines.filter((l) => l !== line);
      save();
      renderStudio();
    });
    tools.append(mic, remove);
    row.append(input, tools);
    return row;
  }

  /* ── Reading the script aloud ──
     Each line owns the stretch of the take during which it was on screen:
     whatever was said then is that line, found and cut out afterwards from
     the take itself. Turning the page is the reader's call (the big Next
     button) or, with automatic advance on, a pause after the line. A pause
     read wrongly only turns a page early or late; nothing ever slides onto
     the wrong line, which is what 2.11's purely live detection could do. */
  /* Automatic page turns: a short pause once most of the line has been
     said, a long one before that. How long a line takes is guessed from its
     length at the reader's own pace, learnt as they read; so a comma in the
     middle of a line does not cut it, and a quick reader's short breath
     between lines still turns the page. */
  const AUTO_GAP = 0.6;            // s of quiet that ends a line mostly said
  const AUTO_GAP_EARLY = 1.6;      // s of quiet that ends one that seems unfinished
  const AUTO_DONE = 0.55;          // share of a line's expected length that counts as mostly said
  const AUTO_MIN_VOICE = 0.3;      // s of voice before any pause counts
  const READ_PACE = 15;            // characters a second, until the reader's own is known
  const NO_SIGNAL = 4;             // s with nothing from the microphone before saying so
  const freshVad = () => ({ loud: 0, speaking: false, start: 0, last: 0, voiced: 0 });
  const takeTime = (rd) => (performance.now() - rd.t0) / 1000;

  /* The microphone, a recorder on it, and an analyser for the live level.
     The audio context is made by the caller, inside the tap. */
  async function openMic(ctx) {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      return { error: err && (err.name === 'NotAllowedError' || err.name === 'SecurityError') ? 'denied' : 'failed' };
    }
    const mime = ['audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type));
    let media = null;
    let analyser = null;
    try {
      if (ctx.state !== 'running') await ctx.resume();
      // A generous rate: the take is only an intermediate, cut into lines and re-encoded.
      media = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 96000 });
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
    } catch (err) {
      stopTracks(stream);
      return { error: 'failed' };
    }
    return { stream: stream, media: media, mime: mime, ctx: ctx, analyser: analyser };
  }

  async function startReading(queue) {
    if (!studio || studio.reading || !queue.length) return;
    stopVoice();
    const session = studio;
    session.error = null;
    session.note = '';
    // Made in the tap itself: Android lets an audio context made there run.
    let ctx;
    try {
      ctx = new AudioContext();
    } catch (err) {
      session.error = 'failed';
      renderStudio();
      return;
    }
    const mic = await openMic(ctx);
    if (mic.error) {
      ctx.close().catch(() => {});
      session.error = mic.error;
      if (studio === session) renderStudio();
      return;
    }
    // The studio may have closed while Android asked for the microphone.
    if (studio !== session || !$('#studio').open) {
      stopTracks(mic.stream);
      ctx.close().catch(() => {});
      return;
    }
    const rd = {
      session: session, queue: queue, index: 0, windows: new Map(), mic: mic, chunks: [],
      t0: 0, last: 0, hist: [], levels: [], buf: new Float32Array(mic.analyser.fftSize),
      v: freshVad(), voiceNow: false, spoken: 0, paceChars: 0, paceSeconds: 0,
      gotAt: -1, heardAt: -1, raf: 0, done: false, cut: false,
      auto: !state.bot || state.bot.auto !== false,
    };
    session.reading = rd;
    session.mode = 'reading';
    mic.media.addEventListener('dataavailable', (evt) => { if (evt.data && evt.data.size) rd.chunks.push(evt.data); });
    mic.media.addEventListener('stop', () => cutReading(rd));
    mic.media.start(250);
    rd.t0 = performance.now();
    openWindow(rd, 0);
    renderStudio();
    listen(rd);
  }

  function openWindow(rd, at) {
    rd.windows.set(rd.queue[rd.index], { start: at, end: null });
    rd.v = freshVad();
    rd.spoken = 0;                    // seconds of voice heard for this line
  }

  function closeWindow(rd, at) {
    const span = rd.windows.get(rd.queue[rd.index]);
    if (span && span.end === null) span.end = at;
  }

  /* Next, or a pause with automatic advance: this line is done. */
  function readerNext(rd) {
    if (rd.done) return;
    const now = takeTime(rd);
    // Learn the reader's pace from each line read through.
    const line = botLines().find((l) => l.id === rd.queue[rd.index]);
    if (line && rd.spoken > 0.5) {
      rd.paceChars += line.text.length;
      rd.paceSeconds += rd.spoken;
    }
    closeWindow(rd, now);
    rd.index++;
    rd.gotAt = now;
    if (rd.index >= rd.queue.length) {
      finishReading(rd);
      return;
    }
    openWindow(rd, now);
    renderStudio();
  }

  /* Back: the previous line is read again; this one waits its turn. */
  function readerBack(rd) {
    if (rd.done || rd.index === 0) return;
    rd.windows.delete(rd.queue[rd.index]);
    rd.index--;
    openWindow(rd, takeTime(rd));
    rd.gotAt = -1;
    renderStudio();
  }

  /* Again: this line starts over; what was said of it so far is dropped. */
  function readerRedo(rd) {
    if (rd.done) return;
    openWindow(rd, takeTime(rd));
    rd.gotAt = -1;
    renderStudio();
  }

  /* Skip: this line stays as it was. */
  function readerSkip(rd) {
    if (rd.done) return;
    rd.windows.delete(rd.queue[rd.index]);
    rd.index++;
    rd.gotAt = -1;
    if (rd.index >= rd.queue.length) {
      finishReading(rd);
      return;
    }
    openWindow(rd, takeTime(rd));
    renderStudio();
  }

  function levelDb(rd) {
    rd.mic.analyser.getFloatTimeDomainData(rd.buf);
    let sum = 0;
    for (let i = 0; i < rd.buf.length; i++) sum += rd.buf[i] * rd.buf[i];
    return 10 * Math.log10(sum / rd.buf.length + 1e-12);
  }

  /* The room's own level: the quiet end of the last four seconds. It follows
     a fan switched on or a voice that starts at once, with nothing to learn
     first. */
  function roomFloor(rd) {
    const sorted = rd.hist.slice().sort((a, b) => a - b);
    return Math.max(-90, Math.min(-25, sorted[Math.floor(sorted.length * 0.15)]));
  }

  /* One look at the microphone per frame: the meter, the "is anything
     arriving" check, and the pause that turns the page when that is on. */
  function listen(rd) {
    if (rd.done || rd.session.reading !== rd) return;
    const now = takeTime(rd);
    const dt = Math.min(0.1, Math.max(0, now - rd.last));
    rd.last = now;
    const db = levelDb(rd);
    rd.hist.push(db);
    if (rd.hist.length > 240) rd.hist.shift();
    while (rd.levels.length < Math.floor(now * 10)) rd.levels.push(db);
    if (db > -70) rd.heardAt = now;
    const floor = roomFloor(rd);
    rd.voiceNow = db > Math.max(floor + 10, -60);
    if (db > Math.max(floor + 6, -64)) rd.spoken += dt;
    if (rd.auto) hearFrame(rd, now, dt, db, floor);
    if (rd.done) return;
    paintPrompter(rd, now);
    rd.raf = requestAnimationFrame(() => listen(rd));
  }

  function hearFrame(rd, now, dt, db, floor) {
    const v = rd.v;
    if (!v.speaking) {
      v.loud = rd.voiceNow ? v.loud + 1 : 0;
      if (v.loud >= 3) {
        v.speaking = true;
        v.start = now;
        v.last = now;
        v.voiced = 0;
      }
      return;
    }
    if (db > Math.max(floor + 6, -64)) {
      v.voiced += dt;
      v.last = now;
    }
    const line = botLines().find((l) => l.id === rd.queue[rd.index]);
    const pace = rd.paceSeconds > 2 ? Math.max(8, Math.min(25, rd.paceChars / rd.paceSeconds)) : READ_PACE;
    const expected = line ? line.text.length / pace : 1;
    const gap = rd.spoken >= expected * AUTO_DONE ? AUTO_GAP : AUTO_GAP_EARLY;
    if (now - v.last >= gap) {
      if (v.voiced >= AUTO_MIN_VOICE) readerNext(rd);
      else rd.v = freshVad();                 // a cough or a click, not a line
    }
  }

  function sectionTitleOf(line) {
    if (line.kind === 'habit') {
      const habit = habitById(line.habitId);
      return habit ? (habit.emoji || '✅') + ' ' + habitName(habit) : '';
    }
    return t({ intro: 'studioIntro', praise: 'studioPraise', generic: 'studioGeneric' }[line.kind]);
  }

  function renderPrompter(body, foot) {
    const rd = studio.reading;
    const line = botLines().find((l) => l.id === rd.queue[rd.index]);
    const next = botLines().find((l) => l.id === rd.queue[rd.index + 1]);
    const last = rd.index === rd.queue.length - 1;
    const box = document.createElement('div');
    box.className = 'prompter';
    const step = document.createElement('p');
    step.className = 'prompter-step';
    step.textContent = t('studioProgress', { at: rd.index + 1, of: rd.queue.length }) + (line ? ' · ' + sectionTitleOf(line) : '');
    const words = document.createElement('p');
    words.className = 'prompter-line';
    words.textContent = line ? line.text : '';
    const after = document.createElement('p');
    after.className = 'prompter-next';
    after.textContent = next ? t('studioNext') + ' ' + next.text : '';
    const wave = document.createElement('div');
    wave.className = 'vn-wave rec-wave';
    wave.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 28; i++) wave.appendChild(document.createElement('i'));
    const status = document.createElement('p');
    status.className = 'prompter-status';
    status.setAttribute('aria-live', 'polite');
    const go = button('btn btn-primary prompter-go', last ? t('studioLastDone') : t('studioNextLine'));
    go.id = 'studioNext';
    go.addEventListener('click', () => readerNext(rd));
    const auto = document.createElement('label');
    auto.className = 'switch-inline prompter-auto';
    const tick = document.createElement('input');
    tick.type = 'checkbox';
    tick.id = 'studioAuto';
    tick.checked = rd.auto;
    tick.addEventListener('change', () => {
      rd.auto = tick.checked;
      rd.v = freshVad();
      if (state.bot) state.bot.auto = tick.checked;
      save();
      paintPrompter(rd, takeTime(rd));
    });
    const autoText = document.createElement('span');
    autoText.textContent = t('studioAuto');
    auto.append(tick, autoText);
    box.append(step, words, after, wave, status, go, auto);
    body.appendChild(box);

    const back = button('btn btn-sm', t('studioBackLine'));
    back.disabled = rd.index === 0;
    back.addEventListener('click', () => readerBack(rd));
    const redo = button('btn btn-sm', t('studioRedo'));
    redo.addEventListener('click', () => readerRedo(rd));
    const skip = button('btn btn-sm', t('studioSkip'));
    skip.addEventListener('click', () => readerSkip(rd));
    const spacer = document.createElement('span');
    spacer.className = 'spacer';
    const finish = button('btn btn-sm', t('studioFinish'));
    finish.id = 'studioFinish';
    finish.addEventListener('click', () => finishReading(rd));
    foot.append(back, redo, skip, spacer, finish);
    paintPrompter(rd, takeTime(rd));
  }

  function paintPrompter(rd, now) {
    const box = $('#studioBody .prompter');
    if (!box) return;
    const mode = rd.heardAt < 0 && now > NO_SIGNAL ? 'silent'
      : rd.gotAt >= 0 && now - rd.gotAt < 0.8 ? 'got'
      : rd.voiceNow ? 'hearing'
      : rd.auto ? 'listening' : 'manual';
    if (box.dataset.state !== mode) {
      box.dataset.state = mode;
      box.querySelector('.prompter-status').textContent = t({
        silent: 'studioNoSignal', got: 'studioGotIt', hearing: 'studioHearing',
        listening: 'studioListening', manual: 'studioManual',
      }[mode]);
    }
    const bars = box.querySelectorAll('.rec-wave i');
    const recent = rd.levels.slice(-bars.length);
    const offset = bars.length - recent.length;
    const floor = rd.hist.length ? roomFloor(rd) : -60;
    bars.forEach((bar, i) => {
      const above = i < offset ? 0 : Math.max(0, Math.min(1, (recent[i - offset] - floor) / 40));
      bar.style.height = (12 + above * 88) + '%';
    });
  }

  /* Finish, or the last line done: the line on screen keeps what was said. */
  function finishReading(rd) {
    if (rd.done) return;
    if (rd.index < rd.queue.length) closeWindow(rd, takeTime(rd));
    rd.done = true;
    cancelAnimationFrame(rd.raf);
    rd.session.mode = 'cutting';
    if (studio === rd.session) renderStudio();
    try {
      if (rd.mic.media.state !== 'inactive') rd.mic.media.stop();     // its 'stop' event cuts the take
      else cutReading(rd);
    } catch (err) {
      cutReading(rd);
    }
  }

  /* The take, cut into its lines: each saved by the shell as a WAV of its
     own, the recording it replaces deleted. A line in whose stretch nothing
     was heard stays as it was. */
  async function cutReading(rd) {
    if (rd.cut) return;
    rd.cut = true;
    stopTracks(rd.mic.stream);
    const windows = rd.queue
      .filter((id) => rd.windows.has(id) && rd.windows.get(id).end !== null)
      .map((id) => Object.assign({ id: id }, rd.windows.get(id)));
    let saved = 0;
    let failed = false;
    if (windows.length) {
      try {
        const blob = new Blob(rd.chunks, { type: rd.mic.mime });
        const audio = await rd.mic.ctx.decodeAudioData(await blob.arrayBuffer());
        for (const cut of planCuts(audio, windows)) {
          const line = botLines().find((l) => l.id === cut.id);
          if (!line) continue;
          const take = await renderPhrase(audio, cut);
          const id = noteId();
          const base64 = await blobBase64(new Blob([take.bytes], { type: 'audio/wav' }));
          let stored = false;
          try {
            stored = !!shell.saveVoiceNote(id, base64);
          } catch (err) {
            stored = false;
          }
          if (!stored) {
            failed = true;
            continue;
          }
          const old = line.clip;
          line.clip = { id: id, ext: 'wav', d: take.d, w: take.w, said: line.text };
          if (old) deleteNoteFile(old.id);
          saved++;
        }
      } catch (err) {
        failed = true;
      }
    }
    rd.mic.ctx.close().catch(() => {});
    if (saved) save();
    const session = rd.session;
    session.reading = null;
    session.mode = 'script';
    session.note = !saved ? ''
      : saved === rd.queue.length ? t('studioSaved', saved)
      : t('studioSavedSome', { saved: saved, of: rd.queue.length });
    session.error = failed ? 'failed' : saved ? null : 'none';
    if (studio === session) {
      renderStudio();
    } else {
      // Closed while its lines were being cut: say how it went, then finish closing.
      if (saved) toast(session.note);
      afterStudio(session);
    }
  }

  /* Where each line's voice really is. The take is measured in 10 ms frames
     against its own quiet level; within the stretch each line was on screen
     (with a little slack for the screen's lag), the voice runs from its
     first sound to its last, clicks under 60 ms ignored. Each is trimmed with
     a short margin and given a gain that brings it to one common level. */
  function planCuts(audio, windows) {
    const data = audio.getChannelData(0);
    const rate = audio.sampleRate;
    const hop = Math.max(1, Math.round(rate / 100));
    const frames = Math.floor(data.length / hop);
    const db = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      let sum = 0;
      for (let i = f * hop; i < (f + 1) * hop; i++) sum += data[i] * data[i];
      db[f] = 10 * Math.log10(sum / hop + 1e-12);
    }
    const sorted = Array.from(db).sort((a, b) => a - b);
    const floor = sorted.length ? sorted[Math.floor(sorted.length * 0.1)] : -80;
    const voice = Math.min(Math.max(floor + 10, -62), -30);
    return windows.map((w) => {
      // A run of voice belongs to this line if it starts while the line is on
      // screen: one already under way when it appeared is the previous line's
      // tail, one starting after the page turned is the next line's start. A
      // word still being said at the turn may run on a little.
      const lo = Math.max(0, w.start - 0.1);
      const startF = Math.floor(lo * 100);
      const endF = Math.min(frames, Math.ceil(w.end * 100));
      const tailF = Math.min(frames, Math.ceil((w.end + 0.4) * 100));
      const hi = tailF / 100;
      let first = -1;
      let last = -1;
      let energy = 0;
      let count = 0;
      let f = startF;
      // (The first line has no previous one: a voice there from the start is its own.)
      if (w.start > 0.05) while (f < endF && db[f] > voice) f++;
      while (f < tailF) {
        if (db[f] <= voice) {
          f++;
          continue;
        }
        if (f >= endF && !(last >= 0 && f - last <= 15)) break;
        const run = f;
        while (f < tailF && db[f] > voice) f++;
        if (f - run < 6 && !(last >= 0 && run - last <= 15)) continue;     // a click, not a word
        if (first < 0) first = run;
        last = f - 1;
        for (let g = run; g < f; g++) {
          energy += Math.pow(10, db[g] / 10);
          count++;
        }
      }
      if (first < 0) return null;
      const from = Math.max(lo, first / 100 - 0.12);
      const to = Math.min(hi, (last + 1) / 100 + 0.2, from + 30);
      let peak = 0;
      for (let s = Math.floor(from * rate); s < Math.min(data.length, Math.ceil(to * rate)); s++) {
        const value = Math.abs(data[s]);
        if (value > peak) peak = value;
      }
      const rms = count ? Math.sqrt(energy / count) : 0;
      // Speech at about -20 dBFS, never clipping, and never boosted past +18 dB.
      const gain = Math.min(rms ? 0.1 / rms : 1, peak ? 0.89 / peak : 1, 8);
      return { id: w.id, from: from, to: Math.max(to, from + 0.2), gain: gain };
    }).filter(Boolean);
  }

  /* One phrase, resampled for the WAV, levelled, with 15 ms fades so it
     never clicks. */
  async function renderPhrase(audio, cut) {
    const length = cut.to - cut.from;
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(length * BOT_RATE)), BOT_RATE);
    const source = offline.createBufferSource();
    source.buffer = audio;
    const gain = offline.createGain();
    const fade = Math.min(0.015, length / 4);
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(cut.gain, fade);
    gain.gain.setValueAtTime(cut.gain, length - fade);
    gain.gain.linearRampToValueAtTime(0, length);
    source.connect(gain).connect(offline.destination);
    source.start(0, cut.from, length);
    const out = await offline.startRendering();
    const info = describeRecording(out);
    return { bytes: wavBytes(out), d: info.d, w: info.w };
  }

  /* 16-bit mono PCM WAV: what every player on the phone opens. */
  function wavBytes(buffer) {
    const data = buffer.getChannelData(0);
    const view = new DataView(new ArrayBuffer(44 + data.length * 2));
    const ascii = (at, text) => { for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i)); };
    ascii(0, 'RIFF');
    view.setUint32(4, 36 + data.length * 2, true);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);                       // PCM
    view.setUint16(22, 1, true);                       // mono
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    ascii(36, 'data');
    view.setUint32(40, data.length * 2, true);
    for (let i = 0; i < data.length; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Uint8Array(view.buffer);
  }

  /* ── Your bot in the habit editor and the picker ── */

  /* Which of your bot's lines this habit plays, while your bot sends the reminders. */
  function renderBotPicks() {
    const box = $('#botPicks');
    const show = !!draft && state.character === BOT_ID && canRecord();
    box.hidden = !show;
    if (!show) return;
    const list = $('#botPickList');
    list.innerHTML = '';
    const recorded = recordedBotLines();
    const own = editingId ? recorded.filter((line) => line.kind === 'habit' && line.habitId === editingId) : [];
    const generic = recorded.filter((line) => line.kind === 'generic');
    const chosen = new Set(draft.botPick || own.map((line) => line.id));
    own.concat(generic).forEach((line) => {
      const row = document.createElement('div');
      row.className = 'bot-pick';
      const label = document.createElement('label');
      const tick = document.createElement('input');
      tick.type = 'checkbox';
      tick.checked = chosen.has(line.id);
      tick.dataset.line = line.id;
      tick.addEventListener('change', () => {
        const set = new Set(draft.botPick || own.map((l) => l.id));
        if (tick.checked) set.add(line.id);
        else set.delete(line.id);
        draft.botPick = Array.from(set);
      });
      const words = document.createElement('span');
      words.textContent = line.text;
      label.append(tick, words);
      const play = button('icon-btn bot-pick-play', null, { 'aria-label': t('voicePlay'), title: t('voicePlay') });
      play.innerHTML = iconSvg('i-play', 16);
      play.addEventListener('click', () => playVoice(clipPath(line.clip), (fraction, ended) => {
        play.innerHTML = iconSvg(ended ? 'i-play' : 'i-pause', 16);
      }, line.clip.d));
      row.append(label, play);
      list.appendChild(row);
    });
    $('#botPickHint').textContent = draftNote() ? t('botLinesOwnFirst')
      : !editingId ? t('botLinesNew')
      : own.length ? t('botLinesHint') : t('botLinesNone');
    $('#btnBotStudio').hidden = !editingId;
  }

  /* Your bot's card in the picker: built in the studio, then picked like anyone else. */
  function botCard() {
    const recorded = recordedBotLines().length;
    const intro = recordedBotLines('intro')[0];
    const card = castCard({
      id: BOT_ID,
      name: botCastLines().name,
      desc: recorded ? t('castMineCount', recorded) : t('castMineDesc'),
      accent: BOT_ACCENT,
      avatar: GLOW_CAST.avatarPath(BOT_ID),
      sample: intro ? clipPath(intro.clip) : null,
    });
    card.classList.add('cast-card-bot');
    const row = document.createElement('div');
    row.className = 'cast-row';
    row.append(...Array.from(card.childNodes));
    const open = button('btn btn-sm cast-studio', t(recorded ? 'castMineEdit' : 'castMineCreate'));
    open.addEventListener('click', () => openStudio({ pick: !recorded }));
    card.append(row, open);
    return card;
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
    if (canRecord()) list.appendChild(botCard());
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
    // Your own bot has nothing to say until it has a line: build it first.
    if (id === BOT_ID && !botReady()) {
      openStudio({ pick: true });
      return;
    }
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
    // The switch covers every voice note: a character's, and your own.
    const voices = !!cast || state.habits.some(hasOwnNote);
    $('#voiceAutoplayRow').hidden = !voices;
    $('#voiceAutoplayHint').hidden = !voices;
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
      activeHabits().length === 0 || !$('#picoPromo').hidden;   // one invitation at a time
  }

  /* Sends one message now, with whichever habit is still open today. Each
     press says the next of that habit's lines, so trying it twice shows the
     variety rather than the same sentence again. */
  let testTurn = 0;
  function sendTestReminder() {
    if (!shell || !shell.testReminder) return;
    const today = todayKey();
    const habit = habitsFor(today).find((h) => !isComplete(h, today)) || activeHabits()[0] || null;
    const id = state.character;
    const lines = id && habit ? reminderMessages(habit, id) : [];
    const payload = {
      id: habit ? habit.id : '',
      name: habit ? habitName(habit) : t('appName'),
      emoji: habit ? habit.emoji || '✅' : '✅',
      msg: id ? (lines.length ? lines[testTurn++ % lines.length] : introMessage(id)) : null,
      // A habit with your own note sends that, the way its reminders will.
      own: hasOwnNote(habit) ? notePath(habit.voiceNote.id) : null,
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
    if (tour.open) {
      endTour(false);
      return 'handled';
    }
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
    if (tour.open) endTour(false);
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
    let entered = false;
    VIEWS.forEach((id) => {
      const section = $('#view-' + id);
      const showing = !section.hidden;
      section.hidden = id !== name;
      if (id === name && !showing) entered = true;
      if (id === name && !showing && !reducedMotion.matches) {
        section.classList.remove('view-enter');
        void section.offsetWidth;
        section.classList.add('view-enter');
      }
    });
    $$('#tabBar .tab').forEach((tab) => {
      if (tab.dataset.view === name) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    updateViewTitle();
    if (name === 'today') renderToday();
    if (name === 'habits') renderHabitsView();
    if (name === 'progress') renderProgress();
    if (name === 'progress' && entered) setTimeout(picoAtCharts, 900);
    if (name === 'settings') {
      updateStorageInfo();
      renderBackupInfo();
      renderBodySettings();
    }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function renderAll() {
    renderToday();
    renderHabitsView();
    if (view === 'progress') renderProgress();
  }

  /* ── Backups and tables ───────────────────────────────────────────────
     Two ways out, named for what they are rather than their format: a
     backup, the whole app in one file to bring back here or on another
     phone, and a table of the days for a spreadsheet. A WebView cannot
     download, so inside the Android app both go through Android's own "save
     as" (NativeShell.saveFile, which answers through __glow.fileSaved); in a
     browser they download. Through 2.13 the APK's export did nothing. */
  let fileSaved = null;

  function offerFile(name, mime, text, done) {
    if (shell && shell.saveFile) {
      fileSaved = done;
      let started = false;
      try { started = !!shell.saveFile(name, mime, text); } catch (err) { started = false; }
      if (!started) {
        fileSaved = null;
        done('failed');
      }
      return;
    }
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    done('saved');
  }

  const longDate = (date) => date.toLocaleDateString(I18N.locale(), { day: 'numeric', month: 'long', year: 'numeric' });

  function saveBackup() {
    const copy = Object.assign({ backup: { app: 'GlowApp', at: new Date().toISOString() } }, state);
    offerFile('GlowApp-' + t('backupWord') + '-' + todayKey() + '.json', 'application/json',
      JSON.stringify(copy, null, 2), (status) => {
        if (status === 'saved') {
          state.lastBackup = todayKey();
          save();
          renderBackupInfo();
          toast(t('backupSaved'));
        } else if (status === 'failed') {
          toast(t('fileFailed'));
        }
      });
  }

  function renderBackupInfo() {
    $('#backupInfo').textContent = state.lastBackup
      ? t('backupLast', longDate(parseKey(state.lastBackup))) : t('backupNever');
    $('#backupVoices').hidden = !shell;
  }

  /* Reads a backup, says what is in it, and replaces nothing until the user
     agrees. */
  function readBackup(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      let copy = null;
      try { copy = JSON.parse(String(reader.result)); } catch (err) { copy = null; }
      if (!copy || typeof copy !== 'object' || !Array.isArray(copy.habits)) {
        toast(t('restoreBad'));
        return;
      }
      const made = copy.backup && copy.backup.at ? new Date(copy.backup.at)
        : file.lastModified ? new Date(file.lastModified) : null;
      const days = new Set(Object.keys(copy.moods || {}));
      Object.values(copy.entries || {}).forEach((byDay) => Object.keys(byDay || {}).forEach((key) => days.add(key)));
      const agreed = await confirmDialog(t('restoreTitle'), t('restoreBody', {
        date: made && !isNaN(made) ? longDate(made) : '—',
        habits: copy.habits.filter((h) => h && !h.archived).length,
        days: days.size,
      }), t('restoreOk'));
      if (!agreed) return;
      delete copy.backup;
      state = Object.assign(defaultState(), copy);
      state.entries = state.entries && typeof state.entries === 'object' ? state.entries : {};
      state.moods = state.moods && typeof state.moods === 'object' ? state.moods : {};
      state.habits = state.habits.filter((h) => h && typeof h === 'object');
      normalizeState();
      reconcileVoiceNotes();
      save();
      applyTheme();
      applyLang();
      renderBackupInfo();
      toast(t('restoreDone'));
    };
    reader.onerror = () => toast(t('restoreBad'));
    reader.readAsText(file);
  }

  /* One row a day, one column a habit, then mood, energy, note, weight and
     BMI: what a spreadsheet wants. Spanish spreadsheets expect semicolons and
     a decimal comma, English ones commas and a point; the byte-order mark
     tells Excel the text is UTF-8. Archived habits keep their columns: their
     history is still history. */
  function buildTable() {
    const es = I18N.getLang() === 'es';
    const sep = es ? ';' : ',';
    const num = (value, digits) => (digits === undefined ? String(value) : value.toFixed(digits)).replace('.', es ? ',' : '.');
    const cell = (value) => {
      const text = value === null || value === undefined ? '' : String(value);
      // Quoted only when it must be: Excel reads a quoted "72,4" as text.
      return /["\r\n]/.test(text) || text.includes(sep) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    const habits = state.habits.slice();
    const today = todayKey();
    const known = new Set(Object.keys(state.moods).concat(Object.keys(state.body.weights)));
    Object.keys(state.entries).forEach((id) => Object.keys(state.entries[id] || {}).forEach((key) => known.add(key)));
    habits.forEach((h) => { if (h.createdAt) known.add(h.createdAt); });
    const first = [...known].filter((key) => key <= today).sort()[0] || today;
    const head = [t('csvDate')]
      .concat(habits.map((h) => habitName(h) + (h.type === 'quantity' && h.unit ? ' (' + h.unit + ')' : '')))
      .concat([t('csvMood'), t('csvEnergy'), t('csvNote'), t('csvWeight', weightUnit()), t('csvBmi')]);
    const rows = [head];
    for (let day = parseKey(first); keyOf(day) <= today; day = addDays(day, 1)) {
      const key = keyOf(day);
      const mood = state.moods[key];
      const kg = state.body.weights[key];
      const bmi = kg ? bmiOf(kg) : null;
      rows.push([key]
        .concat(habits.map((h) => {
          if (!isScheduled(h, key)) return '';
          const value = valueOf(h, key);
          return h.type === 'quantity' ? num(value) : value >= 1 ? t('csvYes') : t('csvNo');
        }))
        .concat([mood && mood.score ? mood.score : '', mood && mood.score && mood.energy ? mood.energy : '',
          mood && mood.note ? mood.note : '', kg ? num(shownWeight(kg), 1) : '', bmi ? num(bmi, 1) : '']));
    }
    return '\uFEFF' + rows.map((row) => row.map(cell).join(sep)).join('\r\n') + '\r\n';
  }

  function saveTable() {
    offerFile('GlowApp-' + t('tableWord') + '-' + todayKey() + '.csv', 'text/csv', buildTable(), (status) => {
      if (status === 'saved') toast(t('tableSaved'));
      else if (status === 'failed') toast(t('fileFailed'));
    });
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
    /* Weight and BMI */
    $('#btnLogWeight').addEventListener('click', openWeightDialog);
    $('#weightForm').addEventListener('submit', (evt) => {
      evt.preventDefault();
      saveWeighIn();
    });
    $$('#weightDialog [data-close]').forEach((btn) => {
      btn.addEventListener('click', () => $('#weightDialog').close());
    });
    $('#btnDeleteWeight').addEventListener('click', deleteWeighIn);
    $('#fWeight').addEventListener('input', renderWeightPreview);
    $('#fWeightDate').addEventListener('change', () => {
      const date = $('#fWeightDate').value;
      $('#btnDeleteWeight').hidden = !state.body.weights[date];
      if (state.body.weights[date]) $('#fWeight').value = inputNumber(shownWeight(state.body.weights[date]));
      renderWeightPreview();
    });
    $('#bodyUnit').addEventListener('change', (evt) => {
      state.body.unit = evt.target.value === 'lb' ? 'lb' : 'kg';
      save();
      renderBodySettings();
      renderBody();
      renderProgressIfVisible();
    });
    $('#bodyGoal').addEventListener('change', (evt) => {
      const value = parseFloat(String(evt.target.value).replace(',', '.'));
      const kg = isFinite(value) ? (inLb() ? value * KG_PER_LB : value) : null;
      state.body.goal = kg && kg >= WEIGHT_MIN && kg <= WEIGHT_MAX ? Math.round(kg * 100) / 100 : null;
      save();
      renderBodySettings();
      renderBody();
      renderProgressIfVisible();
    });
    $('#bodyShow').addEventListener('change', (evt) => {
      state.body.show = evt.target.checked;
      save();
      renderBody();
    });

    $('#habitForm').addEventListener('submit', (evt) => {
      evt.preventDefault();
      saveHabit();
    });
    $$('#habitDialog [data-close]').forEach((btn) => {
      btn.addEventListener('click', () => $('#habitDialog').close());
    });
    // Your own bot's studio (2.11), over the picker or the habit editor.
    $('#studioBack').addEventListener('click', () => $('#studio').close());
    $('#studio').addEventListener('close', onStudioClosed);
    $('#btnBotStudio').addEventListener('click', () => openStudio({ habitId: editingId }));
    $('#habitForm').addEventListener('focusin', (evt) => sheetPicoLook(evt.target));
    // The browser stops an empty name before saveHabit sees it; Pico still notices.
    $('#habitForm').addEventListener('invalid', () => sheetPicoPose('think'), true);
    $('#sheetPico').addEventListener('click', () => Pico.react($('#sheetPico')));
    // However the editor closes, the microphone is released and an unsaved
    // recording is let go.
    $('#habitDialog').addEventListener('close', () => {
      clearTimeout(sheetPicoTimer);
      Pico.unmount($('#sheetPico'));
      stopRecording(true);
      stopVoice();
      if (draft && draft.newNote) URL.revokeObjectURL(draft.newNote.url);
      if (draft) draft.newNote = null;
      $('#btnSaveHabit').disabled = false;
    });
    $('#btnDeleteHabit').addEventListener('click', async () => {
      const ok = await confirmDialog(t('deleteHabitTitle'), t('deleteHabitBody'));
      if (!ok) return;
      const gone = habitById(editingId);
      if (hasOwnNote(gone)) deleteNoteFile(gone.voiceNote.id);
      dropBotLinesOf(editingId);
      state.habits = state.habits.filter((h) => h.id !== editingId);
      delete state.entries[editingId];
      save();
      $('#habitDialog').close();
      renderHabitsView();
      renderToday();
      renderProgressIfVisible();
      renderCastSettings();
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
      withFade(() => {
        applyTheme();
        renderProgressIfVisible();
      });
    });
    $('#themeToggle').addEventListener('click', () => {
      if (paletteIsDarkOnly()) {
        // Ultra oscura has no light side, so asking for light leaves it for classic.
        state.palette = 'classic';
        state.theme = 'light';
        toast(t('paletteBackToLight'));
      } else {
        state.theme = resolvedTheme() === 'dark' ? 'light' : 'dark';
      }
      save();
      withFade(() => {
        applyTheme();
        renderProgressIfVisible();
      });
    });
    buildPalettePicker();
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

    // Any setting changed, now and then, gets a nod from Pico (2.16). The
    // import picker is left out: it opens a file, it does not set anything.
    $('#view-settings').addEventListener('change', (evt) => {
      if (evt.target.id !== 'importFile') picoNoticeSetting(evt.target);
    });

    $('#btnRetakeTest').addEventListener('click', () => startOnboarding());

    /* Pico's tour */
    $('#btnReplayTour').addEventListener('click', startTour);
    $('#btnTourGo').addEventListener('click', startTour);
    $('#btnTourLater').addEventListener('click', () => {
      state.tourPromoDismissed = true;
      save();
      renderTourPromo();
      renderCastPromo();
    });
    $('#tourNext').addEventListener('click', tourNext);
    $('#tourBack').addEventListener('click', tourBack);
    $('#tourSkip').addEventListener('click', () => endTour(false));
    // Nothing behind the overlay may scroll away from the spotlight.
    $('#tour').addEventListener('wheel', (evt) => evt.preventDefault(), { passive: false });
    document.addEventListener('keydown', (evt) => {
      if (!tour.open) return;
      if (evt.key === 'Escape') { evt.preventDefault(); endTour(false); }
      else if (evt.key === 'ArrowRight') { evt.preventDefault(); tourNext(); }
      else if (evt.key === 'ArrowLeft') { evt.preventDefault(); tourBack(); }
    });
    window.addEventListener('resize', () => {
      if (!tour.open) return;
      cancelAnimationFrame(tour.frame);
      tour.frame = requestAnimationFrame(placeTour);
    });
    $('#picoCheer').addEventListener('click', hidePicoCheer);
    // Swipe the coach: right to left for the next stop, left to right to go back.
    let swipe = null;
    $('#tourCoach').addEventListener('pointerdown', (evt) => {
      swipe = evt.isPrimary ? { x: evt.clientX, y: evt.clientY, at: evt.timeStamp } : null;
    });
    $('#tourCoach').addEventListener('pointerup', (evt) => {
      if (!swipe || !tour.open) return;
      const dx = evt.clientX - swipe.x;
      const dy = evt.clientY - swipe.y;
      const quick = evt.timeStamp - swipe.at < 700;
      swipe = null;
      if (!quick || Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) tourNext();
      else tourBack();
    });
    ['#tourPico', '#picoPromoArt'].forEach((sel) => {
      $(sel).addEventListener('click', (evt) => {
        evt.stopPropagation();
        Pico.react($(sel));
        Sounds.play('tick');
      });
    });

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
    $('#btnBackup').addEventListener('click', saveBackup);
    $('#btnRestore').addEventListener('click', () => $('#importFile').click());
    $('#btnTable').addEventListener('click', saveTable);
    $('#importFile').addEventListener('change', (evt) => {
      const file = evt.target.files && evt.target.files[0];
      if (file) readBackup(file);
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
    { id: 'brushTeeth', key: 'hbBrushTeeth', desc: 'dsBrushTeeth', emoji: '🦷', color: 1, area: 'health', cat: 'health', type: 'quantity', target: 2, unit: 'unitTimes', cost: 4 },
    { id: 'floss', key: 'hbFloss', desc: 'dsFloss', emoji: '🧵', color: 3, area: 'health', cat: 'health', type: 'binary', cost: 2, moment: 'evening' },
    { id: 'sunlight', key: 'hbSunlight', desc: 'dsSunlight', emoji: '☀️', color: 4, area: 'health', cat: 'health', type: 'binary', cost: 10, moment: 'morning' },
    { id: 'sleepEarly', key: 'hbSleepEarly', desc: 'dsSleepEarly', emoji: '😴', color: 7, area: 'sleep', cat: 'health', type: 'binary', cost: 0, moment: 'evening' },
    { id: 'noPhoneBed', key: 'hbNoPhoneBed', desc: 'dsNoPhoneBed', emoji: '📵', color: 8, area: 'sleep', cat: 'mental', type: 'binary', cost: 0, moment: 'evening' },
    /* A personal challenge, never put to someone who did not go looking for
       it: the test does not suggest it; the presets and the editor's ideas
       offer it. Discreet: a character's reminder never names it (see
       reminderMessages), since it shows on the lock screen. */
    { id: 'noFap', key: 'hbNoFap', desc: 'dsNoFap', emoji: '🛡️', color: 8, area: 'mental', cat: 'mental', type: 'binary', cost: 0, suggest: false, discreet: true },
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
      .filter((entry) => !already.includes(entry.id) && entry.suggest !== false)
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

    // The tour is about to start: its invitation would only flash on Today.
    tour.pending = !state.tourDone;
    renderAll();
    if (habits.length) {
      Sounds.play('complete');
      toast(t('obAddedFmt', habits.length));
      setView('today');
    } else {
      toast(t('obNothingPicked'));
    }
    // Someone new gets Pico's tour once the test has made way.
    if (tour.pending) {
      setTimeout(() => {
        tour.pending = false;
        if ($('#onboarding').hidden && !$$('dialog[open]').length) startTour();
        else renderTourPromo();
      }, 900);
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

  /* In the Android app the WebView keeps its own scroll bar off while the
     launch screen shows (it used to flash across it); this turns it back on. */
  let splashGoneSent = false;
  function splashGone() {
    if (splashGoneSent) return;
    splashGoneSent = true;
    if (shell && shell.splashDone) {
      try { shell.splashDone(); } catch (err) { /* an older shell */ }
    }
  }

  function runSplash() {
    const splash = $('#splash');
    setBackgroundInert(true);          // the splash covers the app too
    if (!splash) {
      document.documentElement.classList.remove('is-splashing');
      if (needsOnboarding()) startOnboarding();
      else setBackgroundInert(false);
      splashGone();
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
      const remove = () => {
        splash.remove();
        splashGone();
      };
      splash.addEventListener('transitionend', remove, { once: true });
      // Belt and braces: a missed transitionend must not leave it on screen.
      setTimeout(remove, 600);
    };

    splash.addEventListener('click', dismiss);
    setTimeout(dismiss, SPLASH_HOLD);
  }

  /* ── Pico's tour (2.13) ────────────────────────────────────────────────
     One stop at a time: the screen dims around what is being explained and
     Pico, the app's crow, says what it is for. It runs once right after the
     starting test, waits on Today as an invitation for anyone who had the
     app before, and can be replayed from Ajustes. A stop whose target is
     missing (nothing due today, Android-only settings in the browser) adapts
     its words or stands in the middle, so the tour never points at nothing. */
  const tour = { open: false, pending: false, steps: [], at: 0, frame: 0 };

  function tourSteps() {
    const steps = [
      { id: 'hello', view: 'today', pose: 'wave' },
      { id: 'days', view: 'today', target: '#dayStrip', pose: 'point' },
      { id: 'ring', view: 'today', target: '.summary-card', pose: 'happy' },
      { id: 'habits', view: 'today', pose: 'point',
        target: () => $('#habitList .habit-row') || $('#todayEmpty'),
        body: (node) => (node && node.classList.contains('habit-row') ? 'tourHabitsBody' : 'tourHabitsEmptyBody') },
      { id: 'mood', view: 'today', target: '.mood-card', pose: 'think' },
      { id: 'manage', view: 'habits', target: '#tabBar .tab[data-view="habits"]', pose: 'point' },
      { id: 'progress', view: 'progress', target: '#tabBar .tab[data-view="progress"]', pose: 'point' },
      { id: 'palette', view: 'settings', target: '#paletteField', pose: 'happy' },
    ];
    if (shell) steps.push({ id: 'cast', view: 'settings', target: '#castSettings', pose: 'talk' });
    steps.push({ id: 'bye', view: 'today', pose: 'cheer' });
    return steps;
  }

  function tourTarget(step) {
    if (!step || !step.target) return null;
    const node = typeof step.target === 'function' ? step.target() : $(step.target);
    return node && node.getClientRects().length ? node : null;   // hidden things have no boxes
  }

  function startTour() {
    if (tour.open) return;
    if (isChatOpen()) closeChat();
    $$('dialog[open]').forEach((dlg) => dlg.close());
    tour.steps = tourSteps();
    tour.open = true;
    Pico.mount($('#tourPico'), 'wave');
    $('#tour').hidden = false;
    setBackgroundInert(true);
    renderTourPromo();
    showTourStep(0);
  }

  function showTourStep(index) {
    const step = tour.steps[index];
    if (!step) return;
    tour.at = index;
    if (step.view !== view) setView(step.view);
    const key = 'tour' + step.id.charAt(0).toUpperCase() + step.id.slice(1);
    const last = index === tour.steps.length - 1;
    $('#tourStep').textContent = t('tourStep', { at: index + 1, of: tour.steps.length });
    $('#tourTitle').textContent = t(key + 'Title');
    const speech = revealWords($('#tourBody'), t(step.body ? step.body(tourTarget(step)) : key + 'Body'));
    $('#tourBack').hidden = index === 0;
    $('#tourSkip').hidden = last;
    $('#tourNext').textContent = t(index === 0 ? 'tourStart' : last ? 'tourDone' : 'tourNext');
    const dots = $('#tourDots');
    dots.innerHTML = '';
    tour.steps.forEach((s, i) => {
      const dot = document.createElement('i');
      if (i === index) dot.className = 'is-on';
      dots.appendChild(dot);
    });
    Pico.pose($('#tourPico'), step.pose);
    Pico.say($('#tourPico'), speech);
    const coach = $('#tourCoach');
    coach.classList.remove('is-entering');
    void coach.offsetWidth;            // restart the entrance for each stop
    coach.classList.add('is-entering');
    placeTour();
    $('#tourNext').focus({ preventScroll: true });
  }

  /* Frames the stop's target and puts the coach below it when it fits, else
     above, else over the far end of the screen; then Pico looks, and points
     if the pose says so, at the middle of the target. */
  function placeTour() {
    if (!tour.open) return;
    const node = tourTarget(tour.steps[tour.at]);
    const overlay = $('#tour');
    const spot = $('#tourSpot');
    const coach = $('#tourCoach');
    const picoHost = $('#tourPico');
    overlay.dataset.mode = node ? 'target' : 'center';
    if (!node) {
      spot.removeAttribute('style');
      coach.style.top = '';
      Pico.look(picoHost, 0, 0);
      return;
    }
    const inBar = !!node.closest('#tabBar');          // fixed; never scrolled
    if (!inBar) node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const ceiling = inBar ? 4 : $('.app-bar').getBoundingClientRect().bottom + 4;   // the sticky bar covers the top
    const pad = 6;
    const frame = () => {
      const r = node.getBoundingClientRect();
      return {
        left: Math.max(4, r.left - pad), top: Math.max(ceiling, r.top - pad),
        right: Math.min(vw - 4, r.right + pad), bottom: Math.min(vh - 4, r.bottom + pad),
      };
    };
    let box = frame();

    const height = coach.offsetHeight;
    const rise = Math.max(0, -picoHost.offsetTop);   // how far Pico stands above the coach
    const gap = 14;
    const margin = 12;
    const below = height + gap + rise + margin;       // room the coach needs under the target
    let top;
    if (box.bottom + below <= vh) top = box.bottom + gap + rise;
    else if (box.top - gap - height - rise - margin >= 0) top = box.top - gap - height;
    else {
      /* No room either side, which happens on a small screen or with a tall
         target: lift the target to just under the app bar, frame as much of
         it as fits, and put the coach underneath. */
      if (!inBar) {
        window.scrollBy({ top: box.top - ceiling - 4, behavior: 'instant' });
        box = frame();
      }
      const floor = vh - below;
      if (floor - box.top >= 64) {
        box.bottom = Math.min(box.bottom, floor);
        top = box.bottom + gap + rise;
      } else {
        top = margin + rise;
        box.top = Math.max(box.top, top + height + gap);
      }
    }
    spot.style.left = box.left + 'px';
    spot.style.top = box.top + 'px';
    spot.style.width = (box.right - box.left) + 'px';
    spot.style.height = Math.max(0, box.bottom - box.top) + 'px';
    coach.style.top = Math.round(top) + 'px';

    // Pico looks, and points, at the middle of what is framed.
    const pr = picoHost.getBoundingClientRect();
    const px = pr.left + pr.width / 2;
    const py = top + picoHost.offsetTop + pr.height / 2;
    const dx = (box.left + box.right) / 2 - px;
    const dy = (box.top + box.bottom) / 2 - py;
    const length = Math.hypot(dx, dy) || 1;
    Pico.look(picoHost, dx / length, dy / length);
    Pico.point(picoHost, (Math.atan2(dy, dx) * 180) / Math.PI);
  }

  /* Puts text into node a word at a time (each word fades in after the one
     before) and returns, in milliseconds, how long that takes: how long Pico
     talks. Under reduced motion the words are simply there. */
  function revealWords(node, text) {
    node.textContent = '';
    if (reducedMotion.matches) {
      node.textContent = text;
      return 0;
    }
    let count = 0;
    text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        node.appendChild(document.createTextNode(part));
        return;
      }
      const word = document.createElement('span');
      word.className = 'tw';
      word.style.animationDelay = Math.min(count * 34, 2200) + 'ms';
      word.textContent = part;
      node.appendChild(word);
      count++;
    });
    return Math.min(count * 34, 2200) + 260;
  }

  function tourNext() {
    if (!tour.open) return;
    if (tour.at >= tour.steps.length - 1) endTour(true);
    else showTourStep(tour.at + 1);
  }

  function tourBack() {
    if (tour.open && tour.at > 0) showTourStep(tour.at - 1);
  }

  /* Finished, skipped or backed out of, it counts as taken: Ajustes has it
     for whoever wants it again. */
  function endTour(finished) {
    if (!tour.open) return;
    tour.open = false;
    cancelAnimationFrame(tour.frame);
    $('#tour').hidden = true;
    Pico.unmount($('#tourPico'));
    setBackgroundInert(false);
    state.tourDone = true;
    save();
    setView('today');
    if (finished) Sounds.play('complete');
  }

  function renderTourPromo() {
    const show = !tour.open && !tour.pending && !state.tourDone && !state.tourPromoDismissed &&
      !!(state.onboarding && state.onboarding.done);
    const art = $('#picoPromoArt');
    if (show && !art.firstChild) Pico.mount(art, 'wave');
    $('#picoPromo').hidden = !show;
  }

  /* Pico hops up when the day completes, in place of the plain toast. */
  let cheerTimer = null;
  function picoCheer() {
    const box = $('#picoCheer');
    const lines = t('picoCheers');
    Pico.mount($('#picoCheerArt'), 'cheer');
    $('#picoCheerText').textContent = Array.isArray(lines) && lines.length
      ? lines[Math.floor(Math.random() * lines.length)] : t('allDoneTitle');
    box.classList.remove('is-leaving');
    box.hidden = false;
    clearTimeout(cheerTimer);
    cheerTimer = setTimeout(hidePicoCheer, 3200);
  }

  function hidePicoCheer() {
    const box = $('#picoCheer');
    if (box.hidden) return;
    clearTimeout(cheerTimer);
    box.classList.add('is-leaving');
    cheerTimer = setTimeout(() => {
      box.hidden = true;
      box.classList.remove('is-leaving');
    }, 240);
  }

  /* ── Boot ──────────────────────────────────────────────────────────── */
  function init() {
    load();
    const migrated = normalizeState();
    wire();
    const linked = linkCatalogueKeys();
    const reconciled = reconcileVoiceNotes();
    if (linked || migrated || reconciled) save();
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
