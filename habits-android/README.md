# GlowApp — Android build

A thin native shell around the web app in [`../habits`](../habits). The web files
are copied into the APK at build time, so `../habits` stays the single source of
truth — edit the app there, rebuild, and the APK picks the changes up.

## The built APK

`GlowApp-2.9.apk` sits at the repository root. It is signed with the release key
in `keystore/` (not committed), targets API 36 (Android 16), and needs Android
7.0 or newer.

The target matters. The first build targeted API 32 and Google Play Protect
refused to install it — "This app was built for an older version of Android and
doesn't include the latest privacy protections." Play Protect gates sideloads on
`targetSdkVersion`, so the fix was to build against a current platform rather
than to click past the warning. 2.8 moves to 36 for the same reason.

## Installing on a phone

Send the APK to the phone (WhatsApp, Drive, email, USB) and open it. On a
current Android two screens come up, and both are expected for an app that
does not come from the Play Store — neither means the phone rejected it:

1. **"For your security, your phone isn't allowed to install unknown apps from
   this source"** → *Settings* → turn on **Allow from this source** for the app
   that opened the file (WhatsApp, Chrome, Files…) → go back.
2. **Google Play Protect — "App scan recommended"** → **Scan app**. After a few
   seconds it says *"This app looks safe"* → **Install**. Tapping *Don't install
   app* here is the easy mistake.

Both were reproduced on an Android 16 emulator with Google Play: the 2.7 APK
installs once they are answered. Some phones add their own layer on top:

- **Samsung (One UI 6 and later): Auto Blocker.** *Settings → Security and
  privacy → Auto Blocker → off* while installing; it can be turned back on.
- **Xiaomi / Redmi / POCO:** their own security scan asks for confirmation;
  choose to install anyway.
- **"App not installed as package conflicts with an existing package":** an
  older copy signed with a different key is installed. Uninstall it first
  (export a JSON backup before, from Ajustes).
- **"Developer not verified"** (Google's verification for sideloaded apps,
  rolling out by country from 2026): the publisher has to register the
  package and signing key in Google's Android Developer Console; until then
  the phone's advanced install flow is the only way through.

Over USB with developer options and USB debugging on:

```sh
adb install GlowApp-2.9.apk
```

## Native features

Three things live in the shell rather than the page, because a web page cannot
do them:

- **Reminders.** A habit can have up to four times. Each is a one-shot alarm
  that arms the next day's when it fires: *exact* when Android allows it
  (from Android 14 the user grants "Alarms & reminders", and Ajustes offers the
  button), otherwise with a ten-minute window. Up to 2.7 these were inexact
  repeating alarms, and `dumpsys alarm` showed Android giving them an 18-hour
  window — a "9:00" reminder could arrive in the afternoon. `BootReceiver`
  re-arms everything after a reboot, an app update, a clock or time-zone
  change, and when exact alarms are granted. The old repeating alarms are
  found and cancelled on the update itself, before the app is even opened.
- **Characters.** With one chosen, a reminder is a chat-style notification
  (`MessagingStyle`, with the character as a `Person` and, from Android 11, a
  long-lived shortcut so it is filed under Conversations). **Escuchar** plays
  the voice note from the APK with `MediaPlayer` without opening the app;
  **Hecho** records the tick and the character answers. Messages and replies
  are filed in an inbox the page collects for its chat. The voice note also
  plays by itself on arrival, at the notification volume, a moment after the
  notification's own sound — every time, unless the user turns it off or the
  phone is on silent or vibrate, in a call or in Do Not Disturb.
  Android 16 already refuses audio focus to an app in the background, so
  music keeps its volume under the note, and its log says a stricter mode
  "would mute" background playback. If a later Android turns that on, the
  note will have to play from a short foreground service (an exact alarm is
  allowed to start one).
- **Home-screen widget.** A progress ring for the day that stays put, then a
  scrolling list with every habit due: its colour and emoji, a progress bar
  for counted habits, its streak, and two tap targets — the name opens the
  app, the circle ticks the habit (or adds one glass of water) without opening
  anything. A list item cannot carry PendingIntents of its own, only fill-ins
  for one shared broadcast template, so both taps reach
  `WidgetActionReceiver`, which opens the app for a name — launchers allow a
  widget's broadcast to start its app — and ticks for a circle.
  (2.8 used fixed rows instead, which could not scroll: a widget too short for
  the day simply hid the rest.)

### How the widget and reminders see your data

Habit data lives in the WebView's local storage, which native code cannot read.
So the page pushes a snapshot into `SharedPreferences` after every save
(`GlowStore`), and anything ticked from the widget or a notification is
**queued** rather than written directly; the page applies the queue through
its own write path when it next runs, so streaks and charts stay correct.

