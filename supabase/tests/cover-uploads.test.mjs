// Runs supabase/setup_scripts/20261106_cover_uploads.sql on a real PostgreSQL engine (PGlite) next to a stand-in for Supabase's storage
// tables, as the roles Supabase uses, and checks who can add, change, delete and look at cover files.
// The real Storage service is not here: this checks the SQL (the bucket's settings and the policies), not the upload itself.
// Run it with:  npm run test:sql
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\/]$/, '');
const read = (p) => readFileSync(`${ROOT}/${p}`, 'utf8');
const base = read('migrations/20261022125111_remote_schema.sql');
const covers = read('setup_scripts/20261106_cover_uploads.sql');
const rollback = read('rollback_cover_uploads.sql');

const db = new PGlite();
let passed = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) passed++;
  else failures.push(`${name}${detail ? '  -> ' + detail : ''}`);
};

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [ADA, BEN] = [uid(1), uid(2)];

const claims = async (sub) => {
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)", [sub ?? '', sub ? JSON.stringify({ sub }) : '']);
};
const as = async (role, id, fn) => {
  await db.exec('reset role');
  await claims(id);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
};
const asUser = (id, fn) => as('authenticated', id, fn);
const asAnon = (fn) => as('anon', null, fn);
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const count = async (sql, params) => Number((await rows(sql, params))[0].n);
const touched = async (sql, params) => (await db.query(sql, params)).affectedRows ?? 0;
const failsWith = async (fn, re) => {
  try {
    await fn();
    return false;
  } catch (e) {
    return re ? re.test(String(e.message)) : true;
  }
};

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create schema extensions;
  create function extensions.uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
  create publication supabase_realtime;
  create schema realtime;
  create table realtime.messages (id bigserial primary key, topic text, extension text, payload jsonb, event text);
  create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
  alter table realtime.messages enable row level security;
  grant usage on schema realtime to authenticated;
  grant select, insert on realtime.messages to authenticated;
  grant usage on sequence realtime.messages_id_seq to authenticated;
  grant execute on function realtime.topic() to authenticated;

  -- the tables and the helper function Supabase's storage service keeps (the real ones have more columns)
  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, owner uuid, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now()
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid,
    metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(), unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
  declare _parts text[];
  begin
    select string_to_array(name, '/') into _parts;
    return _parts[1:array_length(_parts, 1) - 1];
  end $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects to anon, authenticated, service_role;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;
  -- a second bucket that is not ours, to see the policies do not reach it
  insert into storage.buckets (id, name, public) values ('other', 'other', true);
