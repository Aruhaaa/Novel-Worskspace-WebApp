# Novelist Workspace for phones

A Flutter app (Android, iOS) for the Novelist Workspace web app. It has two spaces in one app, **Read** and **Write**, plus **Me**. Which one opens first is the person's own choice, asked once at sign-up. Nothing is hidden from anyone.

- **Read**: browse the public library, search and filter by genre, save novels, like them, and pick up where you left off. The reader has size, typeface and theme settings. Guests can read without an account.
- **Write**: projects, chapters (drag to reorder, delete with Undo and a Recently deleted list), a rich text editor, a notebook for characters, places and ideas, a daily word goal with a 14-day chart, and publish or unpublish.
- **Reading links**: open a writer's private link, read the manuscript and leave comments. No account is needed.
- **Me**: profile, daily goal, where the app opens (kept on the account, so it follows you to another phone or the website), the six web themes, reading and writing typeface and size, change password, blocked writers, sign-out and delete account.
- **Safety**: "Forgot password?" on sign-in, **Report this novel** and **Block this writer** from a novel's page, and **Delete my account** in Me. Blocked writers' novels are hidden. These need `supabase/setup_scripts/20261008_account_safety.sql` run in the cloud project; see `supabase/README.md`.

## Same data as the web app

The phone talks to the same Supabase project, so a novel written on the web appears on the phone and the other way round. Chapters are the same HTML the web editor writes. Anything the phone editor cannot edit (a table, an image, a code block) is kept as a locked block and written back exactly as it was, so editing on the phone never damages web content.

Without cloud keys the app runs **on the phone only**, with a few sample novels to read. Everything written is kept on the device.

## Run it

You need the Flutter SDK (3.47 or newer).

```bash
cd mobile
flutter pub get
flutter run
```

To connect it to the cloud, copy `env.example.json` to `env.json`, fill in the same project URL and anon key the web app uses, then:

```bash
flutter run --dart-define-from-file=env.json
```

`env.json` is ignored by git. `PUBLIC_APP_URL` is only used to show a web address when sharing.

Chapter notes (status, synopsis, notes) sync to the cloud once `supabase/setup_scripts/20261003_cloud_sync.sql` has been run in the Supabase SQL Editor. Until then they stay on the phone, and the app says nothing is wrong.

## Build

```bash
flutter build apk --release --dart-define-from-file=env.json
flutter build appbundle --release --dart-define-from-file=env.json
flutter build ios --release --dart-define-from-file=env.json   # on a Mac
```

Before publishing to a store, change the app id (`com.novelist.novelist_workspace`) in `android/app/build.gradle.kts` and the iOS bundle identifier in Xcode, and add your own signing keys.

## Test

```bash
flutter analyze
flutter test
```

The tests cover the HTML to editor round trip against real web chapters, the reading, writing and sharing flows on a phone-sized screen, dropped connections, draft recovery, the word counting rules, and the account safety flows (forgot password, delete account, report, block, and the saved "where the app opens" answer).

## Known limits

- The phone has no comments, reviews or messages (only private reading-link comments), so reporting and blocking apply to novels and their writers. The website's comment, review and message reporting has no phone counterpart because those features do not exist on the phone.
- Password reset sends the email, but the link in it opens the website, where the new password is chosen. Changing a password from inside the app (Me) works too.
- Links to reading copies are pasted in (Me, then Open a reading link). Tapping a link in a message does not open the app yet; that needs App Links or Universal Links set up for your domain.
- No version history, export, outline, timeline, tour or story search on the phone yet. Use the web app for those.
- The extra toolbar buttons (mention, highlight, scene break) sit at the end of the scrolling toolbar.
- Reading typefaces are downloaded on first use and the phone's serif is used until then.
