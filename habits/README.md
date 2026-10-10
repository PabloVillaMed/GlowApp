# GlowApp

An installable habit, exercise and mood tracker. Formerly called Hábitos;
existing browser data is migrated automatically on first load. No build step, no accounts, no
backend — plain HTML, CSS and JavaScript that works offline once loaded.

## Running it

A service worker needs a real origin, so open it over HTTP rather than by
double-clicking the file:

```sh
npx --yes serve .        # then open http://localhost:3000/habits/
# or any static server, e.g.  python -m http.server
```

Opening `index.html` straight from the filesystem still works — the app itself
runs fine — but the service worker will not register, so there is no offline
support and no install prompt.

To install: open it in Chrome/Edge and use **Ajustes → Instalar app** (the button
appears once the browser offers the prompt). On iPhone, use Share → *Add to Home
Screen*.

## What it tracks

- **Yes/no habits** — check them off; streaks and a completion ring.
- **Habits with a target** — 8 glasses of water, 30 minutes of exercise, 20
  pages. A stepper and a progress bar against the daily goal; holding + or −
  repeats, faster the longer it is held.
- **Flexible schedules** — every day, specific weekdays, or *X times per week*.
  Streaks respect the schedule: a day the habit was not due never breaks one,
  and weekly-quota habits are counted in whole weeks.
- **Mood** — a 1–5 daily rating with optional energy level and a note, charted
  over time and cross-referenced against habit completion.
- **Weight and BMI** (2.12) — a weigh-in a day at most, from the card on
  Today: the latest weight, its BMI with its WHO band for adults, the change
  since the previous weigh-in and what is left to an optional goal. Progress
  draws the weight over the chosen range with the goal as a dashed line, and
  marks the BMI on a strip of the four bands. Kilograms and centimetres are
  stored whatever is shown (kg and cm, or lb and ft/in, under *Ajustes → Peso
  e IMC*), where the card can also be hidden. BMI is shown as the rough guide
  it is: Ajustes says what it cannot tell.

## The starting test

On the very first launch, after the splash, six questions ask what the person
wants to improve, **what they already do**, how much time they have, how many
habits they want, what they find hardest, and when their day works best.

The answers are scored against a catalogue in `app.js` (`HABIT_CATALOGUE`)
and come back as two groups: habits they already keep — offered so a streak
starts counting today — and new suggestions spread across the chosen areas.

Targets are adjusted rather than fixed: a small time budget, or saying that
consistency is the hard part, scales them down. Only targets that actually cost
time are scaled, because trimming "8 glasses of water" for someone who is busy
would just make the goal meaningless, and a habit they already keep starts at
its normal level rather than a beginner's.

Answers are kept in `state.onboarding`, which is also what lets the Habits tab
show personalised starters instead of the generic ones. **Ajustes → Repetir el
test inicial** runs it again; erasing all data offers it again too.

2.13 adds dental care — *Cepillarse los dientes* (twice a day) and *Usar hilo
dental* — and *No fap* to the catalogue, with every character's lines and
voice notes. No fap is marked `suggest: false`: the test never puts it to
someone who did not go looking for it. It is one tap away instead, among the
starters of an empty Habits tab and the editor's **Ideas rápidas**, a row of
catalogue habits the list does not have yet (the newest first) that fills the
form, keys included. It is also `discreet`: a character's reminder for it uses
only its own three lines, which never say what it is about, and none of the
generic ones, which name the habit — a reminder shows on the lock screen.

## Pico and the tour (2.13)

Pico is GlowApp's guide: a crow, because crows collect shiny things and
nothing in the app shines like a streak. He has been drawn three times:
2.13 as a cartoon (too childish), 2.14 as a minimal crow in profile (too
serious), and 2.15 as he is now (`pico.js`) — facing us, minimal, one solid
colour, with a negative-space line for a chest feather, a small crest, and an
amber beak as the only accent.

