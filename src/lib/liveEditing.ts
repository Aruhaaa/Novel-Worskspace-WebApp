import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { createBroadcast, type BroadcastLine } from './live';

/**
 * Writing in the same chapter at the same time. Everyone who has the chapter open holds a copy of it as a Yjs document, and
 * the small changes each person makes travel to the others over a private line (see createBroadcast in live.ts): in the cloud
 * a private Supabase Realtime channel only people on the project may join, in local mode the other tabs of this browser.
 * Yjs merges changes made at the same moment, so nobody's typing is lost.
 *
 * Nothing here replaces saving. Each person's editor still saves the chapter to the database as before; this only
 * makes everyone's open copy agree while they write.
 *
 * Starting: a person who opens the chapter asks whoever else has it open for the document. If someone answers, that is the
 * starting point. If nobody does (they are alone), the document is filled from the saved chapter. Two people who open it at the
 * very same moment both fill it from the same saved text with the same identity, and Yjs treats that as one and the same
 * (see initClientId), so they do not end up with the text twice.
 */
export interface LiveUser {
  name: string;
  color: string;
}

export type LiveStatus = 'connecting' | 'live' | 'offline';

export interface LiveSession {
  ydoc: Y.Doc;
  awareness: Awareness;
  user: LiveUser;
  /** True when nobody else answered, so the document still has to be filled from the saved chapter */
  needsInit: boolean;
  /** Whether the line to the others is up. 'offline' means changes still save as usual but are not shared until it comes back. */
  getStatus: () => LiveStatus;
  onStatus: (listener: () => void) => () => void;
  /** Fill the document from the saved text, the same way for everyone (see initClientId). Call once, with the editor ready. */
  fill: (apply: () => void, savedHtml: string) => void;
  close: () => void;
}

export interface LiveHandle {
  ready: Promise<LiveSession>;
  /** Leave at once, even if the session has not finished starting */
  cancel: () => void;
}

const WAIT_FOR_OTHERS_MS = 1500;
const BATCH_MS = 80;
const HEAL_EVERY_MS = 12_000;

const COLORS = ['#c0562f', '#3f7d5a', '#3b6ea5', '#8a5fa3', '#b08a1e', '#2f8a8a', '#b5476b', '#6b7a2f'];

/** The same person always gets the same colour, and different people usually different ones */
export const colorFor = (id: string): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
};

const toBase64 = (bytes: Uint8Array): string => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};
const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** An update with nothing in it is two zero bytes */
const isEmptyUpdate = (update: Uint8Array): boolean => update.length <= 2;

/**
 * The identity used to fill an empty document from the saved text. It comes from the chapter and its text, so two people
 * who fill it at the same moment from the same text make identical content under the same identity, which Yjs merges
 * into one copy instead of two. (Different text gives a different identity, so a mismatch shows up as extra text, never as a corrupted document.)
 */
export const initClientId = (chapterId: string, savedHtml: string): number => {
  let h = 2166136261;
  const text = `${chapterId}|${savedHtml}`;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Never 0, which Yjs treats specially, and always a whole number below 2^32
  return (h >>> 0) || 1;
};

const newId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Lines that are still closing, by name. A new line on the same name has to wait: the cloud hands back the old channel for as
 * long as it is still there, and a channel cannot be given new listeners once it has been joined. (This happens whenever a
 * screen is made twice in a row, as in development, or a chapter is left and opened again at once.)
 */
const closing = new Map<string, Promise<unknown>>();

