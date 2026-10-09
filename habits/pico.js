/* Pico — GlowApp's guide. A crow, because crows collect shiny things and
   nothing in GlowApp shines like a streak.

   2.15 drew him facing us again, but kept 2.14's restraint: one solid colour
   (the palette's ink: near black in light themes, soft slate in dark ones),
   negative-space lines for the wings and a chest feather, an amber beak as
   the only accent, and eyes whose lids and tilt carry the expression —
   calm by default, between serious and expressive. His wings are his
   hands: he points with the one on the target's side, gestures while he
   talks, lifts one to his chin to think, waves, cheers, and winks.

   He is rigged rather than keyframed: every part follows its target on a
   spring, so a change of pose is a movement and never a jump. Gestures
   (waving, cheering, nodding, talking, hopping, a caw) sit on top, and
   while nothing is asked of him he breathes, blinks, glances about and
   ruffles his crest. One animation loop serves every Pico on the page:
   full rate while something plays, about fifteen frames a second while he
   only breathes, asleep while none is on screen. Under reduced motion he
   takes each pose at once and holds it. */
(function (global) {
  'use strict';

  const WING_L = 'M38 58 C28 63 23 79 25 95 C29 99 35 96 38 89 C41 79 42 68 40 59 Z';
  const WING_R = 'M82 58 C92 63 97 79 95 95 C91 99 85 96 82 89 C79 79 78 68 80 59 Z';

  const MARKUP =
    '<svg class="pico" viewBox="0 0 120 120" aria-hidden="true" focusable="false" data-pose="idle">' +
      '<ellipse class="pk-shadow" cx="60" cy="111" rx="22" ry="2.6"/>' +
      '<g class="pk-all">' +
        '<g class="pk-legs" fill="none" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M53 101 L51 109 M46.5 109.5 H55.5"/>' +
          '<path d="M67 101 L69 109 M64.5 109.5 H73.5"/>' +
        '</g>' +
        '<g class="pk-crest">' +
          '<path class="pk-fill" d="M55 24 C53 16 56 10 61 7 C60 13 61 18 63 23 Z"/>' +
          '<path class="pk-fill" d="M60 23 C62 15 67 12 72 12 C68 16 66 20 66 25 Z"/>' +
        '</g>' +
        '<path class="pk-fill pk-body" d="M60 20 C80 20 90 37 90 59 C90 85 78 103 60 103 C42 103 30 85 30 59 C30 37 40 20 60 20 Z"/>' +
        '<path class="pk-cut" d="M53 80 L60 86 L67 80"/>' +
        '<g class="pk-face">' +
          '<g class="pk-eye pk-eye-l">' +
            '<circle class="pk-white" cx="49" cy="45" r="7"/>' +
            '<circle class="pk-pupil" cx="49.6" cy="45.6" r="3.3"/>' +
            '<rect class="pk-fill pk-lid" x="40" y="37.6" width="18" height="3"/>' +
          '</g>' +
          '<g class="pk-eye pk-eye-r">' +
            '<circle class="pk-white" cx="71" cy="45" r="7"/>' +
            '<circle class="pk-pupil" cx="70.4" cy="45.6" r="3.3"/>' +
            '<rect class="pk-fill pk-lid" x="62" y="37.6" width="18" height="3"/>' +
          '</g>' +
          '<path class="pk-glad pk-glad-l" d="M43 46.5 Q49 40 55 46.5"/>' +
          '<path class="pk-glad pk-glad-r" d="M65 46.5 Q71 40 77 46.5"/>' +
          '<path class="pk-beak pk-beak-low" d="M54.5 60 L65.5 60 L60 72.5 Z"/>' +
          '<path class="pk-beak pk-beak-up" d="M50.5 55.5 Q60 52.5 69.5 55.5 L60 68 Z"/>' +
        '</g>' +
        '<g class="pk-wing pk-wing-l"><path class="pk-fill pk-wing-shape" d="' + WING_L + '"/></g>' +
        '<g class="pk-wing pk-wing-r"><path class="pk-fill pk-wing-shape" d="' + WING_R + '"/></g>' +
      '</g>' +
      '<path class="pk-spark" d="M100 10 L101.7 15.6 L107 17.4 L101.7 19.2 L100 25 L98.3 19.2 L93 17.4 L98.3 15.6 Z"/>' +
    '</svg>';

  /* Where each part turns, in the drawing's own units. */
  const PIVOT = { wingL: [39, 60], wingR: [81, 60], crest: [61, 23], feet: [60, 109], eyeL: [49, 45], eyeR: [71, 45], face: [60, 52] };
  /* The folded wings' directions from the shoulders, in screen degrees. */
  const REST_L = 101;
  const REST_R = 79;

  /* Each pose is a set of targets; anything left out keeps the calm default.
     Wings are in degrees of lift, outwards and up (negative: across the body).
     tilt slants both lids towards the beak: a little focus, a little frown. */
  const BASE = { lean: 0, wingL: 0, wingR: 0, lid: 0.2, tilt: 5, gladL: 0, gladR: 0, spark: 0, lookX: 0, lookY: 0.1, crest: 0 };
  const POSES = {
    idle: {},
    point: { lid: 0.12, tilt: 4 },
    wave: { wingR: 118, lid: 0.16, tilt: 2, crest: -6, gesture: 'wave', then: 'idle' },
    talk: { lid: 0.18, tilt: 5, gesture: 'talk' },
    think: { wingR: 142, lean: -3, lid: 0.36, tilt: -6, lookX: 0.5, lookY: -1, crest: 6 },
    happy: { lid: 0, tilt: 0, gladL: 1, gladR: 1, spark: 1, wingL: 18, wingR: 18, crest: -8 },
    wink: { lid: 0.08, tilt: 2, gladL: 1, wingR: 104, lean: 6, spark: 1, crest: -6, lookX: 0.6 },
    cheer: { lid: 0, tilt: 0, gladL: 1, gladR: 1, spark: 1, wingL: 128, wingR: 128, crest: -10, gesture: 'cheer', then: 'happy' },
  };
  const POSE_NAMES = Object.keys(POSES);

  /* Spring stiffness and damping per channel: eyelids snap, wings swing with
     a little overshoot, the body leans without hurry. */
  const SPRING = {
    lean: [160, 18], wingL: [150, 13], wingR: [150, 13], lid: [1200, 64], tilt: [300, 30],
    gladL: [260, 30], gladR: [260, 30], spark: [170, 17], lookX: [260, 27], lookY: [260, 27],
    crest: [200, 11], beak: [900, 48],
  };

  const reduce = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const fmt = (v) => (Math.round(v * 100) / 100).toString();
  const norm = (deg) => ((deg % 360) + 540) % 360 - 180;      // -180 … 180

  class Rig {
    constructor(svg) {
      this.svg = svg;
      const q = (sel) => svg.querySelector(sel);
      this.part = {
        all: q('.pk-all'), shadow: q('.pk-shadow'), crest: q('.pk-crest'), face: q('.pk-face'),
        wingL: q('.pk-wing-l'), wingR: q('.pk-wing-r'), beak: q('.pk-beak-low'),
        eyeL: q('.pk-eye-l'), eyeR: q('.pk-eye-r'), gladL: q('.pk-glad-l'), gladR: q('.pk-glad-r'),
        pupils: svg.querySelectorAll('.pk-pupil'), lidL: q('.pk-eye-l .pk-lid'), lidR: q('.pk-eye-r .pk-lid'),
        spark: q('.pk-spark'),
      };
      this.x = {};
      this.v = {};
      this.goal = {};
      Object.keys(SPRING).forEach((k) => { this.x[k] = 0; this.v[k] = 0; this.goal[k] = 0; });
      this.look = [0, 0];              // where the page wants him to look, -1..1
      this.pointing = null;            // 'L' or 'R' while a wing points
      this.lookAway = null;            // an idle glance: [x, y, until]
      this.gestures = [];              // { name, start, end }
      this.talkUntil = 0;
      this.blinkUntil = 0;
      this.next = {};                  // when each idle habit happens next
      this.now = 0;
      this.drawn = new Map();
      this.visible = true;
      this.name = 'idle';
      this.pose('idle', true);
      Object.keys(this.x).forEach((k) => { this.x[k] = this.goal[k]; });
      this.x.lidL = this.x.lidR = this.goal.lid;
      this.v.lidL = this.v.lidR = 0;
      if (global.IntersectionObserver) {
        this.io = new IntersectionObserver((entries) => {
          this.visible = entries[entries.length - 1].isIntersecting;
          if (this.visible) wake();
        });
        this.io.observe(svg);
      }
    }

    pose(name, quiet) {
      let spec = Object.assign({}, BASE, POSES[name] || {});
      // Without motion a gesture has nothing to show: take the pose it ends in.
      if (reduce.matches && spec.then) spec = Object.assign({}, BASE, POSES[spec.then], { gesture: null, then: null });
      this.name = POSES[name] ? name : 'idle';
      this.svg.setAttribute('data-pose', this.name);
      ['lean', 'wingL', 'wingR', 'lid', 'tilt', 'gladL', 'gladR', 'spark', 'crest'].forEach((k) => { this.goal[k] = spec[k]; });
      this.baseLook = [spec.lookX, spec.lookY];
      this.after = spec.then || null;
      if (this.name !== 'point') this.pointing = null;
      this.gestures = this.gestures.filter((g) => g.name === 'hop');
      if (spec.gesture) this.gesture(spec.gesture);
      if (!quiet) wake();
    }

    gesture(name, seconds) {
      if (reduce.matches) return;
      const t = this.now;
      const span = { wave: 2.3, cheer: 1.9, talk: seconds || 1.6, nod: 0.9, hop: 0.46, caw: 0.5 }[name] || 1;
      if (name === 'talk') this.talkUntil = t + span;
      if (name === 'cheer') [0, 0.5, 1.0].forEach((d) => this.gestures.push({ name: 'hop', start: t + d, end: t + d + 0.46 }));
      this.gestures.push({ name, start: t, end: t + span });
      wake();
    }

    /* Points at a screen direction (degrees, 0 to the right, 90 down) with
       the wing on that side, leans a touch towards it, and looks. */
    point(angle) {
      const a = norm(Number(angle) || 0);
      const rad = a * Math.PI / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      this.look = [clamp(dx, -1, 1), clamp(dy, -1, 1)];
      if (this.name === 'point') {
        this.pointing = dx >= 0 ? 'R' : 'L';
        if (this.pointing === 'R') {
          this.goal.wingR = clamp(REST_R - a, 20, 170);
          this.goal.wingL = 0;
        } else {
          this.goal.wingL = clamp((a + 360) % 360 - REST_L, 20, 170);
          this.goal.wingR = 0;
        }
        this.goal.lean = clamp(dx * 5, -5, 5);
      }
      wake();
    }

    setLook(dx, dy) {
      this.look = [clamp(Number(dx) || 0, -1, 1), clamp(Number(dy) || 0, -1, 1)];
      wake();
    }

    /* A tap: a little hop, a caw, a glad blink. */
    react() {
      this.gesture('hop');
      this.gesture('caw');
      this.gladUntil = this.now + 0.7;
      wake();
    }

    /* Advances everything by dt seconds. Returns 0 once he holds still
       (reduced motion), 1 while only his idle life goes on (breathing, the
       odd blink), 2 while a gesture or a change of pose plays. */
    step(dt, t) {
      this.now = t;
      const still = reduce.matches;
      const off = { lean: 0, wingL: 0, wingR: 0, crest: 0, hop: 0, squash: 0, beak: 0, faceY: 0 };
      const goal = Object.assign({}, this.goal);

      // Gestures, each a curve over its own span. One that ends may hand
      // over to a resting pose (a wave to idle, a cheer to happy).
      let settle = null;
      this.gestures = this.gestures.filter((g) => {
        if (t < g.start) return true;
        const u = (t - g.start) / (g.end - g.start);
        if (u >= 1) {
          if ((g.name === 'wave' || g.name === 'cheer') && this.after) settle = this.after;
          return false;
        }
        if (still) return true;
        const env = Math.sin(Math.PI * Math.min(1, u * 1.15));
        const local = t - g.start;
        if (g.name === 'wave') off.wingR += 20 * Math.sin(local * 2 * Math.PI * 1.8) * env;
        if (g.name === 'cheer') {
          const beat = 16 * Math.sin(local * 2 * Math.PI * 4.2) * env;
          off.wingL += beat;
          off.wingR += beat;
        }
        if (g.name === 'nod') off.faceY += 1.8 * Math.sin(local * 2 * Math.PI * 2.2) * env;
        if (g.name === 'caw') { off.beak = Math.max(off.beak, Math.sin(Math.PI * u)); off.crest -= 14 * Math.sin(Math.PI * u); }
        if (g.name === 'hop') {
          off.hop -= 9 * 4 * u * (1 - u);                                  // a parabola, up and down
          off.squash += u < 0.12 ? -0.07 * (u / 0.12) : u > 0.82 ? 0.08 * Math.sin(Math.PI * (u - 0.82) / 0.18) : 0.04;
          off.crest += 10 * Math.sin(Math.PI * u);
        }
        return true;
      });
      if (settle && this.name !== settle) {
        this.pose(settle, true);
        Object.assign(goal, this.goal);
      }

      if (!still) {
        // Talking: syllables, never quite the same twice, and the free wing
        // (or both) moving the way hands do when someone explains.
        if (t < this.talkUntil) {
          const s = Math.abs(Math.sin(t * 13.1) * 0.7 + Math.sin(t * 7.3 + 1.7) * 0.4);
          off.beak = Math.max(off.beak, clamp(s, 0, 1) * 0.85);
          off.faceY += 0.5 * Math.sin(t * 6.5);
          const fade = clamp((this.talkUntil - t) * 2, 0, 1);
          if (this.pointing !== 'L' && this.name !== 'think') off.wingL += (20 + 16 * Math.sin(t * 2.3)) * Math.max(0, Math.sin(t * 3.4)) * fade;
          if (this.pointing !== 'R' && this.name !== 'think') off.wingR += (18 + 14 * Math.sin(t * 1.9 + 1)) * Math.max(0, Math.sin(t * 2.9 + 2)) * fade;
        }
        // Breathing, a sway, and the habits of an idle crow.
        off.squash += 0.012 * Math.sin(t * 2 * Math.PI / 3.3);
        off.lean += 0.9 * Math.sin(t * 2 * Math.PI / 5.7);
        this.idleHabits(t, goal, off);
      }
      if (this.gladUntil && t < this.gladUntil) { goal.gladL = 1; goal.gladR = 1; }
      const blinking = t < this.blinkUntil;
      goal.lidL = blinking && goal.gladL < 0.5 ? 1 : goal.lid;
      goal.lidR = blinking && goal.gladR < 0.5 ? 1 : goal.lid;
      const glance = this.lookAway && t < this.lookAway[2] ? this.lookAway : null;
      goal.lookX = glance ? glance[0] : clamp(this.baseLook[0] + this.look[0] * 0.9, -1, 1);
      goal.lookY = glance ? glance[1] : clamp(this.baseLook[1] + this.look[1] * 0.9, -1, 1);
      goal.beak = off.beak;

      let moving = false;
      const channels = Object.keys(SPRING).concat(['lidL', 'lidR']);
      for (const k of channels) {
        if (k === 'lid') continue;
        const target = (goal[k] || 0) + (off[k] || 0);
        if (this.x[k] === undefined) { this.x[k] = target; this.v[k] = 0; }
        if (still) { this.x[k] = target; this.v[k] = 0; continue; }
        const [stiff, damp] = SPRING[k] || SPRING.lid;
        this.v[k] += (stiff * (target - this.x[k]) - damp * this.v[k]) * dt;
        this.x[k] += this.v[k] * dt;
        if (Math.abs(this.v[k]) > 0.01 || Math.abs(target - this.x[k]) > 0.01) moving = true;
      }
      this.hop = off.hop;
      this.squash = off.squash;
      this.faceY = off.faceY;
      if (still) return moving ? 2 : 0;
      const lively = this.gestures.length > 0 || t < this.talkUntil || t < this.blinkUntil + 0.15 ||
        channels.some((k) => Math.abs(this.v[k] || 0) > (k === 'crest' || k === 'lean' ? 6 : 0.6));
      return lively ? 2 : 1;
    }

    idleHabits(t, goal, off) {
      const due = (key, lo, hi) => {
        if (this.next[key] === undefined) this.next[key] = t + rand(lo, hi);
        if (t < this.next[key]) return false;
        this.next[key] = t + rand(lo, hi);
        return true;
      };
      if (due('blink', 2.4, 5.8)) this.blinkUntil = t + 0.12;
      if (this.name === 'idle' || this.name === 'happy') {
        if (due('glance', 3.5, 8)) this.lookAway = [rand(-1, 1), rand(-0.6, 0.6), t + rand(0.7, 1.4)];
        if (due('bob', 4.5, 9)) this.gestures.push({ name: 'nod', start: t, end: t + 0.55 });
        if (due('ruffle', 6, 12)) this.v.crest -= 90;
      }
    }

    render() {
      const x = this.x;
      const set = (node, attr, value) => {
        let seen = this.drawn.get(node);
        if (!seen) this.drawn.set(node, (seen = {}));
        if (seen[attr] === value) return;
        seen[attr] = value;
        node.setAttribute(attr, value);
      };
      const [fx, fy] = PIVOT.feet;
      const sy = 1 + (this.squash || 0);
      const sx = 1 - (this.squash || 0) * 0.6;
      set(this.part.all, 'transform', 'translate(' + fx + ' ' + fmt(fy + (this.hop || 0)) + ') rotate(' + fmt(x.lean) + ') scale(' +
        fmt(sx) + ' ' + fmt(sy) + ') translate(' + -fx + ' ' + -fy + ')');
      set(this.part.shadow, 'transform', 'translate(60 111) scale(' + fmt(1 + (this.hop || 0) / 40) + ' 1) translate(-60 -111)');
      set(this.part.face, 'transform', 'translate(0 ' + fmt(this.faceY || 0) + ')');
      set(this.part.crest, 'transform', 'rotate(' + fmt(x.crest) + ' ' + PIVOT.crest.join(' ') + ')');
      set(this.part.wingL, 'transform', 'rotate(' + fmt(x.wingL) + ' ' + PIVOT.wingL.join(' ') + ')');
      set(this.part.wingR, 'transform', 'rotate(' + fmt(-x.wingR) + ' ' + PIVOT.wingR.join(' ') + ')');
      set(this.part.beak, 'transform', 'translate(0 ' + fmt(clamp(x.beak, 0, 1) * 3.6) + ')');
      const look = 'translate(' + fmt(x.lookX * 2.6) + ' ' + fmt(x.lookY * 2.2) + ')';
      this.part.pupils.forEach((p) => set(p, 'transform', look));
      // Lids come down from the top of each eye; tilt slants them towards the beak.
      set(this.part.lidL, 'height', fmt(0.6 + clamp(x.lidL, 0, 1) * 14.2));
      set(this.part.lidR, 'height', fmt(0.6 + clamp(x.lidR, 0, 1) * 14.2));
      set(this.part.lidL, 'transform', 'rotate(' + fmt(x.tilt) + ' ' + PIVOT.eyeL.join(' ') + ')');
      set(this.part.lidR, 'transform', 'rotate(' + fmt(-x.tilt) + ' ' + PIVOT.eyeR.join(' ') + ')');
      const gl = clamp(x.gladL, 0, 1);
      const gr = clamp(x.gladR, 0, 1);
      set(this.part.eyeL, 'opacity', fmt(1 - gl));
      set(this.part.gladL, 'opacity', fmt(gl));
      set(this.part.eyeR, 'opacity', fmt(1 - gr));
      set(this.part.gladR, 'opacity', fmt(gr));
      const spark = clamp(x.spark, 0, 1.2);
      set(this.part.spark, 'opacity', fmt(Math.min(1, spark)));
      set(this.part.spark, 'transform', 'translate(100 17.5) rotate(' + fmt(this.now * 40 % 360) + ') scale(' + fmt(0.4 + spark * 0.6) + ') translate(-100 -17.5)');
    }
  }

  /* ── One loop for every Pico ── */
  const rigs = new Set();
  const bySvg = new WeakMap();
  let frame = 0;
  let lazy = 0;
  let last = 0;

  function wake() {
    clearTimeout(lazy);
    lazy = 0;
    if (frame) return;
    last = 0;
    frame = global.requestAnimationFrame(tick);
  }

  function tick(now) {
    frame = 0;
    const dt = last ? Math.min(1 / 30, Math.max(0, (now - last) / 1000)) : 1 / 60;
    last = now;
    let busy = 0;
    for (const rig of rigs) {
      if (!rig.svg.isConnected) { rigs.delete(rig); if (rig.io) rig.io.disconnect(); continue; }
      if (document.hidden || !rig.visible) continue;
      busy = Math.max(busy, rig.step(dt, now / 1000));
      rig.render();
    }
    // Full rate while something plays; about fifteen frames a second while
    // he only breathes, which nobody can tell apart and a battery can; and
    // asleep until something changes when nothing moves at all (a pose, a
    // look, one coming into view, the page coming back wake the loop).
    if (busy === 2) frame = global.requestAnimationFrame(tick);
    else if (busy === 1) lazy = setTimeout(() => { lazy = 0; frame = global.requestAnimationFrame(tick); }, 55);
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && rigs.size) wake(); });

  const rigIn = (host) => {
    const svg = host && host.querySelector && host.querySelector('.pico');
    return svg ? bySvg.get(svg) || null : null;
  };

  /* Draws Pico into host and brings him to life. */
  function mount(host, pose) {
    if (!host) return null;
    host.innerHTML = MARKUP;
    const svg = host.querySelector('.pico');
    const rig = new Rig(svg);
    bySvg.set(svg, rig);
    rigs.add(rig);
    rig.now = performance.now() / 1000;
    rig.pose(POSES[pose] ? pose : 'idle');
    rig.render();
    wake();
    return rig;
  }

  function unmount(host) {
    const rig = rigIn(host);
    if (rig) { rigs.delete(rig); if (rig.io) rig.io.disconnect(); }
    if (host) host.innerHTML = '';
  }

  const withRig = (fn) => (host, ...args) => {
    const rig = rigIn(host);
    if (rig) fn(rig, ...args);
  };

  global.Pico = {
    POSES: POSE_NAMES,
    svg: (pose) => MARKUP.replace('data-pose="idle"', 'data-pose="' + (POSES[pose] ? pose : 'idle') + '"'),
    mount: mount,
    unmount: unmount,
    pose: withRig((rig, name) => rig.pose(name)),
    look: withRig((rig, dx, dy) => rig.setLook(dx, dy)),
    point: withRig((rig, angle) => rig.point(angle)),
    say: withRig((rig, ms) => rig.gesture('talk', Math.max(0.3, (Number(ms) || 1200) / 1000))),
    gesture: withRig((rig, name) => rig.gesture(name)),
    react: withRig((rig) => rig.react()),
  };
})(window);
