# Cloud setup (one step, about a minute)

The app keeps working without this. Until you run it, chapter notes, goals, version history and the
deleted-chapters bin stay on each device, and private reading links are switched off.

## Turn it on

1. Open your Supabase project, then **SQL Editor** > **New query**.
2. Paste the whole of `supabase/setup_scripts/20261003_cloud_sync.sql` and press **Run**.
3. You should see "Success. No rows returned". Running it again is harmless.
4. Reload the app. Nothing else to configure.

To check it worked, run this in the SQL Editor. It should list six tables:

```sql
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('chapter_notes','project_settings','chapter_snapshots','deleted_chapters','share_links','share_comments');
```

## What happens next, automatically

- Chapter status, synopsis and notes, and the manuscript goal, move up from this device the next time a
  project is opened. Where both the device and the cloud have a copy, the one edited last wins.
- Version history and recently deleted chapters held on a device move up the next time they are opened.
- **Reader feedback** now has a "Private reading links" section on the Chapter index.

## What it changes in your database

It only adds six new tables and four functions. It does not alter, move or delete anything in `projects`,
`chapters`, `entities` or any other existing table, and it never touches policies on them. Private data lives in
its own tables that only the project's owner can read, because chapters and projects of published novels are
readable by anyone. `supabase/rollback_cloud_sync.sql` removes everything it added.

## Reading links: what to know

- A link holds a secret token. Anyone who has the link can read the whole manuscript and comment, with no
  account. Turn a link off from **Reader feedback** and it stops working at once.
- Readers cannot see each other's comments, change the manuscript, or read anything but the shared novel.
- Links point at the site the app is running on. In the desktop app they point at
  `PUBLIC_APP_URL` in `src/lib/share.ts`; change that if your site's address is different.

# Account safety (second step: reports, blocking, deleting an account)

The app keeps working without this too. Until you run it, "Delete my account" and reporting say they are not switched on yet, and
blocking someone works on that device only.

## Turn it on

1. In **SQL Editor** > **New query**, paste the whole of `supabase/setup_scripts/20261008_account_safety.sql` and press **Run**.
2. For password reset emails, open **Authentication** > **URL Configuration** and add your site's address (for example
   `https://novelistworkspace.kakamond.com/`) to **Redirect URLs**. Without this Supabase will not send people back to the app.
3. Reload the app.

Check it worked:

```sql
select table_name from information_schema.tables where table_schema = 'public' and table_name in ('reports', 'user_blocks');
select routine_name from information_schema.routines where routine_schema = 'public'
 and routine_name in ('submit_report', 'admin_resolve_report', 'delete_my_account');
```

## What it adds

- `reports` and `user_blocks` tables, and three functions: `submit_report`, `admin_resolve_report`, `delete_my_account`.
- One trigger on `chat_messages` that refuses a message between two people when either has blocked the other.
  It is the only thing attached to an existing table. `supabase/rollback_account_safety.sql` removes everything.
- The admin is the account whose email is written in `_is_admin()` in that file (`aruhaadmin@novelist.com`, the same one the
  Admin screen checks). Change both if yours differs.

## Things to know

- Reports go to a queue only the admin can read (Admin screen > Reports). The server looks up the reported content itself, so the
  admin sees what was really there. Removing a reported novel unpublishes it; it is not deleted.
- Deleting an account removes the person's novels and everything inside them, their reviews, comments, messages, profile, follows
  and the sign-in itself. Reports they filed are kept. It cannot be undone.


# Notifications, live messages, shared projects and the error log (third step)

The app keeps working without this too. Until you run it there is no bell, messages are checked every few seconds instead of arriving at
once and show no unread counts or "Seen" marks, projects cannot be shared with co-authors, and errors are only kept on the device where
they happened.

## Turn it on

1. Run the two steps above first. This one builds on them: it uses the block list and the admin check from the account-safety script.
2. In **SQL Editor** > **New query**, paste the whole of `supabase/setup_scripts/20261105_next_features.sql` and press **Run**. Running it again is harmless.
3. Realtime must be on for the project (it is by default). The script adds its tables to the `supabase_realtime` publication itself.
4. Reload the app.

