// What an email about a notification says. Plain functions with no Deno and no network, so the same file is tested
// from Node (scripts/tests/notify-email.test.mjs) and used by the Edge Function.

export type Kind = 'follow' | 'comment' | 'review' | 'message' | 'share_comment' | 'collab';

/** A row of public.notifications, as the database webhook sends it */
export interface NotificationRecord {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: Kind;
  project_id: string | null;
  snippet: string;
  actor_name: string;
  meta: Record<string, unknown> | null;
  count: number;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
}

/** The name of each kind in Preferences > Notifications, so the email can say which setting to change */
export const KIND_LABEL: Record<Kind, string> = {
  follow: 'New followers',
  comment: 'Comments on your novels',
  review: 'Reviews of your novels',
  message: 'Messages',
  share_comment: 'Comments on reading links',
  collab: 'Shared projects',
};

export const KINDS = Object.keys(KIND_LABEL) as Kind[];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** One line of at most `max` characters: no line breaks (which could be used to forge extra email headers) and no runs of spaces */
export const oneLine = (text: unknown, max: number): string => {
  // Control characters and the two Unicode line separators become spaces (written as character codes, so no editor changes them)
  const spaced = Array.from(String(text ?? ''), (ch) => {
    const code = ch.charCodeAt(0);
    return code < 32 || code === 127 || code === 0x2028 || code === 0x2029 ? ' ' : ch;
  }).join('');
  const flat = spaced.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

const stars = (rating: unknown): string => {
  const n = Math.round(Number(rating));
  return n >= 1 && n <= 5 ? `${'★'.repeat(n)}${'☆'.repeat(5 - n)} ` : '';
};

interface Description {
  headline: string;
  quote: string;
  /** Where to send the reader, as a path in the app (it uses # addresses) */
  path: string;
}

export const describe = (record: NotificationRecord, projectTitle: string | null): Description => {
  const actor = oneLine(record.actor_name, 60) || 'Someone';
  const meta = record.meta ?? {};
  const title = oneLine(projectTitle ?? meta.project_title, 80) || 'your novel';
  const quote = oneLine(record.snippet, 300);
  const actorPath = record.actor_id && UUID.test(record.actor_id) ? record.actor_id : null;
  const novelPath = record.project_id && UUID.test(record.project_id) ? `#/library/novel/${record.project_id}` : '#/notifications';

  switch (record.kind) {
    case 'follow':
      return { headline: `${actor} started following you.`, quote: '', path: actorPath ? `#/library/author/${actorPath}` : '#/notifications' };
    case 'comment':
      return { headline: `${actor} commented on ${title}.`, quote, path: novelPath };
    case 'review':
      return { headline: `${actor} reviewed ${title}.`, quote: `${stars(meta.rating)}${quote}`.trim(), path: novelPath };
    case 'message': {
      const many = Number(record.count) > 1;
      return {
        headline: many ? `${actor} sent you ${Math.min(Number(record.count), 999)} messages.` : `${actor} sent you a message.`,
        quote,
        path: actorPath ? `#/messages/${actorPath}` : '#/messages',
      };
    }
    case 'share_comment':
      return { headline: `${actor} commented on your reading link for ${title}.`, quote, path: '#/notifications' };
    case 'collab': {
      const role = oneLine(meta.role, 20);
      return { headline: `${actor} joined ${title}${role ? ` as ${role}` : ''}.`, quote: '', path: '#/notifications' };
    }
    default:
      return { headline: 'You have a new notification.', quote, path: '#/notifications' };
  }
};

export const buildEmail = (input: { record: NotificationRecord; to: string; recipientName: string; projectTitle: string | null; appUrl: string }): Mail => {
  const { record, to, projectTitle } = input;
  const appUrl = input.appUrl.replace(/\/+$/, '');
  const { headline, quote, path } = describe(record, projectTitle);
  const link = `${appUrl}/${path}`;
  const settings = `${appUrl}/#/preferences#notifications`;
  const name = oneLine(input.recipientName, 60);
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const label = KIND_LABEL[record.kind] ?? 'Notifications';
  const subject = oneLine(headline.replace(/\.$/, ''), 140);

  const text = [
    greeting,
    '',
    headline,
    ...(quote ? ['', `“${quote}”`] : []),
    '',
    `Open it: ${link}`,
    '',
    '—',
    `You are getting this email because you chose "${label}" by email in Preferences > Notifications. To stop, switch it off here: ${settings}`,
  ].join('\n');

  const html = [
    '<!doctype html><html><body style="margin:0;padding:24px;background:#f6f2ea;font-family:Georgia,serif;color:#2a2620">',
    '<div style="max-width:520px;margin:0 auto;background:#fffdf8;border:1px solid #e3dccd;border-radius:6px;padding:28px">',
    `<p style="margin:0 0 16px;font:14px/1.5 Arial,sans-serif;color:#6b6358">${escapeHtml(greeting)}</p>`,
    `<p style="margin:0 0 16px;font-size:20px;line-height:1.4">${escapeHtml(headline)}</p>`,
    quote ? `<blockquote style="margin:0 0 20px;padding:2px 0 2px 14px;border-left:3px solid #c8b99a;font-style:italic;color:#4a443a">${escapeHtml(quote)}</blockquote>` : '',
    `<p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2a2620;color:#fffdf8;text-decoration:none;font:14px Arial,sans-serif;padding:10px 18px;border-radius:4px">Open it</a></p>`,
    `<p style="margin:0;font:12px/1.5 Arial,sans-serif;color:#8a8070">You are getting this email because you chose “${escapeHtml(label)}” by email in Preferences &gt; Notifications. <a href="${escapeHtml(settings)}" style="color:#8a8070">Switch it off</a>.</p>`,
    '</div></body></html>',
  ].join('');

  return { to, subject, text, html, headers: { 'List-Unsubscribe': `<${settings}>` } };
};