2.17 cheered him up. Through 2.16 he wore the palette's ink (near black on
light themes, slate grey on dark ones) and rested with heavy lids slanted
towards his beak, which read as cross or bored. Now he has a purple of his
own, the same in every palette: deep (`#4C1D95`) on light themes, a brighter
violet (`#8A55F0`) on dark ones so he does not sink into the background —
measured against every palette's background and cards, 9.9:1 and up on light
themes, 3.4:1 and up on dark ones, eye whites at least 4.1:1 on him. His eyes
are open, with a glint of light that moves with each pupil, and cheeks rise
under them into a quiet smile at rest and a broad one when he waves or
cheers; no pose frowns (thinking is pensive, not cross). The cheeks give way
as he looks down, the way a lower lid follows the eye, so a smile never
swallows his pupils.

2.16 grew his wings into his body. In 2.15 each wing had an outline of its
own and hung at his side like a sticker; now each shoulder lies well inside
the silhouette, there is no outline, and the only line is a crease along a
folded wing's inner edge, clipped to the body, which fades as the wing
lifts. A raised wing reads as part of him coming out, not a piece beside
him. His face is drawn over his wings, so a wing raised beside his head
passes behind an eye and never bites into it (one colour with him, a wing
drawn over an eye would cut it in half; the tests check every frame of every
gesture for this). To point, a wing lifts at most 140°: any higher and it
would swing in over his head and vanish into it.

His wings are his hands. He points with the one on the target's side,
gestures while he talks the way people do when they explain something,
raises one beside his head to think, waves, cheers with both, and winks with
one up. He is rigged rather than keyframed: body, crest, each wing, each
eyelid, the pupils and the beak follow their targets on springs, so a change
of pose is always a movement and never a jump (the tests sample it: no more
than about two degrees a frame). Gestures sit on top — a wave, a cheer with
hops and wing beats, a nod, talking, a caw when tapped — and while nothing
is asked of him he breathes, blinks, glances about and ruffles his crest.
One animation loop serves every Pico on the
page: full rate while something plays, about fifteen frames a second while
he only breathes, and asleep while none is on screen. Under reduced motion
he takes each pose at once and holds it, and the loop does not run.

The tour runs once, right after the starting test (finished or skipped), and
waits on Today as an invitation for anyone who had the app before it existed;
**Ajustes → Repetir el tour con Pico** replays it. Each stop dims the screen
around one thing — the week, the ring, today's habits, mood, the Habits and
Progress tabs, the palettes and, in the Android app, the reminder characters —
and the coach sits below or above it, wherever it fits. On a small screen a
tall target is lifted under the app bar and framed as far as it fits. The
overlay takes every touch and the app behind is inert; Next, Back, Skip, the
arrow keys, Escape and Android's back all work, and finishing, skipping or
backing out all count as taken (`state.tourDone`).

When a day completes, Pico hops up over the tab bar with one of his lines
instead of the plain toast, and leaves by himself. When a habit is done and
the day is not yet, he peeks: he rises from behind the tab bar like someone
looking over a wall — only his head, shoulders and wings show, wings resting
on its edge — looks at the habit, turns to you and winks, and ducks back
down. The wink happens where you see it: both eyes open, one shuts with a
spark and a tilt of the head, and opens again. When the habit sits right
above the tab bar he rises over that habit's own card instead, so he never
covers it. Never in the way of a touch, not again within a few seconds, and
not under reduced motion. (Through 2.17 the whole bird slid in from the
side and arrived with the eye already shut.) He also keeps an empty list
company, and a tap makes him hop and caw.

A counted habit (glasses of water, portions of fruit) is celebrated the
same way when it reaches its target: sparks from the count, his wink, or
his cheer when it was the day's last. Through 2.16 that only happened on a
long press of + or from the keyboard; a plain tap only beeped. A tap still
celebrates once, with one sound.

Since 2.16 he is around more, without becoming noise:

- **A new habit.** He stands beside *Nuevo hábito* in the editor and looks
  at whatever has the focus; a quick idea makes him glad and nod, a form
  that cannot be saved yet makes him think. Editing a habit is quieter: no
  Pico. Once a new habit is saved — from the editor or a one-tap starter —
  he peeks up over the tab bar and waves.
