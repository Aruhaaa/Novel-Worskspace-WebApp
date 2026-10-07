import { BIN_STORE, runStore } from './history';
import { tryCloud, unwrap } from './cloud';
import type { ChapterMeta } from './chapterMeta';

/**
 * A deleted chapter, kept so it can be brought back. With the cloud database set up the copy is kept there,
 * so it is on every device; otherwise on this device, and it moves up once the cloud can be reached.
 */
export interface DeletedChapter {
  /** A number for a copy held on this device, a string for one in the cloud */
  id?: number | string;
  projectId: string;
  title: string;
  content: string;
  position: number;
  meta?: ChapterMeta;
  deletedAt: number;
}

interface CloudRow {
  id: string;
  project_id: string;
  title: string;
  content: string;
  position: number;
  meta: ChapterMeta | null;
  deleted_at: string;
}

const COLUMNS = 'id, project_id, title, content, position, meta, deleted_at';

const fromRow = (r: CloudRow): DeletedChapter => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  content: r.content,
  position: r.position,
  meta: r.meta || undefined,
  deletedAt: Date.parse(r.deleted_at),
});

const toRow = (item: Omit<DeletedChapter, 'id'>) => ({
  project_id: item.projectId,
  title: item.title,
  content: item.content,
  position: item.position,
  meta: item.meta ?? null,
  deleted_at: new Date(item.deletedAt).toISOString(),
});

const newestFirst = (items: DeletedChapter[]) => [...items].sort((a, b) => b.deletedAt - a.deletedAt);

const listLocal = async (projectId: string): Promise<DeletedChapter[]> => {
  try {
    return await runStore<DeletedChapter[]>(BIN_STORE, 'readonly', (store) => store.index('projectId').getAll(projectId));
  } catch {
    return [];
  }
};

/** Keep a copy of a deleted chapter. Returns its id in the bin, so the delete can be undone. */
export const addToBin = async (item: Omit<DeletedChapter, 'id' | 'deletedAt'>): Promise<number | string> => {
  const entry = { ...item, deletedAt: Date.now() };
  const sent = await tryCloud('bin', async (c) => unwrap(await c.from('deleted_chapters').insert(toRow(entry)).select('id').single()) as { id: string });
  if (sent.ok) return sent.value.id;
  // Not at the cloud right now: keep it on this device, and it will move up later
  return (await runStore<IDBValidKey>(BIN_STORE, 'readwrite', (store) => store.add(entry))) as number;
};

// Two callers asking at once must not both upload the same device copies
const moving = new Map<string, Promise<boolean>>();

/** Move copies held on this device up to the cloud. */
const moveToCloud = (projectId: string): Promise<boolean> => {
  const running = moving.get(projectId);
  if (running) return running;
  const job = upload(projectId).finally(() => moving.delete(projectId));
  moving.set(projectId, job);
  return job;
};

// Reads the device copies afresh, so a late caller never re-sends what an earlier one already moved
const upload = async (projectId: string): Promise<boolean> => {
  const local = await listLocal(projectId);
  if (local.length === 0) return true;
  const res = await tryCloud('bin', async (c) => unwrap(await c.from('deleted_chapters').insert(local.map(toRow)).select('id')));
  if (!res.ok) return false;
  for (const item of local) {
    if (typeof item.id === 'number') {
      const id = item.id;
      await runStore(BIN_STORE, 'readwrite', (store) => store.delete(id)).catch(() => undefined);
    }
  }
  return true;
};

export const listBin = async (projectId: string): Promise<DeletedChapter[]> => {
  const local = await listLocal(projectId);
  const read = () =>
    tryCloud('bin', async (c) =>
      unwrap(await c.from('deleted_chapters').select(COLUMNS).eq('project_id', projectId).order('deleted_at', { ascending: false })) as CloudRow[]
    );
  let cloud = await read();
  if (!cloud.ok) return newestFirst(local);
  let leftover = local;
  if (local.length > 0 && (await moveToCloud(projectId))) {
    const again = await read();
    if (again.ok) {
      cloud = again;
      leftover = [];
    }
  }
  return newestFirst([...cloud.value.map(fromRow), ...leftover]);
};

export const removeFromBin = async (id: number | string): Promise<void> => {
  if (typeof id === 'number') {
    try {
      await runStore(BIN_STORE, 'readwrite', (store) => store.delete(id));
    } catch {
      // ignore
    }
    return;
  }
  await tryCloud('bin', async (c) => unwrap(await c.from('deleted_chapters').delete().eq('id', id).select('id')));
};
