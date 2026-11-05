// Runs supabase/setup_scripts/20261105_next_features.sql on a real PostgreSQL engine (PGlite, in this process, nothing to install
// but `npm install`) with the app's real schema (supabase/migrations/...remote_schema.sql), as the roles Supabase uses, and checks
// what each person can and cannot do. Run it with:  npm run test:sql
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The supabase folder, wherever the project lives
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\/]$/, '');
const base = readFileSync(`${ROOT}/migrations/20261022125111_remote_schema.sql`, 'utf8');
const next = readFileSync(`${ROOT}/setup_scripts/20261105_next_features.sql`, 'utf8');
const rollback = readFileSync(`${ROOT}/rollback_next_features.sql`, 'utf8');

const db = new PGlite();
let passed = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) passed++;
  else failures.push(`${name}${detail ? '  -> ' + detail : ''}`);
};

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [U1, U2, U3, U4, ADMIN] = [uid(1), uid(2), uid(3), uid(4), uid(9)];

const claims = async (sub, email) => {
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)", [
    sub ?? '',
    sub ? JSON.stringify({ sub, email: email ?? null }) : '',
  ]);
};
const asUser = async (id, fn, email) => {
  await db.exec('reset role');
  await claims(id, email);
  await db.exec('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
};
const asAnon = async (fn) => {
  await db.exec('reset role');
  await claims(null);
  await db.exec('set role anon');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
};
const failsWith = async (fn, re) => {
  try {
    await fn();
    return false;
  } catch (e) {
    return re ? re.test(String(e.message)) : true;
  }
};
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await rows(sql, params))[0];
const count = async (sql, params) => Number((await one(sql, params)).n);

// ---------------------------------------------------------------------------------------------------------------------
// The platform pieces Supabase provides, as stand-ins
// ---------------------------------------------------------------------------------------------------------------------
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

// People and a project each
const emails = { [U1]: 'ada@example.com', [U2]: 'ben@example.com', [U3]: 'cat@example.com', [U4]: 'dan@example.com', [ADMIN]: 'aruhaadmin@novelist.com' };
for (const [id, email] of Object.entries(emails)) await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
const names = { [U1]: 'Ada', [U2]: 'Ben', [U3]: 'Cat', [U4]: 'Dan' };
for (const [id, name] of Object.entries(names)) await db.query('insert into public.profiles (id, display_name) values ($1, $2)', [id, name]);
const P1 = uid(101); // Ben's novel
const P2 = uid(102); // Ada's novel
const CH1 = uid(201);
await db.query('insert into public.projects (id, user_id, title, is_published) values ($1, $2, $3, true), ($4, $5, $6, true)', [P1, U2, 'The Long Light', P2, U1, 'Salt and Static']);
await db.query('insert into public.chapters (id, project_id, title, position) values ($1, $2, $3, 0)', [CH1, P1, 'One']);

// ---------------------------------------------------------------------------------------------------------------------
// 1. The setup runs, and runs again
// ---------------------------------------------------------------------------------------------------------------------
let ran = true;
try {
  await db.exec(next);
  await db.exec(next);
} catch (e) {
  ran = false;
  failures.push('setup script failed: ' + e.message);
}
check('setup runs twice without error', ran);
if (!ran) {
  console.log(failures.join('\n'));
  process.exit(1);
}

const newTables = ['notifications', 'notification_settings', 'message_reads', 'project_members', 'project_invites', 'client_errors', 'notification_emails'];
for (const t of newTables) check(`table ${t} exists`, (await one(`select to_regclass('public.${t}') is not null as ok`)).ok);
const pubTables = (await rows("select tablename from pg_publication_tables where pubname = 'supabase_realtime'")).map((r) => r.tablename);
for (const t of ['notifications', 'message_reads', 'chat_messages']) check(`${t} is in the realtime publication`, pubTables.includes(t));