Check it worked:

```sql
select table_name from information_schema.tables where table_schema = 'public'
 and table_name in ('notifications', 'notification_settings', 'notification_emails', 'message_reads', 'project_members', 'project_invites', 'client_errors');
select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('notifications', 'message_reads', 'chat_messages');
```

## What it adds

- Tables: `notifications`, `notification_settings`, `notification_emails`, `message_reads`, `project_members`, `project_invites`, `client_errors`.
- Triggers that write a notification when someone follows you, comments on or reviews your novel, messages you, comments on a private
  reading link, or joins your project. They never notify you of your own actions, respect the kinds you switched off, and stay quiet
  about people you have blocked. A busy chat is one line that counts up, not a new line per message.
- Functions: `follow_user` (updates both people's follower lists, which a plain update by the follower could not), `mark_chat_read`,
  `unread_message_counts`, `accept_project_invite`, `preview_project_invite`, `report_client_error`, `admin_error_groups`, `admin_clear_errors`.
- It does not change the policies or columns of `projects`, `chapters`, `entities` or any other table that already existed.
  `supabase/rollback_next_features.sql` removes everything it added.

## The error log

Every screen of the website and the desktop app reports an error nobody caught: what the error said, which screen was open, which
version of the app it was. Never what anyone wrote, never a name or email, and never the secret part of an address (a password-reset
link carries one). People can switch it off in Preferences > Help fix problems. The admin reads the list in **Admin > Errors**, grouped so
one bug is one line. The server refuses more than 50 of the same error a day, and keeps them for 30 days.

## Emails about notifications (optional, needs an account with an email service)

In Preferences > Notifications each kind can be set to "By email". That choice is saved without any of the steps below, and the column
only appears once `VITE_NOTIFY_EMAIL=on` is set for the website. **Nothing is emailed until you do this**, because sending email needs
an email service and an address to send from, which only you can set up.

1. Make an account at an email service and verify your sending domain. The function is written for [Resend](https://resend.com)
   (create an API key). Another service with a similar HTTP interface only needs the `send` function in `supabase/functions/notify-email/index.ts` changed.
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then in this folder: `supabase login`, then `supabase link --project-ref <your project ref>`.
3. Deploy the function: `supabase functions deploy notify-email`. (`supabase/config.toml` already tells Supabase not to ask callers for a
   login token; the function checks its own secret instead.)
4. Give it its settings. Choose a long random text for the secret:

   ```bash
   supabase secrets set RESEND_API_KEY=re_xxx NOTIFY_FROM="Novelist Workspace <notify@yourdomain.com>" NOTIFY_WEBHOOK_SECRET=a-long-random-text APP_URL=https://your-site.example.com
   ```

5. In the dashboard, **Database** > **Webhooks** > **Create a new hook**: table `notifications`, event **Insert**, type **Supabase Edge Functions**,
   function `notify-email`, and add an HTTP header `x-webhook-secret` with the same secret as above.
6. In the website's environment (for example Vercel > Settings > Environment Variables) set `VITE_NOTIFY_EMAIL=on` and redeploy.

What to know:

- Only a brand new notification is emailed. A message line that counts up is an update and stays quiet, so a conversation is one email until the person reads it.
- Only to addresses Supabase has confirmed, only for kinds the person chose, and at most 8 an hour and 30 a day to one person
  (`NOTIFY_MAX_PER_HOUR` and `NOTIFY_MAX_PER_DAY` change that). A delivery that is tried twice is sent once (`notification_emails` is the record).
- The email says who did it and quotes the first 300 characters of the comment, review or message. It is in English whatever language the
  person uses the app in, because the server does not know that choice.
- Not tested with a real email service. The rules and the wording are tested without one (`npm run test:unit`); the call to Resend is the part that is not.

## Testing without a real Supabase project

`npm run test:sql` runs the setup script on a real PostgreSQL engine inside Node, with the app's real schema, and checks what each person can
and cannot do. `npm run test:e2e:cloud` runs the real app in a browser against a stand-in Supabase (`scripts/dev-supabase`) built on the same
engine, with row level security, triggers and Realtime. `npm run dev:cloud` starts the stand-in on its own. It is a good check of this app's
code and of the SQL. It is not Supabase itself, so a real project can still behave differently (for example in how long Realtime takes to reconnect).

# Publishing chapter by chapter, and closing the open access to projects and chapters (fourth step)

`supabase/setup_scripts/20261106_chapter_publishing.sql`. Needs the third step first. Safe to run more than once.

**Order matters. Update the website first, run the script second.** The new website works before and after the script (likes fall back to the old
way, and the per-chapter buttons stay hidden until the script has run). An old copy of the website, run against a database that has had the script,
cannot save likes or views and cannot change a project it does not own. The desktop app is updated by its own release; a copy that has not updated
yet has the same problem, so release first.

1. Deploy the new website, and publish the desktop release if you use it.
2. In **SQL Editor** > **New query**, paste the whole of `supabase/setup_scripts/20261106_chapter_publishing.sql` and press **Run**.
3. Check: `select count(*) filter (where published_at is not null) as published, count(*) as all_chapters from public.chapters;` The chapters of
   every novel that was public are published, so nothing readers could see before has gone.

**What it does**
- Adds `chapters.published_at` (empty = draft). A novel is listed in the Public Library while at least one chapter is published, and the database keeps
  `projects.is_published` in step. Turning a whole novel on from the Publish button publishes all its chapters when none was. Turning it off keeps which
  chapters were published, so turning it on again brings the same ones back.
- Only the **owner** can publish or unpublish a chapter (a trigger refuses anyone else, editors and co-authors included).
- **Replaces the open "Allow public ..." policies on `projects` and `chapters`.** Anyone can read a listed novel and its published chapters. The owner and the
  people a project is shared with can read everything in it. The owner and co-authors can change a project (but not hand it to someone else); the owner can
  delete it. The owner and co-authors can add and delete chapters; editors can write in them; viewers can read.
- Likes and views are saved by two functions, `toggle_project_like` and `record_project_view`, because other people may no longer change a novel directly. A visitor who is
  not signed in can be counted as nobody: views and likes belong to signed-in accounts.

**What it does not change:** `entities` (the world notebook), `word_count_logs` and a few other tables still have their old open policies (see `limit.md`).
A project saved with a `user_id` that is not any account's id (for example `anonymous`, from before accounts) is no longer readable by anyone unless it is public.

**To undo it:** `supabase/rollback_chapter_publishing.sql` puts the old open access back and removes the triggers and functions. It keeps the column.

`npm run test:sql` runs both SQL test files, including `supabase/tests/chapter-publishing.test.mjs` (who can read and change what, publishing and the listing,
likes, the backfill, running twice, rolling back). The cloud browser tests (`npm run test:e2e:cloud`) run against a stand-in that has the script, and a third one
(`e2e/cloud/chapters.before-publishing.spec.ts`) against one that does not.

# Uploading a cover picture (fifth step, independent of the others)

`supabase/setup_scripts/20261106_cover_uploads.sql`. Needs none of the other steps. Safe to run more than once.

The novel settings (Manuscripts > Edit details) let a writer upload a cover picture instead of pasting a link. The website shrinks the picture to at most
800 x 1200 as a JPEG (about 100 to 200 KB) and sends it to a public storage bucket called `covers`. Until the script has been run there is no such bucket:
choosing a picture then says "Picture upload is not switched on for this site yet", the rest of the form keeps what was typed, and pasting a link still works.
Nothing breaks, so this can be run before or after the website update, or together with the fourth step.

1. In **SQL Editor** > **New query**, paste the whole of `supabase/setup_scripts/20261106_cover_uploads.sql` and press **Run**.
2. Check it: `select id, public, file_size_limit from storage.buckets where id = 'covers';` should list one row, public, 2097152.
3. In the app, open Manuscripts > Edit details on a novel, choose a picture and save. In the dashboard under **Storage** > `covers` there is now a folder named after your
   account id with one file in it.

**What it does**
- Makes the public `covers` bucket (JPEG, PNG and WebP only, 2 MB at most). Anyone can look at a cover, which is what makes it show with a published novel.
- Four policies on `storage.objects` let a signed-in person list, add, replace and delete files **only inside their own folder** (the first part of every file name is their
  account id). Nobody can write into someone else's folder, and someone who is not signed in cannot write at all.
- It changes no table of the app.

**Good to know**
- A replaced or removed cover, and every cover of an account that is deleted, is deleted from the bucket by the website. This is best effort: if the person is offline at that
  moment, the file stays (a few KB, and nothing links to it). Empty the `covers` bucket in the dashboard if you ever want to clear leftovers.
- With no account (this device only) a cover is kept inside the project itself, as a data address, because there is no server.
- The phone app shows these covers (they are ordinary web addresses) but cannot upload one yet.

**To undo it:** `supabase/rollback_cover_uploads.sql` removes the policies, so nobody can upload any more. It keeps the bucket and its files, so covers in use keep showing.

`npm run test:sql` runs `supabase/tests/cover-uploads.test.mjs` (the bucket's settings and who can add, change and delete what). The cloud browser tests
(`e2e/cloud/covers.*.spec.ts`) upload through the real app to the stand-in's storage, with and without the script. The stand-in's storage is a small imitation
(files in memory, the policies above checked as the real service does), not Supabase Storage itself.

# The language a novel is written in (sixth step, independent of the others)

`supabase/setup_scripts/20261107_novel_language.sql`. Needs none of the other steps and can be run in any order with them. Safe to run more than once.

A writer chooses the language of each novel (English, Bahasa Melayu and fifteen others) when starting it, in Manuscripts > Edit details, and when publishing a
novel that has none yet. The same story in two languages is two novels, each with its own language, published one by one. Readers see the language on each card
and, once the library holds novels in more than one language, can filter by it. Until the script has been run, the website says "Choosing a language is not
switched on for this site yet" in Edit details, does not offer the choice when starting a novel (except for a first novel, where it is simply left out when saving),
and publishes as before. Nothing breaks, so this can be run before or after the website update.

1. In **SQL Editor** > **New query**, paste the whole of `supabase/setup_scripts/20261107_novel_language.sql` and press **Run**.
2. Check it: `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'language';` lists one row.
3. In the app, open Manuscripts > Edit details on a novel: there is now a "Language of this novel" choice.

**What it does**
- Adds one column, `projects.language` (a two or three letter code such as `en` or `ms`, or nothing), and a check that refuses anything else.
- Lets the people who may change a project's other settings (the owner and co-authors) change it. Editors, viewers, strangers and visitors cannot.
- Every novel starts with no language. Nothing is guessed: a novel is asked when it is next published, or the writer sets it in Edit details.

**Good to know**
- If the chapter publishing script (fourth step) is run again after this one, it keeps this permission; the order does not matter.
- The phone app does not show or set the language yet. A novel published from the phone keeps whatever language it already had (none, for a new one).

**To undo it:** `supabase/rollback_novel_language.sql` stops the language being changed and checked. It keeps the column and every language already chosen.

`npm run test:sql` runs `supabase/tests/novel-language.test.mjs` (what the column accepts, who can change it, both orders with the chapter publishing script,
rolling back). The cloud browser tests (`e2e/cloud/language.*.spec.ts`) run the real app against the stand-in with and without the script.

# Sign in with Google or Apple (optional, needs your own Google / Apple developer accounts)

The website can show "Continue with Google" and "Continue with Apple" on the sign-in screen. They need accounts only you can make, so
**they are off until you set them up**. Email and password keeps working either way.

Do the Supabase side first. A button for a provider Supabase has not switched on leads to a plain error page from Supabase.

1. **Redirect URL.** In Supabase **Authentication** > **URL Configuration** > **Redirect URLs**, add your site's address, for example
   `https://novelistworkspace.kakamond.com/`. (The same step as password reset. A sign-in from `localhost` needs `http://localhost:5173/` there too.)
2. **Google.** In the [Google Cloud console](https://console.cloud.google.com): set up the OAuth consent screen, then **APIs & Services** >
   **Credentials** > **Create credentials** > **OAuth client ID** > **Web application**. Under Authorized redirect URIs add the callback address
   Supabase shows on its Google provider page (it looks like `https://<project ref>.supabase.co/auth/v1/callback`). Copy the client ID and secret.
   In Supabase **Authentication** > **Sign In / Providers** > **Google**, switch it on and paste them.
3. **Apple.** Needs the paid Apple Developer Program. Create a Services ID with "Sign in with Apple" whose return address is the same Supabase
   callback, and a key. Supabase's Apple provider page asks for the Services ID and a **secret** made from the key. That secret expires after six
   months, and sign-in with Apple stops working on the day it does, so put a reminder in your calendar to make a new one.
4. **Tell the website.** Set `VITE_AUTH_PROVIDERS` to the ones you finished, for example `google` or `google,apple`, in the site's environment
   (for example Vercel > Settings > Environment Variables) and redeploy.

What to know:

- By default Supabase treats a provider sign-in with the same **verified** email address as the same account, so someone who signed up with a
  password and later uses Google with that address lands in the same account.
- A new account made this way gets the same one question as everyone ("What opens first") and starts with an empty display name. The provider's
  real name is not copied into the public profile.
- Not offered in the desktop app or the Android wrapper, on purpose: Google refuses to sign anyone in from inside another program's window.
  They keep email and password. The phone app is covered in `mobile/README.md`.
- Tested against a stand-in provider that answers at once (`e2e/cloud/providers.cloud.spec.ts`): the buttons, the trip out and back, the one
  question, a refusal, and the buttons staying away in the desktop app. **Not tested with real Google or Apple.**

## Sharing a project and writing together

Part of the same third-step script. There is nothing more to switch on: once it has been run, **Manuscripts > Share** works.

- **Invitations.** The owner makes an invitation link for a role: *co-author* (writes and arranges everything except sharing, publishing and deleting), *editor* (writes in the chapters) or *viewer* (reads). A link works for 1, 7 or 30 days and admits 1 to 50 people. It can be switched off at any time. Someone who is not signed in sees what the link is for, then signs in and comes straight back to it.
- **Who may do what** is checked by the screens. The invitations, memberships and the live channels are checked by the database itself (row level security and the `project_role()` function), so a stranger cannot read the member list, make an invitation, raise their own role, or join a project's live channel. Until the fourth step (`20261106_chapter_publishing.sql`) is run, the older "Allow public" policies on projects and chapters are still open to anyone with the website's public key (see `limit.md`), so a determined person could change chapters directly. That step replaces those two tables' policies with ones that follow the roles.
- **Writing together.** When a project has other people on it and two or more have the same chapter open, they write in it together: each sees the other's cursor and changes as they type. It travels over a private Realtime channel named `project:<project id>:doc:<chapter id>` that only people on the project may join (two policies on `realtime.messages`, created by the script). Each person's editor still saves the chapter to the database as before. It can be turned off per device in Preferences > Writing together. If the editor says "Not connected to the others", Realtime is off for the project, or the two policies are missing: run the script again.
- A viewer sees a chapter change when the writers' autosave lands (a second or two later), not keystroke by keystroke.
- Tested against the stand-in server with two people (`npm run test:e2e:cloud`, `e2e/cloud/collab.cloud.spec.ts`) and in local mode with two tabs (`e2e/collab.spec.ts`). Not tried with more people, on a slow connection, or against a real Supabase project.
