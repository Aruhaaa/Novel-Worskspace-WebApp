import { tryCloud, unwrap } from './cloud';
import type { ChapterMeta, ChapterMetaMap, ChapterStatus } from './chapterMeta';
import { EMPTY_META, STATUS_ORDER } from './chapterMeta';
import { readGoalRecord, writeGoalRecord, type ProjectGoal } from './projectGoal';

/**
 * Keeps chapter notes and the manuscript goal in step between this device and the cloud.
 * The rule is simple: whichever copy was edited last wins. The device copy is always written first, so
 * nothing is lost offline, and anything newer on the device is sent up the next time it can be.
 */
interface NoteRow {
  chapter_id: string;
  status: string;
  synopsis: string;
  notes: string;
  updated_at: string;
}

const isDefault = (m: ChapterMeta) => m.status === 'draft' && !m.synopsis && !m.notes;
const safeStatus = (s: string): ChapterStatus => (STATUS_ORDER.includes(s as ChapterStatus) ? (s as ChapterStatus) : 'draft');
const stamp = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

const rowFor = (projectId: string, chapterId: string, m: ChapterMeta) => ({
  chapter_id: chapterId,
  project_id: projectId,
  status: m.status,
  synopsis: m.synopsis,
  notes: m.notes,
  updated_at: new Date(m.updatedAt || Date.now()).toISOString(),
});

/**
 * Merge the device's chapter notes with the cloud's. Returns the merged map to keep on the device,
 * or null when the cloud cannot be used (not set up, offline, no cloud database).
 */
export const syncChapterNotes = async (projectId: string, local: ChapterMetaMap, chapterIds: string[]): Promise<ChapterMetaMap | null> => {
  const pulled = await tryCloud('notes', async (c) =>
    unwrap(await c.from('chapter_notes').select('chapter_id, status, synopsis, notes, updated_at').eq('project_id', projectId)) as NoteRow[]
  );
  if (!pulled.ok) return null;

  const remote = new Map<string, NoteRow>();
  for (const row of pulled.value || []) remote.set(row.chapter_id, row);

  const merged: ChapterMetaMap = { ...local };
  const toPush: ReturnType<typeof rowFor>[] = [];
  for (const id of chapterIds) {
    const mine = local[id];
    const theirs = remote.get(id);
    const mineTime = mine?.updatedAt ?? 0;
    const theirTime = theirs ? stamp(theirs.updated_at) : 0;
    if (theirs && (!mine || mineTime <= theirTime)) {
      merged[id] = { status: safeStatus(theirs.status), synopsis: theirs.synopsis, notes: theirs.notes, updatedAt: theirTime };
    } else if (mine && (theirs ? mineTime > theirTime : !isDefault(mine))) {
      // Edited here since the cloud copy (including clearing it), or never sent: send it up.
      // Untimed notes from before cloud sync count as new.
      const stamped = { ...EMPTY_META, ...mine, updatedAt: mineTime || Date.now() };
      merged[id] = stamped;
      toPush.push(rowFor(projectId, id, stamped));
    }
  }
  if (toPush.length > 0) {
    await tryCloud('notes', async (c) => unwrap(await c.from('chapter_notes').upsert(toPush, { onConflict: 'chapter_id' }).select('chapter_id')));
  }
  return merged;
};

/** Send one chapter's notes to the cloud after an edit. Failures are fine: they are sent on the next sync. */
export const pushChapterNote = async (projectId: string, chapterId: string, meta: ChapterMeta): Promise<boolean> => {
  const res = await tryCloud('notes', async (c) =>
    unwrap(await c.from('chapter_notes').upsert(rowFor(projectId, chapterId, meta), { onConflict: 'chapter_id' }).select('chapter_id'))
  );
  return res.ok;
};

interface SettingsRow {
  goal_words: number | null;
  goal_deadline: string | null;
  updated_at: string;
}

/**
 * Merge the device's goal with the cloud's. Returns the goal to use (null when there is none),
 * or undefined when the cloud cannot be used.
 */
export const syncProjectGoal = async (projectId: string): Promise<ProjectGoal | null | undefined> => {
  const pulled = await tryCloud('settings', async (c) =>
    unwrap(await c.from('project_settings').select('goal_words, goal_deadline, updated_at').eq('project_id', projectId).maybeSingle()) as SettingsRow | null
  );
  if (!pulled.ok) return undefined;

  const theirs = pulled.value;
  const mine = readGoalRecord(projectId);
  const mineTime = mine?.updatedAt ?? 0;
  const theirTime = theirs ? stamp(theirs.updated_at) : 0;

  if (theirs && (!mine || mineTime <= theirTime)) {
    const goal: ProjectGoal = { target: theirs.goal_words || 0, deadline: theirs.goal_deadline, updatedAt: theirTime };
    writeGoalRecord(projectId, goal);
    return goal.target > 0 ? goal : null;
  }
  if (mine && (!theirs || mineTime > theirTime)) {
    const stamped = { ...mine, updatedAt: mineTime || Date.now() };
    writeGoalRecord(projectId, stamped);
    await pushProjectGoal(projectId, stamped);
    return stamped.target > 0 ? stamped : null;
  }
  return null;
};

export const pushProjectGoal = async (projectId: string, goal: ProjectGoal): Promise<boolean> => {
  const res = await tryCloud('settings', async (c) =>
    unwrap(
      await c
        .from('project_settings')
        .upsert(
          {
            project_id: projectId,
            goal_words: goal.target > 0 ? goal.target : null,
            goal_deadline: goal.target > 0 ? goal.deadline : null,
            updated_at: new Date(goal.updatedAt || Date.now()).toISOString(),
          },
          { onConflict: 'project_id' }
        )
        .select('project_id')
    )
  );
  return res.ok;
};
