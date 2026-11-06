// Runs supabase/setup_scripts/20261106_chapter_publishing.sql on a real PostgreSQL engine (PGlite) with the app's real schema and the
// earlier setup scripts, as the roles Supabase uses, and checks who can read and change projects and chapters.
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
const rollback = read('rollback_chapter_publishing.sql');

const db = new PGlite();
let passed = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) passed++;
  else failures.push(`${name}${detail ? '  -> ' + detail : ''}`);
};

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [ADA, BEN, CAT, DAN, EVE] = [uid(1), uid(2), uid(3), uid(4), uid(5)];

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
/** Rows touched by a statement that row-level security may quietly skip */
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

for (const [id, email, name] of [[ADA, 'ada@example.com', 'Ada'], [BEN, 'ben@example.com', 'Ben'], [CAT, 'cat@example.com', 'Cat'], [DAN, 'dan@example.com', 'Dan'], [EVE, 'eve@example.com', 'Eve']]) {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  await db.query('insert into public.profiles (id, display_name) values ($1, $2)', [id, name]);
}

const P1 = uid(101); // Ben's novel, public before the update
const P2 = uid(102); // Ada's novel, private before the update
const [A1, A2, A3] = [uid(201), uid(202), uid(203)];
const [B1, B2] = [uid(211), uid(212)];
await db.query('insert into public.projects (id, user_id, title, is_published, author_name) values ($1, $2, $3, true, $4), ($5, $6, $7, false, $8)', [P1, BEN, 'The Long Light', 'Ben', P2, ADA, 'Salt and Static', 'Ada']);
await db.query('insert into public.chapters (id, project_id, title, position) values ($1, $2, $3, 0), ($4, $2, $5, 1), ($6, $2, $7, 2), ($8, $9, $10, 0), ($11, $9, $12, 1)', [A1, P1, 'One', A2, 'Two', A3, 'Three', B1, P2, 'Alpha', B2, 'Beta']);

// ---------------------------------------------------------------------------------------------------------------------
// 1. Runs twice; what is public today stays public; a second run does not publish a draft again
// ---------------------------------------------------------------------------------------------------------------------
let ran = true;
try {
  await db.exec(publishing);
} catch (e) {
  ran = false;
  failures.push('setup script failed: ' + e.message);
}
check('setup runs', ran);
if (!ran) {
  console.log(failures.join('\n'));
  process.exit(1);
}
check('chapters of a novel that was public stay published', (await count('select count(*) n from public.chapters where project_id = $1 and published_at is not null', [P1])) === 3);
check('chapters of a private novel stay drafts', (await count('select count(*) n from public.chapters where project_id = $1 and published_at is not null', [P2])) === 0);

await db.query('update public.chapters set published_at = null where id = $1', [A3]); // Ben has kept chapter 3 back
let again = true;
try {
  await db.exec(publishing);
} catch (e) {
  again = false;
  failures.push('second run failed: ' + e.message);
}
check('setup runs again without error', again);
check('a second run does not publish a draft again', (await count('select count(*) n from public.chapters where id = $1 and published_at is null', [A3])) === 1);
check('the novel stays listed while some chapter is published', (await count('select count(*) n from public.projects where id = $1 and is_published', [P1])) === 1);

// ---------------------------------------------------------------------------------------------------------------------
// 2. Reading
// ---------------------------------------------------------------------------------------------------------------------
const titlesAnon = await asAnon(() => rows('select title from public.chapters where project_id = $1 order by position', [P1]));
check('anyone reads the published chapters of a listed novel', titlesAnon.length === 2 && titlesAnon[0].title === 'One');
check('anyone does not read the draft chapter', !titlesAnon.some((r) => r.title === 'Three'));
check('anyone sees the listed novel and not the private one', (await asAnon(() => rows('select id from public.projects'))).map((r) => r.id).join() === P1);
check('anyone does not read chapters of a private novel', (await asAnon(() => count('select count(*) n from public.chapters where project_id = $1', [P2]))) === 0);
check('a stranger sees the same as anyone', (await asUser(CAT, () => count('select count(*) n from public.chapters'))) === 2);
check('the owner reads every chapter, drafts too', (await asUser(BEN, () => count('select count(*) n from public.chapters where project_id = $1', [P1]))) === 3);
check('the owner of a private novel reads it and its chapters', (await asUser(ADA, () => count('select count(*) n from public.projects where id = $1', [P2]))) === 1 && (await asUser(ADA, () => count('select count(*) n from public.chapters where project_id = $1', [P2]))) === 2);
check('a stranger does not read a private novel', (await asUser(CAT, () => count('select count(*) n from public.projects where id = $1', [P2]))) === 0);

