/* Pico's discoveries (2.24, a preview of GlowApp Plus): patterns described
   from what is already recorded, worked out on the device and never stored.
   Pure: the app hands in its own rules (when a habit is due, when it is
   done, a settled day's numbers, a day's mood, a day's weekday), so nothing
   here can drift from what Today and Progress count.

   What it looks for, over the last twelve weeks of finished days (today is
   left out: the day is not over yet):
   - same:     the mood or energy of the days a habit was done, against the
               days it was due and not done;
   - next:     the same on the day after (a habit done yesterday, and how
               today went);
   - combo:    two or three habits all done the day before, against the days
               they were all due and not all done ("cuando cumples estos tres
               el día anterior, tu energía suele estar más alta");
   - moodNext: after a day of good mood (4 or 5), how much of what was
               scheduled gets done, against after the other days;
   - weekday:  the mood or energy of one weekday against the rest;
   and this week's completion against the four weeks before.

   What it may say, and what it never says:
   - Only what the records show, with how many days each side rests on.
     Coincidence, never cause: no finding says a habit made anyone feel
     anything, and none gives advice.
   - Nothing on thin data: MIN_DAYS days with a mood before any comparison
     of mood or energy, and days enough on each side of each one.
   - Nothing that could well be chance. Hundreds of comparisons are tried
     (every pair and triple of the most even habits, each habit twice, each
     weekday), and among so many some always look striking by luck: in data
     made up with no relation at all, a plain threshold "found" something
     nine times in ten. So every comparison gets a p-value (Student's t,
     variance pooled; see studentT() below) and only those that survive the
     Benjamini-Hochberg procedure over all the comparisons tried, at a
     false discovery rate of FDR, can be said. They must also be worth a
     sentence (half a point of mood, ten points of energy, ten points of
     completion, more for combinations), and a combination must beat the
     best of its own parts by GAIN, or the simpler finding stands.
   - At most SHOWN findings, the most certain first, two of a kind at most,
     and a combination's habits are not repeated one by one beside it. */