- **Progress and Ajustes, now and then.** Entering Progress or changing its
  range, he may peek up at the right corner and point at the first chart in
  view (or consider it, wing at his chin). Changing a setting or a palette,
  he may peek up at the left corner, look at what changed, nod and smile.
  He never covers what he is looking at: if his corner would, he takes the
  other one, and if both would, he does not come. (In Progress the charts
  fill the screen, so a corner of some other chart can be under him for
  those two seconds.)
- **Rarely.** Those two are chances, not rules: at most one visit a minute,
  and only on about half of the chances even then. Every visit is brief,
  never takes a touch, never shows over a sheet or the tour, and none
  happens under reduced motion.

In the tour his words appear one after another while his beak moves (the
text is whole from the start, so a screen reader reads it at once), the
spotlight and the coach move on a sampled spring curve (`linear()`, with a
cubic fallback), and a swipe on the coach goes to the next stop or back.

Elsewhere, 2.14 adds a little motion where it says something: a ticked
circle throws a few sparks (a day completed, a ring of them), a tab eases in
instead of snapping, and a palette or theme change cross-fades through the
View Transitions API where the browser has it. All of it is off under
reduced motion.

## Reminders from a character (Android app)

Inside the Android app, reminders can come from one of five original
characters instead of a plain notification: **El Crack** (a football champion
who talks like a teammate before a final), **El Narrador** (who turns each
reminder into a small spooky story), **Abuela Rosa**, **Bip** (a robot with dry
humour) and **Maestro Zen**. They are invented for GlowApp — no real person's
name, voice, likeness or catchphrase is used.

Each reminder arrives as a chat message: the character's face and name, a line
written for that habit, and a **voice note** that plays by itself as the
message arrives (and again from the notification's **Escuchar**). **Hecho**
ticks the habit without opening the app, and the character answers.
Everything also lands in an in-app conversation (the bubble button in the
bar), with a one-tap "ya lo hice" for anything still open.

- A habit can have up to four reminder times (*Hábitos → a habit →
  Recordatorios*). Each time gets a different line, and the lines take turns
  from day to day, so water at 10, 13 and 16 never says the same thing twice.
- **Ajustes → Recordatorios** picks the character, can switch the voice notes
  off, sends a test message, and says when Android is blocking notifications
  or exact alarms. A voice note plays at the notification volume, every time,
  unless the phone is on silent or vibrate, in a call or in Do Not Disturb —
  then only the message arrives.
- Every line lives in `characters.js`, in both languages: three lines per
  habit and character, four generic ones for habits the user typed (the text
  names the habit; the recording cannot), five answers to "done" and an
  introduction.

### Your own voice note (pilot, 2.10)

A habit can also carry a note in the user's own voice: *Hábitos → a habit →
Recordatorios → Tu nota de voz → Grabar mi voz*. It records up to 30 seconds
with a live level, plays back in the editor, and can be recorded again or
removed; nothing is kept until the habit is saved. From then on that habit's
reminders play it instead of the character's note, as a "Tu nota de voz"
notification with the same Escuchar and Hecho buttons, playing by itself under
the same rules (on its own Android channel, *Tus notas de voz*). A habit with
no character chosen gets it too.

- Android asks for the microphone the first time the button is pressed. If it
  was refused, the editor says so and offers Android's settings page.
- The page records (`MediaRecorder`, WebM/Opus at 32 kbps) and hands the file
  to the shell once, on save; it lives in the app's private storage, not in
  `glow.v1`, so the backup file does not carry it. Android's own backup does.
  On start the page and the shell compare notes: a file no habit uses is
  deleted, and a habit whose file is missing (a backup from another phone)
  forgets it.
- A take that is almost silent gets a warning; under a second is refused.
- Loading an audio file instead of recording one is the next step.

### Your own bot (2.11)

The character picker has a sixth option, **Tu voz**: a reminder bot that
speaks with the user's own voice. *Crear mi bot* opens the studio, which
writes a script from the user's habits (a greeting, two lines per habit that
name it, three answers to "done", two lines for any habit). Every line can be
edited, removed or added to before recording, and the bot can be named.