// ---------------------------------------------------------------------------------------------------------------------
// 3. Writing: the owner, a stranger, a viewer, an editor, a co-author
// ---------------------------------------------------------------------------------------------------------------------
check('a stranger cannot change a chapter', (await asUser(CAT, () => touched("update public.chapters set title = 'x' where id = $1", [A1]))) === 0);
check('a stranger cannot delete a chapter', (await asUser(CAT, () => touched('delete from public.chapters where id = $1', [A1]))) === 0);
check('a stranger cannot add a chapter', await asUser(CAT, () => failsWith(() => db.query("insert into public.chapters (project_id, title, position) values ($1, 'x', 9)", [P1]))));
check('anyone not signed in cannot change anything', await asAnon(() => failsWith(() => db.query("update public.chapters set title = 'x' where id = $1", [A1]))));
check('a stranger cannot change a project', (await asUser(CAT, () => touched("update public.projects set title = 'x' where id = $1", [P1]))) === 0);
check('a stranger cannot delete a project', (await asUser(CAT, () => touched('delete from public.projects where id = $1', [P1]))) === 0);
check('someone cannot add a project in another person\'s name', await asUser(CAT, () => failsWith(() => db.query("insert into public.projects (user_id, title) values ($1, 'x')", [BEN]))));
check('someone can add their own project', await asUser(CAT, async () => { await db.query("insert into public.projects (user_id, title) values ($1, 'Cat novel')", [CAT]); return true; }));
check('the owner cannot hand a project to someone else', await asUser(BEN, () => failsWith(() => db.query('update public.projects set user_id = $1 where id = $2', [CAT, P1]), /permission denied/i)));

await db.query("insert into public.project_members (project_id, user_id, role) values ($1, $2, 'viewer'), ($1, $3, 'editor'), ($1, $4, 'coauthor')", [P1, CAT, DAN, EVE]);
check('a viewer reads drafts of the shared novel', (await asUser(CAT, () => count('select count(*) n from public.chapters where project_id = $1', [P1]))) === 3);
check('a viewer cannot change a chapter', (await asUser(CAT, () => touched("update public.chapters set title = 'x' where id = $1", [A1]))) === 0);
check('an editor can write in a chapter', (await asUser(DAN, () => touched("update public.chapters set content = 'new words' where id = $1", [A1]))) === 1);
check('an editor cannot publish a chapter', await asUser(DAN, () => failsWith(() => db.query('update public.chapters set published_at = now() where id = $1', [A3]), /Only the owner can publish/)));
check('an editor cannot unpublish a chapter', await asUser(DAN, () => failsWith(() => db.query('update public.chapters set published_at = null where id = $1', [A1]), /Only the owner can publish/)));
check('an editor cannot add a chapter', await asUser(DAN, () => failsWith(() => db.query("insert into public.chapters (project_id, title, position) values ($1, 'x', 9)", [P1]))));
check('an editor cannot change the project', (await asUser(DAN, () => touched("update public.projects set title = 'x' where id = $1", [P1]))) === 0);
check('a co-author can change the project', (await asUser(EVE, () => touched("update public.projects set description = 'a book' where id = $1", [P1]))) === 1);
check('a co-author cannot delete the project', (await asUser(EVE, () => touched('delete from public.projects where id = $1', [P1]))) === 0);
let newCh;
check('a co-author can add a chapter, as a draft', await asUser(EVE, async () => {
  newCh = (await rows("insert into public.chapters (project_id, title, position) values ($1, 'Four', 3) returning id, published_at", [P1]))[0];
  return newCh.published_at === null;
}));
check('a co-author cannot publish a chapter', await asUser(EVE, () => failsWith(() => db.query('update public.chapters set published_at = now() where id = $1', [newCh.id]), /Only the owner can publish/)));
check('the owner can publish it', (await asUser(BEN, () => touched('update public.chapters set published_at = now() where id = $1', [newCh.id]))) === 1);
check('a co-author cannot add a chapter already published to a stranger\'s novel', await asUser(EVE, () => failsWith(() => db.query("insert into public.chapters (project_id, title, position, published_at) values ($1, 'x', 5, now())", [P2]))));
check('a co-author can delete a chapter', (await asUser(EVE, () => touched('delete from public.chapters where id = $1', [newCh.id]))) === 1);

