// Emails a notification to the person it is for, if they chose email for that kind of notification.
//
// A database webhook on public.notifications (INSERT) calls this. See supabase/README.md for the steps: deploy it,
// set the secrets below, and create the webhook. The rules are in handler.ts and the wording in email.ts.
//
// Secrets (supabase secrets set NAME=value):
//   RESEND_API_KEY         from resend.com (any email service with a similar HTTP interface can replace the send below)
//   NOTIFY_FROM            who the email is from, for example  Novelist Workspace <notify@yourdomain.com>
//   NOTIFY_WEBHOOK_SECRET  a long random text, also written in the webhook's x-webhook-secret header
//   APP_URL                where the website lives, for example  https://novelist.example.com
//   NOTIFY_MAX_PER_HOUR    optional, 8 by default      NOTIFY_MAX_PER_DAY   optional, 30 by default
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handle, type Deps } from './handler.ts';

const env = (name: string) => Deno.env.get(name) ?? '';

const required = ['RESEND_API_KEY', 'NOTIFY_FROM', 'NOTIFY_WEBHOOK_SECRET', 'APP_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((name) => !env(name));
if (missing.length) console.error(`notify-email is missing: ${missing.join(', ')}`);

// The service role can read any row, which is needed to find an email address. It never leaves this function.
const db = createClient(env('SUPABASE_URL') || 'http://localhost', env('SUPABASE_SERVICE_ROLE_KEY') || 'missing', { auth: { persistSession: false, autoRefreshToken: false } });

const deps: Deps = {
  secret: env('NOTIFY_WEBHOOK_SECRET'),
  appUrl: env('APP_URL'),
  perHour: Number(env('NOTIFY_MAX_PER_HOUR')) || 8,
  perDay: Number(env('NOTIFY_MAX_PER_DAY')) || 30,

  async getEmailKinds(userId) {
    const { data, error } = await db.from('notification_settings').select('email_kinds').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return (data?.email_kinds as string[] | undefined) ?? [];
  },

  async getPerson(userId) {
    const [account, profile] = await Promise.all([db.auth.admin.getUserById(userId), db.from('profiles').select('display_name').eq('id', userId).maybeSingle()]);
    const user = account.data?.user;
    if (!user) return null;
    return { email: user.email ?? '', confirmed: !!user.email_confirmed_at, name: (profile.data?.display_name as string | undefined) ?? '' };
  },

  async getProjectTitle(projectId) {
    const { data } = await db.from('projects').select('title').eq('id', projectId).maybeSingle();
    return (data?.title as string | undefined) ?? null;
  },

  async claim(notificationId, userId) {
    const { error } = await db.from('notification_emails').insert({ notification_id: notificationId, user_id: userId });
    if (!error) return true;
    // 23505 is "this row is already there": it was claimed by an earlier delivery of the same webhook
    if (error.code === '23505') return false;
    throw error;
  },

  async release(notificationId) {
    await db.from('notification_emails').delete().eq('notification_id', notificationId);
  },

  async countSince(userId, since) {
    const { count, error } = await db.from('notification_emails').select('notification_id', { count: 'exact', head: true }).eq('user_id', userId).gte('sent_at', since.toISOString());
    if (error) throw error;
    return count ?? 0;
  },

  async send(mail) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env('NOTIFY_FROM'), to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, headers: mail.headers }),
    });
    if (!res.ok) throw new Error(`The email service answered ${res.status}`);
  },

  now: () => Date.now(),
};

Deno.serve((req) => {
  // Say what is missing, rather than failing in a way that is hard to trace
  if (missing.length) return new Response(JSON.stringify({ error: `Not set up: ${missing.join(', ')}` }), { status: 500, headers: { 'content-type': 'application/json' } });
  return handle(req, deps);
});
