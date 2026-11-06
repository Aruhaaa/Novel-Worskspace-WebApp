import type { Chapter } from '../services/types';

/**
 * Publishing a novel one chapter at a time.
 *
 * A chapter is a draft when `published_at` is `null`. A chapter with no `published_at` at all (older data, or a database
 * that has not had the chapter-publishing script run) counts as published, so nothing readers could see before is hidden.
 * A novel is listed in the Public Library while at least one of its chapters is published; the database keeps
 * `projects.is_published` in step (supabase/setup_scripts/20261106_chapter_publishing.sql), and local mode does the same here.
 */

export const isDraft = (chapter: Pick<Chapter, 'published_at'>): boolean => chapter.published_at === null;

/** The chapters a reader may see, in the order they were given */
export const publishedChapters = <T extends Pick<Chapter, 'published_at'>>(chapters: T[]): T[] => chapters.filter((c) => !isDraft(c));

export interface PublishSummary {
  published: number;
  drafts: number;
  total: number;
}

export const summarise = (chapters: Pick<Chapter, 'published_at'>[]): PublishSummary => {
  const drafts = chapters.filter(isDraft).length;
  return { published: chapters.length - drafts, drafts, total: chapters.length };
};

/** The chapters that "Publish up to here" would publish: every draft from the first chapter to this one */
export const draftsUpTo = (chapters: Chapter[], chapterId: string): Chapter[] => {
  const sorted = [...chapters].sort((a, b) => a.position - b.position);
  const at = sorted.findIndex((c) => c.id === chapterId);
  return at < 0 ? [] : sorted.slice(0, at + 1).filter(isDraft);
};

/** What a database says when a function it was asked to call is not there yet (the setup script has not been run) */
export const isMissingFunction = (error: { code?: string; message?: string } | null | undefined): boolean =>
  !!error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function|does not exist/i.test(error.message ?? ''));

/** What a database says when a column it was asked for is not there yet */
export const isMissingColumn = (error: { code?: string; message?: string } | null | undefined): boolean =>
  !!error && (error.code === '42703' || error.code === 'PGRST204' || /column .*published_at|published_at.* column/i.test(error.message ?? ''));
