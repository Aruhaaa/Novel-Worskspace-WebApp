import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { watchTable, onLocalChange } from '../lib/live';
import {
  DEFAULT_SETTINGS,
  deleteNotification,
  listNotifications,
  loadNotificationSettings,
  markNotificationsRead,
  saveNotificationSettings,
  type AppNotification,
  type NotificationSettings,
  type NotificationSource,
} from '../lib/notifications';
import { loadUnreadCounts, markChatRead as markChatReadRemote } from '../lib/chat';
import type { ChatMessage } from '../services/types';

/**
 * What happens while the app is open, for the person signed in: notifications (the bell) and unread messages.
 * It listens for new ones as they happen, and checks again now and then in case something was missed.
 */
interface LiveContextType {
  notifications: AppNotification[];
  unreadNotifications: number;
  /** 'setup' means the cloud tables for notifications have not been created yet */
  notificationSource: NotificationSource | null;
  settings: NotificationSettings;
  saveSettings: (next: NotificationSettings) => Promise<{ saved: 'saved' | 'device-only' }>;
  refreshNotifications: () => Promise<void>;
  markRead: (ids: string[] | 'all') => Promise<void>;
  removeNotification: (id: string) => Promise<void>;

  /** Unread messages from each person, and in all (people you blocked are not counted) */
  unreadMessagesBy: Record<string, number>;
  unreadMessages: number;
  /** Tell the app a conversation was read up to a moment (the time of the newest message seen) */
  markChatRead: (peerId: string, untilIso?: string) => Promise<void>;
  /** The conversation open on screen: its new messages are read as they arrive rather than counted */
  setActiveChat: (peerId: string | null) => void;
  /** Be told when a message arrives (the message), or when messages may have changed (null) */
  onIncoming: (listener: (message: ChatMessage | null) => void) => () => void;
  /** True while new things are delivered instantly; false when the app is checking every few seconds instead */
  realtime: boolean;
}

const LiveContext = createContext<LiveContextType | undefined>(undefined);

const FAST_CHECK_MS = 8000;
const SLOW_CHECK_MS = 45000;

/** Everything known for one person. Tagged with whose it is, so a different person signing in never sees it. */
interface Snapshot {
  owner: string | null;
  notifications: AppNotification[];
  unread: number;
  source: NotificationSource | null;
  settings: NotificationSettings;
  unreadBy: Record<string, number>;
}

const EMPTY: Snapshot = { owner: null, notifications: [], unread: 0, source: null, settings: DEFAULT_SETTINGS, unreadBy: {} };

