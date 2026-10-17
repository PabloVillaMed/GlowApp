/* PicoVoice — Pico's voice (2.19): sounds, never words.

   A crow's calls and a mascot's cheer, synthesised like every other sound in
   GlowApp (sounds.js): nothing is recorded, nothing is loaded. Inspired by
   the bright little chirps and trills of cartoon mascots and by real crows —
   the caw, the clicks they make, a curious hum — and copied from neither.

   The pieces:
     caw     a crow's "kraa": a buzzy source shaped by three resonances
             (formants), with a little rasp and wobble so no two are alike
     chirp   a quick pitch sweep, sometimes with a touch of vibrato
     click   a short knock, like the clicks crows make with their beaks
     hum     a low, soft "hmm"
     ping    a small bright bell, for sparkles
   and what he says with them (say(kind)):
     hello      two rising chirps                     (a wave)
     wink       a quick "bwip" and a sparkle          (a wink)
     cheer      a trill and a happy caw               (the day done)
     caw        a caw, now and then two               (a tap on him)
     curious    a rising chirp and two clicks         (pointing)
     think      "hmm?"                                (thinking)
     nod        two soft notes, "mm-hm"               (a nod)
     achieve    a bright arpeggio and a caw           (a level, a badge)
     excellence a rising fifth and octave, a shimmer  (excellence lit, 2.20)
   and babble(ms): syllables without words, while his beak moves.

   Dry on purpose — no echo or reverb, like the characters' voices — short,
   about as loud as the app's other sounds, and silent whenever the app's
   sounds are off. Every call varies its pitch and timing a little. */