// ---------------------------------------------------------------------------------------------------------------------
// 4. Publishing and the library listing
// ---------------------------------------------------------------------------------------------------------------------
const listed = async (id) => (await rows('select is_published from public.projects where id = $1', [id]))[0].is_published;
check('a private novel is not listed', (await listed(P2)) === false);
await asUser(ADA, () => db.query('update public.chapters set published_at = now() where id = $1', [B1]));
check('publishing a first chapter lists the novel', (await listed(P2)) === true);
check('anyone can then read that chapter and only that one', (await asAnon(() => rows('select title from public.chapters where project_id = $1', [P2]))).map((r) => r.title).join() === 'Alpha');
await asUser(ADA, () => db.query('update public.chapters set published_at = null where id = $1', [B1]));
check('unpublishing the last chapter unlists the novel', (await listed(P2)) === false);
check('and anyone can read nothing of it', (await asAnon(() => count('select count(*) n from public.chapters where project_id = $1', [P2]))) === 0);

// the "Publish novel" button, or an older copy of the app, with nothing published: everything is published
await asUser(ADA, () => db.query('update public.projects set is_published = true where id = $1', [P2]));
check('turning a novel on with no chapter published publishes all its chapters', (await count('select count(*) n from public.chapters where project_id = $1 and published_at is not null', [P2])) === 2);
check('the novel stays listed', (await listed(P2)) === true);
// turning it off leaves the chapters' state alone
await asUser(ADA, () => db.query('update public.projects set is_published = false where id = $1', [P2]));
check('turning a novel off keeps which chapters were published', (await count('select count(*) n from public.chapters where project_id = $1 and published_at is not null', [P2])) === 2);
check('and anyone can read none of it', (await asAnon(() => count('select count(*) n from public.chapters where project_id = $1', [P2]))) === 0);
await asUser(ADA, () => db.query('update public.projects set is_published = true where id = $1', [P2]));
check('turning it on again does not touch chapters that are already published', (await count('select count(*) n from public.chapters where project_id = $1 and published_at is not null', [P2])) === 2);
// a novel with some chapters published keeps the others back when turned on
await asUser(ADA, () => db.query('update public.chapters set published_at = null where id = $1', [B2]));
await asUser(ADA, () => db.query('update public.projects set is_published = false where id = $1', [P2]));
await asUser(ADA, () => db.query('update public.projects set is_published = true where id = $1', [P2]));
check('turning on a novel with a chapter published keeps the other chapter back', (await count('select count(*) n from public.chapters where project_id = $1 and published_at is null', [P2])) === 1);

// deleting the last published chapter, and a whole project, work and leave nothing behind
await asUser(ADA, () => db.query('delete from public.chapters where id = $1', [B1]));
check('deleting the last published chapter unlists the novel', (await listed(P2)) === false);
await asUser(CAT, async () => {
  const p = (await rows("select id from public.projects where title = 'Cat novel'"))[0].id;
  const c = (await rows("insert into public.chapters (project_id, title, position, published_at) values ($1, 'x', 0, now()) returning id", [p]))[0];
  void c;
});
check('a project with published chapters can be deleted by its owner', await asUser(CAT, async () => {
  await db.query("delete from public.projects where title = 'Cat novel'");
  return (await count("select count(*) n from public.projects where title = 'Cat novel'")) === 0;
}));
check('its chapters go with it', (await count("select count(*) n from public.chapters where title = 'x'")) === 0);

