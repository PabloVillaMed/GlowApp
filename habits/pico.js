/* Pico — GlowApp's guide (2.13). An original crow drawn for this app: crows
   collect shiny things, and nothing in GlowApp shines like a streak. Inline
   SVG rather than an image so CSS can move his parts: the wings wave and
   point, the eyes blink and look where he is pointing, the beak talks.
   Fixed colours, the same in every palette, so he stays himself; a light rim
   keeps his dark feathers readable on the darkest surfaces. */
(function (global) {
  'use strict';

  const MARKUP =
    '<svg class="pico" viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
      '<g class="pico-all">' +
        '<g class="pico-shadow"><ellipse cx="60" cy="113" rx="25" ry="3.6" fill="#000" opacity=".16"/></g>' +
        // Tail fan, behind everything.
        '<path class="pico-tail" d="M50 96 L41 111 Q47 113 52 108 L56 114 Q60 116 64 114 L68 108 Q73 113 79 111 L70 96 Z"' +
          ' fill="#262B66" stroke="#7A84E6" stroke-width="1.2" stroke-linejoin="round"/>' +
        // Feet.
        '<g class="pico-feet" fill="none" stroke="#E7A126" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M51 101 L50 108 M50 108 L45 111 M50 108 L50 112 M50 108 L54 111"/>' +
          '<path d="M69 101 L70 108 M70 108 L65 111 M70 108 L70 112 M70 108 L75 111"/>' +
        '</g>' +
        // Wings sit behind the body and swing from the shoulder.
        '<g class="pico-wing pico-wing-l">' +
          '<path d="M33 58 C19 60 13 76 17 90 C19 95 25 95 28 91 C33 85 37 75 38 66 Z"' +
            ' fill="#2A3072" stroke="#7A84E6" stroke-width="1.4" stroke-linejoin="round"/>' +
          '<path d="M21 84 C24 82 27 79 29 75 M19 77 C22 75 25 72 27 68" fill="none" stroke="#4C55B4" stroke-width="1.6" stroke-linecap="round"/>' +
        '</g>' +
        '<g class="pico-wing pico-wing-r">' +
          '<path d="M87 58 C101 60 107 76 103 90 C101 95 95 95 92 91 C87 85 83 75 82 66 Z"' +
            ' fill="#2A3072" stroke="#7A84E6" stroke-width="1.4" stroke-linejoin="round"/>' +
          '<path d="M99 84 C96 82 93 79 91 75 M101 77 C98 75 95 72 93 68" fill="none" stroke="#4C55B4" stroke-width="1.6" stroke-linecap="round"/>' +
        '</g>' +
        // Head tuft: three feathers that bounce on their own.
        '<g class="pico-tuft" fill="#353C8C" stroke="#7A84E6" stroke-width="1.2" stroke-linejoin="round">' +
          '<path d="M53 22 C49 14 50 8 55 4 C56 10 58 15 61 20 Z"/>' +
          '<path d="M59 21 C59 12 63 6 70 4 C68 10 67 16 66 21 Z"/>' +
          '<path d="M65 22 C68 15 73 12 79 12 C75 16 72 20 70 24 Z"/>' +
        '</g>' +
        // Body: one round shape, glossy indigo, with a light rim.
        '<path class="pico-body" d="M60 17 C84 17 97 37 97 62 C97 88 81 104 60 104 C39 104 23 88 23 62 C23 37 36 17 60 17 Z"' +
          ' fill="#353C8C" stroke="#7A84E6" stroke-width="1.6"/>' +
        '<path d="M60 17 C84 17 97 37 97 62 C97 75 93 86 86 93 C90 84 91 72 88 60 C84 40 72 27 52 22 C55 19 57 17 60 17 Z"' +
          ' fill="#2A3072" opacity=".55"/>' +
        '<path class="pico-sheen" d="M40 30 C46 24 54 21 62 21" fill="none" stroke="#8F98F0" stroke-width="3.2" stroke-linecap="round" opacity=".7"/>' +
        // Belly.
        '<path class="pico-belly" d="M60 60 C75 60 84 72 84 84 C84 96 73 102 60 102 C47 102 36 96 36 84 C36 72 45 60 60 60 Z" fill="#AEB5F5"/>' +
        '<path d="M50 80 q4 3 8 0 M62 88 q4 3 8 0 M52 94 q3 2 6 0" fill="none" stroke="#8C94E6" stroke-width="1.6" stroke-linecap="round"/>' +
        // Cheeks.
        '<ellipse class="pico-cheek" cx="35" cy="62" rx="6.5" ry="3.8" fill="#FF8DB4" opacity=".6"/>' +
        '<ellipse class="pico-cheek" cx="85" cy="62" rx="6.5" ry="3.8" fill="#FF8DB4" opacity=".6"/>' +
        // Eyes: open ones blink and look around; happy arcs replace them to cheer.
        '<g class="pico-eyes">' +
          '<ellipse cx="47" cy="47" rx="11.5" ry="13" fill="#FFFFFF"/>' +
          '<ellipse cx="73" cy="47" rx="11.5" ry="13" fill="#FFFFFF"/>' +
          '<g class="pico-pupils">' +
            '<circle cx="48.5" cy="49" r="6.4" fill="#15172F"/>' +
            '<circle cx="71.5" cy="49" r="6.4" fill="#15172F"/>' +
            '<circle cx="51" cy="46" r="2.3" fill="#FFFFFF"/>' +
            '<circle cx="74" cy="46" r="2.3" fill="#FFFFFF"/>' +
            '<circle cx="46.5" cy="52" r="1" fill="#FFFFFF" opacity=".8"/>' +
            '<circle cx="69.5" cy="52" r="1" fill="#FFFFFF" opacity=".8"/>' +
          '</g>' +
        '</g>' +
        '<g class="pico-happy" fill="none" stroke="#15172F" stroke-width="4" stroke-linecap="round">' +
          '<path d="M38 50 Q47 39 56 50"/><path d="M64 50 Q73 39 82 50"/>' +
        '</g>' +
        // Brows: the most expressive thing about him.
        '<path class="pico-brow pico-brow-l" d="M36 30 Q45 25 55 30" fill="none" stroke="#15172F" stroke-width="4.2" stroke-linecap="round"/>' +
        '<path class="pico-brow pico-brow-r" d="M65 30 Q75 25 84 30" fill="none" stroke="#15172F" stroke-width="4.2" stroke-linecap="round"/>' +
        // Beak: short and golden; the lower half opens to talk.
        '<g class="pico-beak">' +
          '<path class="pico-beak-low" d="M53.5 64 Q60 67 66.5 64 Q64 72 60 74 Q56 72 53.5 64 Z" fill="#D98A12"/>' +
          '<path class="pico-beak-up" d="M51 59 Q60 53 69 59 Q67 66 60 70 Q53 66 51 59 Z" fill="#F7B933"/>' +
          '<path d="M55 59.5 Q60 57 65 59.5" fill="none" stroke="#FFE08A" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>' +
        '</g>' +
        // The shiny thing he cannot resist.
        '<path class="pico-spark" d="M101 15 L103 22 L110 24 L103 26 L101 33 L99 26 L92 24 L99 22 Z" fill="#FFD447" stroke="#FFF3B8" stroke-width=".8" stroke-linejoin="round"/>' +
        '<circle class="pico-spark pico-spark-2" cx="15" cy="26" r="2.6" fill="#FFD447"/>' +
      '</g>' +
    '</svg>';

  const POSES = ['idle', 'wave', 'point', 'cheer', 'think', 'talk', 'happy'];

  /* Returns his markup; the pose goes on the svg as data-pose. */
  function svg(pose) {
    const p = POSES.includes(pose) ? pose : 'idle';
    return MARKUP.replace('<svg class="pico"', '<svg class="pico" data-pose="' + p + '"');
  }

  /* Changes the pose of the Pico inside host, restarting its animation. */
  function pose(host, name) {
    const node = host && host.querySelector('.pico');
    if (!node) return;
    node.setAttribute('data-pose', POSES.includes(name) ? name : 'idle');
    node.classList.remove('pico-anew');
    void node.getBoundingClientRect();   // restart the one-shot animations
    node.classList.add('pico-anew');
  }

  /* Points his eyes along (dx, dy), each between -1 and 1. */
  function look(host, dx, dy) {
    const node = host && host.querySelector('.pico');
    if (!node) return;
    const clamp = (v) => Math.max(-1, Math.min(1, Number(v) || 0));
    node.style.setProperty('--look-x', (clamp(dx) * 3.2).toFixed(2) + 'px');
    node.style.setProperty('--look-y', (clamp(dy) * 3).toFixed(2) + 'px');
  }

  /* Aims the right wing (the pointing pose) along a screen angle in degrees,
     0 to the right and 90 straight down. The wing rests at about 56°, and a
     wing cannot swing behind his own back, hence the limits. */
  function point(host, angle) {
    const node = host && host.querySelector('.pico');
    if (!node) return;
    const turn = Math.max(-170, Math.min(30, (Number(angle) || 0) - 56));
    node.style.setProperty('--point-angle', turn.toFixed(1) + 'deg');
  }

  global.Pico = { svg: svg, pose: pose, look: look, point: point, POSES: POSES };
})(window);
