# Not done

What is still wanted. When one is started, move it into `limit.md` if it is only partly finished.

## Finish the Malay translation

The language system and about 300 marked sentences are in, but `src/i18n/ms.ts` is empty. Left to do: write the Malay for every marked sentence (`npm run i18n:check` lists them), then mark and translate the rest of the main screens: the landing page and its sample workspace labels, the sign-in form (`AuthView.tsx`), the genre names (`src/lib/genres.ts` and `GenreChips.tsx`), the Public Library headings and the reader. Other screens can follow.

## Phone app (`mobile/`) catches up

Not started in this round: a notifications screen and unread counts, sign in with Google and Apple (deep link back into the app), error reporting to the admin, read aloud, shared projects and live writing, the relationship map, and the language choice.

## Push messages

On the phone (Firebase Cloud Messaging and Apple push) and in the browser (web push). Needs accounts and keys only the owner can make.

## Checks against the real thing

Everything cloud-side was tried only against a stand-in server. Still to do with real accounts: a real Supabase project (the setup script, Realtime, private channels), a real email service for notifications, real Google and Apple sign-in, and a real published desktop release for automatic updates.

## Left out on purpose

- Payments, subscriptions or paid chapters.
- The database access rules and the hard-coded admin email: deferred by request, still listed in `limit.md`.
