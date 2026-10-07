import { countWords } from './text';
import { tryCloud, unwrap } from './cloud';

/**
 * Restore points for a chapter. With the cloud database set up they are kept there and follow the writer
 * to any device. Otherwise (or while offline) they are kept in this browser's IndexedDB, and move to the
 * cloud the next time it can be reached.
 */
export type SnapshotReason = 'session' | 'auto' | 'manual' | 'before-restore' | 'deleted';

export interface Snapshot {
  /** A number for a restore point held on this device, a string for one in the cloud */
  id?: number | string;
  chapterId: string;
  title: string;
  content: string;
  words: number;
  createdAt: number;
  reason: SnapshotReason;
}

const DB_NAME = 'novelist-history';
const STORE = 'snapshots';
export const BIN_STORE = 'bin';
const MAX_PER_CHAPTER = 40;
export const AUTO_SNAPSHOT_GAP_MS = 10 * 60 * 1000;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('chapterId', 'chapterId');
        }
        if (!db.objectStoreNames.contains(BIN_STORE)) {
          const bin = db.createObjectStore(BIN_STORE, { keyPath: 'id', autoIncrement: true });
          bin.createIndex('projectId', 'projectId');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
};

export const runStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = fn(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const run = <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) => runStore(STORE, mode, fn);

// ---- On this device ----

