// The email side of notifications (supabase/functions/notify-email): what an email says, and when one is sent.
// The database, the email service and the clock are pretend ones. Sending a real email needs an account with an
// email service, which these tests cannot have, so that last step is not covered.
//
//   npm run test:unit   (runs every file in scripts/tests)
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEmail, escapeHtml, oneLine } from '../../supabase/functions/notify-email/email.ts';
import { handle, sameSecret } from '../../supabase/functions/notify-email/handler.ts';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_N = '22222222-2222-4222-8222-222222222222';

const record = (over = {}) => ({
  id: '33333333-3333-4333-8333-333333333333',
  user_id: UUID_A,
  actor_id: UUID_N,
  kind: 'comment',
  project_id: '44444444-4444-4444-8444-444444444444',
  snippet: 'I loved the tide.',
  actor_name: 'Ada',
  meta: { project_title: 'Long Tides' },
  count: 1,
  ...over,
});

const email = (over = {}, extra = {}) =>
  buildEmail({ record: record(over), to: 'ben@example.com', recipientName: 'Ben', projectTitle: null, appUrl: 'https://novel.example.com/', ...extra });

test('each kind says what happened, and links to the right place', () => {
  const comment = email();
  assert.equal(comment.subject, 'Ada commented on Long Tides');
  assert.match(comment.text, /“I loved the tide\.”/);
  assert.match(comment.text, /Open it: https:\/\/novel\.example\.com\/#\/library\/novel\/44444444-4444-4444-8444-444444444444/);

  const follow = email({ kind: 'follow', snippet: '', project_id: null });
  assert.equal(follow.subject, 'Ada started following you');
  assert.match(follow.text, new RegExp(`#/library/author/${UUID_N}`));
  assert.ok(!follow.text.includes('“'), 'a follow has nothing to quote');

  const review = email({ kind: 'review', snippet: 'Beautiful and calm.', meta: { project_title: 'Long Tides', rating: 4 } });
  assert.equal(review.subject, 'Ada reviewed Long Tides');
  assert.match(review.text, /★★★★☆ Beautiful and calm\./);

  const one = email({ kind: 'message', project_id: null, snippet: 'Hello' });
  assert.equal(one.subject, 'Ada sent you a message');
  assert.match(one.text, new RegExp(`#/messages/${UUID_N}`));
  const many = email({ kind: 'message', project_id: null, count: 5 });
  assert.equal(many.subject, 'Ada sent you 5 messages');

  assert.equal(email({ kind: 'share_comment' }).subject, 'Ada commented on your reading link for Long Tides');
  assert.equal(email({ kind: 'collab', snippet: '', meta: { project_title: 'Long Tides', role: 'editor' } }).subject, 'Ada joined Long Tides as editor');
});

test('the project title from the database wins over the one stored with the notification', () => {
  assert.equal(email({}, { projectTitle: 'Renamed Since' }).subject, 'Ada commented on Renamed Since');
});

test('it says why the email was sent and how to stop it', () => {
  const mail = email({ kind: 'message' });
  assert.match(mail.text, /you chose "Messages" by email in Preferences > Notifications/);
  assert.match(mail.text, /https:\/\/novel\.example\.com\/#\/preferences#notifications/);
  assert.equal(mail.headers['List-Unsubscribe'], '<https://novel.example.com/#/preferences#notifications>');
  assert.equal(mail.to, 'ben@example.com');
  assert.match(mail.text, /^Hi Ben,/);
});

test('what other people wrote is escaped in the HTML, and cannot add lines to the subject', () => {
  const mail = email({ actor_name: 'Eve\r\nBcc: someone@else.com <b>', snippet: '<script>alert("hi")</script> & more' });
  assert.ok(!/[\r\n]/.test(mail.subject), 'the subject is one line');
  assert.ok(!mail.html.includes('<script>'));
  assert.ok(mail.html.includes('&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt; &amp; more'));
  assert.ok(!mail.html.includes('<b>'));
  assert.ok(!mail.html.includes('Bcc: someone@else.com <'));
});

test('an address in the link comes only from ids, so nothing a person wrote can change where it goes', () => {
  const mail = email({ project_id: '"><a href=//evil.example>x</a>', actor_id: 'javascript:alert(1)', kind: 'comment' });
  assert.match(mail.text, /Open it: https:\/\/novel\.example\.com\/#\/notifications/);
  assert.ok(!mail.html.includes('evil.example'));
  const message = email({ kind: 'message', actor_id: '../../admin', project_id: null });
  assert.match(message.text, /Open it: https:\/\/novel\.example\.com\/#\/messages\n/);
});

test('a long name or message is cut short', () => {
  const mail = email({ actor_name: 'N'.repeat(500), snippet: 'x'.repeat(2000) });
  assert.ok(mail.subject.length <= 140);
  assert.ok(mail.text.length < 1500);
  assert.equal(oneLine('a   b\n\tc', 10), 'a b c');
  assert.equal(oneLine('abcdef', 4), 'abc…');
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('the secret is compared whole, and a wrong length is simply wrong', () => {
  assert.ok(sameSecret('abc', 'abc'));
  assert.ok(!sameSecret('abc', 'abd'));
  assert.ok(!sameSecret('abc', 'abcd'));
  assert.ok(!sameSecret('', 'abc'));
});

// ---------------------------------------------------------------------------------------------------------------------
// When one is sent
// ---------------------------------------------------------------------------------------------------------------------
const NOW = Date.parse('2026-11-05T12:00:00Z');

const makeDeps = (over = {}) => {
  const log = { sent: [], claimed: new Map(), released: [] };
  const sentTimes = []; // when each emailed notification was claimed, per person
  const deps = {
    secret: 'shh',
    appUrl: 'https://novel.example.com',
    perHour: 3,
    perDay: 5,
    getEmailKinds: async () => ['comment', 'message'],
    getPerson: async () => ({ email: 'ben@example.com', confirmed: true, name: 'Ben' }),
    getProjectTitle: async () => 'Long Tides',
    claim: async (id, userId) => {
      if (log.claimed.has(id)) return false;
      log.claimed.set(id, userId);
      sentTimes.push({ id, userId, at: NOW });
      return true;
    },
    release: async (id) => {
      log.claimed.delete(id);
      log.released.push(id);
      const i = sentTimes.findIndex((s) => s.id === id);
      if (i >= 0) sentTimes.splice(i, 1);
    },
    countSince: async (userId, since) => sentTimes.filter((s) => s.userId === userId && s.at >= since.getTime()).length,
    send: async (mail) => {
      log.sent.push(mail);
    },
    now: () => NOW,
    ...over,
  };
  return { deps, log, sentTimes };
};

const call = (deps, { body, headers = { 'x-webhook-secret': 'shh' }, method = 'POST' } = {}) =>
  handle(new Request('https://f.example/notify-email', { method, headers, body: method === 'POST' ? JSON.stringify(body) : undefined }), deps);

const insert = (over = {}) => ({ type: 'INSERT', table: 'notifications', schema: 'public', record: record(over), old_record: null });

test('a new notification of a chosen kind is emailed', async () => {
  const { deps, log } = makeDeps();
  const res = await call(deps, { body: insert() });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { sent: true });
  assert.equal(log.sent.length, 1);
  assert.equal(log.sent[0].to, 'ben@example.com');
  assert.equal(log.sent[0].subject, 'Ada commented on Long Tides');
});

test('only the database webhook can call it', async () => {
  const { deps, log } = makeDeps();
  assert.equal((await call(deps, { body: insert(), headers: {} })).status, 401);
  assert.equal((await call(deps, { body: insert(), headers: { 'x-webhook-secret': 'wrong' } })).status, 401);
  assert.equal((await call(deps, { method: 'GET', headers: { 'x-webhook-secret': 'shh' } })).status, 405);
  // No secret set up at all means nobody gets in, not everybody
  const open = makeDeps({ secret: '' });
  assert.equal((await call(open.deps, { body: insert(), headers: {} })).status, 401);
  assert.equal(log.sent.length + open.log.sent.length, 0);
});

test('a kind the person did not choose for email is not sent, and neither is anything without an address', async () => {
  const notChosen = makeDeps();
  assert.equal((await (await call(notChosen.deps, { body: insert({ kind: 'follow' }) })).json()).skipped, 'this kind is not chosen for email');
  assert.equal(notChosen.log.sent.length, 0);

  const none = makeDeps({ getEmailKinds: async () => [] });
  await call(none.deps, { body: insert() });
  assert.equal(none.log.sent.length, 0);

  const noAddress = makeDeps({ getPerson: async () => ({ email: '', confirmed: true, name: '' }) });
  assert.equal((await (await call(noAddress.deps, { body: insert() })).json()).skipped, 'no email address');

  const unknown = makeDeps({ getPerson: async () => null });
  assert.equal((await (await call(unknown.deps, { body: insert() })).json()).skipped, 'no email address');

  const unconfirmed = makeDeps({ getPerson: async () => ({ email: 'x@example.com', confirmed: false, name: '' }) });
  assert.equal((await (await call(unconfirmed.deps, { body: insert() })).json()).skipped, 'email address not confirmed');
  assert.equal(noAddress.log.sent.length + unknown.log.sent.length + unconfirmed.log.sent.length, 0);
});

test('only a new row is emailed: a message line counting up (an update) and other tables are not', async () => {
  const { deps, log } = makeDeps();
  const update = await call(deps, { body: { ...insert(), type: 'UPDATE' } });
  assert.equal((await update.json()).skipped, 'not a new notification');
  const other = await call(deps, { body: { ...insert(), table: 'comments' } });
  assert.equal((await other.json()).skipped, 'not a new notification');
  assert.equal(log.sent.length, 0);
});

test('a bad request is refused, not guessed at', async () => {
  const { deps } = makeDeps();
  const broken = await handle(new Request('https://f.example', { method: 'POST', headers: { 'x-webhook-secret': 'shh' }, body: '{not json' }), deps);
  assert.equal(broken.status, 400);
  assert.equal((await call(deps, { body: { type: 'INSERT', table: 'notifications', record: { id: 'x' } } })).status, 400);
  assert.equal((await call(deps, { body: insert({ kind: 'surprise' }) })).status, 400);
});

test('the same notification delivered twice is emailed once', async () => {
  const { deps, log } = makeDeps();
  await call(deps, { body: insert() });
  const again = await call(deps, { body: insert() });
  assert.equal((await again.json()).skipped, 'already sent');
  assert.equal(log.sent.length, 1);
});

test('one person is not sent more than the hourly or daily limit', async () => {
  const hourly = makeDeps();
  const ids = [1, 2, 3, 4, 5].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
  const results = [];
  for (const id of ids) results.push(await (await call(hourly.deps, { body: insert({ id }) })).json());
  assert.deepEqual(results.map((r) => (r.sent ? 'sent' : r.skipped)), ['sent', 'sent', 'sent', 'too many this hour', 'too many this hour']);
  assert.equal(hourly.log.sent.length, 3);
  // The ones that were not sent are not counted as sent
  assert.equal(hourly.sentTimes.length, 3);
  assert.deepEqual(hourly.log.released, [ids[3], ids[4]]);

  // Someone else is not affected
  const other = await call(hourly.deps, { body: insert({ id: '00000000-0000-4000-8000-0000000000aa', user_id: UUID_N }) });
  assert.equal((await other.json()).sent, true);

  // Spread over the day: under the hourly limit each hour, but over the daily one
  const daily = makeDeps();
  const earlier = [];
  for (let i = 0; i < 5; i++) earlier.push({ id: `old-${i}`, userId: UUID_A, at: NOW - (2 + i) * 60 * 60 * 1000 });
  for (const e of earlier) {
    daily.sentTimes.push(e);
    daily.log.claimed.set(e.id, e.userId);
  }
  const over = await call(daily.deps, { body: insert({ id: '00000000-0000-4000-8000-0000000000bb' }) });
  assert.equal((await over.json()).skipped, 'too many today');
  assert.equal(daily.log.sent.length, 0);
});

test('if the email service fails, nothing is recorded as sent, so a later try can send it', async () => {
  const { deps, log } = makeDeps({
    send: async () => {
      throw new Error('The email service answered 500');
    },
  });
  const quiet = console.error;
  console.error = () => {};
  try {
    const res = await call(deps, { body: insert() });
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { error: 'Could not send' });
  } finally {
    console.error = quiet;
  }
  assert.equal(log.claimed.size, 0);
  assert.equal(log.sent.length, 0);
});
