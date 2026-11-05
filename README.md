# Novelist Workspace

A quiet place for novelists to write, plan and share, and for readers to find what they have written.

- **Write**: manuscript editor with autosave and version history, chapter index, story outline, world notebook, daily tracker, writing sprints, goals, import from Word, text or Markdown, and export to Word, e-book, text, HTML and a full backup.
- **Read**: public library, saved novels, reviews and comments, reading place, private reading links for beta readers, messages between authors.
- **Everywhere**: this website, a desktop app (Electron), an Android wrapper (Capacitor) and a phone app (Flutter, in `mobile/`).

Built with React 19, TypeScript, Vite, Tailwind 4, TipTap and Supabase. It also runs with no cloud database at all: with no keys set, everything is kept in the browser.

## Run it

```bash
npm install
cp .env.example .env     # then fill in your Supabase URL and anon key, or leave blank for local mode
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the website at http://localhost:5173 |
| `npm run build` | Type-check and build the website into `dist/` |
| `npm run lint` | Check the code style |
| `npm run library:build` | Build the sample library from `content/library/` into `src/data/library/` |
| `npm run library:check` | Check the sample novels (chapters, 50,000 words each) without writing anything |
| `npm run test:e2e` | Run the browser tests (see below) |
| `npm run electron:dev` / `electron:build` | Desktop app |
| `npm run electron:publish` | Build the desktop installer and upload it to a draft GitHub release (see "Desktop app and updates") |
| `npm run test:unit` | Plain Node tests: desktop update logic, notification emails |
| `npm run test:sql` | Check the newest Supabase setup script on a real PostgreSQL engine inside Node |
| `npm run test:e2e:cloud` | Browser tests against a stand-in Supabase (`scripts/dev-supabase`) |
| `npm run dev:cloud` | Start the stand-in Supabase on its own |
| `npm run i18n:check` | Compare the Malay translations with the app's text |

## Sample library

The Public Library comes with 20 original novels of 50,000 words or more, across all eight genres, so a new site has something to read. They are marked **Sample**, are written under made-up pen names, and ship inside the app: they are never written to the cloud database.

- **Where they live.** The source is Markdown in `content/library/<novel>/` (`meta.json`, `bible.md`, `outline.md`, `chapters/NN.md`); `content/library/STYLE.md` is the house style and `briefs.json` is the brief for each novel. `npm run library:build` turns them into `src/data/library/` (`index.json` and one file per novel, loaded only when someone opens that novel).
- **Likes, views, reviews and comments** on a sample novel are kept on the reader's device only. Their pen names cannot be followed, messaged, blocked or reported. Covers are drawn by the app from the title and genre.
- **Switch them off** for a whole build with `VITE_SAMPLE_LIBRARY=off`, or on one device with the "Sample novels" choice in Preferences (it sets `localStorage` `novelist_sample_library` to `off`). The app also runs if `src/data/library/` has not been built.
- **Check a chapter** while writing with `node scripts/chapter-check.mjs content/library/<novel>/chapters/01.md --min 2200`. It counts words the way the app does and rejects stock phrases and over-used names.

## Desktop app and updates

`npm run electron:dev` opens the desktop app on the dev server, and `npm run electron:build` makes the Windows installer in `release/`.

The installed app updates itself. A few seconds after it opens, and again every few hours, it asks the GitHub releases of this repository for a newer
version, downloads it quietly, and installs it when the app is closed, or at once from the "Restart now" notice. **Preferences > App updates** shows the
version and has a "Check for updates" button. A copy run from source never updates.

To publish a release:

1. Raise `version` in `package.json`. Each release must be higher than the last, or nobody is offered it.
2. Make a GitHub personal access token that can write to this repository's releases, and set it as `GH_TOKEN` in your terminal.
3. Run `npm run electron:publish`. It builds the website and the installer and uploads them, with the `latest.yml` file the updater reads, to a **draft**
   release. Publish the draft on GitHub.

Not tested: downloading and installing a real release, which needs one to exist. The logic around it is (`npm run test:unit`), and so is the real desktop
app starting and handing its window the update bridge (`e2e/desktop.spec.ts`). The Windows installer is not code-signed, so Windows may warn the first time
it is run. Only a Windows installer is built today; automatic updates on macOS need a signed and notarised build, which is not set up.

## Cloud database

The app needs only a Supabase project and the two keys in `.env`. Some features need one setup step each, run in the Supabase SQL Editor: see [`supabase/README.md`](supabase/README.md).

## Tests

`npm run test:e2e` runs the smoke tests in `e2e/` with [Playwright](https://playwright.dev). They sign in, write, save, reload, import and export files, run a writing sprint, read and report, and delete an account, all in a real browser.

- The tests always run the app in **local mode**: the cloud keys are blanked, so they can never touch your real database. They also block every request that is not to the app itself (the ad script in `index.html` included).
- The sample novels are switched off for every test by `e2e/fixtures.ts`, so a test sees only what it puts in the library. `e2e/sample-library.spec.ts` turns them on and tests them against whatever is built in `src/data/library/`; it skips itself if nothing is built.
- They use the Microsoft Edge that comes with Windows, so nothing has to be downloaded. On a machine without it, run `npx playwright install chromium` once and set `PW_CHANNEL=bundled`.
- `npm run test:e2e:ui` opens Playwright's visual runner. `npm run test:e2e:report` opens the last report.
- Add a test by copying the pattern in `e2e/writing.spec.ts`. Import `test` from `./fixtures`, not from Playwright, so outside requests stay blocked.

Not covered: the real Supabase project (cloud saving, sign-up emails, password reset emails) and the phone app. See [`limit.md`](limit.md).

## More

- [`limit.md`](limit.md): what is known not to work yet, or not tested.
- [`not done.md`](<not done.md>): features that are planned but not started.
- [`mobile/README.md`](mobile/README.md): the phone app.
