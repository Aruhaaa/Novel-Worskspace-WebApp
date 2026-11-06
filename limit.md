# Known limits

Things that are not done or not verified yet. Remove a line when it is fixed.

## Website: Read | Write

- Your answer to "What opens first" is now kept on your account (in Supabase's per-user data, so no database change was needed) and on the device. Another device picks it up with no question. Not run against the real Supabase project: only the local fallback was tried. If a change cannot reach the account (offline), the account's older answer wins on the next sign-in.
- Existing signed-in writers see the question once, on their next visit. An answer already given on a device is copied to the account the next time that device signs in.
- "Continue reading" now opens the chapter you stopped at, and the Continue reading list says which chapter. The place is kept on this device only: it is not shared between devices, and the web and the phone app do not share it. It is saved when you scroll, so a chapter you only opened is not counted.
- A novel's address now works when opened directly or after a refresh (it used to stay on "Loading novel" for ever). A novel that was unpublished, removed, or is by someone you have blocked says it is not available.
- Chapters in the Public Library reader and the Print view are cleaned before they are shown, the same way private reading links already were: scripts, frames, images and other unknown markup are removed.
- The first-visit guided tour appears a few seconds after a new person opens the studio and takes the keyboard from the editor. A new writer who starts typing at that moment loses the keystrokes that land on the tour. The browser tests mark the tours as seen to avoid it. Fix: do not open a tour while a text box is focused.
- Not tested against the real Supabase project. Browser testing ran in local mode (no cloud keys).
- The built app is now split by screen (main script about 600 KB, 175 KB compressed, plus cached vendor files), and the other screens load as they are opened. Offline use after one online visit relies on the service worker, which was tried in the browser tests only.

## Sample library (the 20 bundled novels)

- They are merged into the Public Library in the browser, never stored in Supabase. So they appear on the website, the desktop app and the Android wrapper, but not in the phone app (`mobile/`), which reads only the cloud database and its own device storage, and not in anything that reads the database directly.
- Likes, views, reviews and comments on a sample novel live on the reader's device. They do not add up across devices or people, "Most liked" reflects only that device, and a sample novel's pen name never replies. No likes, views or reviews are invented.
- The pen names are fictional and have no account. They cannot be followed, messaged, blocked or reported, and a sample novel has no Report button. If a real person publishes under the same name, the two are different people.
- The Public Library reader shows every chapter of a novel on one page, as it always has. A novel of 50,000+ words is a long page: scrolling is smooth in a desktop browser, but it was not tried on a phone or an older device.
- Tested in local mode (cloud keys blanked) with the browser tests in `e2e/sample-library.spec.ts`, and by eye on the library cards and the reader. Not run against the real Supabase project: there the library is the published novels plus the sample ones, sorted together by date.
- Covers are drawn by the app from the title and genre. They are plain typographic covers, not artwork.

## Phone app (`mobile/`)

- Not run on a real phone or emulator. The Android debug build compiles; the iOS build was not tried (needs a Mac).
- Not tested against the real Supabase project, only a stand-in server.
- Tapping a reading link in a message does not open the app. It needs Android App Links and iOS Universal Links on your domain. For now the link is pasted in Me, then Open a reading link.
- No version history, export, outline, timeline, tour or story search on the phone yet.
- The mention, highlight and scene-break buttons sit at the end of the scrolling editor toolbar.
- Reading typefaces download on first use; the phone's serif shows until then.
- The app id is still `com.novelist.novelist_workspace`. Change it and add signing keys before any store release.
- Chapter notes and the Recently deleted list sync to the cloud only after `supabase/setup_scripts/20261003_cloud_sync.sql` has been run; until then they stay on the phone.

## Database access rules (found when the schema was pulled on 2026-10-22)

- **Serious:** `projects`, `chapters`, `entities` and `word_count_logs` have policies named "Allow public read / insert / update / delete" that apply to everyone, including people who are not signed in. The website's public key is visible in the browser, so anyone who has it can read, change or delete every novel, chapter, notebook entry and word log in the database, including unpublished drafts. The app's own screens hide other people's drafts, but the database does not stop a direct request. Fix: replace those policies with ones that check ownership (`projects.user_id` is text, `chapters`, `entities` and `word_count_logs` belong to a project) and let only published novels be read by others. Do it in a new migration, test it with two accounts, and take a backup first, because the app's sample and local modes rely on the current behaviour.
- `profiles`, `comments`, `reviews` and `chat_messages` already check who you are.
- The full structure is now in `supabase/migrations/20261022125111_remote_schema.sql`. The two older hand-run scripts moved to `supabase/setup_scripts/`.

## Account safety (reset password, delete account, report and block)

- Not tested against the real Supabase project. Browser testing ran in local mode. The password-reset email, the redirect back to the app, and `delete_my_account()` have not been run for real.
- Password reset needs your site's address in Supabase **Authentication > URL Configuration > Redirect URLs**, and `supabase/setup_scripts/20261008_account_safety.sql` run. See `supabase/README.md`.
- The phone app now has forgot password, change password, delete account, report novel and block writer (see the Phone app section). Not tried on a real phone or against the real Supabase project.
- The admin is identified by a hard-coded email address (`aruhaadmin@novelist.com`) in the Admin screen and in `_is_admin()`. If email confirmation is off in Supabase, anyone could sign up with that address. Turn confirmation on, or move the admin check to a role.
- Blocking hides a person's comments, reviews and novels and stops messages between you. It does not hide your own content from them, and the follower counts on other people's profiles are not adjusted.
- Reports have no automatic action, no email to the admin, and no appeal. The admin has to open the Admin screen to see them.
- The report dialog and Account section were checked through the page, not by eye: the browser pane would not draw a screenshot.

## Import a manuscript (.docx, .txt, .md)

- Files are read on the device. Word files up to 30 MB are accepted; the XML inside is capped at 120 MB so a booby-trapped file cannot fill memory. Older `.doc`, `.rtf`, `.odt`, `.pages`, `.pdf` and `.epub` files are refused with a note on how to convert them.
- Footnotes, endnotes, images, tables and the table of contents are left out or flattened to plain paragraphs. The review step lists what was skipped. Superscript and subscript come through as plain text. Tracked changes: insertions are kept, deletions are dropped.
- A Word subtitle that does not start with "by" is not used as the author name.
- Only tried on files built by hand (Word-style XML, this app's own export, generated text and Markdown) and a stand-in database. Not tried on documents saved by Word, Google Docs or Scrivener, and not against the real Supabase project.
- Chapter titles lose a leading "Chapter 3:" because the app numbers chapters itself. A title written in capitals is turned into title case for the project name only.
- The imported chapters are plain text with the formatting listed above. Mentions, notes and outline links are not created.
- Undo (the button on the "Imported" message) removes the project or chapters the import made, and nothing else. It does not go through Recently deleted. Once the message has gone, delete chapters one by one.

## Writing sprints

- A sprint lasts a set time, counts words you add in that time, and ends with a short summary. It only measures: the words are counted in "words written today" by the normal save, so nothing is counted twice.
- Sprint history is kept on this device for each novel (the last 200). It is not synced to the cloud, and the phone app does not have sprints.
- The clock uses real time. If you leave the editor, or close the page, it keeps running; when you come back an ended sprint is closed with the words counted up to when you left.
- Deleting text during a sprint never takes away words already counted, the same rule as the daily tracker.
- The chime can be blocked by the browser until you have clicked something on the page. Starting a sprint counts as that click.
- Both features were run in a browser in local mode (no cloud keys): import of .txt, .md and a hand-built .docx, append and new-project modes, Undo, the error messages, and a 1-minute sprint with pause, resume, finish and the Tracker card. Not checked: how they look (the browser pane would not draw screenshots), narrow phone widths, focus mode, the chime, a real Word or Google Docs file, and the real Supabase project.
- A Markdown or text file with only one heading becomes a single chapter named after the file, with that heading kept inside the text. Choose "Headings" under Split by to use the heading as the chapter title instead.
- **Phone app, account safety:** forgot password, change password, delete account, "Report this novel" and "Block this writer" are in. They pass 13 new phone tests (103 in all) against the phone-only data source and stand-ins for the cloud. They have not run against the real Supabase project, on a real phone or emulator, or on iOS. Report, block and delete need `supabase/setup_scripts/20261008_account_safety.sql`; without it the phone says plainly that reporting or deleting is not switched on yet, and blocking works on that phone only.
- **Phone app, what it does not have:** comments, reviews, messages and follows do not exist on the phone, so there is nothing to report or block there beyond novels and their writers. The sprint timer and import are website-only for now.


## Round of 2026-11-05: notifications, live messages, collaboration, writing tools, monitoring, updates, sign-in, language

Read this first
- Everything below that talks to Supabase was tested only against the stand-in server in `scripts/dev-supabase` (a real PostgreSQL engine with row level security, triggers and Realtime), never against a real Supabase project. Run `supabase/setup_scripts/20261105_next_features.sql` first (steps in `supabase/README.md`). Until it is run, each feature quietly falls back to this device.
- The checks: `npm run test:sql`, `npm run test:unit`, `npm run test:e2e`, `npm run test:e2e:cloud`, `node scripts/dev-supabase/smoke.mjs`, and in `mobile/` `flutter analyze` and `flutter test`. See the end of this section for when each was last run. The browser tests type and wait on timers, so on a busy computer a few can time out; they are set to run two at a time for that reason, and any that fail should be re-run alone before being called broken.
- The database access rules and the hard-coded admin email are still deferred, as asked (see the section above).

Notifications and live messages
- Email delivery needs an account with an email service, the deployed `notify-email` function and a database webhook (`supabase/README.md`). The rules and wording are tested; sending through a real email service is not. Emails are in English only.
- Phone and browser push messages are NOT built (they need a Firebase project and Apple/Google push keys). The phone app has a notifications screen and a count on the Me tab (cloud only), but they are checked when the app signs in, when the screen opens and when you pull to refresh, not the moment they happen.

Collaboration (co-authors, editors, viewers, live writing)
- Roles are enforced by the screens only. The old "Allow public" policies on projects and chapters still let anyone with the website's public key change them. The invitations, memberships and live channels themselves are protected by the database.
- Live writing happens only in a project that has other people on it, and can be turned off per device in Preferences. If one person has it off (or is on an older copy of the app), their saves can overwrite what the others wrote.
- Both people filling an empty shared chapter at the same moment is handled by giving them the same starting identity. If they had loaded different saved text, the text can appear twice. It does not corrupt the document.
- A viewer sees changes when the writers' autosave lands (a second or two), not keystroke by keystroke.
- Chapter notes, goals, version history and Recently deleted are per person in a shared project, because their tables only the owner can use.
- Tested with two people. Not tried with many, on a slow connection, or against Supabase's real Realtime limits (updates are batched every 80 ms to stay under them).

Sign in with Google or Apple
- Off until you set the provider up in Supabase and set `VITE_AUTH_PROVIDERS`. Tested only with a pretend provider. Not offered in the desktop app or the Android wrapper (Google refuses embedded windows). Not done in the phone app.

Writing tools
- Typewriter scrolling, read aloud, word lookup and the relationship map are in. Read aloud uses the browser's own voices, so Malay depends on the device. Lookup asks dictionaryapi.dev and Datamuse and knows English words only.

Error monitoring
- Needs the setup script to reach the admin; without it errors stay on the device that had them (on the phone alone they are dropped). Errors that happen offline are not queued. The phone app reports too (Me > Help fix problems). Reading the list is limited by the hard-coded admin email.

Desktop app updates
- Not tested with a real release. Only a Windows installer is built and it is not code-signed. Each release needs a higher `version` in `package.json`. See `README.md`.

Language (Bahasa Melayu)
- The website is in Malay on its main screens and in the Write space (about 1,340 sentences in `src/i18n/ms-1.ts` to `ms-10.ts`): the landing page, sign-in, the Read space, messages, notifications, preferences and the account section, sharing a project, the top bar and side panel, Home, Manuscripts, chapter index, the editor (toolbar, rail, version history, writing sprints), outline, notebook, tracker, profile, export, import, reader feedback and reading links, Ctrl K search, the first-visit tours, reporting, and the page a reading link opens. I wrote the translations myself and had them checked by no one: have a Malay speaker read them before they are relied on.
- Still in English: the admin pages, the writing-sprint announcements read to screen readers, the beta-reader web page that Export writes, error messages that come back from the database or the sign-in service, the browser's own "Choose File" button, the sample project and the sample library's novels (English on purpose), and the whole phone app.
- A browser or computer set to Malay opens the site in Malay on its own; the choice in Preferences overrides that. `npm run i18n:check` lists what is marked and what is missing, but it cannot see text that was never wrapped, so a new screen still needs a look in Malay. Dates and numbers follow the language; the number of words, chapters and so on uses the plural rule of the language.

Own domain, sign-in email and plain pages (2026-11-06)
- The site now lives at `https://novelistworkspace.kakamond.com/` (Namecheap domain `kakamond.com`, hosted on Vercel). `kakamond.com` and `www.kakamond.com` redirect to it. The old `novel-worskspace-web-app.vercel.app` address still works. The address is written in `index.html`, `public/sitemap.xml`, `public/robots.txt`, `src/lib/share.ts` (`PUBLIC_APP_URL`), `mobile/lib/config.dart` and `supabase/README.md`, so change all of them together if it ever moves. Anything saved in local mode (guest) at the old address stays in that browser and does not appear at the new one; accounts in the cloud are not affected.
- Sign-in emails (confirm, password reset) go through Resend by SMTP in the Supabase dashboard, set up by hand, and a password reset was checked by the owner. That setup is not in the code, so a new Supabase project needs it again. The optional notification emails (`notify-email`) are NOT turned on.
- Google Search Console is verified for `kakamond.com` with a DNS TXT record (keep it, or verification is lost). AdSense was asked to review the new address and had not answered when this was written. The earlier review of the old address said "Needs attention".
- About, Privacy and Contact are plain HTML files in `public/` (`about.html`, `privacy.html`, `contact.html`, one shared `pages.css`), listed in the sitemap and linked from the landing page footer. They are English only. The contact address `hello@kakamond.com` is a free ImprovMX forwarder (Namecheap Custom MX records `mx1.improvmx.com` and `mx2.improvmx.com`, and the SPF record at `@` is ImprovMX's) to the owner's own inbox, tested by the owner with a message sent to it. Replies come from the owner's own address, and the free plan allows 500 forwarded emails a day. The privacy policy was written by Claude from what the app does, was not reviewed by anyone, is not legal advice, and says nothing that depends on the database access rules being fixed. Read it, and change it when the app changes (new services, new data kept).
- There is no cookie or consent banner. AdSense expects one for visitors in the EU, the UK and Switzerland (Google's own consent message can be switched on in AdSense), and the policy does not claim one exists.
- The page title and description were reworded for search, and a small structured-data block and a plain-text fallback for browsers without JavaScript were added to `index.html`. The title changed from "Novelist Workspace" to "Novelist Workspace: write, plan and publish your novel" (`e2e/sprint.spec.ts` checks it). Search can still only see the landing page and these three pages: the library, novels and profiles are at `#/` addresses, which search engines do not treat as separate pages.
- The service worker (`public/sw.js`) now keeps only the app's own page for offline use. Before, opening About, Privacy or Contact could have replaced that kept copy, so the app opened as one of those pages without a connection.

Last run (2026-11-05, this computer)
- After the very last edit to the website: `npx tsc -b` clean, `npx eslint .` no errors (one old warning in `AppContext.tsx`), `npm run build` passes, `npm run test:unit` 27 of 27, `npm run i18n:check` 1,341 of 1,341 sentences have Malay.
- Browser tests, local (`npx playwright test`): all 68 passed with 2 workers (2.7 minutes). With 4 workers one to three tests timed out on each full run, a different set each time (the sign-in step, the reader's "Back where you left off" note); each passed when run alone or repeated, so the setting is now 2 workers, which takes about as long. Cloud (`npm run test:e2e:cloud`, against the stand-in server in `scripts/dev-supabase`): all 17 passed (1.1 minutes).
- After the domain and plain-pages edits (2026-11-06): `npx tsc -b` clean, `npm run i18n:check` 1,344 of 1,344, and the sprint, desktop and account browser tests passed (20 of 20). The full browser suite was not run again, and the three new pages were looked at by eye in the browser only.
- Run earlier in the round and not touched since: `npm run test:sql` 117 checks, `node scripts/dev-supabase/smoke.mjs` 25, `flutter test` 127 and `flutter analyze` clean. Nothing was tried against a real Supabase project, email service, Google or Apple.