The snapshot covers this week and the next two, with each habit's streak as
of the day before. The date always comes from the phone's clock (`GlowDay`),
never from the snapshot — through 2.7 the widget took "today" from the last
sync, so after midnight it kept showing, and ticking, yesterday until the app
was opened. A non-waking alarm redraws it just after midnight.

## Rebuilding

```sh
cd habits-android
./gradlew assembleRelease      # -> app/build/outputs/apk/release/app-release.apk
```

`local.properties` points at the Android SDK; it is machine-specific and not
committed. The build needs JDK 17 and an SDK with platform 36 and build-tools
36.1.0, driven by Gradle 8.7 and Android Gradle Plugin 8.6.1 (which predates
API 36 but builds against it; `gradle.properties` silences its notice).

The voice notes in `../habits/voices` are generated, not hand-made: see
`../tools/voices/make-voices.js`. They are stored uncompressed in the APK
(`noCompress` in `app/build.gradle`) so the native player can read them in
place; Opus gains nothing from zip compression anyway.

To bump the version, edit `versionCode` and `versionName` in `app/build.gradle`.
Android only replaces an installed app when the new APK is signed with the same
key **and** has a higher `versionCode`.

## The signing key

`keystore/habitos.jks` (alias `habitos`) and its `keystore.properties` are
gitignored, so neither the key nor its password is published here.
Keep it: Android refuses to update an installed app with a differently-signed
APK. Lose it and the only way forward is uninstalling first, which erases the
habit history stored inside the app. Export a JSON backup before doing that.

To recreate one from scratch:

```sh
keytool -genkeypair -keystore keystore/habitos.jks -alias habitos \
  -keyalg RSA -keysize 2048 -validity 10000
```

then write `keystore/keystore.properties` with `storeFile`, `storePassword`,
`keyAlias` and `keyPassword`.

## Testing the widget

Binding a widget from code needs the signature-level BIND_APPWIDGET
permission, but the launcher's own picker can be driven over adb: long-press
an empty spot on the home screen → *Widgets* → search "GlowApp" → tap the
preview → *Add*. That is how 2.9's scrolling list, ticks and row taps were
checked on Android 16. A list recycles its rows, so a row that sets something
in one state has to set it back in the other: the first 2.9 build drew a done
circle painted over by the colour filter of the habit shown in that row
before, which only a real launcher showed.

Debug builds also carry a `WidgetPreviewActivity` that inflates the **real**
provider views at three heights. Its `date` extra draws another day, which is
how the after-midnight behaviour is checked without touching the clock:

```sh
adb shell am start -n com.pablo.glowapp/.WidgetPreviewActivity --es date 2026-10-06
```

It is in `src/debug` and never reaches a release APK, as is the WebView
DevTools hook.

## How the shell works

`MainActivity` hosts a single WebView and answers every request to
`https://appassets.androidplatform.net` from the APK's assets — nothing touches
the network. Serving from a synthetic https origin rather than `file://` is
deliberate: local storage on `file://` is treated as an opaque origin by some
WebView versions and can be discarded, and service workers refuse to register
outside a secure context.

The window is edge to edge on Android 11 and later (and has to be from
targetSdk 36): the root view is padded by the system bars and the keyboard, and
the page reports its background colour so the bars show it, with light or dark
icons to match. The WebView's own scroll bar starts switched off and comes on
when the page reports the launch screen gone (`splashDone`): it flashes as the
page first lays out, which put a grey bar down the side of the launch screen
that no CSS could reach. Back closes whatever the page has open — a dialog, the chat, a
tab other than Today — and only then leaves; from Android 13 that goes through
`OnBackInvokedCallback`, since Android 16 no longer calls `onBackPressed()` for
apps that target it.

Receivers that only this app should reach (`ReminderReceiver`,
`WidgetActionReceiver`) are not exported and declare no intent filter. The
widget provider must stay exported for the system's updates, which is why its
taps go to a separate receiver.

## Where the data lives

In the WebView's local storage inside the app's private directory. It is not
shared with the same app opened in Chrome — those are separate storage areas, so
installing the APK does not import anything you already logged in the browser.
Move history across with **Ajustes → Exportar JSON** and *Importar JSON*.

Uninstalling deletes it. Android's backup includes that storage
(`res/xml/backup_rules.xml` and `data_extraction_rules.xml`; up to 2.7 the rules
pointed at the wrong folder and carried nothing useful), but treat the JSON
export as the real backup.
