/* Hábitos — hand-rolled SVG charts.
   No chart library: the app has to work offline from the cache, so every mark
   is built here. Colours come from CSS custom properties, which means both
   themes are handled by the stylesheet rather than by branching in JS. */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) {
      if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  /* Every chart shares one tooltip element per host container. */
  function tipFor(host) {
    let tip = host.querySelector('.viz-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'viz-tip';
      host.appendChild(tip);
    }
    return tip;
  }

  function showTip(host, tip, x, y, html) {
    tip.innerHTML = html;
    const rect = host.getBoundingClientRect();
    const clampedX = Math.max(58, Math.min(rect.width - 58, x));
    tip.style.left = clampedX + 'px';
    tip.style.top = y + 'px';
    tip.classList.add('is-on');
  }
  function hideTip(tip) {
    tip.classList.remove('is-on');
  }

  /* Maps an SVG user-space point to CSS pixels inside the host. */
  function pxScale(svg, host) {
    const vb = svg.viewBox.baseVal;
    const w = host.getBoundingClientRect().width || vb.width;
    return w / vb.width;
  }

  /* Draw at the host's width in the text's own scale: at the default size a
     unit is a pixel, so 11px text renders as 11px; with Ajustes → Tamaño
     (2.21) the whole chart — its text, margins and marks — grows or shrinks
     with the rest of the app, the SVG being as wide as its host. */
  function textScale() {
    const px = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return px / 16;
  }
  function widthOf(host, min) {
    const w = Math.round((host.getBoundingClientRect().width || host.clientWidth || 0) / textScale());
    return Math.max(min || 200, w || 340);
  }

  function reset(host) {
    const tip = host.querySelector('.viz-tip');
    host.innerHTML = '';
    if (tip) host.appendChild(tip);
    return tip || tipFor(host);
  }

  /* Rough ellipsis at the label column's width — ~6.2px per character at 11px. */
  function fit(text, widthPx) {
    const max = Math.max(6, Math.floor(widthPx / 6.2));
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  function legend(host, series) {
    const box = document.createElement('div');
    box.className = 'viz-legend';
    series.forEach((s) => {
      const item = document.createElement('span');
      const swatch = document.createElement('i');
      swatch.style.background = s.color;
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(s.name));
      box.appendChild(item);
    });
    host.appendChild(box);
  }

  /* A smooth path through points ([x, y], in order): a monotone cubic
     (Fritsch–Carlson), so the curve never swings past the data between two
     points — a 1–5 scale stays within 1–5, a percentage within 0–100 — and
     never invents a wiggle the data does not have. Two points are a line;
     one is just a move (its dot shows it). */
  function curvePath(P) {
    const f = (n) => n.toFixed(1);
    if (!P.length) return '';
    let d = 'M' + f(P[0][0]) + ' ' + f(P[0][1]);
    if (P.length === 1) return d;
    if (P.length === 2) return d + 'L' + f(P[1][0]) + ' ' + f(P[1][1]);
    const n = P.length;
    const m = [];
    for (let i = 0; i < n - 1; i++) m.push((P[i + 1][1] - P[i][1]) / ((P[i + 1][0] - P[i][0]) || 1));
    const t = new Array(n);
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i];
      const b = t[i + 1] / m[i];
      const h = a * a + b * b;
      if (h > 9) {
        const k = 3 / Math.sqrt(h);
        t[i] = k * a * m[i];
        t[i + 1] = k * b * m[i];
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const dx = (P[i + 1][0] - P[i][0]) / 3;
      d += 'C' + f(P[i][0] + dx) + ' ' + f(P[i][1] + t[i] * dx) + ' ' + f(P[i + 1][0] - dx) + ' ' +
        f(P[i + 1][1] - t[i + 1] * dx) + ' ' + f(P[i + 1][0]) + ' ' + f(P[i + 1][1]);
    }
    return d;
  }

  /* A centred rolling mean over `span` points (odd), where at least half of
     its window has a value; null elsewhere. */
  function rollingMean(values, span) {
    const half = Math.floor(span / 2);
    const need = Math.ceil(span / 2);
    return values.map((_, i) => {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
        if (values[j] === null || values[j] === undefined) continue;
        sum += values[j];
        count++;
      }
      return count >= need ? sum / count : null;
    });
  }

  /* ── Line chart with a crosshair + tooltip ───────────────────────────
     One series (mood over time). A single series needs no legend box —
     the figure caption names it. */
  function line(host, opts) {
    const tip = reset(host);
    const pts = opts.points;
    const W = widthOf(host);
    const H = opts.height || 200;
    const M = { t: 12, r: 14, b: 26, l: 30 };
    const innerW = W - M.l - M.r;
    const innerH = H - M.t - M.b;
    const min = opts.min !== undefined ? opts.min : 0;
    const max = opts.max !== undefined ? opts.max : 5;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.ariaLabel || '' }, host);

    const xAt = (i) => M.l + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
    const yAt = (v) => M.t + innerH - ((v - min) / (max - min)) * innerH;

    (opts.yTicks || [1, 2, 3, 4, 5]).forEach((v) => {
      const y = yAt(v);
      el('line', { class: 'viz-grid', x1: M.l, x2: W - M.r, y1: y, y2: y }, svg);
      el('text', { class: 'viz-tick', x: M.l - 7, y: y + 3.5, 'text-anchor': 'end' }, svg).textContent =
        opts.tickFormat ? opts.tickFormat(v) : v;
    });

    /* A reference value (a goal weight): dashed, labelled at its right end. */
    if (opts.ref && opts.ref.value >= min && opts.ref.value <= max) {
      const y = yAt(opts.ref.value);
      el('line', { class: 'viz-ref', x1: M.l, x2: W - M.r, y1: y, y2: y }, svg);
      el('text', { class: 'viz-tick', x: W - M.r, y: y - 5, 'text-anchor': 'end' }, svg).textContent = opts.ref.label;
    }
    el('line', { class: 'viz-axis', x1: M.l, x2: W - M.r, y1: M.t + innerH, y2: M.t + innerH }, svg);

    /* x labels: first, middle and last only — dense date ticks collide. */
    const xLabelIdx = pts.length > 2 ? [0, Math.floor((pts.length - 1) / 2), pts.length - 1] : pts.map((_, i) => i);
    xLabelIdx.forEach((i) => {
      const anchor = i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle';
      el('text', { class: 'viz-tick', x: xAt(i), y: H - 8, 'text-anchor': anchor }, svg).textContent = pts[i].label;
    });

    /* What the line follows: the values, or (opts.smooth, 2.20) their
       rolling mean (2.21: without the daily values as dots around it). */
    const raw = pts.map((p) => (p.value === null || p.value === undefined ? null : p.value));
    const line = opts.smooth ? rollingMean(raw, opts.smooth) : raw;
    const color = opts.color || 'var(--s1)';

    /* Gaps (days with no entry) break the line rather than bridging them —
       unless `connect` says the readings are sparse by nature (a weigh-in
       every few days), when it runs from one to the next. Each stretch is a
       smooth curve (2.20; straight segments until then). */
    const runs = [];
    let open = false;
    line.forEach((v, i) => {
      if (v === null) { if (!opts.connect) open = false; return; }
      if (!open) runs.push([]);
      runs[runs.length - 1].push(i);
      open = true;
    });
    const pointsOf = (run) => run.map((i) => [xAt(i), yAt(line[i])]);
    /* A single series may lie on a faint wash of its own colour (2.19). */
    if (opts.area) {
      const base = (M.t + innerH).toFixed(1);
      runs.filter((run) => run.length > 1).forEach((run) => {
        const curve = curvePath(pointsOf(run));
        el('path', {
          class: 'viz-area', fill: color,
          d: 'M' + xAt(run[0]).toFixed(1) + ' ' + base + 'L' + curve.slice(1) + 'L' + xAt(run[run.length - 1]).toFixed(1) + ' ' + base + 'Z',
        }, svg);
      });
    }
    runs.forEach((run) => el('path', { class: 'viz-line', d: curvePath(pointsOf(run)), stroke: color }, svg));

    const filled = [];
    raw.forEach((v, i) => { if (v !== null) filled.push(i); });
    const ends = runs.filter((run) => run.length).map((run) => run[run.length - 1]);
    const lastIdx = ends.length ? ends[ends.length - 1] : null;
    if (!opts.smooth) {
      // Fewer, smaller dots the denser the days, so a month or a quarter
      // reads as a line; a lone day between gaps keeps its dot, or it would
      // not show at all.
      const lone = new Set(runs.filter((run) => run.length === 1).map((run) => run[0]));
      raw.forEach((v, i) => {
        if (v === null || opts.dots === false && i !== lastIdx && !lone.has(i)) return;
        if (pts.length > 45 && !lone.has(i) && i !== lastIdx) return;
        const r = i === lastIdx && (opts.dots === false || pts.length > 45) ? 4 : pts.length > 14 ? 3 : 4;
        el('circle', { class: 'viz-dot', cx: xAt(i), cy: yAt(v), r: r, fill: color }, svg);
      });
    } else if (lastIdx !== null) {
      el('circle', { class: 'viz-dot', cx: xAt(lastIdx), cy: yAt(line[lastIdx]), r: 4, fill: color }, svg);
    }

    /* The value at the line's end, where a line is labelled (2.19). */
    if (opts.endLabel && lastIdx !== null) {
      el('text', { class: 'viz-value', x: xAt(lastIdx), y: yAt(line[lastIdx]) - 10, 'text-anchor': 'end' }, svg).textContent = opts.endLabel;
    }

    const cross = el('line', { class: 'viz-crosshair', y1: M.t, y2: M.t + innerH, opacity: 0 }, svg);
    const focus = el('circle', { r: 6, fill: opts.color || 'var(--s1)', stroke: 'var(--surface)', 'stroke-width': 2, opacity: 0 }, svg);

    const hit = el('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' }, svg);
    hit.style.cursor = 'crosshair';

    function nearest(evt) {
      const rect = svg.getBoundingClientRect();
      const ux = ((evt.clientX - rect.left) / rect.width) * W;
      let best = null;
      let bestD = Infinity;
      filled.forEach((i) => {
        const dist = Math.abs(xAt(i) - ux);
        if (dist < bestD) { bestD = dist; best = i; }
      });
      return best;
    }

    function move(evt) {
      const i = nearest(evt);
      if (i === null) return;
      const p = pts[i];
      const s = pxScale(svg, host);
      cross.setAttribute('x1', xAt(i));
      cross.setAttribute('x2', xAt(i));
      cross.setAttribute('opacity', 1);
      focus.setAttribute('cx', xAt(i));
      focus.setAttribute('cy', yAt(p.value));
      focus.setAttribute('opacity', 1);
      const mean = opts.smooth && line[i] !== null && opts.meanLabel
        ? '<br><span class="tip-sub">' + opts.meanLabel(line[i]) + '</span>' : '';
      showTip(host, tip, xAt(i) * s, yAt(p.value) * s, (p.tip || `<b>${p.value}</b>`) + mean);
    }
    function leave() {
      cross.setAttribute('opacity', 0);
      focus.setAttribute('opacity', 0);
      hideTip(tip);
    }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
  }

  /* ── Horizontal bars ─────────────────────────────────────────────────
     Magnitude by habit. Direct-labelled at the end of every bar, which is
     also the relief the light palette needs for its low-contrast hues. */
  function bars(host, opts) {
    const tip = reset(host);
    const items = opts.items;
    const W = widthOf(host);
    // Narrow (Grande on a phone, 2.21): each name goes over its bar, and the
    // bar has the whole width.
    const stacked = W < 300;
    const rowH = stacked ? 40 : 36;
    const gap = 8;
    const labelW = stacked ? 0 : Math.round(Math.min(190, Math.max(96, W * 0.42)));
    const H = items.length * (rowH + gap) + 18;
    const innerW = W - labelW - (opts.valueW || 46);   // room for the value at the end

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.ariaLabel || '' }, host);
    const max = opts.max || 100;

    items.forEach((item, i) => {
      const y = i * (rowH + gap);
      const barH = stacked ? 14 : 18;
      const barY = stacked ? y + rowH - barH : y + (rowH - barH) / 2;

      const name = el('text', { class: 'viz-label', x: 0, y: stacked ? y + 9 : y + rowH / 2 - 1, 'dominant-baseline': 'middle' }, svg);
      name.textContent = fit(item.label, stacked ? W - (item.sub ? 52 : 8) : labelW - 8);
      if (item.sub) {
        el('text', stacked
          ? { class: 'viz-tick', x: W, y: y + 9, 'text-anchor': 'end', 'dominant-baseline': 'middle' }
          : { class: 'viz-tick', x: 0, y: y + rowH / 2 + 12 }, svg).textContent = item.sub;
      }

      el('rect', { class: 'viz-bar', x: labelW, y: barY, width: innerW, height: barH, fill: 'var(--surface-3)' }, svg);
      const w = Math.max(item.value > 0 ? 4 : 0, (item.value / max) * innerW);
      const bar = el('rect', { class: 'viz-bar', x: labelW, y: barY, width: w, height: barH, fill: item.color || 'var(--s1)' }, svg);
      bar.style.cursor = 'pointer';

      el('text', {
        class: 'viz-value', x: labelW + innerW + 8, y: barY + barH / 2 + 1, 'dominant-baseline': 'middle',
      }, svg).textContent = item.valueLabel;

      const hit = el('rect', { x: labelW, y: y, width: innerW, height: rowH, fill: 'transparent' }, svg);
      hit.addEventListener('pointerenter', () => {
        const s = pxScale(svg, host);
        showTip(host, tip, (labelW + w) * s, barY * s, item.tip || item.valueLabel);
      });
      hit.addEventListener('pointerleave', () => hideTip(tip));
    });
  }

  /* ── Columns (2.19) ──────────────────────────────────────────────────
     One series over a few ordered slots (the days of the week). Thin
     columns, rounded only at the data end and square on the baseline, the
     value on each cap; the whole slot answers the pointer. A slot without
     a value keeps its place, marked by a dash. */
  function columns(host, opts) {
    const tip = reset(host);
    const items = opts.items;
    const W = widthOf(host);
    const H = opts.height || 168;
    const M = { t: 20, b: 24 };
    const innerH = H - M.t - M.b;
    const slot = W / items.length;
    const barW = Math.min(24, slot * 0.56);
    const max = opts.max || 100;
    const base = M.t + innerH;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.ariaLabel || '' }, host);
    el('line', { class: 'viz-axis', x1: 0, x2: W, y1: base, y2: base }, svg);
    /* A goal across the columns (excellence's 70 % since 2.21), under them; the
       caption says what it is, so it needs no label of its own. */
    if (opts.ref) {
      const y = base - (opts.ref.value / max) * innerH;
      el('line', { class: 'viz-goal', x1: 0, x2: W, y1: y, y2: y }, svg);
    }

    items.forEach((item, i) => {
      const cx = slot * i + slot / 2;
      el('text', { class: 'viz-tick', x: cx, y: H - 7, 'text-anchor': 'middle' }, svg).textContent = item.label;
      const has = item.value !== null && item.value !== undefined;
      const h = has ? Math.max(item.value > 0 ? 4 : 0, (item.value / max) * innerH) : 0;
      if (h > 0) {
        const x = cx - barW / 2;
        const y = base - h;
        const r = Math.min(4, h, barW / 2);
        el('path', {
          class: 'viz-col',
          d: `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + barW - r}Q${x + barW} ${y} ${x + barW} ${y + r}V${base}Z`,
          fill: item.color || opts.color || 'var(--s1)',
        }, svg);
      }
      el('text', { class: 'viz-value', x: cx, y: base - h - 6, 'text-anchor': 'middle' }, svg).textContent =
        has ? item.valueLabel : '—';
      const hit = el('rect', { x: slot * i, y: 0, width: slot, height: H, fill: 'transparent' }, svg);
      hit.addEventListener('pointerenter', () => {
        const s = pxScale(svg, host);
        showTip(host, tip, cx * s, (base - h - 14) * s, item.tip || item.valueLabel);
      });
      hit.addEventListener('pointerleave', () => hideTip(tip));
    });
  }

  /* ── Grouped bars (two series) ───────────────────────────────────────
     Mood on completed versus missed days. Two series get a legend and
     direct value labels, so identity is never colour-alone. */
  function groupedBars(host, opts) {
    const tip = reset(host);
    const groups = opts.groups;
    const series = opts.series;
    const W = widthOf(host);
    const stacked = W < 300;                          // the name over its pair (2.21)
    const groupH = stacked ? 60 : 52;
    const H = 40 + groups.length * groupH;
    const labelW = stacked ? 0 : Math.round(Math.min(190, Math.max(96, W * 0.42)));
    const innerW = W - labelW - 44;
    const max = opts.max || 5;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.ariaLabel || '' }, host);

    /* Value gridlines behind the marks. */
    for (let v = 1; v <= max; v++) {
      const x = labelW + (v / max) * innerW;
      el('line', { class: 'viz-grid', x1: x, x2: x, y1: 0, y2: H - 22 }, svg);
      el('text', { class: 'viz-tick', x: x, y: H - 8, 'text-anchor': 'middle' }, svg).textContent = v;
    }
    el('line', { class: 'viz-axis', x1: labelW, x2: labelW, y1: 0, y2: H - 22 }, svg);

    groups.forEach((g, gi) => {
      const top = gi * groupH + 4;
      const name = el('text', { class: 'viz-label', x: 0, y: stacked ? top + 6 : top + 22, 'dominant-baseline': 'middle' }, svg);
      name.textContent = fit(g.label, stacked ? W - 8 : labelW - 8);

      g.values.forEach((v, si) => {
        /* 2px surface gap between adjacent bars keeps the pair readable. */
        const barH = 16;
        const y = (stacked ? top + 16 : top) + si * (barH + 2);
        if (v.value === null) return;
        const w = Math.max(3, (v.value / max) * innerW);
        const bar = el('rect', { class: 'viz-bar', x: labelW, y: y, width: w, height: barH, fill: series[si].color }, svg);
        bar.style.cursor = 'pointer';
        el('text', {
          class: 'viz-value', x: labelW + w + 7, y: y + barH / 2 + 1, 'dominant-baseline': 'middle',
        }, svg).textContent = v.valueLabel;

        bar.addEventListener('pointerenter', () => {
          const s = pxScale(svg, host);
          showTip(host, tip, (labelW + w) * s, y * s, v.tip || v.valueLabel);
        });
        bar.addEventListener('pointerleave', () => hideTip(tip));
      });
    });

    legend(host, series);
  }

  /* ── Calendar heatmap ────────────────────────────────────────────────
     Sequential one-hue ramp (light→dark on light, dark→light on dark):
     magnitude only, never a rainbow. Unscheduled days stay blank. */
  function heatmap(host, opts) {
    const tip = reset(host);
    const days = opts.days;           // ordered oldest → newest
    const gap = 3;
    const leftPad = 26;
    const topPad = 16;

    /* Column = calendar week, offset so each row is a fixed weekday. */
    const firstOffset = opts.firstOffset || 0;
    const weeks = Math.ceil((days.length + firstOffset) / 7);
    const avail = widthOf(host) - leftPad;
    const cell = Math.max(11, Math.min(30, Math.floor(avail / weeks) - gap));
    const step = cell + gap;
    const W = leftPad + weeks * step;
    const H = topPad + 7 * step + 4;

    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.ariaLabel || '',
      preserveAspectRatio: 'xMinYMin meet',
    }, host);
    svg.style.maxWidth = W + 'px';
    svg.style.margin = '0 auto';

    (opts.dowLabels || []).forEach((label, row) => {
      if (row % 2 === 1) return;      // every other row, to avoid crowding
      el('text', { class: 'viz-tick', x: 0, y: topPad + row * step + cell - 2 }, svg).textContent = label;
    });

    let lastMonth = null;
    days.forEach((d, i) => {
      const pos = i + firstOffset;
      const col = Math.floor(pos / 7);
      const row = pos % 7;
      const x = leftPad + col * step;
      const y = topPad + row * step;

      if (d.monthLabel && d.monthLabel !== lastMonth) {
        lastMonth = d.monthLabel;
        el('text', { class: 'viz-tick', x: x, y: 9 }, svg).textContent = d.monthLabel;
      }

      const fill = d.scheduled === false
        ? 'transparent'
        : 'var(--seq-' + d.level + ')';
      const rect = el('rect', {
        class: 'viz-cell is-hit', x: x, y: y, width: cell, height: cell, fill: fill,
      }, svg);
      if (d.scheduled === false) {
        rect.setAttribute('stroke', 'var(--grid)');
        rect.setAttribute('stroke-dasharray', '2 2');
      }
      rect.addEventListener('pointerenter', () => {
        const s = pxScale(svg, host);
        showTip(host, tip, (x + cell / 2) * s, y * s, d.tip);
      });
      rect.addEventListener('pointerleave', () => hideTip(tip));
    });

    /* Ramp legend — the ordinal key for the fills above. */
    const scale = document.createElement('div');
    scale.className = 'viz-scale';
    scale.appendChild(document.createTextNode(opts.lessLabel || 'Less'));
    [0, 1, 2, 3, 4, 5].forEach((lv) => {
      const swatch = document.createElement('i');
      swatch.style.background = 'var(--seq-' + lv + ')';
      scale.appendChild(swatch);
    });
    scale.appendChild(document.createTextNode(opts.moreLabel || 'More'));
    host.appendChild(scale);
  }

  global.Charts = { line, bars, columns, groupedBars, heatmap };
})(window);