`);
await db.exec(base);

const publicPolicies = () => count("select count(*) as n from pg_policies where schemaname = 'public'");
const policiesBefore = await publicPolicies();

await db.exec(covers);

// ---------------------------------------------------------------------------------------------------------------------
// The bucket
// ---------------------------------------------------------------------------------------------------------------------
const bucket = (await rows("select * from storage.buckets where id = 'covers'"))[0];
check('the covers bucket exists', !!bucket);
check('the bucket is public, so covers can be shown to everyone', bucket?.public === true);
check('the bucket allows nothing over 2 MB', Number(bucket?.file_size_limit) === 2097152);
check('the bucket accepts only JPEG, PNG and WebP', JSON.stringify([...(bucket?.allowed_mime_types ?? [])].sort()) === JSON.stringify(['image/jpeg', 'image/png', 'image/webp']));
check('the app\'s own tables and policies are untouched', (await publicPolicies()) === policiesBefore);

// ---------------------------------------------------------------------------------------------------------------------
// Adding
// ---------------------------------------------------------------------------------------------------------------------
const add = (name, bucketId = 'covers') => db.query('insert into storage.objects (bucket_id, name, owner) values ($1, $2, auth.uid())', [bucketId, name]);

check('a signed-in person can add a file in their own folder', !(await failsWith(() => asUser(ADA, () => add(`${ADA}/one.jpg`)))));
check('...and a second one', !(await failsWith(() => asUser(ADA, () => add(`${ADA}/two.jpg`)))));
check('a person cannot add a file in someone else\'s folder', await failsWith(() => asUser(BEN, () => add(`${ADA}/sneaky.jpg`)), /row-level security/i));
check('a file with no folder at all is refused', await failsWith(() => asUser(ADA, () => add('loose.jpg')), /row-level security/i));
check('a file in a deeper folder is read by its first part, so it must still be theirs', await failsWith(() => asUser(BEN, () => add(`${ADA}/deeper/x.jpg`)), /row-level security/i));
check('a person can use subfolders inside their own', !(await failsWith(() => asUser(BEN, () => add(`${BEN}/sub/x.jpg`)))));
check('someone who is not signed in cannot add anything', await failsWith(() => asAnon(() => add(`${ADA}/anon.jpg`)), /row-level security|permission denied/i));
check('the policies do not give a way into other buckets', await failsWith(() => asUser(ADA, () => add(`${ADA}/x.jpg`, 'other')), /row-level security/i));

// ---------------------------------------------------------------------------------------------------------------------
// Looking, replacing, deleting
// ---------------------------------------------------------------------------------------------------------------------
check('a person can look up their own files', (await asUser(ADA, () => count("select count(*) as n from storage.objects where bucket_id = 'covers'"))) === 2);
check('...and not other people\'s', (await asUser(BEN, () => count("select count(*) as n from storage.objects where bucket_id = 'covers' and name like $1", [`${ADA}/%`]))) === 0);
check('someone who is not signed in finds nothing by listing (a public file is served by its address, not through this table)', (await asAnon(() => count("select count(*) as n from storage.objects where bucket_id = 'covers'"))) === 0);

check('a person can replace their own file', (await asUser(ADA, () => touched("update storage.objects set metadata = '{\"size\":1}' where bucket_id = 'covers' and name = $1", [`${ADA}/one.jpg`]))) === 1);
check('a person cannot change someone else\'s file', (await asUser(BEN, () => touched("update storage.objects set metadata = '{}' where bucket_id = 'covers' and name = $1", [`${ADA}/one.jpg`]))) === 0);
check('a person cannot move their file into someone else\'s folder', await failsWith(() => asUser(ADA, () => db.query("update storage.objects set name = $2 where bucket_id = 'covers' and name = $1", [`${ADA}/one.jpg`, `${BEN}/stolen.jpg`])), /row-level security/i));

check('a person cannot delete someone else\'s file', (await asUser(BEN, () => touched("delete from storage.objects where bucket_id = 'covers' and name = $1", [`${ADA}/one.jpg`]))) === 0);
check('someone who is not signed in cannot delete', await failsWith(() => asAnon(() => touched("delete from storage.objects where bucket_id = 'covers'")), /permission denied|row-level security/i) || (await asAnon(() => touched("delete from storage.objects where bucket_id = 'covers'"))) === 0);
check('a person can delete their own file', (await asUser(ADA, () => touched("delete from storage.objects where bucket_id = 'covers' and name = $1", [`${ADA}/two.jpg`]))) === 1);
check('the file that was not theirs to delete is still there', (await count("select count(*) as n from storage.objects where bucket_id = 'covers' and name = $1", [`${ADA}/one.jpg`])) === 1);

// ---------------------------------------------------------------------------------------------------------------------
// Running again, and rolling back
// ---------------------------------------------------------------------------------------------------------------------
await db.exec("update storage.buckets set public = false, file_size_limit = 99 where id = 'covers'");
await db.exec(covers);
check('running it again puts the bucket\'s settings back', (await rows("select public, file_size_limit from storage.buckets where id = 'covers'"))[0].public === true && Number((await rows("select file_size_limit from storage.buckets where id = 'covers'"))[0].file_size_limit) === 2097152);
check('running it again does not double the policies', (await count("select count(*) as n from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'covers_%'")) === 4);
check('running it again does not touch the files', (await count("select count(*) as n from storage.objects where bucket_id = 'covers'")) === 2);
check('there is still one covers bucket', (await count("select count(*) as n from storage.buckets where id = 'covers'")) === 1);

await db.exec(rollback);
check('rolling back removes the four policies', (await count("select count(*) as n from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'covers_%'")) === 0);
check('after rolling back nobody can add a cover', await failsWith(() => asUser(ADA, () => add(`${ADA}/three.jpg`)), /row-level security/i));
check('rolling back keeps the bucket and its files, so covers in use keep showing', (await count("select count(*) as n from storage.buckets where id = 'covers' and public")) === 1 && (await count("select count(*) as n from storage.objects where bucket_id = 'covers'")) === 2);
await db.exec(rollback);
check('rolling back twice is harmless', true);
await db.exec(covers);
check('the script can be run again after a rollback', !(await failsWith(() => asUser(ADA, () => add(`${ADA}/four.jpg`)))));

if (failures.length) {
  console.error(`\n${failures.length} of ${passed + failures.length} checks failed:`);
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log(`cover uploads: ${passed} checks passed`);