*Leer el guion* turns the studio into a teleprompter: one line at a time,
large, with the next one underneath. **Each line owns the stretch of the take
during which it was on screen** (2.12): whatever is said then is that line.
The page turns when the reader taps the large *Siguiente frase* button, or,
with *Pasar sola a la siguiente* on (the default), after a pause. That pause
is 0.6 s once most of the line has been said and 1.6 s before, "most" being
judged from the line's length at the reader's own pace, learnt as they read.
A comma in the middle of a line does not cut it, and a quick reader's short
breath between lines still turns the page. *Atrás* reads the previous line
again, *Repetir* starts the current one over, *Saltar* leaves it as it was,
*Terminar* keeps the line on screen and stops. Any line can also be recorded
alone from its microphone button. If nothing at all reaches the microphone
for four seconds, the prompter says so.

2.11 decided everything live from pauses of 0.8 s, and a reader who pauses
less than that between lines got several lines merged into one recording,
and every later line empty or shifted. On a synthetic quick reader (0.75 s
between lines, a 1.1 s pause inside one) 2.11 got 0 of 10 lines right; 2.12
gets 10 of 10 with the button and with automatic page turns, as it does on a
calm reading and on one over steady background noise that starts talking at
once.

When the reading ends, the take is cut into one recording per line. It is
measured again in 10 ms frames against its own quiet level. A run of voice
belongs to the line on screen when it started (one already under way when the
line appeared is the previous line's tail; a word still being said as the
page turns may run on). Each line is trimmed to its voice with 0.12 s before
and 0.2 s after, brought to about −20 dBFS without clipping, and saved as a
22.05 kHz 16-bit WAV by the shell (the same private storage as 2.10's notes).
A line in whose stretch nothing was heard stays as it was. Nothing is
transcribed, so the voice never leaves the phone.

The words of a line can be changed at any time, also after recording: they
are what the message shows, and the recording stays.

In each habit's editor, **Frases de tu bot** then lists that habit's recorded
lines and the ones for any habit, each playable, to tick: the ticked ones take
turns day by day, like a character's. By default a habit says its own lines,
and a habit with none recorded says the ones for any habit. A habit with a
2.10 note of its own plays that note instead. The bot answers "done" with
its recorded answers, and writes in the in-app chat like the characters.

### The voices

The voice notes are generated here, once, by
[`tools/voices/make-voices.js`](../tools/voices/make-voices.js), and shipped
as Opus audio in `voices/` (about 16 MB for 790 clips). They are spoken by
[Piper](https://github.com/rhasspy/piper), an open-source text-to-speech
engine, using stock voices from its catalogue — none of them cloned from a
person — and then given each character's sound with ffmpeg: a compressor and
a referee's whistle for El Crack, a lower, slower pitch for El Narrador, a
faint waver for Abuela Rosa, a robot filter and two beeps for Bip, a singing
bowl for Maestro Zen. Since 2.14 all of them but Bip speak dry: the echoes
they had until then (a cellar for the narrator, a hall for the rest) sounded
like reverb and blurred the words. Bip keeps his short metallic comb, which
is part of being a robot.
`voices/index.json` holds each clip's length and waveform for the chat bubbles.

| Character | Spanish voice | English voice |
|-----------|---------------|---------------|
| El Crack | `es_MX-ald` (Unlicense) | `en_US-bryce` (public domain) |
| El Narrador | `es_ES-davefx` (CC0) | `en_US-norman` (public domain) |
| Abuela Rosa | `es_AR-daniela` (CC BY-SA 4.0, Google / OpenSLR 61) | `en_GB-cori` (public domain) |
| Bip | `es_MX-claude` (Apache 2.0) | `en_US-sam` (Apache 2.0) |
| Maestro Zen | `es_ES-sharvard` (CC BY 3.0, University of Edinburgh) | `en_US-joe` (CC0) |

Abuela Rosa's Spanish recordings derive from a CC BY-SA 4.0 dataset and are
shared under the same licence. The credits are also shown in Ajustes.

To change a line, edit `characters.js` and run `node tools/voices/make-voices.js`
from the repository root: only clips whose text or sound changed are recorded
again. The first run needs `bash tools/voices/fetch.sh`, which downloads Piper,
ffmpeg and the ten voice models (about 900 MB) into an ignored cache folder.

Every clip is measured again after it is encoded, as it will be heard, and one
that misses the target loudness (−16 LUFS) fails the run and is deleted, so
`check.js` stops the release. Before that check existed, 2.8 shipped twelve of
Abuela Rosa's notes at anything from −44 to −6 LUFS: ffmpeg's `vibrato` filter
sometimes starts with a few milliseconds of leftover memory, and the loudness
pass set the whole clip by that click.

## Layout and size

The Today view has four layouts — Comfortable, Compact, Grid and Focus — and
three sizes, both under **Ajustes → Apariencia**. Size is the replacement for
pinch-zoom, which is deliberately disabled: every text size is in `rem` and the
layout paddings with them, so changing the root size rescales the interface in
one step while tap targets stay pinned in pixels.

## Dropdowns

Since 2.18 the app draws its own dropdowns (`select.js`). Android's WebView
opened every `<select>` as the system's plain list dialog, the one thing in
GlowApp that did not look like GlowApp. Each `<select>` stays in the page —
it keeps the value, the label, the change events and all the code that reads
or sets it — but is hidden; a button drawn like the app's fields shows the
choice, and a tap opens a list in the app's colours, anchored to it (below,
or above when there is more room there), as wide as its longest option.
Choosing fires the select's own `change`, so the app reacts as it always
did. Inside a modal sheet the list lives in the sheet (the page outside a
modal sheet is inert: a list there could be seen but not touched) and is
shown in the top layer, above it. Escape, a tap outside, or Android's back
closes the list before anything else; the arrows, Home, End, Enter and
typing a letter work as on a native select, and a screen reader hears a
button, named by the select's label, that opens a listbox. Values set from
code (`select.value`, `selectedIndex`) and options relabelled by a language
change update the button too. It covers the theme, language, week start and
units in Ajustes, the calendar's habit in Progress, and the category in the
habit editor.

## Language, theme and palette

Both are switchable at runtime — the toggles in the app bar, or Ajustes. The
interface ships complete in Spanish and English (`i18n.js` holds every string;
the two tables are kept at full key parity) and starts in Spanish. The theme
follows the system by default and can be pinned to light or dark.

Since 2.13 the colours come in eight palettes, under **Ajustes → Apariencia**:
Clásica, Eléctrica, Pastel, Ultra oscura, Bosque, Atardecer, Océano and Alto
contraste. Each is a block of colour tokens in `styles.css` keyed by
`data-palette` on the root, in a light and a dark version (Ultra oscura is dark
only: while it is chosen the theme resolves to dark and the theme setting
waits, disabled; the app-bar toggle leaves it for classic in light). The
picker's cards carry `data-palette` too, so each previews its palette with the
very same tokens. The inline script in `index.html` applies the saved palette
before the first paint and gives the browser bar the palette's own `--bg`; the
Android shell watches `data-palette` as well as `data-theme` for the system
bars.

## Your data

Everything lives in one `localStorage` record (`glow.v1`) in the browser that
runs the app. It never leaves the device: there is no server to send it to.

That also means clearing site data erases it, and nothing syncs between your
phone and your laptop. **Ajustes → Tus datos** offers two ways out, named for
what they are rather than for their format (until 2.13 the buttons said
"Exportar JSON", which means nothing to most people):

- **Guardar copia** writes a backup: the whole record in one file,
  `GlowApp-copia-<date>.json`, marked as a GlowApp backup. **Restaurar una
  copia** reads one back — on this device or another — but first says what is
  in it (its date, how many habits and logged days) and replaces nothing
  until the user agrees. A file that is not a backup is refused with a plain
  sentence. Ajustes shows the date of the last backup saved.
- **Descargar tabla** writes the history as a spreadsheet,
  `GlowApp-tabla-<date>.csv`: one row a day from the first record to
  today, one column a habit (Sí / No, or the amount for a counted one), then
  mood, energy, the mood note, weight and BMI. In Spanish it uses semicolons
  and a decimal comma, in English commas and a point, which is what Excel
  expects in each; a byte-order mark tells Excel it is UTF-8.

In a browser both download. Inside the Android app, where a WebView cannot
download, both go through Android's own "save as", and a restore through its
file picker (see the Android README).

## Names follow the language

A habit created from the catalogue stores the key it came from (`nameKey`,
`descKey`) alongside the text, and the screen renders `habitName()` /
`habitDesc()` rather than the stored string. Switching language retranslates
it. Rename a habit and the key is dropped, so your own words are never
overwritten. Habits created before this existed are matched by name in either
language on load. The same key is how a reminder finds the character's line
written for that habit.

## Before shipping

`node check.js` from this directory. It catches the mistakes this codebase has
actually made: `$(…)` used where `$$(…)` was meant (which silently broke the
completion animation for four releases), `innerHTML` built by concatenation
without escaping in sight, a stray `console.log`, the two language tables
drifting apart, the asset `?v=` in `index.html` disagreeing with `sw.js`, and —
since 2.8 — a character line without its recording, or a catalogue habit with
no line.

## A note on updating

Asset URLs carry a `?v=` query (`styles.css?v=2.8`). **Bump it in
`index.html` and `sw.js` together whenever a shell file changes**, along with
`CACHE` in `sw.js`.

This is not decoration. The worker serves assets stale-while-revalidate, so
without a version change a newly deployed `index.html` is paired with the
previously cached stylesheet on the first load after an update — which is
exactly how a release once shipped with an unstyled, enormous splash logo. A
versioned URL is simply absent from the old cache, so it is always fetched
fresh.

The Android shell sidesteps this entirely: it registers no worker at all,
because every asset already comes from the APK.

## Files

| File | What it holds |
|------|---------------|
| `index.html` | Markup for all four views, the dialogs, the chat, icon sprite |
| `styles.css` | Design tokens for both themes, layout, components |
| `app.js` | State, storage, scheduling and streak logic, rendering, wiring, the bridge to Android |
| `characters.js` | The five characters and every line they say, in both languages |
| `charts.js` | Hand-rolled SVG charts (line, bars, grouped bars, heatmap) |
| `sounds.js` | The small synthesised interface sounds |
| `pico.js` | Pico, the guide: his drawing and the calls that pose him |
| `select.js` | The app's own dropdowns, in place of Android's plain list |
| `i18n.js` | Spanish and English string tables |
| `sw.js` | Service worker: precached shell, offline fallback |
| `check.js` | The pre-ship checks above |
| `avatars/` | The characters' portraits (SVG, drawn for GlowApp) |
| `voices/` | The recorded voice notes and their index |
| `icons/` | Generated PNG app icons, including a maskable one |

There are no dependencies and nothing is loaded from a CDN, which is what lets
the whole thing run from the cache with the network off.

## Notes for changing it

- Chart and habit colours come from colour-vision-safe categorical palettes
  defined as CSS custom properties (`--s1`…`--s8`), with separate,
  individually chosen steps for light and dark in every palette. A slot keeps
  its hue family in all of them — s1 blue, s2 orange, s3 teal, s4 amber,
  s5 pink, s6 green, s7 violet, s8 red — so a habit keeps its colour when the
  palette changes, and the BMI bands (s1, s3, s4, s8) keep their meaning.
  Every set was checked against its own surface the way classic was:
  lightness band (light 0.43–0.77, dark 0.48–0.67 in OKLCH), chroma of at
  least 0.1, adjacent pairs at least 8 ΔE apart under protanopia and
  deuteranopia and 15 with full colour vision. Text, accent and status
  colours hold at least classic's own contrast. Change a palette in both of
  its blocks, and re-check it.
- Charts draw at the container's pixel width so label sizes are true; they
  redraw on resize.
- The snapshot sent to Android (`buildSnapshot()` in `app.js`) covers this week
  and two weeks ahead, with each habit's streak as of the day before. The
  widget and the reminders work out "today" from the phone's clock and carry
  on from there, so they stay right past midnight with the app closed.
