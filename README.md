# GlowApp

A habit, mood and energy tracker that works offline and keeps everything on
your device: no accounts, no server. It runs in the browser as an
installable web app and on Android as an app with a home-screen widget and
reminders. The interface is in Spanish and English, with Pico, a small
purple crow, as a guide.

- Habits, daily or on chosen days or a number of times a week, with streaks,
  charts, levels and achievements.
- Mood, energy, notes, weight and BMI, and a "sick day" mode that keeps only
  the essential habits.
- Manual backups and a CSV table; on Android, reminders and a widget to tick
  habits and log today's mood without opening the app.

## Try it

- **In the browser:** <https://glowapp-pablovillamed.vercel.app/habits/>
  (the earlier address, hobby-col-web.vercel.app, still serves the same app;
  data saved in a browser stays with the address it was saved at, so move it
  with a backup from Ajustes if you switch).
- **On Android:** download `GlowApp-2.26.apk` from the
  [latest release](https://github.com/PabloVillaMed/GlowApp/releases/latest)
  (Android 7.0 or newer); it is also at the repository root, with
  `GlowApp-2.25.apk`, the release before it, kept next to it. Installing over an earlier GlowApp keeps your data; how to get
  past Android's warnings for apps from outside the Play Store is in
  [habits-android/README.md](habits-android/README.md#installing-on-a-phone).
  Over USB: `adb install -r GlowApp-2.26.apk`.

## Run and build

The web app has no build step. From the repository root:

```sh
npx --yes serve .        # then open http://localhost:3000/habits/
```

The Android app wraps the same files in a WebView shell:

```sh
cd habits-android
./gradlew assembleDebug        # needs JDK 17 and the Android SDK (platform 36)
```

A release build is signed with a key that is not in the repository.

## Documentation

- [habits/README.md](habits/README.md): the web app, its features and how
  they work.
- [habits-android/README.md](habits-android/README.md): the Android shell,
  the widget, reminders, installing and building.
