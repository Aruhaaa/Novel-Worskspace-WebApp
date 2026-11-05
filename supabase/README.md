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
   `https://novel-worskspace-web-app.vercel.app/`) to **Redirect URLs**. Without this Supabase will not send people back to the app.
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

# Sign in with Google or Apple (optional, needs your own Google / Apple developer accounts)

The website can show "Continue with Google" and "Continue with Apple" on the sign-in screen. They need accounts only you can make, so
**they are off until you set them up**. Email and password keeps working either way.

Do the Supabase side first. A button for a provider Supabase has not switched on leads to a plain error page from Supabase.

1. **Redirect URL.** In Supabase **Authentication** > **URL Configuration** > **Redirect URLs**, add your site's address, for example
   `https://novel-worskspace-web-app.vercel.app/`. (The same step as password reset. A sign-in from `localhost` needs `http://localhost:5173/` there too.)
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
