import { tryCloud, unwrap } from './cloud';
import { hasBlockedLocally } from './safety';
import { t, tp } from '../i18n';

/**
 * Notifications: a follow, a comment or review on your novel, a message, a comment on a private reading link, someone
 * joining your project. With the cloud database set up (supabase/setup_scripts/20261105_next_features.sql) the server writes
 * them, and the app is told the moment one arrives. Without a cloud database (local mode) the app writes them itself when
 * another account in the same browser does something, so everything can be tried without a server.
 */
export type NotificationKind = 'follow' | 'comment' | 'review' | 'message' | 'share_comment' | 'collab';

export const NOTIFICATION_KINDS: NotificationKind[] = ['follow', 'comment', 'review', 'message', 'share_comment', 'collab'];

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: NotificationKind;
  project_id: string | null;
  chapter_id: string | null;
  ref_id: string | null;
  snippet: string;
  actor_name: string;
  meta: Record<string, unknown>;
  /** For messages: how many new ones this line stands for */
  count: number;
  created_at: string;
  read_at: string | null;
}

export interface NotificationSettings {
  /** Kinds this person does not want in the app */
  muted_kinds: NotificationKind[];
  /** Kinds that are also emailed (needs the notify-email function set up) */
  email_kinds: NotificationKind[];
}

export const DEFAULT_SETTINGS: NotificationSettings = { muted_kinds: [], email_kinds: [] };

/** Where the list came from, so the screen can say what is going on. 'setup' means the cloud tables are not created yet. */
export type NotificationSource = 'cloud' | 'local' | 'setup';

const itemsKey = (userId: string) => `novel_notifications_${userId}`;
const settingsKey = (userId: string) => `novel_notification_settings_${userId}`;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or refused
  }
};

const byNewest = (a: AppNotification, b: AppNotification) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

export const listNotifications = async (userId: string, limit = 60): Promise<{ items: AppNotification[]; unread: number; source: NotificationSource } | null> => {
  const res = await tryCloud('notifications', async (c) => {
    const [rows, count] = await Promise.all([
      c.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
      c.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null),
    ]);
    return { items: unwrap(rows) as AppNotification[], unread: count.error ? 0 : (count.count ?? 0) };
  });
  if (res.ok) return { ...res.value, source: 'cloud' };
  if (res.reason === 'setup') return { items: [], unread: 0, source: 'setup' };
  if (res.reason === 'network' || res.reason === 'error') return null; // keep what is showing
  const items = readJson<AppNotification[]>(itemsKey(userId), []).sort(byNewest).slice(0, limit);
  return { items, unread: items.filter((n) => !n.read_at).length, source: 'local' };
};

export const markNotificationsRead = async (userId: string, ids: string[] | 'all'): Promise<void> => {
  const now = new Date().toISOString();
  const res = await tryCloud('notifications', async (c) => {
    let q = c.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null);
    if (ids !== 'all') q = q.in('id', ids);
    unwrap(await q);
  });
  if (res.ok || res.reason !== 'none') return;
  const items = readJson<AppNotification[]>(itemsKey(userId), []);
  writeJson(
    itemsKey(userId),
    items.map((n) => (!n.read_at && (ids === 'all' || ids.includes(n.id)) ? { ...n, read_at: now } : n))
  );
};

export const deleteNotification = async (userId: string, id: string): Promise<void> => {
  const res = await tryCloud('notifications', async (c) => {
    unwrap(await c.from('notifications').delete().eq('user_id', userId).eq('id', id));
  });
  if (res.ok || res.reason !== 'none') return;
  writeJson(
    itemsKey(userId),
    readJson<AppNotification[]>(itemsKey(userId), []).filter((n) => n.id !== id)
  );
};

export const loadNotificationSettings = async (userId: string): Promise<NotificationSettings> => {
  const clean = (s: Partial<NotificationSettings> | null | undefined): NotificationSettings => ({
    muted_kinds: (s?.muted_kinds ?? []).filter((k): k is NotificationKind => NOTIFICATION_KINDS.includes(k)),
    email_kinds: (s?.email_kinds ?? []).filter((k): k is NotificationKind => NOTIFICATION_KINDS.includes(k)),
  });
  const res = await tryCloud('notifications', async (c) => {
    const row = unwrap(await c.from('notification_settings').select('muted_kinds,email_kinds').eq('user_id', userId).maybeSingle());
    return clean(row as Partial<NotificationSettings> | null);
  });
  if (res.ok) return res.value;
  return clean(readJson<Partial<NotificationSettings>>(settingsKey(userId), DEFAULT_SETTINGS));
};

export const saveNotificationSettings = async (userId: string, settings: NotificationSettings): Promise<{ saved: 'saved' | 'device-only' }> => {
  writeJson(settingsKey(userId), settings);
  const res = await tryCloud('notifications', async (c) => {
    unwrap(await c.from('notification_settings').upsert({ user_id: userId, muted_kinds: settings.muted_kinds, email_kinds: settings.email_kinds, updated_at: new Date().toISOString() }));
  });
  return { saved: res.ok ? 'saved' : 'device-only' };
};

/**
 * Local mode only: tell another account in this browser that something happened. The server does this itself in the cloud.
 * Never tells someone about their own action, respects what they switched off, and stays quiet about people they blocked.
 */
