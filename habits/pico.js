/* Pico — GlowApp's guide. A crow, because crows collect shiny things and
   nothing in GlowApp shines like a streak. 2.14 redrew him: a minimal crow
   in profile, one solid colour (the palette's ink: black in light, slate in
   dark) with negative-space lines for the wing, the beak and the tail, a
   calm, slightly lowered eyelid — less cartoon, more character.

   He is rigged rather than animated by CSS keyframes: each part (head, wing,
   eyelid, pupil, beak, tail, body) follows its target on a spring, so every
   change of pose is a movement, never a jump. Gestures (waving, nodding,
   talking, hopping) are layered on top, and while nothing is asked of him
   he lives a little: he breathes, blinks, glances about and bobs his head
   the way crows do. One animation loop serves every Pico on the page and
   sleeps while none is on screen. Under reduced motion he takes each pose at
   once and holds it. */
(function (global) {
  'use strict';

  const MARKUP =
    '<svg class="pico" viewBox="0 0 120 120" aria-hidden="true" focusable="false" data-pose="idle">' +
      '<g class="pk-flip">' +
        '<ellipse class="pk-shadow" cx="58" cy="110.5" rx="21" ry="2.4"/>' +
        '<g class="pk-all">' +
          '<g class="pk-legs" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M55 95 L53 108 M48.5 108.5 H58.5"/>' +
            '<path d="M63 95 L64 108 M60 108.5 H70"/>' +
          '</g>' +
          '<g class="pk-tail">' +
            '<path class="pk-fill" d="M37 80 L9 94 Q4 99 9.5 104 L44 92 Z"/>' +
            '<path class="pk-cut" d="M34 85 L12 99"/>' +
          '</g>' +
          '<path class="pk-fill" d="M63 49 C47 51 35 61 31 77 C29 86 34 94 44 97 C54 100 66 98 73 91 C81 83 83 70 80 57 C78 51 71 48 63 49 Z"/>' +
          '<g class="pk-wing">' +
            '<path class="pk-fill pk-wing-shape" d="M64 58 C52 59 38 70 27 90 C41 86 55 78 66 67 C68 63 67 59 64 58 Z"/>' +
          '</g>' +
          '<g class="pk-head">' +
            '<circle class="pk-fill" cx="73" cy="40" r="15.2"/>' +
            '<path class="pk-fill" d="M84.6 32.8 C95 34 103.5 37.4 111 42.5 L86 44.2 Z"/>' +
            '<path class="pk-fill pk-beak-low" d="M86 44.2 L107.5 43.4 C99.5 47.6 92 48.8 85.4 48.2 Z"/>' +
            '<path class="pk-cut pk-mouth" d="M87.2 44 L105 43.4"/>' +
            '<g class="pk-eye">' +
              '<circle class="pk-white" cx="78" cy="37.5" r="4.3"/>' +
              '<circle class="pk-pupil" cx="79" cy="37.6" r="2.1"/>' +
              '<rect class="pk-fill pk-lid" x="72" y="32.8" width="12" height="3.2"/>' +
            '</g>' +
            '<path class="pk-glad" d="M74.4 38.6 Q78 34.4 81.6 38.6"/>' +
          '</g>' +
        '</g>' +
        '<path class="pk-spark" d="M101 13 L102.6 18.4 L108 20 L102.6 21.6 L101 27 L99.4 21.6 L94 20 L99.4 18.4 Z"/>' +
      '</g>' +
    '</svg>';

  /* Where each part turns, in the drawing's own units. */
  const PIVOT = { head: [70, 52], wing: [64, 59], tail: [38, 86], beak: [86, 44.2], eye: [78, 37.5], feet: [60, 108] };
  const WING_REST = 140;          // the folded wing's direction from the shoulder, in screen degrees

  /* Each pose is a set of targets; anything left out keeps the calm default. */
  const BASE = { head: 0, wing: 0, lid: 0.32, tilt: -12, glad: 0, spark: 0, lookX: 0.35, lookY: 0, tail: 0 };
  const POSES = {
    idle: {},
    point: { lid: 0.16, tilt: -6 },
    wave: { wing: 72, head: 4, lid: 0.22, tilt: -6, gesture: 'wave', then: 'idle' },
    talk: { head: 2, lid: 0.24, tilt: -8, gesture: 'talk' },
    think: { head: -11, lid: 0.42, tilt: 2, lookX: 0.25, lookY: -1 },
    happy: { head: -5, lid: 0, tilt: 0, glad: 1, spark: 1, wing: 10 },
    cheer: { head: -6, lid: 0, tilt: 0, glad: 1, spark: 1, wing: 84, gesture: 'cheer', then: 'happy' },
  };
  const POSE_NAMES = Object.keys(POSES);

  /* Spring stiffness and damping per channel: the eyelid snaps, the wing
     swings with a little overshoot, the turn around is unhurried. */
  const SPRING = {
    head: [190, 19], wing: [150, 14], lid: [1200, 64], tilt: [300, 30], glad: [260, 30], spark: [170, 17],
    lookX: [260, 27], lookY: [260, 27], tail: [180, 12], flip: [300, 34], beak: [900, 48],
  };

  const reduce = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const fmt = (v) => (Math.round(v * 100) / 100).toString();

  class Rig {
    constructor(svg) {
      this.svg = svg;
      this.part = {
        flip: svg.querySelector('.pk-flip'), all: svg.querySelector('.pk-all'), shadow: svg.querySelector('.pk-shadow'),
        head: svg.querySelector('.pk-head'), wing: svg.querySelector('.pk-wing'), tail: svg.querySelector('.pk-tail'),
        beak: svg.querySelector('.pk-beak-low'), mouth: svg.querySelector('.pk-mouth'), eye: svg.querySelector('.pk-eye'),
        pupil: svg.querySelector('.pk-pupil'), lid: svg.querySelector('.pk-lid'), glad: svg.querySelector('.pk-glad'),
        spark: svg.querySelector('.pk-spark'),
      };
      this.x = {};
      this.v = {};
      this.goal = {};
      Object.keys(SPRING).forEach((k) => { this.x[k] = 0; this.v[k] = 0; this.goal[k] = 0; });
      this.x.flip = this.goal.flip = 1;
      this.look = [0, 0];              // where the tour wants him to look, -1..1
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
      ['head', 'wing', 'lid', 'tilt', 'glad', 'spark', 'tail'].forEach((k) => { this.goal[k] = spec[k]; });
      this.baseLook = [spec.lookX, spec.lookY];
      this.after = spec.then || null;
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

    /* Points with his beak and eyes, the way a bird does: he turns to face
       the side the target is on, tilts his head towards it and looks. */
    point(angle) {
      const rad = (Number(angle) || 0) * Math.PI / 180;
      let dx = Math.cos(rad);
      const dy = Math.sin(rad);
      this.goal.flip = dx < -0.2 ? -1 : 1;
      dx = Math.abs(dx);
      const facing = Math.atan2(dy, dx) * 180 / Math.PI;     // -90 up … 90 down, after turning
      if (this.name === 'point') this.goal.head = clamp(facing * 0.42, -26, 20);
      this.look = [clamp(dx, -1, 1), clamp(dy, -1, 1)];
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
      const off = { head: 0, wing: 0, tail: 0, hop: 0, squash: 0, beak: 0, headY: 0 };
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
        if (g.name === 'wave') off.wing += 16 * Math.sin(local * 2 * Math.PI * 1.7) * env;
        if (g.name === 'cheer') off.wing += 18 * Math.sin(local * 2 * Math.PI * 4.2) * env;
        if (g.name === 'nod') off.headY += 2.2 * Math.sin(local * 2 * Math.PI * 2.2) * env;
        if (g.name === 'caw') { off.beak = Math.max(off.beak, Math.sin(Math.PI * u)); off.head -= 7 * Math.sin(Math.PI * u); }
        if (g.name === 'hop') {
          off.hop -= 9 * 4 * u * (1 - u);                                  // a parabola, up and down
          off.squash += u < 0.12 ? -0.07 * (u / 0.12) : u > 0.82 ? 0.08 * Math.sin(Math.PI * (u - 0.82) / 0.18) : 0.04;
        }
        return true;
      });
      if (settle && this.name !== settle) {
        this.pose(settle, true);
        Object.assign(goal, this.goal);
      }

      if (!still) {
        // Talking: syllables, never quite the same twice.
        if (t < this.talkUntil) {
          const s = Math.abs(Math.sin(t * 13.1) * 0.7 + Math.sin(t * 7.3 + 1.7) * 0.4);
          off.beak = Math.max(off.beak, clamp(s, 0, 1) * 0.85);
          off.headY += 0.5 * Math.sin(t * 6.5);
        }
        // Breathing, a sway, and the habits of an idle crow.
        off.squash += 0.012 * Math.sin(t * 2 * Math.PI / 3.3);
        off.head += 1.1 * Math.sin(t * 2 * Math.PI / 5.7);
        this.idleHabits(t, goal, off);
      }
      if (this.gladUntil && t < this.gladUntil) goal.glad = 1;
      goal.lid = t < this.blinkUntil && goal.glad < 0.5 ? 1 : goal.lid;
      const glance = this.lookAway && t < this.lookAway[2] ? this.lookAway : null;
      goal.lookX = glance ? glance[0] : clamp(this.baseLook[0] + this.look[0] * 0.8, -1, 1);
      goal.lookY = glance ? glance[1] : clamp(this.baseLook[1] + this.look[1] * 0.9, -1, 1);
      goal.beak = off.beak;

      let moving = false;
      for (const k of Object.keys(SPRING)) {
        const target = k === 'head' ? goal.head + off.head : k === 'wing' ? goal.wing + off.wing : k === 'tail' ? goal.tail + off.tail : goal[k];
        if (still) { this.x[k] = target; this.v[k] = 0; continue; }
        const [stiff, damp] = SPRING[k];
        this.v[k] += (stiff * (target - this.x[k]) - damp * this.v[k]) * dt;
        this.x[k] += this.v[k] * dt;
        if (Math.abs(this.v[k]) > 0.01 || Math.abs(target - this.x[k]) > 0.01) moving = true;
      }
      this.hop = off.hop;
      this.squash = off.squash;
      this.headY = off.headY;
      if (still) return moving ? 2 : 0;
      const lively = this.gestures.length > 0 || t < this.talkUntil || t < this.blinkUntil + 0.15 ||
        Object.keys(SPRING).some((k) => Math.abs(this.v[k]) > (k === 'head' || k === 'tail' ? 6 : 0.6));
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
        if (due('glance', 3.5, 8)) this.lookAway = [rand(-0.9, 1), rand(-0.6, 0.5), t + rand(0.7, 1.4)];
        if (due('bob', 4.5, 9)) this.gestures.push({ name: 'nod', start: t, end: t + 0.55 });
        if (due('flick', 6, 12)) this.v.tail -= 70;
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
      set(this.part.flip, 'transform', 'translate(60 0) scale(' + fmt(x.flip) + ' 1) translate(-60 0)');
      set(this.part.all, 'transform', 'translate(' + fx + ' ' + fmt(fy + (this.hop || 0)) + ') scale(' + fmt(sx) + ' ' + fmt(sy) + ') translate(' + -fx + ' ' + -fy + ')');
      set(this.part.shadow, 'transform', 'translate(58 110.5) scale(' + fmt(1 + (this.hop || 0) / 40) + ' 1) translate(-58 -110.5)');
      set(this.part.head, 'transform', 'translate(0 ' + fmt(this.headY || 0) + ') rotate(' + fmt(x.head) + ' ' + PIVOT.head.join(' ') + ')');
      set(this.part.wing, 'transform', 'rotate(' + fmt(x.wing) + ' ' + PIVOT.wing.join(' ') + ')');
      set(this.part.tail, 'transform', 'rotate(' + fmt(x.tail) + ' ' + PIVOT.tail.join(' ') + ')');
      set(this.part.beak, 'transform', 'rotate(' + fmt(clamp(x.beak, 0, 1) * 18) + ' ' + PIVOT.beak.join(' ') + ')');
      set(this.part.mouth, 'opacity', fmt(1 - clamp(x.beak * 3, 0, 1)));
      set(this.part.pupil, 'transform', 'translate(' + fmt(x.lookX * 1.5) + ' ' + fmt(x.lookY * 1.3) + ')');
      const lid = clamp(x.lid, 0, 1);
      set(this.part.lid, 'height', fmt(0.4 + lid * 9.4));
      set(this.part.lid, 'transform', 'rotate(' + fmt(x.tilt) + ' ' + PIVOT.eye.join(' ') + ')');
      const glad = clamp(x.glad, 0, 1);
      set(this.part.eye, 'opacity', fmt(1 - glad));
      set(this.part.glad, 'opacity', fmt(glad));
      const spark = clamp(x.spark, 0, 1.2);
      set(this.part.spark, 'opacity', fmt(Math.min(1, spark)));
      set(this.part.spark, 'transform', 'translate(101 20) rotate(' + fmt(this.now * 40 % 360) + ') scale(' + fmt(0.4 + spark * 0.6) + ') translate(-101 -20)');
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
    face: withRig((rig, side) => { rig.goal.flip = side < 0 ? -1 : 1; wake(); }),
  };
})(window);
