/* GlowEmoji — the habit editor's emoji picker (2.20).

   Every standard emoji the phone can draw, in Unicode's groups, with a
   search in Spanish and English and the five skin tones; and GlowApp's own,
   drawn in the app's style. Until 2.20 the editor offered 32 fixed emojis.

   The standard ones are text, drawn by the phone's own emoji font — nothing
   is loaded as an image. Their list (emoji-data.js, generated from Unicode
   and CLDR by tools/emoji/make-emoji-data.js) is fetched the first time the
   picker opens; until then the suggestions and GlowApp's own work without
   it. On opening, a few emojis of each Unicode version are drawn on a canvas
   to find which versions this phone draws: the newer ones it would show as
   empty boxes are left out.

   GlowApp's own are saved as "glow:<id>" and drawn from the page's SVG
   sprite, in the habit's colour (Pico in his own); wherever only text can go
   (a notification, the widget, a list) a similar standard emoji stands in.

   GlowEmoji.mount(host, { value, onPick, suggested, t, lang }) builds a picker in
   host and returns { set(value), relabel() }; GlowEmoji.draw(node, value)
   puts a value into a node; GlowEmoji.text(value) is its text; and
   GlowEmoji.isValid(value) tells a value worth keeping. */
(function (global) {
  'use strict';

  const doc = global.document;
  const SVG = 'http://www.w3.org/2000/svg';
  const PREFIX = 'glow:';

  // GlowApp's own: the sprite symbol each is drawn from, and its stand-in.
  const GLYPHS = [
    { id: 'pico', symbol: 'g-pico', text: '🐦' },
    { id: 'laurel', symbol: 'i-laurel', text: '🌿' },
    { id: 'spark', symbol: 'g-spark', text: '✨' },
    { id: 'flame', symbol: 'i-flame', text: '🔥' },
    { id: 'drop', symbol: 'g-drop', text: '💧' },
    { id: 'book', symbol: 'g-book', text: '📖' },
    { id: 'dumbbell', symbol: 'g-dumbbell', text: '🏋️' },
    { id: 'sprout', symbol: 'g-sprout', text: '🌱' },
    { id: 'moon', symbol: 'g-moon', text: '🌙' },
    { id: 'heart', symbol: 'g-heart', text: '❤️' },
    { id: 'lotus', symbol: 'g-lotus', text: '🌸' },
    { id: 'target', symbol: 'g-target', text: '🎯' },
    { id: 'sun', symbol: 'g-sun', text: '☀️' },
  ];
  const GROUPS = ['smileys', 'people', 'nature', 'food', 'travel', 'activities', 'objects', 'symbols', 'flags'];
  const TABS = ['suggested', 'glow'].concat(GROUPS);
  const TAB_ICON = { suggested: '⭐', smileys: '😀', people: '🧑', nature: '🐻', food: '🍎', travel: '✈️',
    activities: '⚽', objects: '💡', symbols: '🔣', flags: '🏁' };
  const TONE_MODIFIERS = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
  const RECENT_KEY = 'glow.emojiRecent';
  const TONE_KEY = 'glow.emojiTone';
  const RECENT_MAX = 16;
  const RESULTS_MAX = 180;

  const glyphOf = (value) => (typeof value === 'string' && value.indexOf(PREFIX) === 0
    ? GLYPHS.find((g) => PREFIX + g.id === value) || null : null);
  const text = (value, fallback) => {
    const g = glyphOf(value);
    return g ? g.text : value || fallback || '✅';
  };
  const isValid = (value) => typeof value === 'string' && value.length > 0 && value.length <= 32 &&
    (value.indexOf(PREFIX) !== 0 || !!glyphOf(value));

  function symbolSvg(id) {
    const svg = doc.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'glyph');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const use = doc.createElementNS(SVG, 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  // Puts a value into node: one of GlowApp's own as its drawing, any other as text.
  function draw(node, value, fallback) {
    const g = glyphOf(value);
    node.classList.toggle('is-glyph', !!g);
    node.textContent = '';
    if (g) node.appendChild(symbolSvg(g.symbol));
    else node.textContent = value || fallback || '✅';
  }

  const store = {
    get(key, otherwise) {
      try { const v = JSON.parse(global.localStorage.getItem(key)); return v === null ? otherwise : v; } catch (err) { return otherwise; }
    },
    set(key, value) {
      try { global.localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* private mode: not remembered */ }
    },
  };

  // Spanish and English searched alike: lower case, no accents.
  const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  /* ── The list of standard emojis ── */
  let data = null;
  let loading = null;

  function parse(raw) {
    const list = raw.rows.split('\n').map((row) => {
      const f = row.split('|');
      const tones = f[7] ? f[7].split(' ') : null;
      return {
        value: f[0], group: raw.groups[Number(f[1])], version: Number(f[2]),
        es: f[3], en: f[4], tones: tones,
        search: fold([f[3], f[4], f[5], f[6]].join(' ').replace(/,/g, ' ')),
      };
    });
    return { list: drawable(list) };
  }

  function load() {
    if (data) return Promise.resolve(data);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        if (global.GLOW_EMOJI_DATA) { resolve(global.GLOW_EMOJI_DATA); return; }
        const script = doc.createElement('script');
        script.src = 'emoji-data.js';
        script.async = true;
        script.onload = () => (global.GLOW_EMOJI_DATA ? resolve(global.GLOW_EMOJI_DATA) : reject(new Error('no emoji data')));
        script.onerror = () => reject(new Error('emoji data did not load'));
        doc.head.appendChild(script);
      }).then((raw) => (data = parse(raw)), (err) => { loading = null; throw err; });
    }
    return loading;
  }

  /* Which emojis this phone draws. A few of each Unicode version are drawn
     on a canvas: a drawn emoji has colour, an emoji the font lacks is an
     empty box (no colour), and a sequence it cannot join comes out as two
     or three emojis side by side (too wide). A version passes when most of
     its samples do; sequences are judged on their own, flags too. */
  function drawable(list) {
    let ctx = null;
    try {
      const canvas = doc.createElement('canvas');
      canvas.width = 48;
      canvas.height = 40;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    } catch (err) { ctx = null; }
    if (!ctx || !ctx.getImageData) return list;
    ctx.font = '28px sans-serif';
    ctx.textBaseline = 'top';
    const one = ctx.measureText('😀').width || 28;
    const draws = (value) => {
      ctx.clearRect(0, 0, 48, 40);
      ctx.fillText(value, 0, 4);
      const px = ctx.getImageData(0, 0, 48, 40).data;
      let colour = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 80) continue;
        if (Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]) > 40) colour++;
      }
      return colour > 12 && ctx.measureText(value).width < one * 1.6;
    };
    const kindOf = (e) => (e.group === 'flags' ? 'flag' : e.value.indexOf('\u200d') >= 0 ? 'zwj' : 'one');
    const samples = new Map();
    list.forEach((e) => {
      const key = e.version + '|' + kindOf(e);
      const s = samples.get(key) || [];
      if (s.length < 3) { s.push(e.value); samples.set(key, s); }
    });
    const ok = new Map();
    samples.forEach((values, key) => {
      const passed = values.filter(draws).length;
      ok.set(key, passed * 2 > values.length || (values.length === 1 && passed === 1));
    });
    return list.filter((e) => ok.get(e.version + '|' + kindOf(e)));
  }

  /* ── The picker ── */
  function mount(host, options) {
    const o = Object.assign({ value: '', onPick: () => {}, suggested: [], t: (k) => k, lang: () => 'es' }, options);
    let value = o.value;
    let tab = 'suggested';
    let touched = false;                             // a tab or a search chosen since set()
    let query = '';
    let tone = Number(store.get(TONE_KEY, 0)) || 0;
    if (tone < 0 || tone > 5) tone = 0;

    host.classList.add('ep');
    host.textContent = '';
    const top = doc.createElement('div');
    top.className = 'ep-top';
    const current = doc.createElement('span');
    current.className = 'ep-current';
    current.setAttribute('aria-hidden', 'true');
    const search = doc.createElement('input');
    search.type = 'search';
    search.className = 'ep-search';
    search.autocomplete = 'off';
    search.spellcheck = false;
    const toneBtn = doc.createElement('button');
    toneBtn.type = 'button';
    toneBtn.className = 'ep-tone';
    toneBtn.setAttribute('aria-expanded', 'false');
    top.append(current, search, toneBtn);

    const tones = doc.createElement('div');
    tones.className = 'ep-tones';
    tones.hidden = true;
    tones.setAttribute('role', 'radiogroup');

    const tabs = doc.createElement('div');
    tabs.className = 'ep-tabs';
    tabs.setAttribute('role', 'tablist');
    const tabButtons = TABS.map((id) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'ep-tab';
      b.dataset.tab = id;
      b.setAttribute('role', 'tab');
      if (id === 'glow') b.appendChild(symbolSvg('i-laurel'));
      else b.textContent = TAB_ICON[id];
      b.addEventListener('click', () => {
        tab = id;
        touched = true;
        query = '';
        search.value = '';
        render(true);
      });
      tabs.appendChild(b);
      return b;
    });

    const grid = doc.createElement('div');
    grid.className = 'ep-grid';
    grid.setAttribute('role', 'radiogroup');
    const note = doc.createElement('p');
    note.className = 'ep-note';
    note.hidden = true;
    host.append(top, tones, tabs, grid, note);

    const toned = (e) => (tone && e.tones ? e.tones[tone - 1] : e.value);
    const nameOf = (e) => (o.lang() === 'en' ? e.en : e.es) || e.en;
    const recents = () => store.get(RECENT_KEY, []).filter(isValid);

    function remember(v) {
      const list = [v].concat(recents().filter((x) => x !== v)).slice(0, RECENT_MAX);
      store.set(RECENT_KEY, list);
    }

    // What the grid shows now: [{ value, label }].
    function items() {
      const glyphNames = o.t('emojiGlyphs') || {};
      if (query) {
        const q = fold(query.trim());
        const words = q.split(/\s+/).filter(Boolean);
        const own = GLYPHS.filter((g) => words.every((w) => fold((glyphNames[g.id] || g.id) + ' glowapp').indexOf(w) >= 0))
          .map((g) => ({ value: PREFIX + g.id, label: glyphNames[g.id] || g.id }));
        if (!data) return own;
        const hits = [];
        for (const e of data.list) {
          if (!words.every((w) => e.search.indexOf(w) >= 0)) continue;
          // Names that start with the words come first.
          const rank = fold(nameOf(e)).indexOf(words[0]) === 0 ? 0 : 1;
          hits.push({ e, rank });
          if (hits.length > RESULTS_MAX * 2) break;
        }
        hits.sort((a, b) => a.rank - b.rank);
        return own.concat(hits.slice(0, RESULTS_MAX).map(({ e }) => ({ value: toned(e), label: nameOf(e) })));
      }
      if (tab === 'glow') return GLYPHS.map((g) => ({ value: PREFIX + g.id, label: glyphNames[g.id] || g.id }));
      if (tab === 'suggested') {
        const seen = new Set();
        const labelOf = (v) => {
          const g = glyphOf(v);
          if (g) return glyphNames[g.id] || g.id;
          const e = data && data.list.find((x) => x.value === v || (x.tones && x.tones.includes(v)));
          return e ? nameOf(e) : v;
        };
        return recents().concat(o.suggested).filter((v) => !seen.has(v) && seen.add(v)).map((v) => ({ value: v, label: labelOf(v) }));
      }
      if (!data) return null;                                  // still loading
      return data.list.filter((e) => e.group === tab).map((e) => ({ value: toned(e), label: nameOf(e) }));
    }

    function cellFor(item) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'ep-cell';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(item.value === value));
      b.setAttribute('aria-label', item.label);
      b.title = item.label;
      b.dataset.value = item.value;
      b.tabIndex = -1;
      draw(b, item.value);
      return b;
    }

    /* A long group goes in a few rows at a time: the first rows at once, the
       rest a frame later each. An emoji costs most the first time the phone
       draws it, and the 388 people at once held the tap for a third of a
       second. reveal (opening a habit) scrolls to the chosen emoji. */
    const FIRST_CELLS = 63;                          // nine rows of seven, more than in view
    const MORE_CELLS = 84;
    let filling = 0;

    function render(fromUser, reveal) {
      draw(current, value);
      tabButtons.forEach((b) => {
        const on = !query && b.dataset.tab === tab;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      const list = items();
      global.cancelAnimationFrame(filling);
      grid.textContent = '';
      note.hidden = true;
      if (list === null) {
        note.textContent = o.t('emojiLoading');
        note.hidden = false;
        load().then(() => render(false, reveal), () => { note.textContent = o.t('emojiUnavailable'); });
        return;
      }
      if (!list.length) {
        note.textContent = o.t('emojiNone');
        note.hidden = false;
      }
      if (fromUser) grid.scrollTop = 0;
      let at = 0;
      let stop = null;                               // the grid's one tab stop
      const fill = (count) => {
        const end = Math.min(list.length, at + count);
        const batch = doc.createDocumentFragment();
        let chosen = null;
        for (; at < end; at++) {
          const b = cellFor(list[at]);
          if (list[at].value === value) chosen = b;
          batch.appendChild(b);
        }
        grid.appendChild(batch);
        // The stop is the chosen emoji once it is in, the first until then
        // (unless the arrows have moved it meanwhile).
        if (chosen && !grid.contains(doc.activeElement)) {
          if (stop) stop.tabIndex = -1;
          stop = chosen;
          stop.tabIndex = 0;
          if (reveal) {
            const g = grid.getBoundingClientRect();
            const c = chosen.getBoundingClientRect();
            grid.scrollTop += c.top - g.top - (g.height - c.height) / 2;
          }
        } else if (!stop && grid.firstChild) {
          stop = grid.firstChild;
          stop.tabIndex = 0;
        }
        if (at < list.length) filling = global.requestAnimationFrame(() => fill(MORE_CELLS));
      };
      fill(FIRST_CELLS);
    }

    function pick(v) {
      value = v;
      remember(v);
      grid.querySelectorAll('.ep-cell').forEach((b) => {
        const on = b.dataset.value === v;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      draw(current, value);
      o.onPick(v);
    }

    grid.addEventListener('click', (evt) => {
      const b = evt.target.closest('.ep-cell');
      if (b) pick(b.dataset.value);
    });
    // Arrows move through the grid (one tab stop for all of it); Home and End.
    grid.addEventListener('keydown', (evt) => {
      const cells = [...grid.querySelectorAll('.ep-cell')];
      const at = cells.indexOf(doc.activeElement);
      if (at < 0) return;
      const cols = cells.filter((c) => c.offsetTop === cells[0].offsetTop).length || 1;
      const to = { ArrowRight: at + 1, ArrowLeft: at - 1, ArrowDown: at + cols, ArrowUp: at - cols, Home: 0, End: cells.length - 1 }[evt.key];
      if (to === undefined) return;
      evt.preventDefault();
      const next = cells[Math.max(0, Math.min(cells.length - 1, to))];
      cells[at].tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    });
    tabs.addEventListener('keydown', (evt) => {
      const at = tabButtons.indexOf(doc.activeElement);
      const to = { ArrowRight: at + 1, ArrowLeft: at - 1 }[evt.key];
      if (at < 0 || to === undefined) return;
      evt.preventDefault();
      const next = tabButtons[(to + tabButtons.length) % tabButtons.length];
      next.focus();
      next.click();
    });
    search.addEventListener('input', () => {
      query = search.value;
      touched = true;
      if (query && !data) load().then(() => render(false), () => {});
      render(true);
    });
    // Enter in the search picks the first match.
    search.addEventListener('keydown', (evt) => {
      if (evt.key !== 'Enter') return;
      evt.preventDefault();
      const first = grid.querySelector('.ep-cell');
      if (first) pick(first.dataset.value);
    });

    function renderTones() {
      const names = o.t('emojiTones') || [];
      toneBtn.textContent = '✋' + TONE_MODIFIERS[tone];
      toneBtn.setAttribute('aria-label', o.t('emojiTone') + ': ' + (names[tone] || ''));
      tones.textContent = '';
      TONE_MODIFIERS.forEach((mod, i) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'ep-tone-option';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(i === tone));
        b.setAttribute('aria-label', names[i] || '');
        b.textContent = '✋' + mod;
        b.addEventListener('click', () => {
          tone = i;
          store.set(TONE_KEY, tone);
          tones.hidden = true;
          toneBtn.setAttribute('aria-expanded', 'false');
          renderTones();
          render(false);
          toneBtn.focus();
        });
        tones.appendChild(b);
      });
    }
    toneBtn.addEventListener('click', () => {
      tones.hidden = !tones.hidden;
      toneBtn.setAttribute('aria-expanded', String(!tones.hidden));
    });

    function relabel() {
      const names = o.t('emojiGroups') || {};
      search.placeholder = o.t('emojiSearch');
      search.setAttribute('aria-label', o.t('emojiSearch'));
      tabs.setAttribute('aria-label', o.t('emojiCategories'));
      grid.setAttribute('aria-label', o.t('emojiCategories'));
      tabButtons.forEach((b) => {
        b.setAttribute('aria-label', names[b.dataset.tab] || b.dataset.tab);
        b.title = names[b.dataset.tab] || b.dataset.tab;
      });
      renderTones();
      render(false);
    }

    // The tab that has v: GlowApp's own, the suggestions, or its group once
    // the list is in.
    function tabFor(v) {
      if (glyphOf(v)) return 'glow';
      if (o.suggested.includes(v) || recents().includes(v)) return 'suggested';
      const e = data && data.list.find((x) => x.value === v || (x.tones && x.tones.includes(v)));
      return e ? e.group : 'suggested';
    }

    relabel();
    // In the background, for the other tabs; then on the chosen one's, if
    // nothing else was chosen meanwhile.
    load().then(() => {
      if (!touched) tab = tabFor(value);
      render(false, !touched);
    }, () => {});
    return {
      set(v) {
        value = v;
        query = '';
        search.value = '';
        tones.hidden = true;
        touched = false;
        tab = tabFor(v);
        render(true, true);
      },
      relabel: relabel,
    };
  }

  global.GlowEmoji = { mount: mount, draw: draw, text: text, isValid: isValid, glyphOf: glyphOf, load: load, GLYPHS: GLYPHS };
})(window);
