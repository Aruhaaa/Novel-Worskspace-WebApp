import { localDate } from './dates';

/**
 * "Words written today" for a project: how much longer the manuscript is than it was this morning.
 * Each chapter's length is remembered at the start of the day (`base`) and after every save (`last`).
 * Kept in this browser. `logged` only ever goes up, so deleting a paragraph never shrinks today's count.
 */
interface DayRecord {
  date: string;
  base: Record<string, number>;
  last: Record<string, number>;
  logged: number;
}

const key = (projectId: string) => `novelist_day_${projectId}`;

const read = (projectId: string): DayRecord | null => {
  try {
    const raw = localStorage.getItem(key(projectId));
    return raw ? (JSON.parse(raw) as DayRecord) : null;
  } catch {
    return null;
  }
};

const write = (projectId: string, rec: DayRecord) => {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(rec));
  } catch {
    // ignore
  }
};

/** Start of a new day: today's chapters are the starting point, and nothing is written yet. */
const fresh = (words: Record<string, number>): DayRecord => ({ date: localDate(), base: { ...words }, last: { ...words }, logged: 0 });

/** Call when a project's chapters load. Starts a new day, or adds chapters that arrived from another device. */
export const startDay = (projectId: string, words: Record<string, number>): void => {
  const rec = read(projectId);
  if (!rec || rec.date !== localDate()) {
    write(projectId, fresh(words));
    return;
  }
  let changed = false;
  for (const [id, n] of Object.entries(words)) {
    if (!(id in rec.last)) {
      rec.base[id] = n;
      rec.last[id] = n;
      changed = true;
    }
  }
  if (changed) write(projectId, rec);
};

/** A chapter that was restored or imported already has its words, so they are not counted as new. */
export const markExisting = (projectId: string, chapterId: string, words: number): void => {
  const rec = read(projectId) || fresh({});
  rec.base[chapterId] = words;
  rec.last[chapterId] = words;
  write(projectId, rec);
};

export const forgetChapter = (projectId: string, chapterId: string): void => {
  const rec = read(projectId);
  if (!rec) return;
  delete rec.base[chapterId];
  delete rec.last[chapterId];
  write(projectId, rec);
};

/**
 * Record a saved chapter's length. Returns today's total to log, or null if there is nothing new to log.
 */
export const noteWords = (projectId: string, chapterId: string, words: number): number | null => {
  let rec = read(projectId);
  if (!rec) rec = fresh({});
  if (rec.date !== localDate()) {
    // The day rolled over while the app stayed open: yesterday's last lengths are this morning's start
    rec = { date: localDate(), base: { ...rec.last }, last: { ...rec.last }, logged: 0 };
  }
  rec.last[chapterId] = words;
  let net = 0;
  for (const [id, n] of Object.entries(rec.last)) net += n - (rec.base[id] ?? 0);
  net = Math.max(0, net);
  const next = Math.max(rec.logged, net);
  const changed = next > rec.logged;
  rec.logged = next;
  write(projectId, rec);
  return changed ? next : null;
};
