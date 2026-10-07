import { useEffect, useSyncExternalStore } from 'react';
import { listLinkComments, removeLinkComment, setLinkCommentStatus } from './share';

/**
 * Comments from beta readers. Two sources: comments left through a private reading link (live, kept in the cloud)
 * and comments imported from the feedback files readers send back (kept on this device, per project).
 */
export interface FeedbackComment {
  id: string;
  chapterId: string;
  chapterTitle: string;
  /** The passage the reader selected; empty for a comment on the whole chapter */
  quote: string;
  note: string;
  createdAt: string;
  reader: string;
  status: 'open' | 'done';
  importedAt: string;
  /** Set for comments left through a reading link */
  source?: 'link';
}

export const FEEDBACK_FORMAT = 'novelist-feedback';

/** The term to find when showing a reader's passage: its opening words, which are the least likely to be split by formatting. */
export const quoteTerm = (quote: string): string => quote.replace(/\s+/g, ' ').trim().slice(0, 40);

const key = (projectId: string) => `novelist_feedback_${projectId}`;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

const readRaw = (projectId: string): string => {
  try {
    return localStorage.getItem(key(projectId)) || '[]';
  } catch {
    return '[]';
  }
};

export const loadFeedback = (projectId: string): FeedbackComment[] => {
  try {
    const list = JSON.parse(readRaw(projectId));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const save = (projectId: string, list: FeedbackComment[]) => {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(list));
  } catch {
    // storage full or blocked
  }
  emit();
};

export type ParsedFeedback = { ok: true; reader: string; projectTitle: string; comments: Omit<FeedbackComment, 'status' | 'importedAt' | 'reader'>[] } | { ok: false; error: string };

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

/** Check a feedback file before anything from it is kept. */
export const parseFeedbackFile = (raw: string, projectId: string, projectTitle: string): ParsedFeedback => {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'That file is not readable. Choose the .json file the reader sent back.' };
  }
  const d = data as Record<string, unknown> | null;
  if (!d || d.format !== FEEDBACK_FORMAT || !Array.isArray(d.comments)) {
    return { ok: false, error: 'That does not look like a feedback file from a reading copy.' };
  }
  if (d.projectId !== projectId) {
    return { ok: false, error: `This feedback is for “${text(d.projectTitle, 80) || 'another project'}”, not “${projectTitle}”.` };
  }
  const comments = d.comments
    .map((c: unknown) => {
      const o = (c || {}) as Record<string, unknown>;
      return {
        id: text(o.id, 60),
        chapterId: text(o.chapterId, 80),
        chapterTitle: text(o.chapterTitle, 200),
        quote: text(o.quote, 1000),
        note: text(o.note, 5000),
        createdAt: text(o.createdAt, 40) || new Date().toISOString(),
      };
    })
    .filter((c) => c.id && c.chapterId && c.note.trim());
  return { ok: true, reader: text(d.reader, 80).trim() || 'A reader', projectTitle: text(d.projectTitle, 200), comments };
};

/** Keep the comments from a parsed file. Comments already imported (same reader and id) are skipped. */
export const importFeedback = (projectId: string, parsed: Extract<ParsedFeedback, { ok: true }>): { added: number; skipped: number } => {
  const existing = loadFeedback(projectId);
  const seen = new Set(existing.map((c) => `${c.reader}|${c.id}`));
  const fresh: FeedbackComment[] = [];
  for (const c of parsed.comments) {
    if (seen.has(`${parsed.reader}|${c.id}`)) continue;
    fresh.push({ ...c, reader: parsed.reader, status: 'open', importedAt: new Date().toISOString() });
  }
  if (fresh.length) save(projectId, [...existing, ...fresh]);
  return { added: fresh.length, skipped: parsed.comments.length - fresh.length };
};

// ---- Comments left through reading links (in the cloud) ----

const linkComments = new Map<string, FeedbackComment[]>();
const lastRefresh = new Map<string, number>();

/** Fetch the comments readers have left through links. Returns false if there is no cloud, or it is not set up. */
export const refreshLinkFeedback = async (projectId: string, force = false): Promise<boolean> => {
  if (!force && Date.now() - (lastRefresh.get(projectId) || 0) < 20000) return true;
  lastRefresh.set(projectId, Date.now());
  const res = await listLinkComments(projectId);
  if (!res.ok) return false;
  linkComments.set(
    projectId,
    res.value.map((c) => ({
      id: c.id,
      chapterId: c.chapterId,
      chapterTitle: c.chapterTitle,
      quote: c.quote,
      note: c.note,
      createdAt: c.createdAt,
      reader: c.readerName,
      status: c.status,
      importedAt: c.createdAt,
      source: 'link' as const,
    }))
  );
  emit();
  return true;
};

export const setFeedbackStatus = async (projectId: string, comment: FeedbackComment, status: FeedbackComment['status']) => {
  if (comment.source === 'link') {
    // Show the change at once; the server confirms it
    linkComments.set(projectId, (linkComments.get(projectId) || []).map((c) => (c.id === comment.id ? { ...c, status } : c)));
    emit();
    const res = await setLinkCommentStatus(comment.id, status);
    if (!res.ok) await refreshLinkFeedback(projectId, true);
    return;
  }
  save(projectId, loadFeedback(projectId).map((c) => (c.id === comment.id && c.reader === comment.reader ? { ...c, status } : c)));
};

export const removeFeedback = async (projectId: string, comment: FeedbackComment) => {
  if (comment.source === 'link') {
    linkComments.set(projectId, (linkComments.get(projectId) || []).filter((c) => c.id !== comment.id));
    emit();
    const res = await removeLinkComment(comment.id);
    if (!res.ok) await refreshLinkFeedback(projectId, true);
    return;
  }
  save(projectId, loadFeedback(projectId).filter((c) => !(c.id === comment.id && c.reader === comment.reader)));
};

// A stable snapshot per project, so React only re-renders when something really changed
const snapshots = new Map<string, { raw: string; cloud: FeedbackComment[] | undefined; value: FeedbackComment[] }>();
const EMPTY: FeedbackComment[] = [];

const snapshotFor = (projectId: string | undefined): FeedbackComment[] => {
  if (!projectId) return EMPTY;
  const raw = readRaw(projectId);
  const cloud = linkComments.get(projectId);
  const cached = snapshots.get(projectId);
  if (cached && cached.raw === raw && cached.cloud === cloud) return cached.value;
  const value = [...loadFeedback(projectId), ...(cloud || [])];
  snapshots.set(projectId, { raw, cloud, value });
  return value;
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener('storage', fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', fn);
  };
};

/** All the feedback for a project: imported files and live link comments. Kept up to date. */
export const useFeedback = (projectId: string | undefined): FeedbackComment[] => {
  const value = useSyncExternalStore(subscribe, () => snapshotFor(projectId), () => EMPTY);
  useEffect(() => {
    if (projectId) void refreshLinkFeedback(projectId);
  }, [projectId]);
  return value;
};
