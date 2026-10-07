# Cloud setup (one step, about a minute)

The app keeps working without this. Until you run it, chapter notes, goals, version history and the
deleted-chapters bin stay on each device, and private reading links are switched off.

## Turn it on

1. Open your Supabase project, then **SQL Editor** > **New query**.
2. Paste the whole of `supabase/migrations/20261003_cloud_sync.sql` and press **Run**.
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
