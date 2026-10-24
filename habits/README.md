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
- **Mood** — a 1–5 daily rating with its energy and a note, charted over time
  and cross-referenced against habit completion. Energy is a percentage since
  2.20 (see *Energy* below).
- **Excellence** (2.20) — the one habit nobody ticks by hand: on Today, it
  ticks itself once 70% of the day's habits are done (see *Excellence* below).
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

## Sick days (2.26)

**Estoy enfermo**, under the faces of "¿Cómo te sientes?" on Today, opens a
sheet with every habit; the ones marked **Esencial** in their editor come
ticked, and the list can be adjusted for this time. Turned on, from that day
until **Ya estoy mejor**, each day asks only for the habits kept:
- Today shows only them, and its ring counts only them; so does the day's
  excellence (70 % of the habits kept).
- The others are simply not due those days: they break no daily streak and
  lower no percentage, chart or level, and their reminders do not ring. One
  done anyway still counts, in your favour.
- A weekly quota ("3 veces por semana") asks, in a week with sick days, for
  its share of the quota (rounded up); a week spent ill throughout neither
  counts nor breaks the run.

While it lasts a card on Today says since when and what still counts that
day (the habits kept that are on their schedule), with **Elegir esenciales**
and **Ya estoy mejor**. Better makes today an ordinary day again (a period
begun today is undone); the days before stay sick days, and a past one says
so, from when to when, when chosen in the strip. Changing who is kept (from
the card, or with an editor's **Esencial** switch) applies from today on: the
period so far ends yesterday and a new one carries on, so keeping a habit on
the fourth day never turns the first three into misses, nor does letting one
go excuse them. A habit ticked or unticked on Today on a sick day keeps its
row there for the session, so an untick does not take it from under the
finger. Free, part of the base app.

The charts follow: Progress's best runs and the levels count a week with sick
days against its share of the quota, and the mood comparisons ("Ánimo y
hábitos", Pico's discoveries) leave out the sick days a habit was excused
from, done or not, so an illness's low moods do not land on one side alone.
The table still shows what was logged on such a day.

**Storage.** `state.sick = { periods: [{ from, to, keep }] }`, `to` null while
it lasts, written the first time it is turned on; a habit's `essential: true`
only once set. Everything is worked out through `isScheduled()`, so the
widget's list, the shell's streaks and the reminders follow by themselves:
the snapshot marks sick days (`sick`), the habits excused (`excused`) and
those of them not done (`rest`), which the shell shortens a weekly quota by
as the app does; a widget untick moves a habit from `due` to `rest` the
same way.

## Pico frowns at an untick (2.26)

A habit he saw done and that is unticked (its tick on Today, or the − that
takes a counted habit back below its target) brings him up over the tab bar,
displeased: the inner corners of his lids down, heavier lids, no smile, his
crest laid back, a small shake of the head and a low "hmph". Disappointed,
never angry, and only for a moment. Unticked while he is still up winking at
the tick, the same Pico changes face. Not under reduced motion.

## Excellence (2.20; on Today only, at 70%, since 2.21)

Aristotle held that we become just by doing just acts: excellence is not an
act but what repeated acts make of us. So GlowApp's one habit that cannot be
ticked by hand is **Excelencia**: it ticks itself.

- **A day is excellent** as soon as at least 70% of that day's habits are
  done. (2.20 asked for 80%, of the week before it too, and a week of
  practice first; 2.21 made it the day's alone, as the user asked.)
- **Fair to every schedule.** Days with nothing due neither count nor break
  its streak, and an unfinished today does not either. A weekly quota counts
  on the days it was done, and as missing only on days when the week had no
  slack left to meet it.
- **Its streak gives it light**: *Chispa* from the first day, *Llama* from 7,
  *Luz* from 21 and *Resplandor* from 66 (the median time a new habit took to
  become automatic in Lally and colleagues' 2010 study).
- **Only on Today** (2.21): a row of its own above Today's habits, saying
  what is left for today, and ticked by itself — a check in a gold disc —
  once the day reaches 70%. The tick that does it lights the row, makes the
  whole screen glow once, softly (one slow pulse, never a flicker, none under
  reduced motion), and Pico cheers with lines and a fanfare of his own. A tap
  opens its sheet: grade, streak, the last seven days against the 70% line,
  today's share, best streak, total, how it works, and a maxim. Through 2.20
  it also had a line in Progress, the calendar and the streaks chart, a note
  in Hábitos and a switch in Ajustes; all gone. (`state.showExcellence` is
  still kept for 2.20, which reads it, but no longer read.)
- **Levels and achievements**: 25 points for each excellent day, and four
  achievements (the first excellent day, then 7, 21 and 66 in a row). A
  record from before 2.21 takes the new points quietly, without a burst of
  "new level" (`ACHIEVEMENT_FORMULA`, 3 since 2.21).
- **The table** (CSV) has an *Excelencia* column: Sí on excellent days.

Like the levels, it is worked out from what is recorded, so an undo, an
import or an edit can never leave it wrong; nothing about it is stored but
whether it is shown and whether its sheet has been seen. The reckoning is
memoised until the next change (`save()` bumps `dataRev`), so Today, the
levels and Progress share one pass over the history.

## Energy (2.20)

Under the mood, energy is a slider from 0 to 100%, a point at a time, with
its value written beside it (*48% · Media*) and a − and + on either side for
exact steps (held, they repeat faster; they stop by themselves at either
end). The arrows, Home and End work from the keyboard, and a screen reader
hears the same text as the readout. Until 2.20 it was a step from 1 to 5.

A finger moves it from the first millimetre. The browser's own slider lets a
finger travel a few points before following it (to tell a drag from a
scroll), then jumps; so the page follows a finger or a pen itself
(`pointermove` on the slider) and leaves the mouse and the keys to the
browser, which are already exact. Up and down still scroll the page
(`touch-action: pan-y`), and a scroll that starts on the slider leaves the
energy as it was.

The day stores `energyPct` (0–100) and, kept in step, the old `energy`
(1 + round(pct / 25)), so an older version reading the record — or a backup
restored into one — still shows something sensible. A day saved before 2.20
reads as 0, 25, 50, 75 or 100% and is not rewritten until its energy is
moved. The table's column is *Energía (%)*.

## The emoji picker (2.20)

The habit editor offers every standard emoji the phone can draw instead of
32 fixed ones (`emoji-picker.js`): the suggestions (recent choices first,
then the 32 of before), GlowApp's own, and Unicode's nine groups as tabs; a
search in Spanish and English at once, without accents, names that start
with the words first; and the five skin tones. The tabs fit in one row
where there is room and in two rows of six on a phone.

- **Nothing is an image.** The standard emojis are text, drawn by the phone's
  own emoji font. Their list, `emoji-data.js` (194 KB, 1,923 emojis with
  their Spanish and English names and keywords and their toned forms), is
  loaded the first time the editor opens, and precached for offline use. It
  is generated from Unicode's `emoji-test.txt` and the CLDR annotations by
  `tools/emoji/make-emoji-data.js` (see the comment at its top).
- **Only what the phone can draw.** On opening, a few emojis of each Unicode
  version are drawn on a canvas; versions the font lacks (they would show as
  empty boxes, or a sequence as several emojis side by side) are left out.
  Android's emoji font is updated with the system, so an older phone simply
  offers fewer of the newest.
- **GlowApp's own**: thirteen drawn in the app's style from the SVG sprite in
  `index.html` — Pico in his own purple, the rest in the habit's colour
  (laurel, spark, flame, drop, book, dumbbell, sprout, moon, heart, lotus,
  target, sun). They are saved as `glow:<id>`; wherever only text can go (the
  widget, a notification, a chart label, a menu) a similar standard emoji
  stands in (`GlowEmoji.text`), and an id the app does not know (a damaged
  backup) becomes ✅ on load.
- **Quick on a phone.** An emoji costs most the first time the phone draws
  it, so a long group goes in a few rows a frame: the tap shows the first
  rows at once and the rest follow within a fraction of a second.
- The grid is one tab stop: arrows move within it, Home and End go to its
  ends, Enter or Space chooses; Enter in the search chooses the first match.
  Opening a habit opens its emoji's tab, scrolled to it.
- Recent choices and the chosen tone are remembered per device
  (`glow.emojiRecent`, `glow.emojiTone` in `localStorage`, outside the
  backup).

## The Hábitos list and deleting (2.21)

A row in Hábitos is a habit's icon and its name, nothing else: how often,
how much and the rest are in its editor, a tap away. Its handle still drags
it; its **⋯** opens its actions in a short sheet — *Editar*, *Subir*,
*Bajar* (for whoever does not drag; they skip the archived habits the list
does not show), *Archivar* or, for an archived one, *Restaurar* — and
**Eliminar**. Deleting is for good and asks first: the habit goes with its
whole history, its own voice note and its bot's lines, and the next
snapshot takes its reminders off the phone. The editor keeps its own
*Eliminar*.

## Text size (2.21)

*Ajustes → Tamaño* is Pequeño (14 px), Normal (16 px) or Grande (21 px; it
was 18.5 px, too close to Normal). Text is in `rem` everywhere, so the whole
interface follows — and since 2.21 the charts too: each draws in units of
the text's own scale (`widthOf()` in `charts.js`), so its labels, margins
and marks grow with the rest, and its bar charts put each name over its bar
when there is no room beside it. Grande on a 320 px phone fits: the summary
card puts its figures under the ring when it must (a container query in
`rem`, so it follows the setting, not only the screen), the mood buttons
and the segmented controls shrink their padding before anything spills.
Tap targets stay at least 44 px in every size.

A long press selects nothing: the app's text is not selectable
(`user-select: none` on the body), so holding a habit or an icon does not
light it up as text; what is typed into stays selectable.

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
In the tour (2.21) he is large — about 7 rem at a stop, 9.5 at the first
and the last — and stands behind the coach card, which hides his lower
half, as he peeks over the tab bar: at each stop he takes the side of the
card nearest what it is about and points at it with a wing; for a target as
wide as the card he takes the other side from where he stood, so from one
stop to the next he runs along behind the card (`Pico.run`: quick low hops,
leaning the way he goes, the wings beating in turn), and he rises and sinks
with the card as it moves, growing or shrinking on the way between his two
sizes (2.22). Under reduced motion he is simply there.

One animation loop serves every Pico on the
page: full rate while something plays, about fifteen frames a second while
he only breathes, and asleep while none is on screen. The tour's Pico, large
and watched, keeps the full rate even at rest (`Pico.lively`, 2.22). The springs move in
steps of at most 1/120 s however long a frame is: until 2.19 each frame was
one step, and at twenty frames a second (a slow phone, the emulator, or
his own fifteen at rest) the stiffest springs — the eyelids and the beak —
swung wider on every frame instead of settling, so his eyes flickered shut
and open many times a second. He blinks every 2.4 to 5.8 seconds, at any
frame rate. Under reduced motion
he takes each pose at once and holds it, and the loop does not run.

The tour runs once, right after the starting test (finished or skipped), and
waits on Today as an invitation for anyone who had the app before it existed;
**Ajustes → Repetir el tour con Pico** replays it. Each stop dims the screen
around one thing — the week, the ring, today's habits, excellence (2.20),
mood, the Habits and Progress tabs, the palettes and, in the Android app, the
reminder characters —
and the coach sits below or above it, wherever it fits. On a small screen a
tall target is lifted under the app bar and framed as far as it fits. The
overlay takes every touch and the app behind is inert; Next, Back, Skip, the
arrow keys, Escape and Android's back all work, and finishing, skipping or
backing out all count as taken (`state.tourDone`).

From one stop to the next (2.22) everything moves on the compositor:
opacity, `translate` and `scale`, never `top`, `left`, `width` or `height`.
Until 2.21 the highlight, the card and Pico animated those, so the browser
laid out and repainted the whole screen on every frame of a move and a
phone showed it in a few jerky frames. On the same view the tap answers at
once (the words, the dots and the buttons change), the highlight closes
into a plain dim (`#tourDim`) while the page scrolls smoothly to what comes
next, and opens around it as the card and Pico glide there from where they
were seen: each is put in its new place, moved back to where it was with a
transform, and let go on the spring, so a second tap mid-move goes on from
wherever things are. A stop in another view is a change of scene: the card
and Pico step out, the view is drawn and scrolled while nothing moves, and
they come back with the new stop, Pico talking and the words coming as they
do. `#tour[data-settled]` turns `true` when a move is over; the tests wait
on it.

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

### His voice (2.19)

Pico makes sounds, never words (`pico-voice.js`). Everything is
synthesised with Web Audio like the app's other sounds, nothing is recorded
or loaded: a crow's caw (a buzzy tone shaped by three resonances, with a
wobble and a little rasp), chirps that sweep up or down, the clicks crows
make, a low hum and a small bright ping. Inspired by real crows and by the
cheerful chirps of cartoon mascots, copied from neither. What he says with
them follows what he does: a quick "bwip" as his eye shuts in a wink, two
rising chirps when he waves at a new habit, a curious chirp and two clicks
when he points at a chart, a "hmm?" when he thinks (an empty name in the
editor), an "mm-hm" when he nods, a trill and a happy caw for the day done
(after the app's own arpeggio), a caw when tapped, a little fanfare for a
level or an achievement, and syllables without words while he talks in the
tour.

Each call varies its pitch and timing a little, so no two are alike. They
are dry — no echo, no reverb — short (under a second and a quarter), about
as loud as the app's chime and never louder than its loudest sound, and
silent whenever the app's sounds are off or the page is hidden. Before the
first touch a phone keeps the audio suspended; he waits rather than queue a
sound that would burst out later.

### His wardrobe (2.24; more hats and gestures in 2.25)

Part of the Plus preview (see "The Plus preview" below): **Ajustes →
Apariencia → Armario de Pico** shows only while it is on. The sheet keeps
Pico large on a little stage at the top, with the hat's name and the
button, and scrolls the tiles under it: no hat, and thirteen hats.
- **Free:** a knitted beanie, a birthday hat, a cap and a crown of flowers.
- **Earned with an achievement** (once earned, for good): an explorer hat
  with "Una semana entera" (a 7-day streak), one inspired by the sombrero
  vueltiao with "Constancia" (30 days with something done), a beret with
  "Te conoces" (mood logged on 7 days), a graduation cap with "Cien" (100
  habits done) and a crown with "Semana perfecta" (7 perfect days in a row).
- **GlowApp Plus:** a witch hat, a Christmas hat, a top hat and a chef's hat.

Tapping a tile tries the hat on: it is lowered onto his head and he looks
up at it. Nothing is saved until **Ponérselo**: then he hops, the hat
settles, and every Pico in the app wears it, from the tour to his peeks.
The same button takes it off. A locked hat can be tried on; its button is
dimmed and says why it cannot be put on ("Aún por ganar", "Llega con Plus").

**Gestures (2.25).** Under the stage, five buttons play a gesture with the
hat on: **Saludar** (he tips the brim), **Bailar**, **Reverencia**, **No sé**
(a shrug) and **Celebrar** (the hat bounces). Each is a short spring
animation on the compositor, none loops, and under reduced motion the row
is not shown. While a hat is worn his crest is hidden under it.

**Plus is not available.** Nothing in the app grants it: there is no Google
Play Billing, no account and no server, so `plusActive()` in `app.js` is
false. It is never read from `glow.v1`, which an edited or restored backup
could rewrite. A Plus hat saved as the choice (a backup from the future, an
edited file) is not worn, is kept, and the sheet says so. Nothing is deleted.

**Storage.** `state.wardrobe = { hat }`, absent until a hat is first put on,
so a record nobody touched stays as 2.23 wrote it. A hat id this version
does not draw is kept rather than dropped. Backups carry it like any other
setting.

**Drawing (`pico.js`).** Each hat is a flat layer at the end of `.pk-all`:
no outline, its own colours (`.pk-hat-*` in `styles.css`, for dark and
light themes). It never reaches below y 32 nor above y 1 of his 120-unit
box, so it is clear of his eyes, whose whites start at y 38, and inside the
window he peeks from. Being inside `.pk-all`, it leans, hops and squashes
with him. Two springs of its own (`hatY`, `hatRot`), present only on a Pico
wearing one, give it weight:
- it floats a little at the top of a hop and lands after him, so a cheer's
  hops bounce it gently;
- his wave tips its brim;
- running, the air pushes it back;
- `admire` is the look up at a hat being tried on.

His crest folds away under it, and its idle ruffle is skipped, since nobody
would see it. Without a hat nothing changes: the same drawing, the same
springs, the same loop. Everything runs in the one existing loop, so there
is no animation when he is off screen and none under reduced motion, where
a hat is simply there.

`Pico.wear(id)` dresses every Pico on the page and the next ones;
`Pico.hat(host, id, 'drop' | 'settle')` dresses one, as the wardrobe does;
`Pico.hatSvg(id)` draws a hat alone for the tiles.

## Reminders from a character (Android app)

Inside the Android app, reminders can come from one of three original
characters instead of a plain notification: **El Narrador** (who turns each
reminder into a small spooky story), **Bip** (a robot with dry humour) and
**Maestro Zen**. They are invented for GlowApp — no real person's name,
voice, likeness or catchphrase is used.

Until 2.20 there were five: **El Crack** and **Abuela Rosa** were retired,
with their lines, portraits and voice notes. Someone who had chosen one of
them gets plain reminders from then on and Today invites them to pick again;
their messages leave the in-app conversation (the others' stay), a message
from them still queued on the phone is let go, and the Android shell treats
their ids as no character at all, so a snapshot from an older version cannot
bring them back.

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

After the characters, the picker offers **Tu voz**: a reminder bot that
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
as Opus audio in `voices/` (about 12 MB for 528 clips). They are spoken by
[Piper](https://github.com/rhasspy/piper), an open-source text-to-speech
engine, using stock voices from its catalogue — none of them cloned from a
person — and then given each character's sound with ffmpeg: a lower, slower
pitch for El Narrador, a robot filter and two beeps for Bip, a singing bowl
for Maestro Zen. Since 2.14 all of them but Bip speak dry: the echoes they
had until then (a cellar for the narrator, a hall for the rest) sounded like
reverb and blurred the words. Bip keeps his short metallic comb, which is
part of being a robot.
`voices/index.json` holds each clip's length and waveform for the chat bubbles.

| Character | Spanish voice | English voice |
|-----------|---------------|---------------|
| El Narrador | `es_ES-davefx` (CC0) | `en_US-norman` (public domain) |
| Bip | `es_MX-claude` (Apache 2.0) | `en_US-sam` (Apache 2.0) |
| Maestro Zen | `es_ES-sharvard` (CC BY 3.0, University of Edinburgh) | `en_US-joe` (CC0) |

The credits and licences ship with the app in `credits.txt` (the CC BY
voice asks for its attribution to travel with it). Until 2.20 they were
also printed at the foot of Ajustes; they left the screen to keep Ajustes
for settings.

To change a line, edit `characters.js` and run `node tools/voices/make-voices.js`
from the repository root: only clips whose text or sound changed are recorded
again. The first run needs `bash tools/voices/fetch.sh`, which downloads Piper,
ffmpeg and the six voice models (about 500 MB) into an ignored cache folder.

Every clip is measured again after it is encoded, as it will be heard, and one
that misses the target loudness (−16 LUFS) fails the run and is deleted, so
`check.js` stops the release. Before that check existed, 2.8 shipped twelve of
Abuela Rosa's notes (a character retired in 2.20) at anything from −44 to −6
LUFS: ffmpeg's `vibrato` filter
sometimes starts with a few milliseconds of leftover memory, and the loudness
pass set the whole clip by that click.

## Layout and size

The Today view has four layouts — Comfortable, Compact, Grid and Focus — and
three sizes, both under **Ajustes → Apariencia**. Size is the replacement for
pinch-zoom, which is deliberately disabled: every text size is in `rem` and the
layout paddings with them, so changing the root size rescales the interface in
one step while tap targets stay pinned in pixels.

## The look (2.19)

2.19 freshened the interface without changing what it is. The typeface is
**Figtree**, a friendly geometric sans by Erik Kennedy, under the SIL Open
Font License (`fonts/OFL.txt`): one variable file for every weight, only
the Latin range the app writes in (20 KB), self-hosted and precached so it
works offline and in the APK, preloaded so the first screen is drawn in it.
Cards lost their outline on light themes and sit on a soft, low shadow
instead (`--edge` and `--lift` in `styles.css`); dark themes keep a hairline
edge, and Alto contraste keeps its strong edges in both. Buttons are pills
that give a little under the finger, the current tab sits in a soft pill
that springs open, the chosen day in the week strip is a filled pill, the
on/off settings are switches, and the app bar shows a view's title only
once its big heading has scrolled away. Tap targets stay at 44 px or more;
the press feedback is off under reduced motion. The approach — a few
tokens for radii, edges, shadows and easing rather than a framework — was
taken from design-token projects such as Open Props; nothing was added as
a dependency.

## Progress: more charts, levels and achievements (2.19)

**Ver más gráficos**, under the charts in Progress, opens three more, drawn
only while open and remembered open (`state.moreCharts`): what you complete
on each day of the week (thin columns, the best day named), the trend
(completion averaged over the last seven days, a plain line on a faint wash
with its last value written at its end), and each habit's longest streak in
the range (days, or whole weeks for a weekly quota; a full bar means never a
miss). Like the rest of Progress they follow the range above them, and an
unfinished today counts in none of them until it is done.

**Smooth lines** (2.20). The line charts — mood, weight, the trend — are
curves rather than straight segments: a monotone cubic (Fritsch–Carlson,
`curvePath()` in `charts.js`), which passes through every point and never
swings past two neighbouring ones, so a 1–5 scale stays within 1–5 and a
percentage within 0–100, and no wiggle is invented between days. Over 30
and 90 days a day-by-day mood zigzags, so there the line is its rolling
mean (5 days over a month, 7 over a quarter, centred, drawn where at least
half its window has a mood); its subtitle says so, and the tooltip gives
the day and its mean. (2.20 also drew each day as a faint dot around the
line, with a key; 2.21 took the floating dots away.) Over a week the line
still joins the days themselves. A stretch with no mood
still breaks the line; the weight line still runs from one weigh-in to the
next.

**Levels and achievements** are worked out from what is already recorded,
so an import, an undo or an edit can never leave them wrong. Points: 10 for
each habit done on a day, 20 for each perfect day, 5 for each day with a
mood, and since 2.20 25 for each day of excellence. Level 2 takes 100
points and each level after it 50 more than the one before. A card at the
top of Progress (above the range, which it does not follow) shows the
level, the points, a thin meter to the next level and how many of the
sixteen achievements are earned; a tap opens them all, earned
ones marked, the rest with how far along they are. A new level or
achievement is announced once, as a short message with Pico's little
fanfare, after his cheer for the day rather than over it; several at once
make one message. All that is stored is what was already announced
(`state.achievements`: the achievements and the highest level), so a level
lost to an undo and won back is not news twice — and whoever had the app
before 2.19 starts with what they had already earned, quietly.

### The Plus preview (2.24; one switch since 2.25)

**Ajustes → Funciones en prueba** has one switch, off unless turned on,
labelled a preview of GlowApp Plus: free while the test lasts, part of Plus
once Plus exists. It brings in everything below. Off, GlowApp is 2.23 as
it was: no new card, row or Pico hat anywhere, and nothing new written.
Turning it off deletes nothing: routines, the program's progress and the
hat chosen wait in `glow.v1` and come back as they were when it is turned
on again. It is saved as `state.labs.plus`, only once it is first moved; a
2.24 record with `labs.insights` on reads as on.

**Plus is not available.** Nothing in the app grants it: there is no Google
Play Billing, no account and no server, so `plusActive()` is false and the
Plus hats can be tried on, never worn. The switch is a preference, not a
purchase.

### Pico's discoveries (2.24; more of them in 2.25)

A card under the charts in Progress describes what the last twelve weeks
of records show, in plain sentences:
- this week's completion against the four weeks before;
- **same day:** mood, or energy, on days a habit was done and on days it
  was not;
- **the next day:** mood or energy the day after doing a habit, against
  the day after not doing it;
- **together:** two or three habits done on the same day, and the mood or
  energy the next day ("El día después de cumplir «Caminar» y «Leer», tu
  energía suele estar más alta…"); a combination is only told when it beats
  each habit alone and every habit in it adds something;
- **mood, then habits:** how much gets done the day after a good or a low
  mood;
- **weekdays:** a day of the week clearly above or below the rest.

Every comparison is a Student t-test (pooled variance) with an exact p
value, and all of them together, often hundreds, go through a
Benjamini–Hochberg false-discovery cut at 5 %, so that looking at many
pairs does not turn chance into findings. A difference must also be large
enough to matter (half a point of mood, ten of energy). On records with no
pattern in them, fewer than 2 % of cases show any finding at all. The card
shows four at most, two of a kind.

It never says a habit caused anything, and gives no advice. Each sentence
gives both numbers and the days behind each, and the card ends with "Son
coincidencias en tus registros, no causas." Nothing is compared on thin
data: a group needs seven days (six for a combination), and the card needs
21 days with a mood in the twelve weeks; below that it says how many there
are. Today is left out, since the day is not over. Energy counts only on
days the slider was moved (`energyPct`).

`insights.js` is pure: the app hands in its own rules (`isScheduled`,
`isComplete`, `settledStats`). It is worked out when the data or the day
changes and never stored. The free charts ("Ánimo y hábitos", by weekday,
trend, streaks), the CSV table and the backup are unchanged.

### Guided routines (2.25)

A **Rutinas** card at the top of Hábitos chains habits in the order they
are done (the morning, the evening). The editor adds habits by tapping
them, moves them up and down, and gives a step a timer of up to 60 minutes
(a habit counted in minutes starts with its own target). **Empezar** goes
through it step by step with Pico: **Hecho** marks the habit for today
exactly as a tap on Today would (with its streaks and excellence), and
**Saltar** leaves it as it was. The timer works from the clock, so a slow
or backgrounded page still shows the right time; when it runs out it says
so, with a sound and a buzz, and marks nothing. A step whose habit was
deleted or archived is passed over. Stored as `state.routines`, written
when the first is saved; deleting a routine leaves its habits and their
records alone.

### The guided program (2.25)

A first program, **Siete días, un paso a la vez**, from its card in
Hábitos: a small step a day for a week (something small, a set moment, the
mood, chaining two habits, looking at the week, making things easier, a
week done). Each step suggests one thing and offers a way to do it (a
starter habit to add, Today's mood, the routine editor, Progress). **Listo
por hoy** moves the program on and marks no habit; the next step opens the
next day and waits as long as it takes, so missing a day loses nothing.
While today's step is still to do, Today shows it in one line. It is
voluntary and can be left at any time; the habits it helped add are
ordinary habits and stay as they are. It promises nothing about health.
Stored as `state.program` (`{ id, startedAt, done: [the date of each
step] }`), written when it is first started, `null` once left.

### The month's report (2.25)

**Informe del mes**, at the foot of the discoveries card, makes a one-page
summary of a month (this one or one of the eleven before it with data),
only when asked for. Before making it the sheet says what it holds: the
habits always (each one's days due and done, and a counted habit's total;
the month's summary with full days and days of excellence; week by week),
and, ticked unless unticked, mood and energy averages, the month's first
and last weigh-in, and the discoveries. Notes and voice notes are never in
it. Its numbers follow the charts' rules: an unfinished today counts in
none of them. **Guardar como PDF o imprimir** opens Android's print screen
in the app (`NativeShell.printPage`), where "Guardar como PDF" makes the
file, or the browser's own print elsewhere. Only the report prints, dark on
white whatever the theme; printing anything else is as before. Nothing of
it is stored.

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

Since 2.13 the colours come in palettes, under **Ajustes → Apariencia**:
Clásica, Eléctrica, Pastel, Ultra oscura, Bosque, Atardecer, Océano, Alto
contraste and, since 2.23, Halloween (a violet night with a pumpkin accent).
Each is a block of colour tokens in `styles.css` keyed by `data-palette` on
the root, in a light and a dark version (Ultra oscura and Halloween are dark
only: while one is chosen the theme resolves to dark and the theme setting
waits, disabled, under a note that names the palette; the app-bar toggle
leaves it for classic in light). On a phone the picker has two columns, so
the ninth card, alone on its row, takes the whole row. The
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
  excellence (2.20), mood, energy (as a percentage since 2.20), the mood
  note, weight and BMI. In Spanish it uses semicolons
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
drifting apart, the asset `?v=` in `index.html` disagreeing with `sw.js`, a
file the page or — since 2.19 — the stylesheet loads (the typeface) missing
from the precache, and — since 2.8 — a character line without its
recording, or a catalogue habit with no line. Since 2.20 it also checks that
the emoji list the picker loads exists and is precached.

`check.js` looks at the code; the behaviour is covered by browser tests
driven over the DevTools protocol, which are kept outside the repository.

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
| `characters.js` | The three characters and every line they say, in both languages |
| `charts.js` | Hand-rolled SVG charts (line, bars, columns, grouped bars, heatmap); smooth curves |
| `emoji-picker.js` | The habit editor's emoji picker (2.20) |
| `emoji-data.js` | Every standard emoji, its group, names and tones — generated, loaded on demand |
| `sounds.js` | The small synthesised interface sounds |
| `pico-voice.js` | Pico's voice: synthesised caws, chirps, clicks and trills, no words |
| `pico.js` | Pico, the guide: his drawing, his hats and the calls that pose him |
| `insights.js` | Pico's discoveries (2.24; combinations and the next day since 2.25), a Plus preview: patterns described from the records, never stored |
| `select.js` | The app's own dropdowns, in place of Android's plain list |
| `i18n.js` | Spanish and English string tables |
| `sw.js` | Service worker: precached shell, offline fallback |
| `check.js` | The pre-ship checks above |
| `avatars/` | The characters' portraits (SVG, drawn for GlowApp) |
| `voices/` | The recorded voice notes and their index |
| `icons/` | Generated PNG app icons, including a maskable one |
| `fonts/` | Figtree (Latin, variable) and its license, `OFL.txt` |
| `credits.txt` | Credits and licences of the voices and the typeface |

Outside this folder, `tools/voices/` makes the voice notes and
`tools/emoji/make-emoji-data.js` makes `emoji-data.js`.

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