export const openLiveSession = (options: {
  projectId: string;
  chapterId: string;
  user: LiveUser;
  /** False for someone who may only read: they listen but never send */
  canWrite: boolean;
  waitMs?: number;
}): LiveHandle => {
  const { projectId, chapterId, user, canWrite } = options;
  const topic = `project:${projectId}:doc:${chapterId}`;
  let cancelled = false;
  let leave: () => void = () => undefined;

  const ready = (async (): Promise<LiveSession> => {
    await closing.get(topic);
    // Nobody is waiting for it any more: it never starts, and no answer ever comes
    if (cancelled) return new Promise<LiveSession>(() => undefined);

    return new Promise<LiveSession>((resolve) => {
      const selfId = newId();
      const ydoc = new Y.Doc();
      const awareness = new Awareness(ydoc);
      awareness.setLocalStateField('user', user);
      const line: BroadcastLine = createBroadcast(topic, { private: true });

      let isReady = false;
      let status: LiveStatus = 'connecting';
      const statusListeners = new Set<() => void>();
      let settled = false;
      let batchTimer: number | undefined;
      let queue: Uint8Array[] = [];
      let closed = false;

      const send = (event: string, payload: unknown) => {
        if (!closed) line.send(event, payload);
      };
      const askForState = () => send('sync-req', { from: selfId, sv: toBase64(Y.encodeStateVector(ydoc)) });

      // Changes can be lost on the way (a dropped connection, a busy line). Asking now and then puts that right.
      const heal = window.setInterval(askForState, HEAL_EVERY_MS);

      const close = () => {
        if (closed) return;
        // Tell the others this person has left, so their cursor does not linger
        removeAwarenessStates(awareness, [ydoc.clientID], 'local');
        closed = true;
        window.clearInterval(heal);
        window.clearTimeout(startTimer);
        window.clearTimeout(batchTimer);
        const gone = Promise.resolve(line.close()).catch(() => undefined);
        closing.set(topic, gone);
        void gone.then(() => {
          if (closing.get(topic) === gone) closing.delete(topic);
        });
        awareness.destroy();
        ydoc.destroy();
      };

      const finish = (needsInit: boolean) => {
        if (settled) return;
        settled = true;
        isReady = !needsInit;
        resolve({
          ydoc,
          awareness,
          user,
          needsInit,
          getStatus: () => status,
          onStatus: (listener) => {
            statusListeners.add(listener);
            return () => statusListeners.delete(listener);
          },
          fill: (apply, savedHtml) => {
            // The same identity for everyone filling from the same text; this person's own identity again straight after
            const own = ydoc.clientID;
            ydoc.clientID = initClientId(chapterId, savedHtml);
            try {
              apply();
            } finally {
              ydoc.clientID = own;
              isReady = true;
            }
          },
          close,
        });
      };

      // Changes made here go out to the others, a few at a time so a fast typist does not flood the line
      const flush = () => {
        batchTimer = undefined;
        if (queue.length === 0) return;
        const merged = queue.length === 1 ? queue[0] : Y.mergeUpdates(queue);
        queue = [];
        send('update', { update: toBase64(merged) });
      };
      ydoc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin === 'remote' || !canWrite) return;
        queue.push(update);
        if (batchTimer === undefined) batchTimer = window.setTimeout(flush, BATCH_MS);
      });

      awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        if (origin === 'remote' || !canWrite) return;
        send('aware', { update: toBase64(encodeAwarenessUpdate(awareness, [...added, ...updated, ...removed])) });
      });

      line.on<{ from: string; sv: string }>('sync-req', ({ from, sv }) => {
        if (from === selfId) return;
        // Only someone who has the document can lend it; someone still waiting for it has nothing to give
        if (isReady && canWrite) {
          const diff = Y.encodeStateAsUpdate(ydoc, fromBase64(sv));
          if (!isEmptyUpdate(diff)) send('sync-res', { to: from, update: toBase64(diff) });
        }
        // The newcomer also needs to see where everyone's cursor is
        if (canWrite) send('aware', { update: toBase64(encodeAwarenessUpdate(awareness, [awareness.clientID])) });
      });
      line.on<{ to: string; update: string }>('sync-res', ({ to, update }) => {
        if (to !== selfId) return;
        Y.applyUpdate(ydoc, fromBase64(update), 'remote');
        finish(false);
      });
      line.on<{ update: string }>('update', ({ update }) => {
        if (!update) return;
        Y.applyUpdate(ydoc, fromBase64(update), 'remote');
      });
      line.on<{ update: string }>('aware', ({ update }) => {
        if (update) applyAwarenessUpdate(awareness, fromBase64(update), 'remote');
      });

      line.open((connected) => {
        status = connected ? 'live' : 'offline';
        statusListeners.forEach((listener) => listener());
        // Each time the line (re)connects, catch up on anything missed while it was down
        if (connected) askForState();
      });

      // Nobody answered: this person is alone with the chapter
      const startTimer = window.setTimeout(() => finish(true), options.waitMs ?? WAIT_FOR_OTHERS_MS);

      // Leaving before it has finished starting closes the line all the same
      leave = close;
    });
  })();

  return {
    ready,
    cancel: () => {
      cancelled = true;
      leave();
    },
  };
};