(function (global) {
  'use strict';

  const noiseFor = new WeakMap();      // a buffer of noise per audio context
  const busFor = new WeakMap();        // and his own level in it
  const LEVEL = 1;
  let lastAt = -Infinity;
  let babbleBus = null;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function noise(ctx) {
    let buffer = noiseFor.get(ctx);
    if (!buffer) {
      buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.6), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      // A fixed sequence (the same breath every time), exact in 32 bits.
      let seed = 0x2545f491;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = seed / 0x80000000 - 1;
      }
      noiseFor.set(ctx, buffer);
    }
    return buffer;
  }

  // Everything he says goes through one gain, his level beside the app's
  // other sounds, and straight out: nothing else (no echo, no reverb).
  function master(ctx) {
    let bus = busFor.get(ctx);
    if (!bus) {
      bus = ctx.createGain();
      bus.gain.value = LEVEL;
      bus.connect(ctx.destination);
      busFor.set(ctx, bus);
    }
    return bus;
  }

  // A gain envelope: attack, hold, then an exponential release; no clicks.
  function envelope(param, t, peak, attack, hold, release) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    param.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
    param.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return t + attack + hold + release;
  }

  // Free each node when its source ends.
  const tidy = (source, nodes) => {
    source.onended = () => nodes.forEach((n) => { try { n.disconnect(); } catch (e) { /* gone */ } });
  };

  /* ── The pieces ── */

  function chirp(ctx, out, t, o) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.from, t);
    osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur * 0.85);
    const nodes = [osc, amp];
    if (o.vib) {                                      // a bird's flutter
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = o.vibRate || 34;
      depth.gain.value = o.from * o.vib;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + o.dur + 0.03);
      nodes.push(lfo, depth);
    }
    const end = envelope(amp.gain, t, o.gain, 0.012, o.dur * 0.3, o.dur * 0.7);
    osc.connect(amp).connect(out);
    osc.start(t);
    osc.stop(end + 0.02);
    tidy(osc, nodes);
    if (o.harm) {                                     // a brighter octave above
      chirp(ctx, out, t, { from: o.from * 2, to: o.to * 2, dur: o.dur, gain: o.gain * o.harm, type: 'sine' });
    }
    return end;
  }

  // A crow's caw: a buzzy source (sawtooth) with a pitch that rises a touch
  // and falls, a wobble and a rasp, breath (noise), shaped by three formants.
  function caw(ctx, out, t, o, rnd) {
    const f0 = o.f0;
    const dur = o.dur;
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(f0 * 0.94, t);
    src.frequency.linearRampToValueAtTime(f0 * 1.04, t + dur * 0.22);
    src.frequency.exponentialRampToValueAtTime(f0 * 0.78, t + dur);
    const wobble = ctx.createOscillator();            // jitter: never a pure tone
    const wobbleDepth = ctx.createGain();
    wobble.frequency.value = 17 + rnd() * 9;
    wobbleDepth.gain.value = f0 * 0.025;
    wobble.connect(wobbleDepth).connect(src.frequency);

    const rasp = ctx.createGain();                    // the rasp: a fast tremolo
    const raspLfo = ctx.createOscillator();
    const raspDepth = ctx.createGain();
    rasp.gain.value = 0.7;
    raspLfo.frequency.value = 42 + rnd() * 12;
    raspDepth.gain.value = 0.3;
    raspLfo.connect(raspDepth).connect(rasp.gain);

    const breath = ctx.createBufferSource();          // air through the beak
    breath.buffer = noise(ctx);
    breath.loop = true;
    const breathBand = ctx.createBiquadFilter();
    breathBand.type = 'bandpass';
    breathBand.frequency.value = 2400;
    breathBand.Q.value = 1.2;
    const breathAmp = ctx.createGain();
    breathAmp.gain.value = o.breath || 0.18;

    const sum = ctx.createGain();
    sum.gain.value = 1;
    const nodes = [src, wobble, wobbleDepth, rasp, raspLfo, raspDepth, breath, breathBand, breathAmp, sum];
    // Three resonances, lifted a little for a younger, friendlier crow.
    const lift = o.bright || 1;
    [[880, 5, 1], [1650, 7, 0.75], [2850, 9, 0.38]].forEach(([hz, q, g]) => {
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = hz * lift;
      band.Q.value = q;
      const amp = ctx.createGain();
      amp.gain.value = g;
      rasp.connect(band).connect(amp).connect(sum);
      breathAmp.connect(band);
      nodes.push(band, amp);
    });
    src.connect(rasp);
    breath.connect(breathBand).connect(breathAmp);

    const soft = ctx.createBiquadFilter();            // no harsh top
    soft.type = 'lowpass';
    soft.frequency.value = 5200;
    const amp = ctx.createGain();
    const end = envelope(amp.gain, t, o.gain, 0.012, dur * 0.45, dur * 0.55);
    sum.connect(soft).connect(amp).connect(out);
    nodes.push(soft, amp);
    [src, wobble, raspLfo, breath].forEach((s) => { s.start(t); s.stop(end + 0.03); });
    tidy(src, nodes);
    return end;
  }

  function click(ctx, out, t, o, rnd) {
    const burst = ctx.createBufferSource();
    burst.buffer = noise(ctx);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = o.hz || 3000;
    band.Q.value = 3;
    const amp = ctx.createGain();
    const end = envelope(amp.gain, t, o.gain, 0.001, 0.004, 0.03);
    burst.connect(band).connect(amp).connect(out);
    burst.start(t, rnd() * 0.4);
    burst.stop(end + 0.01);
    tidy(burst, [burst, band, amp]);
    return end;
  }

  function hum(ctx, out, t, o) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(o.from, t);
    osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 1100;
    const amp = ctx.createGain();
    const end = envelope(amp.gain, t, o.gain, 0.03, o.dur * 0.5, o.dur * 0.5);
    osc.connect(warm).connect(amp).connect(out);
    osc.start(t);
    osc.stop(end + 0.02);
    tidy(osc, [osc, warm, amp]);
    return end;
  }

  const ping = (ctx, out, t, o) => chirp(ctx, out, t, { from: o.f, to: o.f * 1.01, dur: o.dur || 0.09, gain: o.gain, type: 'sine' });

  /* ── What he says ── */

  // r(x, a): x varied by up to ±a (a fraction) — never the same twice.
  const PHRASES = {
    hello: (ctx, out, t, r) => {
      chirp(ctx, out, t, { from: r(880, 0.04), to: r(1500, 0.04), dur: 0.09, gain: 0.07, vib: 0.02, harm: 0.2 });
      return chirp(ctx, out, t + r(0.13, 0.08), { from: r(1150, 0.04), to: r(1950, 0.04), dur: 0.12, gain: 0.065, vib: 0.025, harm: 0.25 });
    },
    wink: (ctx, out, t, r) => {
      chirp(ctx, out, t, { from: r(700, 0.05), to: r(1420, 0.04), dur: 0.075, gain: 0.1, type: 'triangle' });
      ping(ctx, out, t + 0.07, { f: r(2640, 0.03), gain: 0.042 });
      return ping(ctx, out, t + 0.13, { f: r(3520, 0.03), gain: 0.034, dur: 0.12 });
    },
    cheer: (ctx, out, t, r, rnd) => {
      const lo = r(1080, 0.03);
      const hi = lo * 1.26;                           // a major third: glad
      let at = t;
      for (let i = 0; i < 6; i++) {
        chirp(ctx, out, at, { from: i % 2 ? hi : lo, to: (i % 2 ? hi : lo) * 1.06, dur: 0.05, gain: 0.1, type: 'sine' });
        at += 0.055;
      }
      return caw(ctx, out, at + 0.04, { f0: r(560, 0.04), dur: 0.2, gain: 0.16, bright: 1.15, breath: 0.12 }, rnd);
    },
    caw: (ctx, out, t, r, rnd) => {
      const end = caw(ctx, out, t, { f0: r(500, 0.06), dur: r(0.27, 0.1), gain: 0.24, bright: 1.08 }, rnd);
      if (rnd() < 0.35) return caw(ctx, out, end + 0.05, { f0: r(470, 0.06), dur: r(0.2, 0.1), gain: 0.2, bright: 1.08 }, rnd);
      return end;
    },
    curious: (ctx, out, t, r, rnd) => {
      chirp(ctx, out, t, { from: r(560, 0.05), to: r(980, 0.05), dur: 0.16, gain: 0.063, vib: 0.04, vibRate: 28 });
      click(ctx, out, t + 0.2, { gain: 0.09 }, rnd);
      return click(ctx, out, t + 0.27, { gain: 0.07, hz: 2600 }, rnd);
    },
    think: (ctx, out, t, r) => {
      const end = hum(ctx, out, t, { from: r(250, 0.04), to: r(300, 0.04), dur: 0.3, gain: 0.075 });
      return chirp(ctx, out, end - 0.05, { from: r(520, 0.04), to: r(760, 0.04), dur: 0.09, gain: 0.045 });
    },
    nod: (ctx, out, t, r) => {
      hum(ctx, out, t, { from: r(430, 0.03), to: r(420, 0.03), dur: 0.09, gain: 0.068 });
      return hum(ctx, out, t + 0.12, { from: r(520, 0.03), to: r(560, 0.03), dur: 0.12, gain: 0.068 });
    },
    excellence: (ctx, out, t, r) => {
      // A small fanfare of excellence (2.20): a rising fifth and octave,
      // warm and unhurried, the last note held with a slow vibrato, then a
      // shimmer. No caw: this one is solemn.
      const g = r(392, 0.02);
      chirp(ctx, out, t, { from: g, to: g * 1.004, dur: 0.14, gain: 0.07, type: 'triangle', harm: 0.15 });
      chirp(ctx, out, t + 0.13, { from: g * 1.5, to: g * 1.506, dur: 0.14, gain: 0.07, type: 'triangle', harm: 0.15 });
      chirp(ctx, out, t + 0.26, { from: g * 2, to: g * 2.006, dur: 0.38, gain: 0.075, type: 'triangle', vib: 0.008, vibRate: 5.5, harm: 0.18 });
      ping(ctx, out, t + 0.52, { f: g * 4, gain: 0.028, dur: 0.2 });
      return ping(ctx, out, t + 0.6, { f: g * 5.04, gain: 0.022, dur: 0.24 });
    },
    achieve: (ctx, out, t, r, rnd) => {
      [1046.5, 1318.5, 1568, 2093].forEach((hz, i) => ping(ctx, out, t + i * 0.07, { f: hz, gain: 0.06, dur: 0.14 }));
      return caw(ctx, out, t + 0.34, { f0: r(580, 0.04), dur: 0.18, gain: 0.19, bright: 1.15, breath: 0.12 }, rnd);
    },
  };
  const KINDS = Object.keys(PHRASES);

  // The audio context to speak in: the app's (sounds.js), only when its
  // sounds are on and the page is in view; or one handed in (tests).
  // Before the first touch an audio context waits, suspended, and a sound
  // scheduled then would come out late, whenever it woke: speak only while
  // it runs, or during the touch that wakes it.
  function context(o) {
    if (o && o.ctx) return o.ctx;
    const S = global.Sounds;
    if (!S || !S.isEnabled() || global.document.hidden) return null;
    const ctx = S.unlock();
    if (!ctx) return null;
    if (ctx.state === 'running') return ctx;
    const touch = global.navigator.userActivation;
    return touch && touch.isActive ? ctx : null;
  }

  function say(kind, o) {
    const phrase = PHRASES[kind];
    const ctx = context(o);
    if (!phrase || !ctx) return false;
    const now = ctx.currentTime;
    if (!(o && o.ctx) && now - lastAt < 0.18) return false;   // never two on top of each other
    lastAt = now;
    const rnd = (o && o.random) || Math.random;
    const r = (x, a) => x * (1 + (rnd() * 2 - 1) * a);
    try {
      const out = (o && o.out) || master(ctx);
      phrase(ctx, out, now + ((o && o.at) || 0.005), r, rnd);
      return true;
    } catch (err) {
      return false;                                   // a sound must never break the app
    }
  }

  // Syllables without words, for ms: short blips on a pentatonic scale, each
  // bending up or down a little, with gaps like speech. hush() stops them.
  function babble(ms, o) {
    const ctx = context(o);
    if (!ctx) return false;
    hush();
    const rnd = (o && o.random) || Math.random;
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect((o && o.out) || master(ctx));
    babbleBus = { bus, ctx };
    const scale = [587, 659, 784, 880, 988, 1175];
    let t = ctx.currentTime + 0.02;
    const end = t + clamp(ms, 200, 6000) / 1000;
    let count = 0;
    while (t < end - 0.05) {
      const f = scale[Math.floor(rnd() * scale.length)] * (0.98 + rnd() * 0.04);
      const len = 0.045 + rnd() * 0.05;
      const bend = rnd() < 0.5 ? 1.12 : 0.9;
      chirp(ctx, bus, t, { from: f, to: f * bend, dur: len, gain: 0.06, type: rnd() < 0.3 ? 'triangle' : 'sine' });
      t += len + 0.03 + rnd() * 0.06;
      if (++count % (4 + Math.floor(rnd() * 3)) === 0) t += 0.12;   // a breath between "words"
    }
    return true;
  }

  function hush() {
    if (!babbleBus) return;
    const { bus, ctx } = babbleBus;
    babbleBus = null;
    try {
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
      bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.04);
      global.setTimeout(() => { try { bus.disconnect(); } catch (e) { /* gone */ } }, 120);
    } catch (err) { /* nothing to stop */ }
  }

  // Out of sight, out of breath.
  global.document.addEventListener('visibilitychange', () => { if (global.document.hidden) hush(); });

  global.PicoVoice = { say: say, babble: babble, hush: hush, KINDS: KINDS };
})(window);
