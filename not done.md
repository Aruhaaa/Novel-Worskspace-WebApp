# Not done

What is still wanted. When one is started, move it into `limit.md` if it is only partly finished.

## Finish the Malay translation

The website is in Malay on its main screens and in the Write space: language choice, the landing page, sign-in, the Read space (reader home, Public Library, the reader, comments, reviews), messages, notifications, preferences (including the account section), sharing a project, the top bar and side panel, and the Write space (Home, Manuscripts, chapter index, the editor with its toolbar, rail, version history and writing sprints, outline, notebook, tracker, profile, export, import, reader feedback and private reading links), the Ctrl K search, the first-visit tours, reporting, and the page a private reading link opens. About 1,340 sentences are translated in `src/i18n/ms-1.ts` to `ms-10.ts`. Left to do:

- A Malay speaker has to read all of it: Claude wrote the translations and nobody has checked them.
- The admin pages (`src/components/Admin/`).
- Text written inside `src/lib` and `src/utils` instead of a screen: the writing-sprint announcements read out for screen readers (`lib/sprint.ts`), several error texts, and the beta-reader web page that Export writes (`utils/betaCopy.ts`).
- Error messages that come back from the database or the sign-in service (they are in English as the service words them).
- Text the browser itself draws, such as the "Choose File" button on the picture field.
- The phone app (`mobile/`) is English only.

`npm run i18n:check` lists what is marked and what is missing, but it cannot see text that was never wrapped in `t()`: look at each new screen in Malay (Preferences > Language).

## Phone app (`mobile/`) catches up

Done: notifications (cloud only, no push), error reporting, and hiding draft chapters from readers. Publishing or taking down a chapter from the chapter list (owner only, shown only once the database script has run) is done. Not started: sign in with Google and Apple (deep link back into the app), shared projects and live writing, read aloud, the relationship map, Malay, uploading a novel cover from the phone (it shows covers, but only the website uploads them), and the language of a novel (the phone neither shows, filters by nor sets it).

## Publishing chapter by chapter: what is left

Built and tested on the stand-in server. Still to do: run `supabase/setup_scripts/20261106_chapter_publishing.sql` on the real database after the website update (steps in `supabase/README.md`), a notification to followers when a new chapter comes out, an Ongoing / Complete label, scheduled publishing, and search-visible pages for novels that writers publish (the static pages cover only the sample novels).

## Novel language: what is left

Built and tested on the stand-in server. Still to do: run `supabase/setup_scripts/20261107_novel_language.sql` on the real database (steps in `supabase/README.md`), link the versions of one story so a reader can switch between them ("also in Bahasa Melayu"), the phone app (show, filter, set), filtering the library to novels with no language, more languages than the seventeen listed, and the language in the share preview and the search box.

## Database access rules

`entities` (the world notebook) and `word_count_logs` still have the old open policies, and the hard-coded admin email is unchanged. `projects` and `chapters` are closed by the script above once it is run.

## Push messages

On the phone (Firebase Cloud Messaging and Apple push) and in the browser (web push). Needs accounts and keys only the owner can make.

## Checks against the real thing

Everything cloud-side was tried only against a stand-in server. Still to do with real accounts: a real Supabase project (the setup scripts, Realtime, private channels for live writing, and file storage for cover pictures), a real email service for notifications, real Google and Apple sign-in, and a real published desktop release for automatic updates.

## Left out on purpose

- Payments, subscriptions or paid chapters.
- The hard-coded admin email, and the open rules on `entities` and `word_count_logs`: deferred by request, still listed in `limit.md`.
