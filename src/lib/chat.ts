import { cloud, tryCloud, unwrap } from './cloud';
import { markLocalMessageNotificationsRead } from './notifications';
import type { ChatMessage } from '../services/types';

/**
 * Unread counts and "Seen" marks for messages. With the cloud database set up (supabase/setup_scripts/20261105_next_features.sql)
 * the server keeps read marks, so they follow a person to every device and the sender can see that a message was read.
 * Without it, read marks are kept on this device, and unread counts are worked out from them.
 */

type Reads = Record<string, string>;

const readsKey = (readerId: string) => `novel_chat_reads_${readerId}`;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const localReads = (readerId: string): Reads => readJson<Reads>(readsKey(readerId), {});

const setLocalRead = (readerId: string, peerId: string, untilIso: string) => {
  const reads = localReads(readerId);
  if (reads[peerId] && reads[peerId] >= untilIso) return;
  reads[peerId] = untilIso;
  try {
    localStorage.setItem(readsKey(readerId), JSON.stringify(reads));
  } catch {
    // storage full or refused
  }
};

const countBySender = (messages: { sender_id: string; created_at: string }[], reads: Reads): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const m of messages) {
    if (!reads[m.sender_id] || m.created_at > reads[m.sender_id]) out[m.sender_id] = (out[m.sender_id] ?? 0) + 1;
  }
  return out;
};

/** How many unread messages this person has from each sender. Null when it could not be worked out right now. */
export const loadUnreadCounts = async (userId: string): Promise<Record<string, number> | null> => {
  const res = await tryCloud('messages', async (c) => {
    const rows = unwrap(await c.rpc('unread_message_counts')) as { sender_id: string; unread: number | string }[] | null;
    return Object.fromEntries((rows ?? []).map((r) => [r.sender_id, Number(r.unread)])) as Record<string, number>;
  });
  if (res.ok) return res.value;
  if (res.reason === 'network' || res.reason === 'error') return null;

  if (res.reason === 'setup') {
    // The messages exist in the cloud but its read marks do not yet: count against the marks kept on this device
    const c = cloud();
    if (!c) return {};
    try {
      const rows = unwrap(await c.from('chat_messages').select('sender_id,created_at').eq('receiver_id', userId).order('created_at', { ascending: false }).limit(500)) as { sender_id: string; created_at: string }[];
      return countBySender(rows, localReads(userId));
    } catch {
      return null;
    }
  }
  const all = readJson<ChatMessage[]>('novel_chats', []);
  return countBySender(
    all.filter((m) => m.receiver_id === userId),
    localReads(userId)
  );
};

/** This person has read what `peerId` sent, up to `untilIso` (the newest message they saw). */
export const markChatRead = async (userId: string, peerId: string, untilIso: string = new Date().toISOString()): Promise<void> => {
  setLocalRead(userId, peerId, untilIso);
  const res = await tryCloud('messages', async (c) => {
    unwrap(await c.rpc('mark_chat_read', { p_peer: peerId, p_until: untilIso }));
  });
  if (!res.ok && res.reason === 'none') markLocalMessageNotificationsRead(userId, peerId);
};

/** Up to when the other person has read what this person sent them (for "Seen"), or null. */
export const loadPeerRead = async (userId: string, peerId: string): Promise<string | null> => {
  const res = await tryCloud('messages', async (c) => {
    const row = unwrap(await c.from('message_reads').select('read_until').eq('user_id', peerId).eq('peer_id', userId).maybeSingle()) as { read_until: string } | null;
    return row?.read_until ?? null;
  });
  if (res.ok) return res.value;
  if (res.reason === 'none') return localReads(peerId)[userId] ?? null;
  return null;
};