// ---------------------------------------------------------------------------------------------------------------------
// 2. Follow notifications
// ---------------------------------------------------------------------------------------------------------------------
await asUser(U1, () => db.query('update public.profiles set following = $1 where id = $2', [[U2], U1]));
let n = await rows("select * from public.notifications where user_id = $1 and kind = 'follow'", [U2]);
check('following someone tells them once', n.length === 1);
check('the follow notification names who followed', n[0]?.actor_name === 'Ada' && n[0]?.actor_id === U1);
await asUser(U1, () => db.query('update public.profiles set following = $1 where id = $2', [[U2], U1]));
check('saving the same follow list again adds nothing', (await count("select count(*) n from public.notifications where user_id = $1", [U2])) === 1);
await asUser(U1, () => db.query('update public.profiles set following = $1 where id = $2', [[U2, U3], U1]));
check('a second follow notifies only the new person', (await count("select count(*) n from public.notifications where user_id = $1 and kind = 'follow'", [U3])) === 1 && (await count("select count(*) n from public.notifications where user_id = $1", [U2])) === 1);
await asUser(U1, () => db.query('update public.profiles set following = $1 where id = $2', [[U3], U1]));
check('unfollowing sends nothing', (await count('select count(*) n from public.notifications')) === 2);
await asUser(U1, () => db.query('update public.profiles set following = $1 where id = $2', [[U3, U1, 'bundled-author-ilves'], U1]));
check('following yourself, or a sample pen name, notifies nobody and does not fail', (await count('select count(*) n from public.notifications')) === 2);

// muted and blocked
await asUser(U2, () => db.query("insert into public.notification_settings (user_id, muted_kinds) values ($1, '{follow}')", [U2]));
await asUser(U4, () => db.query('update public.profiles set following = $1 where id = $2', [[U2], U4]));
check('a switched-off kind is not delivered', (await count("select count(*) n from public.notifications where user_id = $1 and actor_id = $2", [U2, U4])) === 0);
await asUser(U3, () => db.query("insert into public.user_blocks (blocker_id, blocked_id) values ($1, $2)", [U3, U4]));
await asUser(U4, () => db.query('update public.profiles set following = $1 where id = $2', [[U2, U3], U4]));
check('someone you blocked cannot notify you', (await count("select count(*) n from public.notifications where user_id = $1 and actor_id = $2", [U3, U4])) === 0);
await asUser(U2, () => db.query("delete from public.notification_settings where user_id = $1", [U2]));
await db.exec('delete from public.notifications');

