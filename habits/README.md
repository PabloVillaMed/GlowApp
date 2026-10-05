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
  `glow.v1`, so the JSON export does not carry it. Android's own backup does.
  On start the page and the shell compare notes: a file no habit uses is
  deleted, and a habit whose file is missing (a backup from another phone)
  forgets it.
- A take that is almost silent gets a warning; under a second is refused.
- Loading an audio file instead of recording one is the next step.

### The voices

The voice notes are generated here, once, by
[`tools/voices/make-voices.js`](../tools/voices/make-voices.js), and shipped
as Opus audio in `voices/` (about 16 MB for 790 clips). They are spoken by
[Piper](https://github.com/rhasspy/piper), an open-source text-to-speech
engine, using stock voices from its catalogue — none of them cloned from a
person — and then given each character's sound with ffmpeg: a compressor and
a referee's whistle for El Crack, a lower pitch and a cellar echo for El
Narrador, a robot filter and two beeps for Bip, a singing bowl for Maestro Zen.
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

## Language and theme

Both are switchable at runtime — the toggles in the app bar, or Ajustes. The
interface ships complete in Spanish and English (`i18n.js` holds every string;
the two tables are kept at full key parity) and starts in Spanish. The theme
follows the system by default and can be pinned to light or dark.

## Your data

Everything lives in one `localStorage` record (`glow.v1`) in the browser that
runs the app. It never leaves the device: there is no server to send it to.

That also means clearing site data erases it, and nothing syncs between your
phone and your laptop. **Ajustes → Exportar JSON** writes a full backup, and
*Importar JSON* restores one — the same file moves your history to another
device.

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
| `i18n.js` | Spanish and English string tables |
| `sw.js` | Service worker: precached shell, offline fallback |
| `check.js` | The pre-ship checks above |
| `avatars/` | The characters' portraits (SVG, drawn for GlowApp) |
| `voices/` | The recorded voice notes and their index |
| `icons/` | Generated PNG app icons, including a maskable one |

There are no dependencies and nothing is loaded from a CDN, which is what lets
the whole thing run from the cache with the network off.

## Notes for changing it

- Chart colours come from a colour-vision-safe categorical palette defined as
  CSS custom properties (`--s1`…`--s8`) with separate, individually chosen steps
  for light and dark. Change them in `styles.css` in both blocks, not one.
- Charts draw at the container's pixel width so label sizes are true; they
  redraw on resize.
- The snapshot sent to Android (`buildSnapshot()` in `app.js`) covers this week
  and two weeks ahead, with each habit's streak as of the day before. The
  widget and the reminders work out "today" from the phone's clock and carry
  on from there, so they stay right past midnight with the app closed.