// ---------------------------------------------------------------------------------------------------------------------
// 5. Likes and views
// ---------------------------------------------------------------------------------------------------------------------
check('someone cannot write likes straight into a novel', await asUser(CAT, () => failsWith(() => db.query("update public.projects set likes = '{x}' where id = $1", [P1]), /permission denied/i)));
check('someone cannot write views straight into a novel', await asUser(CAT, () => failsWith(() => db.query("update public.projects set views = '{x}' where id = $1", [P1]), /permission denied/i)));
const liked = await asUser(CAT, () => rows('select * from public.toggle_project_like($1)', [P1]));
check('a like is saved by the function', liked[0].likes.includes(CAT));
const unliked = await asUser(CAT, () => rows('select * from public.toggle_project_like($1)', [P1]));
check('the same call takes it back', !unliked[0].likes.includes(CAT));
check('someone not signed in cannot like', await asAnon(() => failsWith(() => db.query('select * from public.toggle_project_like($1)', [P1]), /Sign in|permission denied/i)));
check('a stranger cannot like a private novel', await asUser(CAT, () => failsWith(() => db.query('select * from public.toggle_project_like($1)', [P2]), /not found/i)));
check('the owner can like their own private novel', (await asUser(ADA, () => rows('select * from public.toggle_project_like($1)', [P2])))[0].likes.includes(ADA));
const v1 = await asUser(CAT, () => rows('select * from public.record_project_view($1)', [P1]));
const v2 = await asUser(CAT, () => rows('select * from public.record_project_view($1)', [P1]));
check('a view is saved once', v1[0].views.filter((x) => x === CAT).length === 1 && v2[0].views.filter((x) => x === CAT).length === 1);
const v3 = await asAnon(() => rows('select * from public.record_project_view($1)', [P1]));
check('someone not signed in gets the novel back and adds nothing', v3[0].id === P1 && v3[0].views.length === v2[0].views.length);
check('a view of a private novel by a stranger is refused', await asUser(CAT, () => failsWith(() => db.query('select * from public.record_project_view($1)', [P2]), /not found/i)));

// ---------------------------------------------------------------------------------------------------------------------
// 6. Things that already worked still do
// ---------------------------------------------------------------------------------------------------------------------
const link = await asUser(BEN, async () => (await rows('insert into public.share_links (project_id) values ($1) returning token', [P1]))[0].token);
const manuscript = (await asAnon(() => rows('select public.get_shared_manuscript($1) as m', [link])))[0].m;
check('a private reading link still shows every chapter, drafts too', manuscript.chapters.length === 3);
check('a person can still change their own project settings', (await asUser(BEN, () => touched("update public.projects set title = 'The Longer Light', author_name = 'B', genre = 'Fantasy', cover_url = 'x', description = 'd', updated_at = now() where id = $1", [P1]))) === 1);
check('the owner can delete their novel', (await asUser(BEN, () => touched('delete from public.projects where id = $1', [P1]))) === 1);

// ---------------------------------------------------------------------------------------------------------------------
// 7. Rolling back puts the old open access back, and it can be set up again
// ---------------------------------------------------------------------------------------------------------------------
await db.query('insert into public.projects (id, user_id, title, is_published) values ($1, $2, $3, false)', [uid(150), ADA, 'Private again']);
await db.exec(rollback);
check('rollback removes the functions', (await count("select count(*) n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('toggle_project_like','record_project_view','_chapter_sync_listing')")) === 0);
check('rollback puts the open read access back', (await asAnon(() => count('select count(*) n from public.projects where id = $1', [uid(150)]))) === 1);
check('rollback keeps the column', (await count("select count(*) n from information_schema.columns where table_name = 'chapters' and column_name = 'published_at'")) === 1);
let redo = true;
try {
  await db.exec(rollback);
  await db.exec(publishing);
} catch (e) {
  redo = false;
  failures.push('re-setup after rollback failed: ' + e.message);
}
check('rollback can be run twice, and the setup can be run again after it', redo);
check('after setting up again a private novel is private again', (await asAnon(() => count('select count(*) n from public.projects where id = $1', [uid(150)]))) === 0);

console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log('FAIL: ' + f);
process.exit(failures.length ? 1 : 0);
