import { tryCloud, unwrap, type CloudResult } from './cloud';

/**
 * Private reading links for beta readers. A link holds a secret token; anyone with the link can read the
 * manuscript and leave comments, without an account. The writer can see the comments and revoke the link.
 * Needs the tables and functions from supabase/migrations/20261003_cloud_sync.sql.
 */

// Where a link should point. The desktop app has no web address of its own, so it uses the published site.
const PUBLIC_APP_URL = 'https://novel-worskspace-web-app.vercel.app/';

export const linkUrl = (token: string): string => {
  const here = typeof location !== 'undefined' && location.protocol.startsWith('http') ? `${location.origin}${location.pathname}` : PUBLIC_APP_URL;
  return `${here}#/read/${token}`;
};

export interface ShareLink {
  id: string;
  token: string;
  label: string;
  createdAt: number;
  revokedAt: number | null;
}

interface LinkRow {
  id: string;
  token: string;
  label: string;
  created_at: string;
  revoked_at: string | null;
}

const toLink = (r: LinkRow): ShareLink => ({
  id: r.id,
  token: r.token,
  label: r.label,
  createdAt: Date.parse(r.created_at),
  revokedAt: r.revoked_at ? Date.parse(r.revoked_at) : null,
});

// ---- The writer's side ----

export const listShareLinks = (projectId: string): Promise<CloudResult<ShareLink[]>> =>
  tryCloud('share', async (c) => {
    const rows = unwrap(
      await c.from('share_links').select('id, token, label, created_at, revoked_at').eq('project_id', projectId).order('created_at', { ascending: false })
    ) as LinkRow[];
    return rows.map(toLink);
  });

export const createShareLink = (projectId: string, label: string): Promise<CloudResult<ShareLink>> =>
  tryCloud('share', async (c) => {
    const row = unwrap(
      await c.from('share_links').insert({ project_id: projectId, label: label.trim().slice(0, 80) }).select('id, token, label, created_at, revoked_at').single()
    ) as LinkRow;
    return toLink(row);
  });

export const revokeShareLink = (linkId: string): Promise<CloudResult<unknown>> =>
  tryCloud('share', async (c) => unwrap(await c.from('share_links').update({ revoked_at: new Date().toISOString() }).eq('id', linkId).select('id')));

export interface LinkComment {
  id: string;
  chapterId: string;
  chapterTitle: string;
  quote: string;
  note: string;
  readerName: string;
  createdAt: string;
  status: 'open' | 'done';
}

interface CommentRow {
  id: string;
  chapter_id: string;
  chapter_title: string;
  quote: string;
  note: string;
  reader_name: string;
  created_at: string;
  status?: 'open' | 'done';
}

const toComment = (r: CommentRow): LinkComment => ({
  id: r.id,
  chapterId: r.chapter_id,
  chapterTitle: r.chapter_title,
  quote: r.quote,
  note: r.note,
  readerName: r.reader_name,
  createdAt: r.created_at,
  status: r.status || 'open',
});

export const listLinkComments = (projectId: string): Promise<CloudResult<LinkComment[]>> =>
  tryCloud('share', async (c) => {
    const rows = unwrap(
      await c.from('share_comments').select('id, chapter_id, chapter_title, quote, note, reader_name, created_at, status').eq('project_id', projectId).order('created_at', { ascending: true })
    ) as CommentRow[];
    return rows.map(toComment);
  });

export const setLinkCommentStatus = (id: string, status: 'open' | 'done'): Promise<CloudResult<unknown>> =>
  tryCloud('share', async (c) => unwrap(await c.from('share_comments').update({ status }).eq('id', id).select('id')));

export const removeLinkComment = (id: string): Promise<CloudResult<unknown>> =>
  tryCloud('share', async (c) => unwrap(await c.from('share_comments').delete().eq('id', id).select('id')));

// ---- The reader's side ----

export interface SharedManuscript {
  label: string;
  project: { id: string; title: string; author_name: string; description: string };
  chapters: { id: string; title: string; content: string; position: number }[];
}

/** The manuscript behind a link, or null if the link is wrong, revoked or expired. */
export const getSharedManuscript = (token: string): Promise<CloudResult<SharedManuscript | null>> =>
  tryCloud('share', async (c) => unwrap(await c.rpc('get_shared_manuscript', { p_token: token })) as SharedManuscript | null);

export const listMyComments = (token: string, readerKey: string): Promise<CloudResult<LinkComment[]>> =>
  tryCloud('share', async (c) => {
    const rows = unwrap(await c.rpc('list_share_comments', { p_token: token, p_reader_key: readerKey })) as CommentRow[];
    return (rows || []).map(toComment);
  });

export const addMyComment = (
  token: string,
  readerKey: string,
  readerName: string,
  chapterId: string,
  quote: string,
  note: string
): Promise<CloudResult<LinkComment>> =>
  tryCloud('share', async (c) =>
    toComment(
      unwrap(
        await c.rpc('add_share_comment', {
          p_token: token,
          p_reader_key: readerKey,
          p_reader_name: readerName,
          p_chapter_id: chapterId,
          p_quote: quote,
          p_note: note,
        })
      ) as CommentRow
    )
  );

export const deleteMyComment = (token: string, readerKey: string, commentId: string): Promise<CloudResult<boolean>> =>
  tryCloud('share', async (c) => unwrap(await c.rpc('delete_share_comment', { p_token: token, p_reader_key: readerKey, p_comment_id: commentId })) as boolean);

/** The message from a refused request, such as "Please add your name first." */
export const refusalMessage = (error: unknown): string => {
  const m = String((error as { message?: unknown } | null)?.message ?? '');
  return m && m.length < 200 ? m : 'That did not work. Please try again.';
};
