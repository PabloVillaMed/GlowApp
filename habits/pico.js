/* Pico — GlowApp's guide. A crow, because crows collect shiny things and
   nothing in GlowApp shines like a streak.

   2.15 drew him facing us again, but kept 2.14's restraint: one solid colour,
   a negative-space line for a chest feather, an amber beak as the only
   accent, and eyes that carry the expression. His wings are his hands: he
   points with the one on the target's side, gestures while he talks, lifts
   one to his chin to think, waves, cheers, and winks. 2.16 grew them into
   his body (see WING_L below). 2.17 cheered him up: his own purple instead
   of the palette's grey ink (styles.css), open eyes with a glint of light,
   and cheeks that rise into a quiet smile — through 2.16 his resting face,
   heavy lids slanted towards the beak, read as cross or bored.

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

  /* 2.16: the wings grow out of the body. Each one's shoulder lies well
     inside the silhouette, so a raised wing comes out of him rather than
     floating beside him, and there is no outline: the only line is the
     crease along the wing's inner edge, drawn over the body alone (clipped
     to it), which shows the folded wing and vanishes once it is lifted.
     His face is drawn over the wings, so a wing raised beside his head
     passes behind an eye and never across it. */
  const BODY = 'M60 20 C80 20 90 37 90 59 C90 85 78 103 60 103 C42 103 30 85 30 59 C30 37 40 20 60 20 Z';
  const WING_L = 'M47 52 C38 53 29 62 26 78 C24.5 86 25.5 93 28.5 97 C32.5 97.5 37 93.5 40 87 C44 79 47.5 69 48.5 60 Z';
  const WING_R = 'M73 52 C82 53 91 62 94 78 C95.5 86 94.5 93 91.5 97 C87.5 97.5 83 93.5 80 87 C76 79 72.5 69 71.5 60 Z';
  const CREASE_L = 'M46.6 70 C45 77 43 82 40 87 C37 93.5 32.5 97.5 28.5 97';
  const CREASE_R = 'M73.4 70 C75 77 77 82 80 87 C83 93.5 87.5 97.5 91.5 97';
  /* A smiling cheek under the eye centred at x (2.17): his own colour, its
     top edge arched, so as it rises it turns the eye into a smiling one.
     At rest it sits just below the eye, unseen against his body. */
  const CHEEK = (x) => 'M' + (x - 8.5) + ' 47 Q' + x + ' 41 ' + (x + 8.5) + ' 47 L' + (x + 8.5) + ' 55 L' + (x - 8.5) + ' 55 Z';
  const CHEEK_DROP = 9;                // how far below the eye a cheek rests

  /* ── His wardrobe (2.24) ──
     Hats, each in his own flat way: no outline, a colour or two and one
     detail. Each sits on the top of his head (the top of the silhouette is
     y 20) and reaches no lower than about y 31, well clear of his eyes,
     whose whites start at y 38; nothing goes above y 1, the top of the box
     he peeks from. A hat is a layer of its own at the end of .pk-all, so it
     leans, hops and squashes with him, and two springs of its own (hatY,
     hatRot) give it a little weight: it settles when put on, its brim tips
     when he waves, it bounces gently when he cheers. His crest folds away
     under it. Without a hat he is drawn exactly as before: no layer, no
     extra springs. Colours are in styles.css (.pk-hat-*), for each theme. */
  const q2 = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  const r2 = (v) => Math.round(v * 100) / 100;
  // The beanie's ribs: short lines down its cuff, which runs between two
  // curves from x 40.6 to 79.4 (top 23.4 at the ends, 20.2 at the middle).
  const RIBS = [44.6, 49.6, 54.8, 60, 65.2, 70.4, 75.4].map((x) => {
    const u = (x - 40.4) / 39.2;
    const sag = 6.4 * u * (1 - u);
    return 'M' + x + ' ' + r2(23.4 - sag + 1.2) + ' V' + r2(29.2 - sag - 1.2);
  }).join(' ');
  // The vueltiao's pinta: a zigzag along the front of its brim, kept inside
  // it however thin the brim gets towards the ends.
  const PINTA = (() => {
    let d = '';
    for (let i = 0; i <= 20; i++) {
      const t = 0.07 + 0.86 * i / 20;
      const up = q2(28, 21, 28, t);
      const low = q2(28, 34.5, 28, t);
      const y = i % 2 ? up + (low - up) * 0.36 : low - (low - up) * 0.3;
      d += (i ? ' L' : 'M') + r2(q2(27, 60, 93, t)) + ' ' + r2(y);
    }
    return d;
  })();
  const HATS = {
    // Free from the start.
    beanie:
      '<path class="pk-hat-a" d="M42.4 24.6 C42 14.5 50 8.8 60 8.8 C70 8.8 78 14.5 77.6 24.6 Z"/>' +
      '<path class="pk-hat-b" d="M40.6 23.4 Q60 20.2 79.4 23.4 L79.8 29.2 Q60 26 40.2 29.2 Z"/>' +
      '<path class="pk-hat-ink" d="' + RIBS + '"/>' +
      '<circle class="pk-hat-c" cx="60" cy="8.2" r="4.3"/>',
    birthday:
      '<g transform="rotate(-10 60 26)">' +
        '<path class="pk-hat-a" d="M47.6 25.4 Q60 28.4 72.4 25.4 L60 4.6 Z"/>' +
        '<circle class="pk-hat-c" cx="55.5" cy="21" r="1.5"/>' +
        '<circle class="pk-hat-c" cx="64" cy="17" r="1.35"/>' +
        '<circle class="pk-hat-c" cx="58.6" cy="11.6" r="1.15"/>' +
        '<circle class="pk-hat-c" cx="65.4" cy="23" r="1.2"/>' +
        '<circle class="pk-hat-c" cx="60" cy="4.4" r="3.2"/>' +
      '</g>',
    // Earned with an achievement.
    explorer:
      '<path class="pk-hat-c" d="M33 27.6 Q60 21.6 87 27.6 Q60 31.6 33 27.6 Z"/>' +
      '<path class="pk-hat-a" d="M42 25.4 C42 13.5 50 8.4 60 8.4 C70 8.4 78 13.5 78 25.4 Z"/>' +
      '<path class="pk-hat-b" d="M42.1 21.2 Q60 18.9 77.9 21.2 L78 24.6 Q60 22.3 42 24.6 Z"/>' +
      '<circle class="pk-hat-b" cx="60" cy="8.9" r="1.6"/>',
    // Inspired by the sombrero vueltiao: cream with black bands and a pinta.
    vueltiao:
      '<path class="pk-hat-a" d="M27 28 Q60 21 93 28 Q60 34.5 27 28 Z"/>' +
      '<path class="pk-hat-a" d="M45 25.5 L46.5 12 Q60 9.5 73.5 12 L75 25.5 Z"/>' +
      '<path class="pk-hat-b" d="M45.5 21 L74.5 21 L74.28 19 L45.72 19 Z"/>' +
      '<path class="pk-hat-b" d="M46.11 15.5 L73.89 15.5 L73.72 14 L46.28 14 Z"/>' +
      '<path class="pk-hat-ink" d="' + PINTA + '"/>',
    // GlowApp Plus.
    witch:
      '<path class="pk-hat-c" d="M30 27.5 Q60 21 90 27.5 Q60 32 30 27.5 Z"/>' +
      '<path class="pk-hat-a" d="M46 25.5 C48.5 17 52 9 57.5 4.5 Q63 1.5 68.5 4.8 Q63.5 6 62.5 10.5 C65 17 70 22 74 25.5 Z"/>' +
      '<path class="pk-hat-b" d="M47.3 21.7 Q60 20.4 70 21.7 L73.5 25.2 Q60 23.8 46.3 25.2 Z"/>',
    santa:
      '<path class="pk-hat-a" d="M42.6 24 C42 14 50 7.5 61 7 C71 6.5 80 10.5 86.5 19 C83.6 18.4 80.6 19.4 78.6 21.3 C76.6 16.6 72 14 67.6 13.8 C72 16.6 75.5 20 77.4 24 Z"/>' +
      '<path class="pk-hat-c" d="M41 23.6 Q60 19.8 79 23.6 Q80.6 26.3 79 29 Q60 25.4 41 29 Q39.4 26.3 41 23.6 Z"/>' +
      '<circle class="pk-hat-c" cx="87" cy="20.6" r="3.6"/>',
    // 2.25: more of them. Free:
    cap:
      '<path class="pk-hat-a" d="M42 25 C42 13.5 50 8.5 60 8.5 C70 8.5 78 13.5 78 25 Z"/>' +
      '<circle class="pk-hat-c" cx="60" cy="16.5" r="2.3"/>' +
      '<circle class="pk-hat-b" cx="60" cy="8.9" r="1.5"/>' +
      '<path class="pk-hat-b" d="M37.5 24.6 Q60 20.8 82.5 24.6 Q81.6 29.6 60 30.2 Q38.4 29.6 37.5 24.6 Z"/>',
    flowers:
      '<path class="pk-hat-ink" d="M40.5 25.5 Q60 16.5 79.5 25.5"/>' +
      '<circle class="pk-hat-a" cx="44.5" cy="23" r="2.7"/><circle class="pk-hat-c" cx="44.5" cy="23" r="1"/>' +
      '<circle class="pk-hat-b" cx="51.6" cy="20.4" r="2.7"/><circle class="pk-hat-c" cx="51.6" cy="20.4" r="1"/>' +
      '<circle class="pk-hat-a" cx="60" cy="19.4" r="3"/><circle class="pk-hat-c" cx="60" cy="19.4" r="1.1"/>' +
      '<circle class="pk-hat-b" cx="68.4" cy="20.4" r="2.7"/><circle class="pk-hat-c" cx="68.4" cy="20.4" r="1"/>' +
      '<circle class="pk-hat-a" cx="75.5" cy="23" r="2.7"/><circle class="pk-hat-c" cx="75.5" cy="23" r="1"/>',
    // Earned:
    beret:
      '<path class="pk-hat-a" d="M40 24 C38 17 50 11 63 11.5 C76 12 84.5 17 80.5 22 C77.5 25.4 70 25 60 25.5 C50 26 42 26.5 40 24 Z"/>' +
      '<path class="pk-hat-b" d="M43.5 24.4 Q60 22 77 23.6 L77 25.8 Q60 24.4 43.5 26.6 Z"/>' +
      '<path class="pk-hat-ink" d="M62.5 11.6 L63.4 8.6"/>',
    graduation:
      '<path class="pk-hat-b" d="M44 18 L44 25 Q60 28.6 76 25 L76 18 Z"/>' +
      '<path class="pk-hat-a" d="M33 15 L60 8.6 L87 15 L60 21.4 Z"/>' +
      '<circle class="pk-hat-c" cx="60" cy="15" r="1.3"/>' +
      '<path class="pk-hat-ink" d="M60 15 L80.5 16.8 L82 24.5"/>' +
      '<path class="pk-hat-c" d="M80.6 24 L83.4 24 L83.8 28.2 L80.2 28.2 Z"/>',
    crown:
      '<path class="pk-hat-a" d="M43 25 L43 15 L49.5 20 L54.5 11 L60 18 L65.5 11 L70.5 20 L77 15 L77 25 Q60 27.6 43 25 Z"/>' +
      '<path class="pk-hat-b" d="M43 22.4 Q60 25 77 22.4 L77 25 Q60 27.6 43 25 Z"/>' +
      '<circle class="pk-hat-c" cx="54.5" cy="11.2" r="1.4"/><circle class="pk-hat-c" cx="65.5" cy="11.2" r="1.4"/>' +
      '<circle class="pk-hat-c" cx="60" cy="21.4" r="1.6"/>',
    // GlowApp Plus:
    tophat:
      '<path class="pk-hat-c" d="M36 26 Q60 21.6 84 26 Q60 30.2 36 26 Z"/>' +
      '<path class="pk-hat-a" d="M45 25 L46 6 Q60 4.6 74 6 L75 25 Z"/>' +
      '<path class="pk-hat-b" d="M45.3 19.6 L74.7 19.6 L74.85 23.4 L45.15 23.4 Z"/>',
    chef:
      '<path class="pk-hat-b" d="M43 18.5 L77 18.5 L77 26 Q60 28.4 43 26 Z"/>' +
      '<path class="pk-hat-a" d="M42.5 20 C37.5 12.5 43.5 5.5 51 8.4 C53.5 3.4 66.5 3.4 69 8.4 C76.5 5.5 82.5 12.5 77.5 20 Z"/>' +
      '<path class="pk-hat-ink" d="M51 20.5 L51 26.6 M60 20.5 L60 27.2 M69 20.5 L69 26.6"/>',
  };
  const HAT_NAMES = Object.keys(HATS);
  const hatLayer = (id) => '<g class="pk-hat" data-hat="' + id + '">' + HATS[id] + '</g>';

  let drawings = 0;                    // gives each drawing's clip path its own id
  const markup = (pose, hat) => {
    const clip = 'pk-body-' + (++drawings);
    const wearing = !!(hat && HATS[hat]);
    return '<svg class="pico" viewBox="0 0 120 120" aria-hidden="true" focusable="false" data-pose="' + pose + '">' +
      '<defs><clipPath id="' + clip + '"><path d="' + BODY + '"/></clipPath></defs>' +
      '<ellipse class="pk-shadow" cx="60" cy="111" rx="22" ry="2.6"/>' +
      '<g class="pk-all">' +
        '<g class="pk-legs" fill="none" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M53 101 L51 109 M46.5 109.5 H55.5"/>' +
          '<path d="M67 101 L69 109 M64.5 109.5 H73.5"/>' +
        '</g>' +
        '<g class="pk-crest"' + (wearing ? ' visibility="hidden"' : '') + '>' +
          '<path class="pk-fill" d="M55 24 C53 16 56 10 61 7 C60 13 61 18 63 23 Z"/>' +
          '<path class="pk-fill" d="M60 23 C62 15 67 12 72 12 C68 16 66 20 66 25 Z"/>' +
        '</g>' +
        '<path class="pk-fill pk-body" d="' + BODY + '"/>' +
        '<path class="pk-cut" d="M53 80 L60 86 L67 80"/>' +
        // The wings before the face: one colour with him, a wing raised past
        // his head would otherwise be drawn over an eye and bite into it.
        '<g class="pk-wing pk-wing-l"><path class="pk-fill" d="' + WING_L + '"/></g>' +
        '<g class="pk-wing pk-wing-r"><path class="pk-fill" d="' + WING_R + '"/></g>' +
        '<g clip-path="url(#' + clip + ')">' +
          '<g class="pk-crease-l"><path class="pk-crease" d="' + CREASE_L + '"/></g>' +
          '<g class="pk-crease-r"><path class="pk-crease" d="' + CREASE_R + '"/></g>' +
        '</g>' +
        '<g class="pk-face">' +
          // Each eye: the white, the pupil with a glint of light in it, a cheek
          // that rises from below when he smiles (2.17), and the lid.
          '<g class="pk-eye pk-eye-l">' +
            '<circle class="pk-white" cx="49" cy="45" r="7"/>' +
            '<circle class="pk-pupil" cx="49.6" cy="45.6" r="3.3"/>' +
            '<circle class="pk-glint" cx="48.3" cy="44.2" r="1.15"/>' +
            '<path class="pk-fill pk-cheek" d="' + CHEEK(49) + '"/>' +
            '<rect class="pk-fill pk-lid" x="40" y="37.6" width="18" height="3"/>' +
          '</g>' +
          '<g class="pk-eye pk-eye-r">' +
            '<circle class="pk-white" cx="71" cy="45" r="7"/>' +
            '<circle class="pk-pupil" cx="70.4" cy="45.6" r="3.3"/>' +
            '<circle class="pk-glint" cx="69.1" cy="44.2" r="1.15"/>' +
            '<path class="pk-fill pk-cheek" d="' + CHEEK(71) + '"/>' +
            '<rect class="pk-fill pk-lid" x="62" y="37.6" width="18" height="3"/>' +
          '</g>' +
          '<path class="pk-glad pk-glad-l" d="M43 46.5 Q49 40 55 46.5"/>' +
          '<path class="pk-glad pk-glad-r" d="M65 46.5 Q71 40 77 46.5"/>' +
          '<path class="pk-beak pk-beak-low" d="M54.5 60 L65.5 60 L60 72.5 Z"/>' +
          '<path class="pk-beak pk-beak-up" d="M50.5 55.5 Q60 52.5 69.5 55.5 L60 68 Z"/>' +
        '</g>' +
        (wearing ? hatLayer(hat) : '') +
      '</g>' +
      '<path class="pk-spark" d="M100 10 L101.7 15.6 L107 17.4 L101.7 19.2 L100 25 L98.3 19.2 L93 17.4 L98.3 15.6 Z"/>' +
    '</svg>';
  };

  /* Where each part turns, in the drawing's own units: the shoulders sit
     inside the body, so the root of a wing never leaves it. */
  const PIVOT = { wingL: [42, 60], wingR: [78, 60], crest: [61, 23], feet: [60, 109], eyeL: [49, 45], eyeR: [71, 45], face: [60, 52], hat: [60, 26] };
  /* The folded wings' directions from the shoulders, in screen degrees. */
  const REST_L = 108;
  const REST_R = 72;
  const MAX_LIFT = 140;

  /* Each pose is a set of targets; anything left out keeps the default.
     Wings are in degrees of lift, outwards and up (negative: across the body).
     lid is how far each eyelid is down; tilt slants the lids (positive: the
     inner corners down, a frown; negative: up, soft); smile raises the
     cheeks under the eyes. Through 2.16 his rest was a little frown with
     heavy lids, and read as cross or bored; since 2.17 it is open, eyes
     bright and a quiet smile, and every pose leans glad rather than stern. */
  const BASE = { lean: 0, wingL: 0, wingR: 0, lid: 0.04, tilt: -2, smile: 0.55, gladL: 0, gladR: 0, spark: 0, lookX: 0, lookY: 0.1, crest: 0 };
  const POSES = {
    idle: {},
    point: { lid: 0.02 },
    wave: { wingR: 118, lid: 0, tilt: -3, smile: 0.75, crest: -6, gesture: 'wave', then: 'idle' },
    talk: { lid: 0.02, gesture: 'talk' },
    think: { wingR: 128, lean: -3, lid: 0.28, tilt: -6, smile: 0.15, lookX: 0.5, lookY: -1, crest: 6 },
    happy: { lid: 0, tilt: 0, smile: 0.9, gladL: 1, gladR: 1, spark: 1, wingL: 18, wingR: 18, crest: -8 },
    // The wink is a gesture (2.18): he arrives with both eyes open and the
    // eye shuts and opens again where you can see it. Through 2.17 the pose
    // simply had it shut, so he turned up already winking.
    wink: { lid: 0, tilt: -2, smile: 0.7, wingR: 104, lean: 6, crest: -6, lookX: 0.6, gesture: 'wink' },
    cheer: { lid: 0, tilt: 0, smile: 0.95, gladL: 1, gladR: 1, spark: 1, wingL: 128, wingR: 128, crest: -10, gesture: 'cheer', then: 'happy' },
    // Peeking over a ledge (2.18): his wings lie out on its edge like hands
    // on a wall; he can wave from there, or be glad.
    peek: { wingL: 68, wingR: 68, lid: 0, tilt: -2, smile: 0.7, crest: -4 },
    peekWave: { wingL: 68, wingR: 122, lid: 0, tilt: -3, smile: 0.8, crest: -6, gesture: 'wave', then: 'peek' },
    peekGlad: { wingL: 68, wingR: 68, lid: 0, tilt: 0, smile: 0.9, gladL: 1, gladR: 1, spark: 1, crest: -8 },
    // Displeased (2.26), when a habit he saw done is unticked: the lids'
    // inner corners down (a frown), no smile, the crest laid back, and a
    // small shake of the head. Disappointed, never angry.
    frown: { lid: 0.24, tilt: 7, smile: 0, lean: -2, crest: 8, lookY: 0.5, wingL: 4, wingR: 4, gesture: 'shake' },
    peekFrown: { wingL: 68, wingR: 68, lid: 0.24, tilt: 7, smile: 0, crest: 8, lookY: 0.4, gesture: 'shake' },
  };
  const POSE_NAMES = Object.keys(POSES);

  /* Spring stiffness and damping per channel: eyelids snap, wings swing with
     a little overshoot, the body leans without hurry. */
  const SPRING = {
    lean: [160, 18], wingL: [150, 13], wingR: [150, 13], lid: [1200, 64], tilt: [300, 30],
    gladL: [260, 30], gladR: [260, 30], spark: [170, 17], lookX: [260, 27], lookY: [260, 27],
    crest: [200, 11], beak: [900, 48], smile: [220, 24],
  };
  /* A hat's own two (2.24), only on a Pico wearing one: a soft spring with
     a little bounce, so it lags a hop a touch and settles after it. */
  const HAT_SPRING = { hatY: [240, 13], hatRot: [210, 12] };
  const CHANNELS = Object.keys(SPRING).concat(['lidL', 'lidR']);
  const CHANNELS_HAT = CHANNELS.concat(Object.keys(HAT_SPRING));

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
        wingL: q('.pk-wing-l'), wingR: q('.pk-wing-r'), creaseL: q('.pk-crease-l'), creaseR: q('.pk-crease-r'), beak: q('.pk-beak-low'),
        eyeL: q('.pk-eye-l'), eyeR: q('.pk-eye-r'), gladL: q('.pk-glad-l'), gladR: q('.pk-glad-r'),
        // The glints move with the pupils, as light caught in them would.
        pupils: svg.querySelectorAll('.pk-pupil, .pk-glint'), lidL: q('.pk-eye-l .pk-lid'), lidR: q('.pk-eye-r .pk-lid'),
        cheekL: q('.pk-eye-l .pk-cheek'), cheekR: q('.pk-eye-r .pk-cheek'),
        spark: q('.pk-spark'),
        hat: q('.pk-hat'),
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
      // Without motion a gesture has nothing to show: take the pose it ends in
      // (a wink holds the eye shut, the still picture of one).
      if (reduce.matches && spec.then) spec = Object.assign({}, BASE, POSES[spec.then], { gesture: null, then: null });
      if (reduce.matches && spec.gesture === 'wink') spec = Object.assign(spec, { gladL: 1, spark: 1, gesture: null });
      this.name = POSES[name] ? name : 'idle';
      this.svg.setAttribute('data-pose', this.name);
      ['lean', 'wingL', 'wingR', 'lid', 'tilt', 'smile', 'gladL', 'gladR', 'spark', 'crest'].forEach((k) => { this.goal[k] = spec[k]; });
      this.baseLook = [spec.lookX, spec.lookY];
      this.after = spec.then || null;
      if (this.name !== 'point') this.pointing = null;
      this.gestures = this.gestures.filter((g) => g.name === 'hop');
      if (spec.gesture) this.gesture(spec.gesture);
      if (!quiet) wake();
    }

    gesture(name, seconds) {
      if (reduce.matches) return;
      // His clock only moves while he is drawn. Back from a hidden page or
      // from off screen it is old, and a gesture timed from it would be over
      // before its first frame (2.16: a wave or a cheer silently skipped).
      const t = this.now = Math.max(this.now, performance.now() / 1000);
      const span = { wave: 2.3, cheer: 1.9, talk: seconds || 1.6, nod: 0.9, hop: 0.46, caw: 0.5, wink: 1.15, run: seconds || 0.75, admire: 1.5, hatDrop: 0.5,
        tip: 1.6, dance: 2.6, bow: 1.5, shrug: 1.2, shake: 1.1 }[name] || 1;
      if (name === 'talk') this.talkUntil = t + span;
      if (name === 'cheer') [0, 0.5, 1.0].forEach((d) => this.gestures.push({ name: 'hop', start: t + d, end: t + d + 0.46 }));
      this.gestures.push({ name, start: t, end: t + span });
      wake();
    }

    /* Points at a screen direction (degrees, 0 to the right, 90 down) with
       the wing on that side, leans a touch towards it, and looks. A wing
       lifts at most MAX_LIFT: any higher and it would swing in over his
       head, where, one colour with him, it would vanish and point at
       nothing (2.16). */
    point(angle) {
      const a = norm(Number(angle) || 0);
      const rad = a * Math.PI / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      this.look = [clamp(dx, -1, 1), clamp(dy, -1, 1)];
      if (this.name === 'point') {
        this.pointing = dx >= 0 ? 'R' : 'L';
        if (this.pointing === 'R') {
          this.goal.wingR = clamp(REST_R - a, 20, MAX_LIFT);
          this.goal.wingL = 0;
        } else {
          this.goal.wingL = clamp((a + 360) % 360 - REST_L, 20, MAX_LIFT);
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

    /* A run (2.21): towards dir (-1 left, 1 right) for seconds. */
    run(dir, seconds) {
      this.runDir = dir < 0 ? -1 : 1;
      this.gesture('run', seconds);
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
      const hat = !!this.part.hat;
      const off = { lean: 0, wingL: 0, wingR: 0, crest: 0, hop: 0, squash: 0, beak: 0, faceY: 0, gladL: 0, smile: 0, spark: 0, lookY: 0, hatY: 0, hatRot: 0 };
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
        if (g.name === 'wink') {
          // A beat with both eyes open, then the left one shuts, holds and
          // opens again; his smile, a tilt of the head, the crest and a
          // spark go with it.
          const shut = clamp((u - 0.18) / 0.12, 0, 1) * clamp((0.72 - u) / 0.12, 0, 1);
          off.gladL += shut;
          off.smile += 0.25 * shut;
          off.spark += shut;
          off.crest -= 8 * shut;
          off.lean += 3 * shut;
          off.faceY -= 0.8 * shut;
        }
        if (g.name === 'caw') { off.beak = Math.max(off.beak, Math.sin(Math.PI * u)); off.crest -= 14 * Math.sin(Math.PI * u); }
        if (g.name === 'run') {
          // Quick low hops, leaning the way he goes, the wings beating in turn.
          off.hop -= 6 * Math.abs(Math.sin(local * Math.PI * 7)) * env;
          off.lean += 9 * (this.runDir || 1) * env;
          off.wingL += 34 * Math.max(0, Math.sin(local * 2 * Math.PI * 3.5)) * env;
          off.wingR += 34 * Math.max(0, Math.sin(local * 2 * Math.PI * 3.5 + Math.PI)) * env;
          off.crest += 8 * env;
        }
        if (g.name === 'hop') {
          off.hop -= 9 * 4 * u * (1 - u);                                  // a parabola, up and down
          off.squash += u < 0.12 ? -0.07 * (u / 0.12) : u > 0.82 ? 0.08 * Math.sin(Math.PI * (u - 0.82) / 0.18) : 0.04;
          off.crest += 10 * Math.sin(Math.PI * u);
        }
        // 2.25's gestures, from the wardrobe. Tipping his hat: a wing up to
        // its brim, the hat lifted and tilted at the top of it, then back
        // (with no hat, the wing and a small nod: a greeting all the same).
        if (g.name === 'tip') {
          const lift = Math.sin(Math.PI * clamp(u / 0.85, 0, 1));
          off.wingR += 95 * lift;
          off.smile += 0.2 * lift;
          if (hat) { off.hatY -= 6 * lift; off.hatRot += 14 * lift; } else off.faceY += 1.2 * lift;
        }
        // Dancing: a sway from side to side on the beat, wings up in turn,
        // small bounces; the hat sways the other way, a touch behind.
        if (g.name === 'dance') {
          const beat = Math.sin(local * 2 * Math.PI * 2);
          off.lean += 9 * beat * env;
          off.wingL += (25 + 20 * Math.max(0, beat)) * env;
          off.wingR += (25 + 20 * Math.max(0, -beat)) * env;
          off.hop -= 3.5 * Math.abs(beat) * env;
          off.smile += 0.25 * env;
          off.crest += 6 * beat * env;
          if (hat) off.hatRot -= 5 * beat * env;
        }
        // A bow: down and up again, the head dipping, wings a little open.
        if (g.name === 'bow') {
          const dip = Math.sin(Math.PI * u);
          off.squash -= 0.07 * dip;
          off.faceY += 2.2 * dip;
          off.wingL += 35 * dip;
          off.wingR += 35 * dip;
          if (hat) { off.hatY += 1.6 * dip; off.hatRot += 6 * dip; }
        }
        // A shrug ("no sé"): both wings up a little, a glance up, a tilt.
        if (g.name === 'shrug') {
          const s = Math.sin(Math.PI * clamp(u / 0.8, 0, 1));
          off.wingL += 38 * s;
          off.wingR += 38 * s;
          off.lean += 3 * Math.sin(local * 2 * Math.PI * 1.2) * env;
          off.lookY -= 0.4 * s;
          if (hat) off.hatRot -= 4 * s;
        }
        // Shaking his head (2.26, with the frown): side to side, three
        // times, fading; the crest a beat behind, a hat the other way.
        if (g.name === 'shake') {
          const side = Math.sin(local * 2 * Math.PI * 2.7);
          off.lean += 5 * side * env;
          off.crest += 3 * Math.sin(local * 2 * Math.PI * 2.7 - 1) * env;
          if (hat) off.hatRot -= 3 * side * env;
        }
        // Looking up at a hat he is trying on (2.24): eyes up, a glad face,
        // and the hat turned a touch this way and that, to see it.
        if (g.name === 'admire') {
          off.lookY -= 1.15 * env;
          off.smile += 0.2 * env;
          if (hat) off.hatRot += 4 * Math.sin(local * 2 * Math.PI * 1.4) * env;
        }
        if (hat) {
          // The hat's weight: it floats a little at the top of a hop and lands
          // just after him (a cheer's three hops bounce it gently); his wave
          // tips its brim; running, the air pushes it back.
          if (g.name === 'hop') off.hatY -= 2.8 * Math.sin(Math.PI * clamp((u - 0.15) / 0.85, 0, 1));
          // Tried on: lowered onto his head over half a second, landing with
          // the spring's own small bounce.
          if (g.name === 'hatDrop') off.hatY -= 12 * (1 - u) * (1 - u);
          if (g.name === 'wave') { off.hatRot += 9 * env; off.hatY -= 1.2 * env; }
          if (g.name === 'run') off.hatRot -= 6 * (this.runDir || 1) * env;
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
      // No idle glance while he looks up at a hat (2.24).
      const glance = this.lookAway && t < this.lookAway[2] &&
        !this.gestures.some((g) => g.name === 'admire' && t >= g.start) ? this.lookAway : null;
      goal.lookX = glance ? glance[0] : clamp(this.baseLook[0] + this.look[0] * 0.9, -1, 1);
      goal.lookY = glance ? glance[1] : clamp(this.baseLook[1] + this.look[1] * 0.9, -1, 1);
      goal.beak = off.beak;

      // The springs move in steps of at most 1/120 s, however long the frame.
      // Taken in one step of 1/30 s (a slow phone, the emulator, or his
      // fifteen frames a second at rest) the stiff ones — the eyelids and
      // the beak — swung wider on every frame instead of settling, and his
      // eyes flickered shut and open many times a second (found in 2.19).
      const steps = Math.max(1, Math.ceil(dt * 120 - 1e-9));
      const h = dt / steps;
      let moving = false;
      const channels = hat ? CHANNELS_HAT : CHANNELS;
      for (const k of channels) {
        if (k === 'lid') continue;
        const target = (goal[k] || 0) + (off[k] || 0);
        if (this.x[k] === undefined) { this.x[k] = target; this.v[k] = 0; }
        if (still) { this.x[k] = target; this.v[k] = 0; continue; }
        const [stiff, damp] = SPRING[k] || HAT_SPRING[k] || SPRING.lid;
        for (let i = 0; i < steps; i++) {
          this.v[k] += (stiff * (target - this.x[k]) - damp * this.v[k]) * h;
          this.x[k] += this.v[k] * h;
        }
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
        // A crest under a hat (2.24) cannot be seen ruffling: no frames for it.
        if (due('ruffle', 6, 12) && !this.part.hat) this.v.crest -= 90;
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
      const wingL = 'rotate(' + fmt(x.wingL) + ' ' + PIVOT.wingL.join(' ') + ')';
      const wingR = 'rotate(' + fmt(-x.wingR) + ' ' + PIVOT.wingR.join(' ') + ')';
      set(this.part.wingL, 'transform', wingL);
      set(this.part.wingR, 'transform', wingR);
      set(this.part.creaseL, 'transform', wingL);
      set(this.part.creaseR, 'transform', wingR);
      // The crease belongs to a folded wing: it fades as the wing lifts, so
      // a raised one leaves no stray line at the shoulder.
      const crease = (lift) => fmt(clamp(1 - (Math.abs(lift) - 22) / 30, 0, 1));
      set(this.part.creaseL, 'opacity', crease(x.wingL));
      set(this.part.creaseR, 'opacity', crease(x.wingR));
      set(this.part.beak, 'transform', 'translate(0 ' + fmt(clamp(x.beak, 0, 1) * 3.6) + ')');
      const look = 'translate(' + fmt(x.lookX * 2.6) + ' ' + fmt(x.lookY * 2.2) + ')';
      this.part.pupils.forEach((p) => set(p, 'transform', look));
      // Lids come down from the top of each eye; tilt slants them towards the beak.
      set(this.part.lidL, 'height', fmt(0.6 + clamp(x.lidL, 0, 1) * 14.2));
      set(this.part.lidR, 'height', fmt(0.6 + clamp(x.lidR, 0, 1) * 14.2));
      // The cheeks rise from below the eyes as he smiles, and give way when
      // he looks down, the way a lower lid follows the eye: a broad smile
      // aimed at something below him would otherwise swallow his pupils.
      const cheek = 'translate(0 ' + fmt((1 - clamp(x.smile, 0, 1)) * CHEEK_DROP + Math.max(0, x.lookY) * 2.2) + ')';
      set(this.part.cheekL, 'transform', cheek);
      set(this.part.cheekR, 'transform', cheek);
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
      if (this.part.hat) {
        set(this.part.hat, 'transform', 'translate(0 ' + fmt(x.hatY || 0) + ') rotate(' + fmt(x.hatRot || 0) + ' ' + PIVOT.hat.join(' ') + ')');
      }
    }

    /* Puts a hat on him, changes it or takes it off (2.24), in place. how:
       'drop' lowers it onto his head from a little above (trying it on),
       'settle' gives it a small jolt to settle from (put on with a hop);
       anything else just has it there. Without motion it is simply there. */
    dress(id, how) {
      const old = this.part.hat;
      const next = id && HATS[id] ? id : null;
      if (!old && !next) return;
      if (old && old.getAttribute('data-hat') === next && !how) return;
      if (old) { old.remove(); this.drawn.delete(old); }
      this.part.hat = null;
      if (next) {
        // Parsed as SVG (the drawings above are well-formed XML), then moved in.
        const doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + hatLayer(next) + '</svg>', 'image/svg+xml');
        this.part.hat = this.part.all.appendChild(document.importNode(doc.documentElement.firstChild, true));
        this.part.crest.setAttribute('visibility', 'hidden');
        this.x.hatY = 0; this.v.hatY = 0; this.x.hatRot = 0; this.v.hatRot = 0;
        if (!reduce.matches && how === 'drop') {
          this.x.hatY = -12;
          this.x.hatRot = Math.random() < 0.5 ? -5 : 5;
          this.gestures = this.gestures.filter((g) => g.name !== 'hatDrop');
          this.gesture('hatDrop');
        } else if (!reduce.matches && how === 'settle') {
          this.v.hatY = -38;
          this.x.hatRot = Math.random() < 0.5 ? -6 : 6;
        }
      } else {
        this.part.crest.removeAttribute('visibility');
        delete this.x.hatY; delete this.v.hatY; delete this.x.hatRot; delete this.v.hatRot;
      }
      this.render();
      wake();
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
      if (!rig.svg.isConnected) { release(rig); continue; }
      if (document.hidden || !rig.visible) continue;
      const b = rig.step(dt, now / 1000);
      busy = Math.max(busy, b === 1 && rig.lively ? 2 : b);   // a lively one breathes at full rate (2.22)
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

  const release = (rig) => {
    rigs.delete(rig);
    if (rig.io) rig.io.disconnect();
  };

  /* The hat every Pico wears (2.24): set by the app from the wardrobe, null
     for none. A Pico can be given his own instead (opts.hat, or hat()), as
     the wardrobe's does to try hats on; wear() leaves those alone. */
  let worn = null;

  /* Draws Pico into host and brings him to life. A Pico already there is
     let go first, rather than left for the loop to find disconnected. */
  function mount(host, pose, opts) {
    if (!host) return null;
    const old = rigIn(host);
    if (old) release(old);
    const own = !!(opts && opts.hat !== undefined);
    host.innerHTML = markup('idle', own ? opts.hat : worn);
    const svg = host.querySelector('.pico');
    const rig = new Rig(svg);
    rig.ownHat = own;
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
    if (rig) release(rig);
    if (host) host.innerHTML = '';
  }

  const withRig = (fn) => (host, ...args) => {
    const rig = rigIn(host);
    if (rig) fn(rig, ...args);
  };

  global.Pico = {
    POSES: POSE_NAMES,
    svg: (pose) => markup(POSES[pose] ? pose : 'idle'),
    mount: mount,
    unmount: unmount,
    pose: withRig((rig, name) => rig.pose(name)),
    look: withRig((rig, dx, dy) => rig.setLook(dx, dy)),
    point: withRig((rig, angle) => rig.point(angle)),
    say: withRig((rig, ms) => rig.gesture('talk', Math.max(0.3, (Number(ms) || 1200) / 1000))),
    gesture: withRig((rig, name) => rig.gesture(name)),
    run: withRig((rig, dir, seconds) => rig.run(dir, seconds)),
    // Every frame even at rest (2.22): for a Pico large and watched, as in the tour.
    lively: withRig((rig, on) => { rig.lively = !!on; wake(); }),
    react: withRig((rig) => rig.react()),
    // His wardrobe (2.24).
    HATS: HAT_NAMES,
    /* The hat for every Pico, those on the page and those to come. Each
       changes in place; one off screen just has it when he is next seen. */
    wear: (id) => {
      const next = id && HATS[id] ? id : null;
      if (next === worn) return;
      worn = next;
      rigs.forEach((rig) => { if (!rig.ownHat && rig.svg.isConnected) rig.dress(worn); });
    },
    worn: () => worn,
    /* This Pico's own hat (the wardrobe's), with how it arrives: 'drop' or
       'settle' (see Rig.dress). */
    hat: withRig((rig, id, how) => { rig.ownHat = true; rig.dress(id, how); }),
    /* A hat alone, as a small picture (the wardrobe's tiles). */
    hatSvg: (id) => (HATS[id]
      ? '<svg class="hat-icon" viewBox="25 0 70 36" aria-hidden="true" focusable="false">' + hatLayer(id) + '</svg>' : ''),
  };
})(window);