const listLocal = async (chapterId: string): Promise<Snapshot[]> => {
  try {
    const all = await run<Snapshot[]>('readonly', (store) => store.index('chapterId').getAll(chapterId));
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
};

const deleteLocal = async (id: number): Promise<void> => {
  try {
    await run('readwrite', (store) => store.delete(id));
  } catch {
    // ignore
  }
};

const pruneLocal = async (chapterId: string) => {
  const all = await listLocal(chapterId);
  // Keep every manual and restore point; thin out the automatic ones first
  const removable = all.filter((s) => s.reason === 'auto' || s.reason === 'session');
  const overflow = all.length - MAX_PER_CHAPTER;
  if (overflow <= 0) return;
  for (const s of removable.slice(-overflow)) {
    if (typeof s.id === 'number') await deleteLocal(s.id);
  }
};

// ---- In the cloud ----

interface CloudRow {
  id: number;
  chapter_id: string;
  title: string;
  content: string;
  words: number;
  reason: SnapshotReason;
  created_at: string;
}

const fromRow = (r: CloudRow): Snapshot => ({
  id: String(r.id),
  chapterId: r.chapter_id,
  title: r.title,
  content: r.content,
  words: r.words,
  reason: r.reason,
  createdAt: Date.parse(r.created_at),
});

const COLUMNS = 'id, chapter_id, title, content, words, reason, created_at';

const listCloud = (chapterId: string, limit = 100) =>
  tryCloud('history', async (c) =>
    unwrap(await c.from('chapter_snapshots').select(COLUMNS).eq('chapter_id', chapterId).order('created_at', { ascending: false }).limit(limit)) as CloudRow[]
  );

const pruneCloud = async (chapterId: string) => {
  await tryCloud('history', async (c) => {
    // Everything past the newest MAX_PER_CHAPTER; only automatic points are ever thinned out
    const old = unwrap(
      await c.from('chapter_snapshots').select('id, reason').eq('chapter_id', chapterId).order('created_at', { ascending: false }).range(MAX_PER_CHAPTER, MAX_PER_CHAPTER + 200)
    ) as { id: number; reason: SnapshotReason }[];
    const ids = old.filter((o) => o.reason === 'auto' || o.reason === 'session').map((o) => o.id);
    if (ids.length) unwrap(await c.from('chapter_snapshots').delete().in('id', ids).select('id'));
  });
};

// Two callers asking at once must not both upload the same device copies
const moving = new Map<string, Promise<boolean>>();

/** Move restore points held on this device up to the cloud, once it can be reached. */
const moveToCloud = (projectId: string, chapterId: string): Promise<boolean> => {
  const running = moving.get(chapterId);
  if (running) return running;
  const job = upload(projectId, chapterId).finally(() => moving.delete(chapterId));
  moving.set(chapterId, job);
  return job;
};

const upload = async (projectId: string, chapterId: string): Promise<boolean> => {
  const local = await listLocal(chapterId);
  if (local.length === 0) return true;
  const rows = local.map((s) => ({
    chapter_id: chapterId,
    project_id: projectId,
    title: s.title,
    content: s.content,
    words: s.words,
    reason: s.reason,
    created_at: new Date(s.createdAt).toISOString(),
  }));
  const res = await tryCloud('history', async (c) => unwrap(await c.from('chapter_snapshots').insert(rows).select('id')));
  if (!res.ok) return false;
  for (const s of local) if (typeof s.id === 'number') await deleteLocal(s.id);
  return true;
};

// ---- Together ----

/** Every restore point for a chapter, newest first. */
export const listSnapshots = async (projectId: string, chapterId: string): Promise<Snapshot[]> => {
  const local = await listLocal(chapterId);
  const cloud = await listCloud(chapterId);
  if (!cloud.ok) return local;
  if (local.length > 0 && (await moveToCloud(projectId, chapterId))) {
    const again = await listCloud(chapterId);
    if (again.ok) return again.value.map(fromRow);
  }
  return [...cloud.value.map(fromRow), ...local].sort((a, b) => b.createdAt - a.createdAt);
};

// The newest restore point per chapter, remembered so saving does not ask the server every time
const newest = new Map<string, { title: string; content: string; createdAt: number }>();

const newestFor = async (projectId: string, chapterId: string) => {
  const hit = newest.get(chapterId);
  if (hit) return hit;
  const first = (await listSnapshots(projectId, chapterId))[0];
  const value = first ? { title: first.title, content: first.content, createdAt: first.createdAt } : null;
  if (value) newest.set(chapterId, value);
  return value;
};

// Snapshot writes run one at a time, so two quick calls can't both decide "nothing saved yet"
let writeChain: Promise<unknown> = Promise.resolve();

/** Save a restore point. Skips it if the text is identical to the newest one. */
export const addSnapshot = (
  projectId: string,
  chapterId: string,
  title: string,
  content: string,
  reason: SnapshotReason
): Promise<boolean> => {
  const task = async (): Promise<boolean> => {
    try {
      const last = await newestFor(projectId, chapterId);
      if (last && last.content === content && last.title === title && reason !== 'manual') return false;
      const words = countWords(content);
      const now = Date.now();
      const sent = await tryCloud('history', async (c) =>
        unwrap(await c.from('chapter_snapshots').insert({ chapter_id: chapterId, project_id: projectId, title, content, words, reason }).select('id'))
      );
      if (sent.ok) {
        void pruneCloud(chapterId);
        void moveToCloud(projectId, chapterId);
      } else {
        // Not at the cloud right now: keep it here, and it will move up later
        await run('readwrite', (store) => store.add({ chapterId, title, content, words, createdAt: now, reason } as Snapshot));
        await pruneLocal(chapterId);
      }
      newest.set(chapterId, { title, content, createdAt: now });
      return true;
    } catch {
      return false;
    }
  };
  const result = writeChain.then(task, task);
  writeChain = result.catch(() => undefined);
  return result;
};

/** Take a restore point if the last one is old enough, so a long session leaves a trail. */
export const maybeAutoSnapshot = async (projectId: string, chapterId: string, title: string, content: string): Promise<void> => {
  if (!content.trim()) return;
  const last = await newestFor(projectId, chapterId);
  if (!last || Date.now() - last.createdAt >= AUTO_SNAPSHOT_GAP_MS) {
    await addSnapshot(projectId, chapterId, title, content, 'auto');
  }
};

export const REASON_LABEL: Record<SnapshotReason, string> = {
  session: 'When you opened it',
  auto: 'Automatic',
  manual: 'Saved by you',
  'before-restore': 'Before a restore',
  deleted: 'Before it was deleted',
};
