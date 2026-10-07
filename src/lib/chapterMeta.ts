/**
 * Extra facts about each chapter: where it stands, a one-line synopsis and private notes.
 * Kept in this browser (per project). The chapters table has no columns for these yet.
 */
export type ChapterStatus = 'draft' | 'revising' | 'done';

export interface ChapterMeta {
  status: ChapterStatus;
  synopsis: string;
  notes: string;
  /** When this was last edited on this device (ms). Used to decide which copy is newer when syncing. */
  updatedAt?: number;
}

export type ChapterMetaMap = Record<string, ChapterMeta>;

export const STATUS_ORDER: ChapterStatus[] = ['draft', 'revising', 'done'];
export const STATUS_LABEL: Record<ChapterStatus, string> = {
  draft: 'Drafting',
  revising: 'Revising',
  done: 'Done',
};

export const EMPTY_META: ChapterMeta = { status: 'draft', synopsis: '', notes: '' };

const key = (projectId: string) => `novelist_chapter_meta_${projectId}`;

export const loadChapterMeta = (projectId: string): ChapterMetaMap => {
  try {
    const raw = localStorage.getItem(key(projectId));
    return raw ? (JSON.parse(raw) as ChapterMetaMap) : {};
  } catch {
    return {};
  }
};

export const saveChapterMeta = (projectId: string, map: ChapterMetaMap): void => {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(map));
  } catch {
    // storage full or blocked: the notes still work for this session
  }
};

export const metaFor = (map: ChapterMetaMap, chapterId: string): ChapterMeta => ({ ...EMPTY_META, ...map[chapterId] });
