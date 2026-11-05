import { tryCloud, unwrap } from './cloud';
import type { Report, ReportReason, ReportTarget } from '../services/types';

/**
 * Reporting and blocking. With the cloud database set up (supabase/setup_scripts/20261008_account_safety.sql) reports go
 * to a queue only the admin can read, and blocks are enforced by the server. Without it, blocks still work on this
 * device (what a blocked person writes is hidden from you) and reports are kept in this browser for the local admin.
 */

export const REPORT_REASONS: { id: ReportReason; label: string; hint: string }[] = [
  { id: 'spam', label: 'Spam or advertising', hint: 'Repeated links, promotion, or posts that are not real writing.' },
  { id: 'harassment', label: 'Harassment or hate', hint: 'Targets a person or group, threatens, or demeans.' },
  { id: 'sexual', label: 'Sexual content', hint: 'Explicit material in a place that is not marked for it.' },
  { id: 'violence', label: 'Graphic violence', hint: 'Extreme violence or self-harm shown without care.' },
  { id: 'copyright', label: 'Copyright or plagiarism', hint: 'Someone else’s work posted as their own.' },
  { id: 'other', label: 'Something else', hint: 'Tell us what is wrong in the details.' },
];

export const TARGET_NAMES: Record<ReportTarget, string> = {
  novel: 'novel',
  comment: 'comment',
  review: 'review',
  message: 'message',
  author: 'author',
};

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
    // storage full or refused: nothing more can be done here
  }
};

const errorText = (error: unknown, fallback: string): string => {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message ? message : fallback;
};

// ------------------------------------------------------------------ blocking

const blocksKey = (userId: string) => `novelist_blocks_${userId}`;
const readLocalBlocks = (userId: string): string[] => readJson<string[]>(blocksKey(userId), []);
const writeLocalBlocks = (userId: string, ids: string[]) => writeJson(blocksKey(userId), ids);

/** Whether `blockerId` has blocked `blockedId`, as far as this device knows (local mode, where there is no server to ask). */
export const hasBlockedLocally = (blockerId: string, blockedId: string): boolean => readLocalBlocks(blockerId).includes(blockedId);

/** Everyone this person has blocked. The server's list wins when it can be reached; this device's copy is the fallback. */
export const loadBlocks = async (userId: string): Promise<string[]> => {
  const res = await tryCloud('blocks', async (c) => unwrap(await c.from('user_blocks').select('blocked_id').eq('blocker_id', userId)) as { blocked_id: string }[]);
  if (res.ok) {
    const ids = res.value.map((r) => r.blocked_id);
    writeLocalBlocks(userId, ids);
    return ids;
  }
  return readLocalBlocks(userId);
};

/** `saved` is 'device-only' only when there is a cloud database that could not be reached or is not set up, so the block lives on this device alone. */
export const addBlock = async (userId: string, blockedId: string): Promise<{ saved: 'saved' | 'device-only' }> => {
  const current = readLocalBlocks(userId);
  if (!current.includes(blockedId)) writeLocalBlocks(userId, [...current, blockedId]);
  const res = await tryCloud('blocks', async (c) =>
    unwrap(await c.from('user_blocks').upsert({ blocker_id: userId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }))
  );
  return { saved: res.ok || res.reason === 'none' ? 'saved' : 'device-only' };
};