export const pushLocalNotification = (
  recipientId: string,
  note: { actor_id: string | null; actor_name: string; kind: NotificationKind; project_id?: string | null; chapter_id?: string | null; ref_id?: string | null; snippet?: string; meta?: Record<string, unknown> }
): void => {
  if (!recipientId || recipientId === note.actor_id) return;
  const settings = readJson<Partial<NotificationSettings>>(settingsKey(recipientId), DEFAULT_SETTINGS);
  if ((settings.muted_kinds ?? []).includes(note.kind)) return;
  if (note.actor_id && hasBlockedLocally(recipientId, note.actor_id)) return;

  const items = readJson<AppNotification[]>(itemsKey(recipientId), []);
  const now = new Date().toISOString();
  const snippet = (note.snippet ?? '').slice(0, 140);
  if (note.kind === 'message' && note.actor_id) {
    const open = items.find((n) => n.kind === 'message' && n.actor_id === note.actor_id && !n.read_at);
    if (open) {
      open.count += 1;
      open.snippet = snippet;
      open.ref_id = note.ref_id ?? null;
      open.created_at = now;
      writeJson(itemsKey(recipientId), items);
      return;
    }
  }
  items.unshift({
    id: `n-${Math.random().toString(36).slice(2, 11)}`,
    user_id: recipientId,
    actor_id: note.actor_id,
    kind: note.kind,
    project_id: note.project_id ?? null,
    chapter_id: note.chapter_id ?? null,
    ref_id: note.ref_id ?? null,
    snippet,
    actor_name: note.actor_name || '',
    meta: note.meta ?? {},
    count: 1,
    created_at: now,
    read_at: null,
  });
  writeJson(itemsKey(recipientId), items.slice(0, 200));
};

/** Local mode: a conversation was read, so its "new messages" line is read too. */
export const markLocalMessageNotificationsRead = (userId: string, peerId: string): void => {
  const items = readJson<AppNotification[]>(itemsKey(userId), []);
  const now = new Date().toISOString();
  let changed = false;
  for (const n of items) {
    if (n.kind === 'message' && n.actor_id === peerId && !n.read_at) {
      n.read_at = now;
      changed = true;
    }
  }
  if (changed) writeJson(itemsKey(userId), items);
};

// ---- Words and places ----

export const KIND_LABEL: Record<NotificationKind, () => string> = {
  follow: () => t('Someone follows you'),
  comment: () => t('Comments on your novels'),
  review: () => t('Reviews of your novels'),
  message: () => t('New messages'),
  share_comment: () => t('Comments on your reading links'),
  collab: () => t('Someone joins your project'),
};

export const KIND_HINT: Record<NotificationKind, () => string> = {
  follow: () => t('When another author follows you.'),
  comment: () => t('When a reader comments on a published novel of yours.'),
  review: () => t('When a reader rates and reviews a published novel of yours.'),
  message: () => t('When an author you follow, or who follows you, writes to you.'),
  share_comment: () => t('When someone comments on a private reading link you shared.'),
  collab: () => t('When someone accepts your invitation to a project.'),
};

export const ROLE_LABEL: Record<string, () => string> = {
  owner: () => t('owner'),
  coauthor: () => t('co-author'),
  editor: () => t('editor'),
  viewer: () => t('viewer'),
};

const metaText = (n: AppNotification, key: string): string => (typeof n.meta?.[key] === 'string' ? (n.meta[key] as string) : '');

/** What a notification says, and where it leads. */
export const describeNotification = (n: AppNotification): { title: string; detail: string; href: string } => {
  const name = n.actor_name || t('Someone');
  const novel = metaText(n, 'project_title') || t('your novel');
  switch (n.kind) {
    case 'follow':
      return { title: t('{name} started following you', { name }), detail: '', href: n.actor_id ? `/library/author/${n.actor_id}` : '/profile' };
    case 'comment':
      return { title: t('{name} commented on {novel}', { name, novel }), detail: n.snippet, href: n.project_id ? `/library/novel/${n.project_id}` : '/library' };
    case 'review': {
      const rating = Number(n.meta?.rating);
      const stars = Number.isFinite(rating) && rating > 0 ? `${'★'.repeat(rating)}${'☆'.repeat(Math.max(0, 5 - rating))} ` : '';
      return { title: t('{name} reviewed {novel}', { name, novel }), detail: `${stars}${n.snippet}`.trim(), href: n.project_id ? `/library/novel/${n.project_id}` : '/library' };
    }
    case 'message':
      return {
        title: tp(n.count, '{name} sent you a message', '{name} sent you {n} new messages', { name }),
        detail: n.snippet,
        href: n.actor_id ? `/messages/${n.actor_id}` : '/messages',
      };
    case 'share_comment': {
      const chapter = metaText(n, 'chapter_title');
      return {
        title: t('{name} commented on a reading link for {novel}', { name, novel }),
        detail: [chapter, n.snippet].filter(Boolean).join(' · '),
        href: '/chapters',
      };
    }
    case 'collab': {
      const role = (ROLE_LABEL[metaText(n, 'role')] ?? ROLE_LABEL.editor)();
      return { title: t('{name} joined {novel} as {role}', { name, novel, role }), detail: '', href: '/manuscripts' };
    }
  }
};