export const LiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isGuest, blockedIds, refreshShared } = useApp();
  // The newest "someone joined" notification seen, so a new one makes the app look again at who is on which project
  const newestJoin = useRef<string | null>(null);
  const refreshSharedRef = useRef(refreshShared);
  useEffect(() => {
    refreshSharedRef.current = refreshShared;
  });
  const userId = user && !isGuest ? user.id : null;

  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [realtime, setRealtime] = useState(false);
  const view = snap.owner === userId ? snap : EMPTY;

  // Answers that arrive after the person signed out, or after a newer question, are ignored
  const current = useRef<string | null>(null);
  const activeChat = useRef<string | null>(null);
  const incoming = useRef(new Set<(message: ChatMessage | null) => void>());
  const timers = useRef<{ notes?: number; unread?: number }>({});

  useEffect(() => {
    current.current = userId;
  }, [userId]);

  const patch = useCallback((owner: string, change: Partial<Snapshot> | ((base: Snapshot) => Partial<Snapshot>)) => {
    setSnap((prev) => {
      const base = prev.owner === owner ? prev : { ...EMPTY, owner };
      return { ...base, ...(typeof change === 'function' ? change(base) : change) };
    });
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!userId) return;
    const result = await listNotifications(userId);
    if (!result || current.current !== userId) return;
    patch(userId, { notifications: result.items, unread: result.unread, source: result.source });
    const joined = result.items.find((n) => n.kind === 'collab')?.id ?? '';
    if (newestJoin.current !== null && joined !== newestJoin.current) void refreshSharedRef.current();
    newestJoin.current = joined;
  }, [userId, patch]);

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    const counts = await loadUnreadCounts(userId);
    if (!counts || current.current !== userId) return;
    // The conversation on screen is being read, so it has nothing unread
    if (activeChat.current) delete counts[activeChat.current];
    patch(userId, { unreadBy: counts });
  }, [userId, patch]);

  // Several signals in a row (a burst of messages) become one check
  const soon = useCallback(
    (which: 'notes' | 'unread') => {
      window.clearTimeout(timers.current[which]);
      timers.current[which] = window.setTimeout(() => void (which === 'notes' ? refreshNotifications() : refreshUnread()), 200);
    },
    [refreshNotifications, refreshUnread]
  );

  useEffect(() => {
    if (!userId) return;
    void refreshNotifications();
    void refreshUnread();
    void loadNotificationSettings(userId).then((s) => {
      if (current.current === userId) patch(userId, { settings: s });
    });

    const offNotes = watchTable<AppNotification>({
      name: `notifications:${userId}`,
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
      onEvent: () => soon('notes'),
      onStatus: (connected) => setRealtime(connected),
    });
    const offInbox = watchTable<ChatMessage>({
      name: `inbox:${userId}`,
      table: 'chat_messages',
      filter: `receiver_id=eq.${userId}`,
      onEvent: (e) => {
        if (e.event !== 'INSERT') return;
        incoming.current.forEach((fn) => fn(e.row));
        soon('unread');
        soon('notes');
      },
    });
    // Another tab of this browser changed saved data (local mode)
    const offLocal = onLocalChange([`novel_notifications_${userId}`, 'novel_chats', 'novel_chat_reads_', 'novel_notification_settings_'], () => {
      incoming.current.forEach((fn) => fn(null));
      soon('notes');
      soon('unread');
    });

    const pending = timers.current;
    return () => {
      offNotes();
      offInbox();
      offLocal();
      window.clearTimeout(pending.notes);
      window.clearTimeout(pending.unread);
    };
  }, [userId, refreshNotifications, refreshUnread, soon, patch]);

  // A safety check now and then, in case something was missed; quicker when nothing is being delivered live
  useEffect(() => {
    if (!userId) return;
    const every = realtime ? SLOW_CHECK_MS : FAST_CHECK_MS;
    const run = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshNotifications();
      void refreshUnread();
      incoming.current.forEach((fn) => fn(null));
    };
    const id = window.setInterval(run, every);
    document.addEventListener('visibilitychange', run);
    window.addEventListener('online', run);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('online', run);
    };
  }, [userId, realtime, refreshNotifications, refreshUnread]);

  const markRead = useCallback(
    async (ids: string[] | 'all') => {
      if (!userId) return;
      const now = new Date().toISOString();
      patch(userId, (base) => ({
        notifications: base.notifications.map((n) => (!n.read_at && (ids === 'all' || ids.includes(n.id)) ? { ...n, read_at: now } : n)),
        unread: ids === 'all' ? 0 : Math.max(0, base.unread - ids.length),
      }));
      await markNotificationsRead(userId, ids);
    },
    [userId, patch]
  );

  const removeNotification = useCallback(
    async (id: string) => {
      if (!userId) return;
      patch(userId, (base) => ({ notifications: base.notifications.filter((n) => n.id !== id) }));
      await deleteNotification(userId, id);
      void refreshNotifications();
    },
    [userId, patch, refreshNotifications]
  );

  const saveSettings = useCallback(
    async (next: NotificationSettings) => {
      if (!userId) return { saved: 'device-only' as const };
      patch(userId, { settings: next });
      return saveNotificationSettings(userId, next);
    },
    [userId, patch]
  );

  const clearUnreadFrom = useCallback(
    (peerId: string) => {
      if (!userId) return;
      patch(userId, (base) => {
        if (!base.unreadBy[peerId]) return {};
        const next = { ...base.unreadBy };
        delete next[peerId];
        return { unreadBy: next };
      });
    },
    [userId, patch]
  );

  const markChatRead = useCallback(
    async (peerId: string, untilIso?: string) => {
      if (!userId) return;
      clearUnreadFrom(peerId);
      await markChatReadRemote(userId, peerId, untilIso);
      void refreshNotifications();
    },
    [userId, clearUnreadFrom, refreshNotifications]
  );

  const setActiveChat = useCallback(
    (peerId: string | null) => {
      activeChat.current = peerId;
      if (peerId) clearUnreadFrom(peerId);
    },
    [clearUnreadFrom]
  );

  const onIncoming = useCallback((listener: (message: ChatMessage | null) => void) => {
    incoming.current.add(listener);
    return () => {
      incoming.current.delete(listener);
    };
  }, []);

  const unreadMessagesBy = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [sender, n] of Object.entries(view.unreadBy)) if (n > 0 && !blockedIds.includes(sender)) out[sender] = n;
    return out;
  }, [view.unreadBy, blockedIds]);
  const unreadMessages = useMemo(() => Object.values(unreadMessagesBy).reduce((a, b) => a + b, 0), [unreadMessagesBy]);

  const value: LiveContextType = {
    notifications: view.notifications,
    unreadNotifications: view.unread,
    notificationSource: view.source,
    settings: view.settings,
    saveSettings,
    refreshNotifications,
    markRead,
    removeNotification,
    unreadMessagesBy,
    unreadMessages,
    markChatRead,
    setActiveChat,
    onIncoming,
    realtime,
  };

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLive = (): LiveContextType => {
  const context = useContext(LiveContext);
  if (!context) throw new Error('useLive must be used within a LiveProvider');
  return context;
};
