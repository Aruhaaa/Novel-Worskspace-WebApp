# Moving the database to another server

Read this before you change database servers, and do step 1 even if you never move.

## What lives where

- **In the repo, the full structure:** `supabase/migrations/20261022125111_remote_schema.sql`, pulled from the live project on
  2026-10-22. It holds all 16 tables, their columns, row level security policies, the 10 functions and the trigger on
  `chat_messages`. Pull again (`npx supabase db pull`) whenever you change the database in the dashboard.
- **In the repo, older hand-run scripts:** `supabase/setup_scripts/20261003_cloud_sync.sql` and `20261008_account_safety.sql`.
  They were run by hand in the SQL Editor and are already inside the pulled file. They are kept out of `supabase/migrations/` on
  purpose: the pulled file creates the same tables, so running them first on a new project would fail.
- **Only inside your Supabase project (not in any file):** the sign-in accounts (the `auth` area) and all the data.
- **Not used at all:** Supabase file storage (covers are drawn by the app) and Realtime (messages are checked every 5 seconds).

Your project reference is the part of `VITE_SUPABASE_URL` in `.env` before `.supabase.co`.

## Step 1: write the existing structure down (do this now)

This makes a file that describes every table, policy and function, so the repo can rebuild the database from nothing.
It is the structure only, not the data.

You need the Supabase CLI and Docker (the CLI uses Docker to compare against a temporary copy).

1. Install **Docker Desktop** and start it.
2. In the project folder:

   ```bash
   npx supabase login
   npx supabase init
   npx supabase link --project-ref <your project reference>
   npx supabase db pull
   ```

   - `login` opens a browser to sign in to Supabase.
   - `link` asks for your **database password** (Supabase dashboard > Project Settings > Database; reset it there if you do not
     have it). Type it only in your own terminal.
   - `db pull` writes a new file in `supabase/migrations/`. Say yes if it asks to update the migration history.
3. Open the new file and look it over. Keep it in the repo. `npx supabase init` also adds `supabase/config.toml`; keep that too.

If the pull says your two later migrations clash with it, that is expected: the new file already contains those tables.
Keep the new file as the base and leave the two older ones for history, or ask for help tidying them.

Without Docker you can use plain Postgres tools instead: install the PostgreSQL client tools, copy the **Session pooler**
connection string from the dashboard (Connect), then:

```bash
pg_dump "<connection string>" --schema-only --schema=public --no-owner --no-privileges -f supabase/schema_snapshot.sql
```

## Step 2: moving to another Supabase project (or self-hosted Supabase)

The app talks to Supabase through its address and key, so a move is mostly copying and changing two values.

1. **Make the new project.** Note its project reference, URL, anon key and database password.
2. **Rebuild the structure.** Either run `npx supabase link --project-ref <new ref>` then `npx supabase db push`
   (uses the migration files from step 1), or paste the schema file into the new project's SQL Editor.
   The pulled file already contains everything from the two scripts in `supabase/setup_scripts/`, so do not run those on a new project.
3. **Copy the data.** With the old and new connection strings (dashboard > Connect > Session pooler):

   ```bash
   npx supabase db dump --db-url "<old connection string>" --data-only -f data.sql
   psql "<new connection string>" -f data.sql
   ```

   People's sign-in accounts live in the `auth` area and are not in the `public` dump. To keep everyone's password working,
   also dump and restore the `auth` tables (`auth.users` and `auth.identities`), or accept that people use "Forgot password"
   once. Test with one account before you move everyone.
4. **Set the admin.** The admin is identified by the email written in `_is_admin()` (see `supabase/setup_scripts/20261008_account_safety.sql`)
   (`aruhaadmin@novelist.com`) and in the Admin screen. Make sure that account exists in the new project.
5. **Point the apps at the new project.**
   - Website: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` and in your Vercel project settings, then redeploy.
   - Phone app: `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `mobile/env.json` (see `mobile/README.md`), then rebuild.
   - Desktop and Android wrapper: rebuild after the website values change.
6. **Sign-in settings.** In the new project, Authentication > URL Configuration: set the Site URL and add your site's address to
   **Redirect URLs** (needed for password-reset emails). Turn email confirmation on. Set up the email sender you want.
7. **Check.** Sign in, open a novel, save a chapter, publish, open a reading link, send a message, reset a password.
8. **Switch over and keep the old project for a while.** Do not delete it until you are sure nothing is missing.

## Moving to something that is not Supabase

Not a quick change. The app uses Supabase for sign-in, for reading and writing every table, for the functions
(`add_share_comment`, `admin_resolve_report`, `delete_my_account`, `delete_share_comment`, `get_shared_manuscript`,
`list_share_comments`, `submit_report`) and for the rules that decide who can see what. Plain Postgres would need the website
layer (`src/services/database.ts`, `src/services/auth.ts`) and the phone app's data layer rewritten, and a replacement for
sign-in and for those rules. Do this only if there is a strong reason.

## Regular backups

- Turn on Supabase **Database > Backups** (daily backups are on paid plans; free projects should take their own).
- Run the `db dump` command from step 2 now and then (structure and data), and keep the files somewhere other than this computer.
