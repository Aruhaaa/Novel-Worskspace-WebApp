// Checks the stand-in with the real supabase-js client: sign-up, REST, row level security, RPC, and Realtime.
//   node scripts/dev-supabase/smoke.mjs
import { createClient } from '@supabase/supabase-js';
import { startSupabaseLite } from './server.mjs';

const lite = await startSupabaseLite({ port: 54399 });
let passed = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) passed++;
  else failures.push(`${name}${detail ? '  -> ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(50);
  }
  return false;
};

const newClient = () => createClient(lite.url, lite.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const ada = newClient();
const ben = newClient();

try {
  // Sign up and in
  const a = await ada.auth.signUp({ email: 'ada@example.com', password: 'secret-pass' });
  const b = await ben.auth.signUp({ email: 'ben@example.com', password: 'secret-pass' });
  check('sign-up returns a session', !!a.data.session && !!b.data.session, JSON.stringify(a.error));
  const adaId = a.data.user.id;
  const benId = b.data.user.id;
  const bad = await newClient().auth.signInWithPassword({ email: 'ada@example.com', password: 'wrong' });
  check('a wrong password is refused', !!bad.error);
  const again = await newClient().auth.signInWithPassword({ email: 'ada@example.com', password: 'secret-pass' });
  check('the right password signs in', !!again.data.session);
  const meta = await ada.auth.updateUser({ data: { use_mode: 'write' } });
  check('account metadata can be saved', meta.data.user?.user_metadata?.use_mode === 'write');
  check('getUser returns the person', (await ada.auth.getUser()).data.user?.email === 'ada@example.com');

  // Profiles (the first rows)
  const p1 = await ada.from('profiles').upsert({ id: adaId, display_name: 'Ada' }).select().single();
  const p2 = await ben.from('profiles').upsert({ id: benId, display_name: 'Ben' }).select().single();
  check('a person can create their own profile', p1.data?.display_name === 'Ada' && p2.data?.display_name === 'Ben', JSON.stringify(p1.error));
  const other = await ada.from('profiles').upsert({ id: benId, display_name: 'Hacked' }).select().single();
  check("row level security stops writing someone else's profile", !!other.error, JSON.stringify(other.data));

  // Missing table and function answers
  const missing = await ada.from('no_such_table').select('*');
  check('a missing table answers PGRST205', missing.error?.code === 'PGRST205');
  const missingFn = await ada.rpc('no_such_function');
  check('a missing function answers PGRST202', missingFn.error?.code === 'PGRST202');

  // Realtime: Ben listens for notifications addressed to him
  const events = [];
  let status = '';
  const channel = ben
    .channel('notes-test')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${benId}` }, (e) => events.push(e))
    .subscribe((s) => (status = s));
  check('realtime subscribes', await until(() => status === 'SUBSCRIBED'), status);

  // Ada follows Ben through the function: the trigger writes the notification and Ben is told live
  const follow = await ada.rpc('follow_user', { p_target: benId });
  check('follow_user answers true', follow.data === true, JSON.stringify(follow.error));
  check('the follow notification arrives live', await until(() => events.some((e) => e.eventType === 'INSERT' && e.new.kind === 'follow')));
  const list = await ben.from('notifications').select('*').eq('user_id', benId).order('created_at', { ascending: false });
  check('Ben can read his notification', list.data?.length === 1 && list.data[0].actor_name === 'Ada', JSON.stringify(list.error));
  const adaSees = await ada.from('notifications').select('*');
  check("Ada cannot see Ben's notification", adaSees.data?.length === 0);
  const count = await ben.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', benId).is('read_at', null);
  check('an exact count of unread works', count.count === 1, JSON.stringify(count));

  // Mark as read; only the read mark may change
  const mark = await ben.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', benId).is('read_at', null);
  check('marking read works', !mark.error, JSON.stringify(mark.error));
  const edit = await ben.from('notifications').update({ snippet: 'changed' }).eq('user_id', benId);
  check('rewriting a notification is refused', !!edit.error);
  check('the read update is announced live', await until(() => events.some((e) => e.eventType === 'UPDATE')));

  // Messages: unread counts and read marks
  await ada.from('chat_messages').insert({ sender_id: adaId, receiver_id: benId, content: 'Hello Ben' });
  await ada.from('chat_messages').insert({ sender_id: adaId, receiver_id: benId, content: 'Are you there?' });
  const unread = await ben.rpc('unread_message_counts');
  check('unread counts come back as rows', Array.isArray(unread.data) && Number(unread.data[0]?.unread) === 2, JSON.stringify(unread));
  const thread = await ben.from('chat_messages').select('*').or(`and(sender_id.eq.${adaId},receiver_id.eq.${benId}),and(sender_id.eq.${benId},receiver_id.eq.${adaId})`).order('created_at', { ascending: true });
  check('an or() filter over two people returns the thread in order', thread.data?.length === 2 && thread.data[0].content === 'Hello Ben', JSON.stringify(thread.error));
  const newest = thread.data[1].created_at;
  const read = await ben.rpc('mark_chat_read', { p_peer: adaId, p_until: newest });
  check('mark_chat_read returns nothing and works', !read.error, JSON.stringify(read.error));
  const after = await ben.rpc('unread_message_counts');
  check('the unread count clears', after.data?.length === 0);
  const seen = await ada.from('message_reads').select('read_until').eq('user_id', benId).eq('peer_id', adaId).maybeSingle();
  check('the sender can read the read mark, in the same format as message times', seen.data?.read_until === newest, `${seen.data?.read_until} vs ${newest}`);

  // Broadcast between two clients
  const got = [];
  const lineA = ada.channel('typing-test', { config: { broadcast: { self: false } } }).on('broadcast', { event: 'typing' }, (m) => got.push(m.payload));
  let statusA = '';
  lineA.subscribe((s) => (statusA = s));
  const lineB = ben.channel('typing-test', { config: { broadcast: { self: false } } });
  let statusB = '';
  lineB.subscribe((s) => (statusB = s));
  await until(() => statusA === 'SUBSCRIBED' && statusB === 'SUBSCRIBED');
  await lineB.send({ type: 'broadcast', event: 'typing', payload: { from: 'ben' } });
  check('a broadcast reaches the other client', await until(() => got.length === 1 && got[0].from === 'ben'), JSON.stringify(got));

  // Presence
  const seenPresence = [];
  const presA = ada.channel('presence-test', { config: { presence: { key: 'ada' } } });
  presA.on('presence', { event: 'sync' }, () => seenPresence.push(Object.keys(presA.presenceState())));
  let sa = '';
  presA.subscribe((s) => (sa = s));
  await until(() => sa === 'SUBSCRIBED');
  const presB = ben.channel('presence-test', { config: { presence: { key: 'ben' } } });
  let sb = '';
  presB.subscribe(async (s) => {
    sb = s;
    if (s === 'SUBSCRIBED') await presB.track({ name: 'Ben' });
  });
  check('presence shows who joined', await until(() => Object.keys(presA.presenceState()).includes('ben')), JSON.stringify(presA.presenceState()));
  await ada.removeChannel(presA);
  await ben.removeChannel(presB);

  await ben.removeChannel(channel);
} catch (e) {
  failures.push('exception: ' + (e?.stack || e));
}

await lite.close();
console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log('FAIL: ' + f);
process.exit(failures.length ? 1 : 0);