// ---------------------------------------------------------------------------------------------------------------------
// 3. follow_user
// ---------------------------------------------------------------------------------------------------------------------
await db.exec("update public.profiles set following = '{}', followers = '{}'");
const f1 = await asUser(U1, () => one('select public.follow_user($1) as r', [U3]));
check('follow_user says now following', f1.r === true);
const pa = await one('select following, followers from public.profiles where id = $1', [U1]);
const pc = await one('select following, followers from public.profiles where id = $1', [U3]);
check('follow_user updates both profiles, which a plain update by the follower could not', pa.following.includes(U3) && pc.followers.includes(U1));
check('follow_user notifies the author', (await count("select count(*) n from public.notifications where user_id = $1 and kind = 'follow'", [U3])) === 1);
const f2 = await asUser(U1, () => one('select public.follow_user($1) as r', [U3]));
const pa2 = await one('select following from public.profiles where id = $1', [U1]);
const pc2 = await one('select followers from public.profiles where id = $1', [U3]);
check('calling it again unfollows from both sides', f2.r === false && !pa2.following.includes(U3) && !pc2.followers.includes(U1));
check('you cannot follow yourself', await asUser(U1, () => failsWith(() => one('select public.follow_user($1)', [U1]), /yourself/)));
check('an unknown author is refused', await asUser(U1, () => failsWith(() => one('select public.follow_user($1)', [uid(77)]), /not found/)));
check('a signed-out visitor cannot follow', await asAnon(() => failsWith(() => one('select public.follow_user($1)', [U3]))));
await asUser(U3, () => db.query("insert into public.user_blocks (blocker_id, blocked_id) values ($1, $2) on conflict do nothing", [U3, U1]));
check('a block in either direction stops a follow', await asUser(U1, () => failsWith(() => one('select public.follow_user($1)', [U3]), /can't follow/)));
await db.exec('delete from public.user_blocks; delete from public.notifications');

// ---------------------------------------------------------------------------------------------------------------------
// 4. Comments, reviews and reading-link comments tell the novel's owner
// ---------------------------------------------------------------------------------------------------------------------
await asUser(U1, () => db.query("insert into public.comments (project_id, chapter_id, user_id, content) values ($1, $2, $3, 'I loved the lamp.')", [P1, CH1, U1]));
n = await rows("select * from public.notifications where user_id = $1 and kind = 'comment'", [U2]);
check('a comment on your novel notifies you', n.length === 1 && n[0].snippet === 'I loved the lamp.' && n[0].meta.project_title === 'The Long Light' && n[0].actor_name === 'Ada');
await asUser(U2, () => db.query("insert into public.comments (project_id, user_id, content) values ($1, $2, 'Thanks')", [P1, U2]));
check('your own comment on your own novel notifies nobody', (await count("select count(*) n from public.notifications where kind = 'comment'")) === 1);
await asUser(U1, () => db.query("insert into public.reviews (project_id, user_id, rating, content) values ($1, $2, 5, 'Beautiful.')", [P1, U1]));
n = await rows("select * from public.notifications where user_id = $1 and kind = 'review'", [U2]);
check('a review notifies the owner and carries the rating', n.length === 1 && n[0].meta.rating === 5);

const link = await asUser(U2, () => one('insert into public.share_links (project_id) values ($1) returning token', [P1]));
await asAnon(() => one("select public.add_share_comment($1, 'reader-key-1', 'Mina', $2, 'the lamp', 'Why does it fail?')", [link.token, CH1]));
n = await rows("select * from public.notifications where user_id = $1 and kind = 'share_comment'", [U2]);
check('a comment on a private reading link notifies the owner by the reader\'s name', n.length === 1 && n[0].actor_name === 'Mina' && n[0].actor_id === null && n[0].meta.chapter_title === 'One');

// ---------------------------------------------------------------------------------------------------------------------
// 5. Messages: one line per sender that counts up, and read marks
// ---------------------------------------------------------------------------------------------------------------------
await db.exec('delete from public.notifications');
for (const text of ['Hello', 'Are you there?', 'The lamp scene works!']) {
  await asUser(U1, () => db.query('insert into public.chat_messages (sender_id, receiver_id, content) values ($1, $2, $3)', [U1, U2, text]));
}
n = await rows("select * from public.notifications where user_id = $1 and kind = 'message'", [U2]);
check('three messages from one person are one notification', n.length === 1 && n[0].count === 3);
check('the notification shows the latest message', n[0].snippet === 'The lamp scene works!');
await asUser(U3, () => db.query('insert into public.chat_messages (sender_id, receiver_id, content) values ($1, $2, $3)', [U3, U2, 'Hi Ben']));
check('another sender gets their own line', (await count("select count(*) n from public.notifications where user_id = $1 and kind = 'message'", [U2])) === 2);

let unread = await asUser(U2, () => rows('select * from public.unread_message_counts() order by unread desc'));
check('unread counts per sender are right', unread.length === 2 && unread[0].sender_id === U1 && Number(unread[0].unread) === 3 && Number(unread[1].unread) === 1);
check('a signed-out visitor cannot read counts', await asAnon(() => failsWith(() => rows('select * from public.unread_message_counts()'))));

await asUser(U2, () => one('select public.mark_chat_read($1)', [U1]));
unread = await asUser(U2, () => rows('select * from public.unread_message_counts()'));
check('reading a conversation clears its count and nobody else\'s', unread.length === 1 && unread[0].sender_id === U3);
check('reading a conversation marks its notification read', (await count("select count(*) n from public.notifications where user_id = $1 and actor_id = $2 and read_at is not null", [U2, U1])) === 1);
await asUser(U1, () => db.query('insert into public.chat_messages (sender_id, receiver_id, content) values ($1, $2, $3)', [U1, U2, 'One more']));
check('a message after reading starts a new notification', (await count("select count(*) n from public.notifications where user_id = $1 and actor_id = $2 and read_at is null and count = 1", [U2, U1])) === 1);

// Marking read only up to a moment leaves later messages unread
await db.exec("delete from public.message_reads; delete from public.chat_messages");
await db.query("insert into public.chat_messages (sender_id, receiver_id, content, created_at) values ($1, $2, 'early', now() - interval '10 minutes'), ($1, $2, 'late', now() - interval '1 minute')", [U1, U2]);
await asUser(U2, () => one("select public.mark_chat_read($1, now() - interval '5 minutes')", [U1]));
unread = await asUser(U2, () => rows('select * from public.unread_message_counts()'));
check('read marks go up to a moment, not past it', unread.length === 1 && Number(unread[0].unread) === 1);
await asUser(U2, () => one("select public.mark_chat_read($1, now() - interval '9 minutes')", [U1]));
check('a read mark never moves backwards', (await one('select read_until < now() - interval \'6 minutes\' as back from public.message_reads where user_id = $1', [U2])).back === false);
await asUser(U2, () => one("select public.mark_chat_read($1, now() + interval '1 hour')", [U1]));
check('a read mark cannot be set in the future', (await one("select read_until <= now() as ok from public.message_reads where user_id = $1 and peer_id = $2", [U2, U1])).ok === true);

check('the sender can see the other person\'s read mark (for "Seen")', (await asUser(U1, () => rows('select * from public.message_reads where user_id = $1 and peer_id = $2', [U2, U1]))).length === 1);
check('a third person cannot see it', (await asUser(U3, () => rows('select * from public.message_reads'))).length === 0);
check('nobody can write a read mark for someone else', await asUser(U1, () => failsWith(() => db.query("insert into public.message_reads (user_id, peer_id) values ($1, $2)", [U2, U3]))));
check('nobody can mark themselves as the peer', await asUser(U1, () => failsWith(() => db.query("insert into public.message_reads (user_id, peer_id) values ($1, $1)", [U1]))));

// ---------------------------------------------------------------------------------------------------------------------
// 6. What each person may do with notifications and their settings
// ---------------------------------------------------------------------------------------------------------------------
await db.exec('delete from public.notifications');
await db.query("insert into public.notifications (user_id, actor_id, kind, snippet) values ($1, $2, 'follow', 'a'), ($3, $2, 'follow', 'b')", [U2, U1, U3]);
let mine = await asUser(U2, () => rows('select * from public.notifications'));
check('you see only your own notifications', mine.length === 1 && mine[0].snippet === 'a');
check('a signed-out visitor sees none', (await asAnon(() => failsWith(() => rows('select * from public.notifications')))));
check('you cannot write a notification yourself', await asUser(U2, () => failsWith(() => db.query("insert into public.notifications (user_id, kind) values ($1, 'follow')", [U2]))));
check('you cannot rewrite what a notification says', await asUser(U2, () => failsWith(() => db.query("update public.notifications set snippet = 'changed' where user_id = $1", [U2]))));
await asUser(U2, () => db.query('update public.notifications set read_at = now() where user_id = $1', [U2]));
check('you can mark your own as read', (await count("select count(*) n from public.notifications where user_id = $1 and read_at is not null", [U2])) === 1);
await asUser(U2, () => db.query('update public.notifications set read_at = now() where user_id = $1', [U3]));
check('you cannot mark someone else\'s as read', (await count("select count(*) n from public.notifications where user_id = $1 and read_at is not null", [U3])) === 0);
await asUser(U2, () => db.query('delete from public.notifications where user_id = $1', [U3]));
check('you cannot delete someone else\'s', (await count("select count(*) n from public.notifications where user_id = $1", [U3])) === 1);
await asUser(U2, () => db.query('delete from public.notifications where user_id = $1', [U2]));
check('you can delete your own', (await count("select count(*) n from public.notifications where user_id = $1", [U2])) === 0);

check('settings accept real kinds', await asUser(U2, async () => { await db.query("insert into public.notification_settings (user_id, muted_kinds, email_kinds) values ($1, '{review}', '{message}')", [U2]); return true; }));
check('settings refuse an unknown kind', await asUser(U3, () => failsWith(() => db.query("insert into public.notification_settings (user_id, muted_kinds) values ($1, '{nonsense}')", [U3]))));
check('settings cannot be written for someone else', await asUser(U3, () => failsWith(() => db.query("insert into public.notification_settings (user_id) values ($1)", [U4]))));
check('settings are private', (await asUser(U3, () => rows('select * from public.notification_settings'))).length === 0);

// ---------------------------------------------------------------------------------------------------------------------
// 7. Shared projects
// ---------------------------------------------------------------------------------------------------------------------
await db.exec('delete from public.notifications');
check('only the owner can make an invitation', await asUser(U3, () => failsWith(() => db.query("insert into public.project_invites (project_id, role) values ($1, 'editor')", [P1]))));
const inv = await asUser(U2, () => one("insert into public.project_invites (project_id, role, label) values ($1, 'coauthor', 'for Ada') returning token, expires_at, max_uses, created_by", [P1]));
check('an invitation gets a long secret token and expires', inv.token.length === 64 && new Date(inv.expires_at) > new Date() && inv.max_uses === 1 && inv.created_by === U2);
check('an invitation cannot last longer than a month', await asUser(U2, () => failsWith(() => db.query("insert into public.project_invites (project_id, role, expires_at) values ($1, 'viewer', now() + interval '90 days')", [P1]))));
check('only the owner can read invitations', (await asUser(U1, () => rows('select * from public.project_invites'))).length === 0 && (await asUser(U2, () => rows('select * from public.project_invites'))).length === 2 - 1);

const prev = await asAnon(() => one('select public.preview_project_invite($1) as r', [inv.token]));
check('an invitation can be previewed before joining', prev.r?.title === 'The Long Light' && prev.r?.role === 'coauthor' && prev.r?.inviter === 'Ben');
check('a made-up token previews as nothing', (await asAnon(() => one("select public.preview_project_invite('nope') as r"))).r === null);

check('signing in is needed to accept', await asAnon(() => failsWith(() => one('select public.accept_project_invite($1)', [inv.token]))));
check('the owner cannot accept their own invitation', await asUser(U2, () => failsWith(() => one('select public.accept_project_invite($1)', [inv.token]), /your own/)));
const acc = await asUser(U1, () => one('select public.accept_project_invite($1) as r', [inv.token]));
check('accepting makes you a member with the invited role', acc.r.role === 'coauthor' && (await one('select role from public.project_members where project_id = $1 and user_id = $2', [P1, U1])).role === 'coauthor');
check('the owner is told someone joined', (await count("select count(*) n from public.notifications where user_id = $1 and kind = 'collab' and actor_id = $2", [U2, U1])) === 1);
check('a one-use invitation cannot be used twice', await asUser(U3, () => failsWith(() => one('select public.accept_project_invite($1)', [inv.token]), /no longer active/)));

const inv2 = await asUser(U2, () => one("insert into public.project_invites (project_id, role, max_uses) values ($1, 'viewer', 3) returning token", [P1]));
await asUser(U3, () => one('select public.accept_project_invite($1)', [inv2.token]));
await asUser(U3, () => one('select public.accept_project_invite($1)', [inv2.token]));
check('joining twice does not use up an invitation again', (await one('select uses from public.project_invites where token = $1', [inv2.token])).uses === 1);
const inv3 = await asUser(U2, () => one("insert into public.project_invites (project_id, role) values ($1, 'viewer') returning token", [P1]));
await asUser(U1, () => one('select public.accept_project_invite($1)', [inv3.token]));
check('a lower-role invitation never lowers an existing role', (await one('select role from public.project_members where project_id = $1 and user_id = $2', [P1, U1])).role === 'coauthor');
const inv4 = await asUser(U2, () => one("insert into public.project_invites (project_id, role) values ($1, 'editor') returning token", [P1]));
await asUser(U3, () => one('select public.accept_project_invite($1)', [inv4.token]));
check('a higher-role invitation raises the role', (await one('select role from public.project_members where project_id = $1 and user_id = $2', [P1, U3])).role === 'editor');

await db.query("update public.project_invites set expires_at = now() - interval '1 minute' where token = $1", [inv2.token]);
check('an expired invitation is refused', await asUser(U4, () => failsWith(() => one('select public.accept_project_invite($1)', [inv2.token]))));
const inv5 = await asUser(U2, () => one("insert into public.project_invites (project_id, role) values ($1, 'viewer') returning id, token", [P1]));
await asUser(U2, () => db.query('update public.project_invites set revoked_at = now() where id = $1', [inv5.id]));
check('a turned-off invitation is refused', await asUser(U4, () => failsWith(() => one('select public.accept_project_invite($1)', [inv5.token]))));
check('a turned-off invitation previews as nothing', (await asAnon(() => one('select public.preview_project_invite($1) as r', [inv5.token]))).r === null);

check('the owner sees every member', (await asUser(U2, () => rows('select * from public.project_members where project_id = $1', [P1]))).length === 2);
check('a member sees who else is on the project', (await asUser(U1, () => rows('select * from public.project_members where project_id = $1', [P1]))).length === 2);
check('an outsider sees nobody', (await asUser(U4, () => rows('select * from public.project_members'))).length === 0);
check('you can see your own memberships across projects', (await asUser(U3, () => rows('select * from public.project_members where user_id = $1', [U3]))).length === 1);
check('project_role tells owner, member and outsider apart', (await asUser(U2, () => one('select public.project_role($1) as r', [P1]))).r === 'owner' && (await asUser(U1, () => one('select public.project_role($1) as r', [P1]))).r === 'coauthor' && (await asUser(U4, () => one('select public.project_role($1) as r', [P1]))).r === null);

await asUser(U2, () => db.query("update public.project_members set role = 'viewer' where project_id = $1 and user_id = $2", [P1, U3]));
check('the owner can change a role', (await one('select role from public.project_members where user_id = $1', [U3])).role === 'viewer');
await asUser(U1, () => db.query("update public.project_members set role = 'coauthor' where user_id = $1", [U3]));
check('a member cannot change roles', (await one('select role from public.project_members where user_id = $1', [U3])).role === 'viewer');
await asUser(U1, () => db.query('delete from public.project_members where user_id = $1', [U3]));
check('a member cannot remove someone else', (await count('select count(*) n from public.project_members where user_id = $1', [U3])) === 1);
check('nobody can add themselves to a project', await asUser(U4, () => failsWith(() => db.query("insert into public.project_members (project_id, user_id, role) values ($1, $2, 'coauthor')", [P1, U4]))));
await asUser(U3, () => db.query('delete from public.project_members where user_id = $1', [U3]));
check('a member can leave', (await count('select count(*) n from public.project_members where user_id = $1', [U3])) === 0);
await asUser(U2, () => db.query('delete from public.project_members where project_id = $1', [P1]));
check('the owner can remove members', (await count('select count(*) n from public.project_members')) === 0);

// Live editing channels
await asUser(U2, () => db.query("update public.project_invites set revoked_at = revoked_at"));
const inv6 = await asUser(U2, () => one("insert into public.project_invites (project_id, role, max_uses) values ($1, 'editor', 5) returning token", [P1]));
const inv7 = await asUser(U2, () => one("insert into public.project_invites (project_id, role, max_uses) values ($1, 'viewer', 5) returning token", [P1]));
await asUser(U1, () => one('select public.accept_project_invite($1)', [inv6.token]));
await asUser(U3, () => one('select public.accept_project_invite($1)', [inv7.token]));
const topic = `project:${P1}:doc:${CH1}`;
await db.query("insert into realtime.messages (topic, extension) values ($1, 'broadcast')", [topic]);
const seeChannel = async (id) => asUser(id, async () => { await db.query("select set_config('realtime.topic', $1, false)", [topic]); return (await rows('select * from realtime.messages')).length; });
check('the owner and members can listen on the project channel', (await seeChannel(U2)) === 1 && (await seeChannel(U1)) === 1 && (await seeChannel(U3)) === 1);
check('an outsider cannot listen on it', (await seeChannel(U4)) === 0);
const sendChannel = async (id) => asUser(id, async () => { await db.query("select set_config('realtime.topic', $1, false)", [topic]); try { await db.query("insert into realtime.messages (topic, extension) values ($1, 'broadcast')", [topic]); return true; } catch { return false; } });
check('owners and editors can send; viewers and outsiders cannot', (await sendChannel(U2)) && (await sendChannel(U1)) && !(await sendChannel(U3)) && !(await sendChannel(U4)));

// ---------------------------------------------------------------------------------------------------------------------
// 8. The error log
// ---------------------------------------------------------------------------------------------------------------------
const secret = 'a'.repeat(64);
await asAnon(() => one("select public.report_client_error('fp-boom', 'TypeError: x is undefined', 'at a (app.js:1:1)', 'web', '1.2.0', $1, 'Mozilla/5.0')", [`https://novel.example/#/read/${secret}`]));
const e1 = await one("select * from public.client_errors where fingerprint = 'fp-boom'");
check('a signed-out visitor can report an error', !!e1 && e1.message === 'TypeError: x is undefined' && e1.source === 'web');
check('secret tokens are scrubbed from the reported address', !e1.url.includes(secret) && e1.url.includes(':id'));
check('nobody can read the log directly', await asAnon(() => failsWith(() => rows('select * from public.client_errors'))) && await asUser(U1, () => failsWith(() => rows('select * from public.client_errors'))));
await asUser(U1, () => one("select public.report_client_error('fp-boom', 'TypeError: x is undefined', '', 'phone', '1.2.0', '', '')"));
await asUser(U1, () => one("select public.report_client_error('fp-other', 'Something else', '', 'sideways', '', '', '')"));
check('an unknown source counts as web', (await one("select source from public.client_errors where fingerprint = 'fp-other'")).source === 'web');
await asUser(U1, () => one("select public.report_client_error('', 'no fingerprint', '', 'web', '', '', '')"));
await asUser(U1, () => one("select public.report_client_error('fp-empty', '   ', '', 'web', '', '', '')"));
check('empty reports are ignored', (await count("select count(*) n from public.client_errors where fingerprint in ('', 'fp-empty')")) === 0);
for (let i = 0; i < 60; i++) await asAnon(() => one("select public.report_client_error('fp-loop', 'again', '', 'web', '', '', '')"));
check('one error repeating cannot fill the table (50 a day)', (await count("select count(*) n from public.client_errors where fingerprint = 'fp-loop'")) === 50);

check('only the admin can list errors', await asUser(U1, () => failsWith(() => rows('select * from public.admin_error_groups()'), /Only the admin/)));
const groups = await asUser(ADMIN, () => rows('select * from public.admin_error_groups(14)'), 'aruhaadmin@novelist.com');
const boom = groups.find((g) => g.fingerprint === 'fp-boom');
check('the admin sees errors grouped, with counts', !!boom && Number(boom.occurrences) === 2 && groups.length === 3);
check('only the admin can clear errors', await asUser(U1, () => failsWith(() => one("select public.admin_clear_errors('fp-boom')"), /Only the admin/)));
await asUser(ADMIN, () => one("select public.admin_clear_errors('fp-boom')"), 'aruhaadmin@novelist.com');
check('the admin can clear one error group', (await count("select count(*) n from public.client_errors where fingerprint = 'fp-boom'")) === 0 && (await count('select count(*) n from public.client_errors')) > 0);

// ---------------------------------------------------------------------------------------------------------------------
// 8b. The email delivery log (used by the notify-email function, with the service role)
// ---------------------------------------------------------------------------------------------------------------------
await db.exec('delete from public.notifications');
const [mail1] = await rows("insert into public.notifications (user_id, actor_id, kind, snippet) values ($1, $2, 'comment', 'Lovely') returning id", [U2, U3]);
const asService = async (fn) => {
  await db.exec('reset role');
  await db.exec('set role service_role');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
};
check('nobody signed in can read, write or clear the email log', await asUser(U2, () => failsWith(() => rows('select * from public.notification_emails'))) && await asUser(U2, () => failsWith(() => db.query('insert into public.notification_emails (notification_id, user_id) values ($1, $2)', [mail1.id, U2]))) && await asUser(U2, () => failsWith(() => db.query('delete from public.notification_emails'))) && await asAnon(() => failsWith(() => rows('select * from public.notification_emails'))));
await asService(() => db.query('insert into public.notification_emails (notification_id, user_id) values ($1, $2)', [mail1.id, U2]));
check('the server can record that a notification was emailed', (await asService(() => count('select count(*) n from public.notification_emails where user_id = $1', [U2]))) === 1);
check('a notification can be claimed for emailing only once (a retried delivery never sends twice)', await asService(() => failsWith(() => db.query('insert into public.notification_emails (notification_id, user_id) values ($1, $2)', [mail1.id, U2]), /duplicate key/)));
await db.exec('delete from public.notifications');
check('the log row goes when its notification is tidied away', (await count('select count(*) n from public.notification_emails')) === 0);
await db.query("insert into public.notifications (id, user_id, actor_id, kind) values ('00000000-0000-4000-8000-0000000000a1', $1, $2, 'follow')", [U1, U3]);
await db.query("insert into public.notification_emails (notification_id, user_id) values ('00000000-0000-4000-8000-0000000000a1', $1)", [U1]);

// ---------------------------------------------------------------------------------------------------------------------
// 9. Deleting an account takes its rows with it
// ---------------------------------------------------------------------------------------------------------------------
await db.exec('delete from public.notifications');
await db.query("insert into public.notifications (user_id, actor_id, kind) values ($1, $2, 'follow'), ($2, $1, 'follow')", [U1, U3]);
await asUser(U1, () => db.query("insert into public.notification_settings (user_id) values ($1)", [U1]));
check('the account to delete has rows in the new tables', (await count('select count(*) n from public.notifications where user_id = $1 or actor_id = $1', [U1])) > 0);
await asUser(U1, () => one('select public.delete_my_account()'));
const left = await count(`select (select count(*) from public.notifications where user_id = $1 or actor_id = $1)
  + (select count(*) from public.notification_settings where user_id = $1)
  + (select count(*) from public.message_reads where user_id = $1 or peer_id = $1)
  + (select count(*) from public.project_members where user_id = $1)
  + (select count(*) from public.project_invites where created_by = $1)
  + (select count(*) from public.notification_emails where user_id = $1) as n`, [U1]);
check('deleting an account removes its notifications, settings, read marks, memberships and invitations', left === 0, `left ${left}`);

// ---------------------------------------------------------------------------------------------------------------------
// 10. Rolling it back leaves everything else alone, and it can be set up again
// ---------------------------------------------------------------------------------------------------------------------
const before = await count("select count(*) n from public.chat_messages");
await db.exec(rollback);
for (const t of newTables) check(`rollback removes ${t}`, !(await one(`select to_regclass('public.${t}') is not null as ok`)).ok);
check('rollback removes the functions', (await count("select count(*) n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('_notify','follow_user','mark_chat_read','accept_project_invite','report_client_error')")) === 0);
check('rollback leaves the messages alone', (await count("select count(*) n from public.chat_messages")) === before);
check('rollback leaves the base tables and their triggers (the block check stays)', (await count("select count(*) n from pg_trigger where tgname = 'refuse_blocked_message'")) === 1);
check('rollback leaves no stray triggers behind', (await count("select count(*) n from pg_trigger where tgname like 'notify_on_%'")) === 0);
let again = true;
try {
  await db.exec(rollback);
  await db.exec(next);
} catch (e) {
  again = false;
  failures.push('re-setup after rollback failed: ' + e.message);
}
check('rollback can be run twice, and the setup can be run again after it', again);

console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log('FAIL: ' + f);
process.exit(failures.length ? 1 : 0);