export const removeBlock = async (userId: string, blockedId: string): Promise<{ saved: 'saved' | 'device-only' }> => {
  writeLocalBlocks(userId, readLocalBlocks(userId).filter((id) => id !== blockedId));
  const res = await tryCloud('blocks', async (c) => unwrap(await c.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', blockedId)));
  return { saved: res.ok || res.reason === 'none' ? 'saved' : 'device-only' };
};

// ------------------------------------------------------------------ reporting

const LOCAL_REPORTS = 'novel_reports';

/** What the report form hands over. `local` is only used when there is no cloud database to look the content up. */
export interface ReportInput {
  type: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details: string;
  local: { reporterId: string; targetUserId?: string; projectId?: string; excerpt: string };
}

export const submitReport = async (input: ReportInput): Promise<{ error: string | null }> => {
  const res = await tryCloud('reports', async (c) =>
    unwrap(await c.rpc('submit_report', { p_type: input.type, p_target_id: input.targetId, p_reason: input.reason, p_details: input.details.trim() }))
  );
  if (res.ok) return { error: null };
  if (res.reason === 'none') {
    const reports = readJson<Report[]>(LOCAL_REPORTS, []);
    const already = reports.some((r) => r.reporter_id === input.local.reporterId && r.target_type === input.type && r.target_id === input.targetId);
    if (!already) {
      reports.unshift({
        id: `rep-${Math.random().toString(36).slice(2, 11)}`,
        reporter_id: input.local.reporterId,
        target_type: input.type,
        target_id: input.targetId,
        target_user_id: input.local.targetUserId ?? null,
        project_id: input.local.projectId ?? null,
        reason: input.reason,
        details: input.details.trim(),
        excerpt: input.local.excerpt.slice(0, 500),
        status: 'open',
        created_at: new Date().toISOString(),
      });
      writeJson(LOCAL_REPORTS, reports);
    }
    return { error: null };
  }
  if (res.reason === 'setup') return { error: 'Reporting is not switched on for this site yet. Please tell the site owner.' };
  if (res.reason === 'network') return { error: 'Could not reach the server. Check your connection and try again.' };
  return { error: errorText(res.error, 'The report could not be sent. Please try again.') };
};

// ------------------------------------------------------------------ the admin's queue

export const listReports = async (): Promise<{ reports: Report[]; setupNeeded: boolean; error: string | null }> => {
  const res = await tryCloud('reports', async (c) => unwrap(await c.from('reports').select('*').order('created_at', { ascending: false }).limit(200)) as Report[]);
  if (res.ok) return { reports: res.value, setupNeeded: false, error: null };
  if (res.reason === 'none') return { reports: readJson<Report[]>(LOCAL_REPORTS, []), setupNeeded: false, error: null };
  if (res.reason === 'setup') return { reports: [], setupNeeded: true, error: null };
  return { reports: [], setupNeeded: false, error: res.reason === 'network' ? 'Could not reach the server.' : errorText(res.error, 'Could not load reports.') };
};

const dropFrom = (key: string, id: string) => writeJson(key, readJson<{ id: string }[]>(key, []).filter((row) => row.id !== id));

/** Dismiss a report, or remove what it points at (an unpublished novel stays on its author's shelf). */
export const resolveReport = async (report: Report, action: 'remove' | 'dismiss'): Promise<{ error: string | null }> => {
  const res = await tryCloud('reports', async (c) => unwrap(await c.rpc('admin_resolve_report', { p_report_id: report.id, p_action: action })));
  if (res.ok) return { error: null };
  if (res.reason !== 'none') return { error: res.reason === 'network' ? 'Could not reach the server.' : errorText(res.error, 'That did not work. Please try again.') };

  if (action === 'remove') {
    if (report.target_type === 'comment') dropFrom('novel_comments', report.target_id);
    if (report.target_type === 'review') dropFrom('novel_reviews', report.target_id);
    if (report.target_type === 'message') dropFrom('novel_chats', report.target_id);
    if (report.target_type === 'novel') {
      writeJson('novel_projects', readJson<{ id: string; is_published?: boolean }[]>('novel_projects', []).map((p) => (p.id === report.target_id ? { ...p, is_published: false } : p)));
    }
  }
  const status = action === 'remove' ? 'actioned' : 'dismissed';
  writeJson(LOCAL_REPORTS, readJson<Report[]>(LOCAL_REPORTS, []).map((r) => (r.id === report.id ? { ...r, status, resolved_at: new Date().toISOString() } : r)));
  return { error: null };
};