(function (global) {
  'use strict';

  const WINDOW = 84;                    // twelve weeks of finished days
  const MIN_DAYS = 21;                  // days with a mood before any mood or energy comparison
  const MIN_PER_GROUP = 7;              // days on each side, one habit
  const MIN_PER_GROUP_COMBO = 6;        // days on each side, a combination
  const MIN_WEEKDAY = 5;                // days of the weekday compared
  const DIFF = { mood: 0.5, energy: 10, done: 0.1 };
  const DIFF_COMBO = { mood: 0.6, energy: 12 };
  const GAIN = { mood: 0.25, energy: 5 };
  const FDR = 0.05;                     // the share of false findings tolerated, at most
  const MAX_COMBO_HABITS = 12;          // the habits closest to "done half the time" go into combinations
  const RATE_FLOOR = 0.15;              // a habit nearly always or nearly never done says little
  const SHOWN = 4;
  const PER_KIND = 2;
  const WEEK = 7;
  const PREV_WEEKS = 4;
  const MIN_WEEK_DAYS = 4;              // due days this week before it is compared
  const MIN_PREV_DAYS = 21;             // due days in the four weeks before

  /* ── Student's t, two-sided p ──────────────────────────────────────────
     Through the regularized incomplete beta function (Lanczos log-gamma, and
     the continued fraction of Numerical Recipes). */
  const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    let a = LANCZOS[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function betacf(a, b, x) {
    const FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 3e-14) break;
    }
    return h;
  }
  function ibeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function pTwoSided(t, df) {
    if (!Number.isFinite(t)) return 0;
    if (!(df > 0)) return 1;
    return Math.min(1, ibeta(df / (df + t * t), df / 2, 0.5));
  }

  // n, mean and sample variance of a list of numbers.
  function stats(values) {
    const n = values.length;
    if (!n) return { n: 0, mean: 0, v: 0 };
    let sum = 0;
    for (const x of values) sum += x;
    const mean = sum / n;
    let sq = 0;
    for (const x of values) sq += (x - mean) * (x - mean);
    return { n, mean, v: n > 1 ? sq / (n - 1) : 0 };
  }
  /* Student's t with the two groups' variance pooled: difference, t, p.
     Not Welch's: a combination's group is often six to ten days, whose own
     variance comes out too small by chance now and then, and Welch then
     trusts it — in data with no relation its p-values below 0.001 came up
     three to four times too often, just where the false discovery control
     works. Pooled, the small group leans on the large one's variance (both
     are the same days' measure; what is compared is the mean): measured,
     p below 0.001 then comes up about as often as it should, and made-up
     data with no relation shows a finding in about 2 % of cases. */
  function studentT(a, b) {
    const diff = a.mean - b.mean;
    const df = a.n + b.n - 2;
    const pooled = df > 0 ? ((a.n - 1) * a.v + (b.n - 1) * b.v) / df : 0;
    const se = Math.sqrt(pooled * (1 / a.n + 1 / b.n));
    if (!(se > 0)) return { diff, t: diff === 0 ? 0 : (diff > 0 ? Infinity : -Infinity), p: diff === 0 ? 1 : 0 };
    const t = diff / se;
    return { diff, t, p: pTwoSided(t, df) };
  }
  // Every subset of `items` of size k, in order.
  function subsets(items, k) {
    const out = [];
    const walk = (start, picked) => {
      if (picked.length === k) { out.push(picked.slice()); return; }
      for (let i = start; i < items.length; i++) { picked.push(items[i]); walk(i + 1, picked); picked.pop(); }
    };
    walk(0, []);
    return out;
  }

  /* inp: { days: day keys oldest to newest, ending today — at least WINDOW
     + 2 of them, so each day of the window has the day before it;
     habits: the active ones; scheduled(habit, key); complete(habit, key);
     settled(key) -> { due, done }; mood(key) -> { score, energyPct } or
     null, energyPct null unless the person set it; dow(key) -> 0..6
     (optional: without it there are no weekday findings) }. */
  function compute(inp) {
    const all = inp.days;
    const past = all.slice(0, -1);                    // today left out
    const window = past.slice(-WINDOW);
    const offset = past.length - window.length;       // where the window starts in `past`
    const dayBefore = (i) => (offset + i - 1 >= 0 ? past[offset + i - 1] : null);
    const moodOf = (key) => {
      const m = key ? inp.mood(key) : null;
      return m && Number.isFinite(m.score) ? m : null;
    };

    // The measures of each day of the window.
    const M = { mood: [], energy: [] };
    window.forEach((key, i) => {
      const m = moodOf(key);
      M.mood[i] = m ? m.score : null;
      M.energy[i] = m && Number.isFinite(m.energyPct) ? m.energyPct : null;
    });
    const moodDays = M.mood.filter((v) => v !== null).length;
    const energyDays = M.energy.filter((v) => v !== null).length;
    const enough = moodDays >= MIN_DAYS;
    const measures = [];
    if (enough) measures.push('mood');
    if (energyDays >= MIN_DAYS) measures.push('energy');

    // Each habit on each day of the window and on the day before it.
    const H = inp.habits.map((h) => {
      const rec = { h, due: [], done: [], duePrev: [], donePrev: [] };
      window.forEach((key, i) => {
        const prev = dayBefore(i);
        rec.due[i] = !!inp.scheduled(h, key);
        rec.done[i] = rec.due[i] && !!inp.complete(h, key);
        rec.duePrev[i] = !!prev && !!inp.scheduled(h, prev);
        rec.donePrev[i] = rec.duePrev[i] && !!inp.complete(h, prev);
      });
      return rec;
    });

    // Every comparison tried, held up or not: the family the false
    // discovery rate is controlled over.
    const tests = [];
    const consider = (base, yes, no, minN, minDiff) => {
      if (yes.length < minN || no.length < minN) return null;
      const a = stats(yes);
      const b = stats(no);
      const w = studentT(a, b);
      const test = Object.assign(base, { yes: { mean: a.mean, n: a.n }, no: { mean: b.mean, n: b.n }, diff: w.diff, t: w.t, p: w.p,
        worth: Math.abs(w.diff) >= minDiff });
      tests.push(test);
      return test;
    };

    // One habit, the same day and the day after.
    const nextDiff = { mood: {}, energy: {} };       // every habit's day-after difference
    for (const m of measures) {
      for (const rec of H) {
        for (const lag of [0, 1]) {
          const yes = [];
          const no = [];
          for (let i = 0; i < window.length; i++) {
            const v = M[m][i];
            if (v === null || !(lag ? rec.duePrev[i] : rec.due[i])) continue;
            ((lag ? rec.donePrev[i] : rec.done[i]) ? yes : no).push(v);
          }
          if (lag && yes.length && no.length) nextDiff[m][rec.h.id] = stats(yes).mean - stats(no).mean;
          consider({ kind: lag ? 'next' : 'same', measure: m, habitIds: [rec.h.id] }, yes, no, MIN_PER_GROUP, DIFF[m]);
        }
      }
    }

    // Two or three habits all done the day before. Only habits that vary
    // (done between 15 % and 85 % of the days they were due), the most even
    // first, at most MAX_COMBO_HABITS of them.
    const even = H.map((rec) => {
      let due = 0, done = 0;
      for (let i = 0; i < window.length; i++) if (rec.duePrev[i]) { due++; if (rec.donePrev[i]) done++; }
      return { rec, due, rate: due ? done / due : 0 };
    }).filter((x) => x.due >= 2 * MIN_PER_GROUP_COMBO && x.rate >= RATE_FLOOR && x.rate <= 1 - RATE_FLOOR)
      .sort((a, b) => Math.abs(a.rate - 0.5) - Math.abs(b.rate - 0.5) || (a.rec.h.id < b.rec.h.id ? -1 : 1))
      .slice(0, MAX_COMBO_HABITS)
      .map((x) => x.rec);
    let combosTried = 0;
    for (const m of measures) {
      const comboDiff = {};                          // every pair's difference, for the triples' check
      for (const size of [2, 3]) {
        for (const set of subsets(even, size)) {
          const yes = [];
          const no = [];
          for (let i = 0; i < window.length; i++) {
            const v = M[m][i];
            if (v === null || !set.every((rec) => rec.duePrev[i])) continue;
            (set.every((rec) => rec.donePrev[i]) ? yes : no).push(v);
          }
          const ids = set.map((rec) => rec.h.id);
          if (yes.length && no.length) comboDiff[ids.join('|')] = stats(yes).mean - stats(no).mean;
          const test = consider({ kind: 'combo', measure: m, habitIds: ids }, yes, no, MIN_PER_GROUP_COMBO, DIFF_COMBO[m]);
          if (!test) continue;
          combosTried++;
          // It must say more than its parts: beat the best of them, in its own direction.
          const parts = ids.map((id) => nextDiff[m][id] || 0);
          if (size === 3) subsets(ids, 2).forEach((pair) => parts.push(comboDiff[pair.join('|')] || 0));
          const sign = Math.sign(test.diff);
          const bestPart = Math.max(0, ...parts.map((d) => d * sign));
          if (Math.abs(test.diff) < bestPart + GAIN[m]) test.worth = false;
          test.set = set;                            // for partsMatter(), once it is a discovery
        }
      }
    }

    /* Every habit in a combination must matter: among the days the others
       were all done, the days it was done too must differ from the days it
       was not, the same way, by GAIN and with p below 0.05. Without this, a
       habit that only rides along with two that go with the measure
       ("dormir, leer y meditar" when it was "dormir, leer y caminar") could
       be named with them. Asked only of the few combinations that are
       discoveries already. */
    const partsMatter = (f) => {
      const sign = Math.sign(f.diff);
      return f.set.every((x) => {
        const rest = f.set.filter((r) => r !== x);
        const withIt = [];
        const without = [];
        for (let i = 0; i < window.length; i++) {
          const v = M[f.measure][i];
          if (v === null || !x.duePrev[i] || !rest.every((r) => r.duePrev[i] && r.donePrev[i])) continue;
          (x.donePrev[i] ? withIt : without).push(v);
        }
        if (withIt.length < 2 || without.length < 2) return false;
        const w = studentT(stats(withIt), stats(without));
        return w.diff * sign >= GAIN[f.measure] && w.p < 0.05;
      });
    };

    // After a day of good mood (4 or 5): how much of what was due got done.
    if (enough) {
      const good = [];
      const other = [];
      window.forEach((key, i) => {
        const before = moodOf(dayBefore(i));
        const s = inp.settled(key);
        if (!before || !s.due) return;
        (before.score >= 4 ? good : other).push(s.done / s.due);
      });
      consider({ kind: 'moodNext', measure: 'done', habitIds: [] }, good, other, MIN_PER_GROUP, DIFF.done);
    }

    // One weekday against the rest.
    if (inp.dow) {
      const dows = window.map((key) => inp.dow(key));
      for (const m of measures) {
        for (let w = 0; w < 7; w++) {
          const yes = [];
          const no = [];
          for (let i = 0; i < window.length; i++) {
            const v = M[m][i];
            if (v === null) continue;
            (dows[i] === w ? yes : no).push(v);
          }
          if (no.length < MIN_PER_GROUP) continue;
          consider({ kind: 'weekday', measure: m, habitIds: [], weekday: w }, yes, no, MIN_WEEKDAY, DIFF[m]);
        }
      }
    }

    // Benjamini-Hochberg over every comparison tried: the largest k whose
    // k-th smallest p is at most k/m of the rate; those k are discoveries.
    const ranked = tests.slice().sort((a, b) => a.p - b.p);
    let cut = 0;
    ranked.forEach((test, i) => { if (test.p <= ((i + 1) / ranked.length) * FDR) cut = i + 1; });
    const label = (f) => f.kind + ':' + f.measure + ':' + f.habitIds.join('|') + ':' + (f.weekday === undefined ? '' : f.weekday);
    const discoveries = ranked.slice(0, cut).filter((f) => f.worth && (f.kind !== 'combo' || partsMatter(f)))
      .sort((a, b) => a.p - b.p || Math.abs(b.diff) - Math.abs(a.diff) || (label(a) < label(b) ? -1 : 1));

    // The most certain first; two of a kind at most; a combination's habits
    // not repeated one by one, for the same measure, beside it.
    const chosen = [];
    const perKind = {};
    for (const f of discoveries) {
      if (chosen.length >= SHOWN) break;
      if ((perKind[f.kind] || 0) >= PER_KIND) continue;
      const covered = chosen.some((c) => c.kind === 'combo' && c.measure === f.measure &&
        (f.kind === 'next' || f.kind === 'combo') && f.habitIds.every((id) => c.habitIds.includes(id)));
      if (covered) continue;
      if (f.kind === 'combo') {
        // The combination says more: it takes the place of its singles.
        for (let i = chosen.length - 1; i >= 0; i--) {
          const c = chosen[i];
          if (c.kind === 'next' && c.measure === f.measure && f.habitIds.includes(c.habitIds[0])) { chosen.splice(i, 1); perKind.next--; }
        }
      }
      chosen.push(f);
      perKind[f.kind] = (perKind[f.kind] || 0) + 1;
    }
    const findings = chosen.map((f) => ({ kind: f.kind, measure: f.measure, habitIds: f.habitIds, weekday: f.weekday,
      yes: f.yes, no: f.no, diff: f.diff, t: f.t, p: f.p }));

    // This week (the last seven finished days) against the four before it.
    const rate = (keys) => {
      let due = 0, done = 0;
      keys.forEach((key) => { const s = inp.settled(key); due += s.due; done += s.done; });
      return { due, done, rate: due ? done / due : 0 };
    };
    const thisWeek = rate(past.slice(-WEEK));
    const before = rate(past.slice(-WEEK * (PREV_WEEKS + 1), -WEEK));
    const daysWithDue = (keys) => keys.filter((key) => inp.settled(key).due > 0).length;
    const weekOk = daysWithDue(past.slice(-WEEK)) >= MIN_WEEK_DAYS &&
      daysWithDue(past.slice(-WEEK * (PREV_WEEKS + 1), -WEEK)) >= MIN_PREV_DAYS;

    return {
      period: { from: window[0], to: window[window.length - 1], days: window.length },
      moodDays, energyDays, needDays: MIN_DAYS, enough,
      week: weekOk ? { rate: thisWeek.rate, prevRate: before.rate, due: thisWeek.due, prevDue: before.due } : null,
      findings,
      tried: tests.length, combosTried, discoveries: discoveries.length,
    };
  }

  global.GlowInsights = {
    compute,
    pTwoSided,                         // for its tests
    WINDOW, MIN_DAYS, MIN_PER_GROUP, MIN_PER_GROUP_COMBO, DIFF, DIFF_COMBO, GAIN, FDR, SHOWN,
  };
})(window);
