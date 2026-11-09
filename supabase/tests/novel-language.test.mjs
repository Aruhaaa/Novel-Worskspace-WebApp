// Runs supabase/setup_scripts/20261107_novel_language.sql on a real PostgreSQL engine (PGlite) with the app's real schema and the other
// setup scripts, as the roles Supabase uses, and checks the new column: what it accepts, who can change it, running it in either order
// with the chapter publishing script, and rolling it back.
// Run it with:  npm run test:sql
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\/]$/, '');
const read = (p) => readFileSync(`${ROOT}/${p}`, 'utf8');
const base = read('migrations/20261022125111_remote_schema.sql');
const cloud = read('setup_scripts/20261003_cloud_sync.sql');
const next = read('setup_scripts/20261105_next_features.sql');
const publishing = read('setup_scripts/20261106_chapter_publishing.sql');
const language = read('setup_scripts/20261107_novel_language.sql');
const rollback = read('rollback_novel_language.sql');

const db = new PGlite();
let passed = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) passed++;
  else failures.push(`${name}${detail ? '  -> ' + detail : ''}`);
};

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [ADA, BEN, CAT, DAN] = [uid(1), uid(2), uid(3), uid(4)];

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
`);
await db.exec(base);
await db.exec(cloud);
await db.exec(next);

for (const [id, email, name] of [[ADA, 'ada@example.com', 'Ada'], [BEN, 'ben@example.com', 'Ben'], [CAT, 'cat@example.com', 'Cat'], [DAN, 'dan@example.com', 'Dan']]) {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  await db.query('insert into public.profiles (id, display_name) values ($1, $2)', [id, name]);
}
const P1 = uid(101); // Ben's novel, public before the update
const P2 = uid(102); // Ada's novel, private
await db.query('insert into public.projects (id, user_id, title, is_published, author_name) values ($1, $2, $3, true, $4), ($5, $6, $7, false, $8)', [P1, BEN, 'The Long Light', 'Ben', P2, ADA, 'Salt and Static', 'Ada']);

const columnExists = async () => (await count("select count(*) n from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'language'")) === 1;
check('there is no language column before the script', !(await columnExists()));

// The real order for the owner: the language script after everything else. Then chapter publishing is run again (it sets the column permissions afresh).
await db.exec(publishing);
await db.exec(language);

check('the column exists', await columnExists());
check('every novel starts with no language', (await count('select count(*) n from public.projects where language is null')) === 2);
check('anyone can read a listed novel\'s language', (await asAnon(() => rows('select language from public.projects where id = $1', [P1]))).length === 1);

// ---------------------------------------------------------------------------------------------------------------------
// Who can change it
// ---------------------------------------------------------------------------------------------------------------------
const setLanguage = (id, value, project) => asUser(id, () => touched('update public.projects set language = $1 where id = $2', [value, project]));
check('the owner can set the language', (await setLanguage(BEN, 'ms', P1)) === 1);
check('and it is saved', (await rows('select language from public.projects where id = $1', [P1]))[0].language === 'ms');
check('anyone reads it back', (await asAnon(() => rows('select language from public.projects where id = $1', [P1])))[0].language === 'ms');
check('the owner can change it to another', (await setLanguage(BEN, 'en', P1)) === 1);
check('the owner can clear it', (await setLanguage(BEN, null, P1)) === 1 && (await rows('select language from public.projects where id = $1', [P1]))[0].language === null);
check('a stranger cannot change it', (await setLanguage(CAT, 'zh', P1)) === 0);
check('someone not signed in cannot change it', await failsWith(() => asAnon(() => touched('update public.projects set language = $1 where id = $2', ['zh', P1])), /permission denied/i));
await db.query("insert into public.project_members (project_id, user_id, role) values ($1, $2, 'coauthor'), ($1, $3, 'editor')", [P1, CAT, DAN]);
check('a co-author can change it, as they can change the other settings', (await setLanguage(CAT, 'id', P1)) === 1);
check('an editor cannot', (await setLanguage(DAN, 'fr', P1)) === 0);
check('the language did not change under the editor', (await rows('select language from public.projects where id = $1', [P1]))[0].language === 'id');

// ---------------------------------------------------------------------------------------------------------------------
// What it accepts
// ---------------------------------------------------------------------------------------------------------------------
for (const bad of ['English', 'e', 'MS', 'en-GB', 'm s', '12', '']) {
  check(`"${bad}" is refused`, await failsWith(() => setLanguage(BEN, bad, P1), /projects_language_format|check constraint/i));
}
for (const good of ['en', 'ms', 'zh', 'fil']) {
  check(`"${good}" is accepted`, (await setLanguage(BEN, good, P1)) === 1);
}
check('a new novel can be made with a language', !(await failsWith(() => asUser(ADA, () => db.query("insert into public.projects (user_id, title, language) values ($1, 'Second Version', 'ms')", [ADA])))));
check('a new novel can be made without one', !(await failsWith(() => asUser(ADA, () => db.query("insert into public.projects (user_id, title) values ($1, 'No Language')", [ADA])))));
check('a new novel with a bad language is refused', await failsWith(() => asUser(ADA, () => db.query("insert into public.projects (user_id, title, language) values ($1, 'Bad', 'Malay')", [ADA])), /projects_language_format|check constraint/i));
check('the other settings can still be changed together with it', (await asUser(BEN, () => touched("update public.projects set title = 'The Longer Light', genre = 'Fantasy', language = 'ms', updated_at = now() where id = $1", [P1]))) === 1);

// ---------------------------------------------------------------------------------------------------------------------
// Running again, in either order
// ---------------------------------------------------------------------------------------------------------------------
await db.exec(language);
check('running it again leaves one check', (await count("select count(*) n from pg_constraint where conname = 'projects_language_format'")) === 1);
check('running it again keeps what was chosen', (await rows('select language from public.projects where id = $1', [P1]))[0].language === 'ms');
await db.exec(publishing); // sets the column permissions afresh, and must not take this one away
check('running chapter publishing again afterwards keeps the permission to change the language', (await setLanguage(BEN, 'en', P1)) === 1);
check('...and still keeps the other rules: a stranger still cannot', (await setLanguage(CAT, 'ta', P2)) === 0);
check('...and a person still cannot hand a novel to someone else', await failsWith(() => asUser(BEN, () => db.query('update public.projects set user_id = $1 where id = $2', [ADA, P1])), /permission denied/i));

// ---------------------------------------------------------------------------------------------------------------------
// Rolling back
// ---------------------------------------------------------------------------------------------------------------------
await db.exec(rollback);
check('rolling back keeps the column and what is in it', (await columnExists()) && (await rows('select language from public.projects where id = $1', [P1]))[0].language === 'en');
check('after rolling back the language can no longer be changed', await failsWith(() => setLanguage(BEN, 'ms', P1), /permission denied/i));
check('the other settings still can', (await asUser(BEN, () => touched("update public.projects set title = 'Still Works' where id = $1", [P1]))) === 1);
check('the check is gone', (await count("select count(*) n from pg_constraint where conname = 'projects_language_format'")) === 0);
await db.exec(rollback);
await db.exec(language);
check('the script can be run again after a rollback', (await setLanguage(BEN, 'ms', P1)) === 1);

if (failures.length) {
  console.error(`\n${failures.length} of ${passed + failures.length} checks failed:`);
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log(`novel language: ${passed} checks passed`);
