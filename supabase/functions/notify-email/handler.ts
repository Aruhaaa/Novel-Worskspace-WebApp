// The rules for emailing a notification. Everything that touches the outside world (the database, the email service,
// the clock) is handed in as `deps`, so scripts/tests/notify-email.test.mjs can run these rules against pretend ones.
import { buildEmail, KINDS, type Kind, type Mail, type NotificationRecord } from './email.ts';

export interface Person {
  email: string;
  /** Whether the address has been confirmed. Nothing is sent to one that has not. */
  confirmed: boolean;
  name: string;
}

export interface Deps {
  /** The shared secret the database webhook must send in the x-webhook-secret header */
  secret: string;
  appUrl: string;
  /** At most this many emails to one person in an hour / in a day */
  perHour: number;
  perDay: number;
  /** The kinds this person chose to get by email */
  getEmailKinds: (userId: string) => Promise<string[]>;
  getPerson: (userId: string) => Promise<Person | null>;
  getProjectTitle: (projectId: string) => Promise<string | null>;
  /** Write down that this notification is being emailed. False if it already was (a retried delivery). */
  claim: (notificationId: string, userId: string) => Promise<boolean>;
  /** Take that note back, because nothing was sent after all */
  release: (notificationId: string) => Promise<void>;
  /** How many emails to this person were sent since this moment, counting the one just claimed */
  countSince: (userId: string, since: Date) => Promise<number>;
  send: (mail: Mail) => Promise<void>;
  now: () => number;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Compares without stopping at the first difference, so how long it takes says nothing about how close a guess was */
export const sameSecret = (given: string, expected: string): boolean => {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
};

const isRecord = (value: unknown): value is NotificationRecord => {
  const r = value as Partial<NotificationRecord> | null;
  return !!r && typeof r.id === 'string' && typeof r.user_id === 'string' && typeof r.kind === 'string' && (KINDS as string[]).includes(r.kind);
};

export const handle = async (req: Request, deps: Deps): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  if (!deps.secret || !sameSecret(req.headers.get('x-webhook-secret') ?? '', deps.secret)) return json(401, { error: 'Not allowed' });

  let payload: { type?: string; table?: string; record?: unknown };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return json(400, { error: 'Not JSON' });
  }
  // Only a brand new notification is emailed. A message line that counts up is an update and stays quiet.
  if (payload.type !== 'INSERT' || payload.table !== 'notifications') return json(200, { skipped: 'not a new notification' });
  if (!isRecord(payload.record)) return json(400, { error: 'Not a notification' });
  const record = payload.record;

  const chosen = await deps.getEmailKinds(record.user_id);
  if (!chosen.includes(record.kind as Kind)) return json(200, { skipped: 'this kind is not chosen for email' });

  const person = await deps.getPerson(record.user_id);
  if (!person || !person.email) return json(200, { skipped: 'no email address' });
  if (!person.confirmed) return json(200, { skipped: 'email address not confirmed' });

  if (!(await deps.claim(record.id, record.user_id))) return json(200, { skipped: 'already sent' });

  try {
    const now = deps.now();
    if ((await deps.countSince(record.user_id, new Date(now - 60 * 60 * 1000))) > deps.perHour) {
      await deps.release(record.id);
      return json(200, { skipped: 'too many this hour' });
    }
    if ((await deps.countSince(record.user_id, new Date(now - 24 * 60 * 60 * 1000))) > deps.perDay) {
      await deps.release(record.id);
      return json(200, { skipped: 'too many today' });
    }
    const projectTitle = record.project_id ? await deps.getProjectTitle(record.project_id) : null;
    await deps.send(buildEmail({ record, to: person.email, recipientName: person.name, projectTitle, appUrl: deps.appUrl }));
  } catch (error) {
    // Nothing went out, so the note is taken back and a later try can send it
    await deps.release(record.id).catch(() => undefined);
    console.error('notify-email failed:', error instanceof Error ? error.message : error);
    return json(502, { error: 'Could not send' });
  }
  return json(200, { sent: true });
};
