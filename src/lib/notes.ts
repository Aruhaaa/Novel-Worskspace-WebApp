import type { Chapter, WikiEntity } from '../services/types';
import { htmlToText } from './text';

/**
 * Extra facts about notebook entries and scenes, kept inside each entry's existing `content` field
 * under keys that start with an underscore. They sync with the cloud and need no new columns:
 *   _tags     "ally, sailor"
 *   _links    JSON list of { to: entityId, label }
 *   _chapter  (scenes) the chapter a scene belongs to
 *   _when     (scenes) when it happens, in the story's own words
 */
export const TYPE_LABEL: Record<WikiEntity['type'], string> = {
  character: 'Character',
  location: 'Location',
  item: 'Item',
  lore: 'Lore',
  scene: 'Scene',
};

export interface NoteLink {
  to: string;
  label: string;
}

const BOARD_KEYS = ['lat', 'lng', 'status', 'order'];

/** Keys the app manages itself; never shown as an attribute the writer typed. */
export const isManagedKey = (key: string): boolean => key.startsWith('_') || BOARD_KEYS.includes(key);

/** The attributes a writer typed, for display and for the edit form. */
export const typedAttributes = (entity: WikiEntity): [string, string][] =>
  Object.entries(entity.content || {})
    .filter(([k]) => !isManagedKey(k))
    .map(([k, v]) => [k, String(v)]);

export const parseTags = (text: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(',')) {
    const tag = raw.trim().replace(/^#/, '');
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      out.push(tag);
    }
  }
  return out;
};

export const getTags = (entity: WikiEntity): string[] => parseTags(entity.content?._tags || '');

export const getLinks = (entity: WikiEntity): NoteLink[] => {
  try {
    const raw = JSON.parse(entity.content?._links || '[]');
    return Array.isArray(raw) ? raw.filter((l) => l && typeof l.to === 'string').map((l) => ({ to: l.to, label: String(l.label || '') })) : [];
  } catch {
    return [];
  }
};

/** Everything under the underscore keys the notebook form does not edit, so saving never drops it. */
export const preservedKeys = (entity: WikiEntity | null): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!entity) return out;
  for (const [k, v] of Object.entries(entity.content || {})) {
    if (isManagedKey(k) && k !== '_tags' && k !== '_links') out[k] = String(v);
  }
  return out;
};

export const sceneChapterId = (scene: WikiEntity): string | undefined => scene.content?._chapter || undefined;
export const sceneWhen = (scene: WikiEntity): string => scene.content?._when || '';

/** A scene's content with its chapter and time set (or cleared), leaving the board position alone. */
export const withSceneLinks = (scene: WikiEntity, chapterId: string, when: string): Record<string, string> => {
  const next = { ...scene.content };
  if (chapterId) next._chapter = chapterId;
  else delete next._chapter;
  if (when.trim()) next._when = when.trim();
  else delete next._when;
  return next;
};

/** Connections from other entries pointing at this one, so a link shows from both ends. */
export const incomingLinks = (entity: WikiEntity, all: WikiEntity[]): { from: WikiEntity; label: string }[] =>
  all
    .filter((e) => e.id !== entity.id)
    .flatMap((e) => getLinks(e).filter((l) => l.to === entity.id).map((l) => ({ from: e, label: l.label })));

// ---- Where an entry appears in the manuscript ----

export interface ChapterText {
  chapter: Chapter;
  index: number;
  html: string;
  text: string;
}

export const indexChapters = (chapters: Chapter[]): ChapterText[] =>
  chapters.map((chapter, index) => ({ chapter, index, html: chapter.content || '', text: htmlToText(chapter.content) }));

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** How many times an entry is named in some chapter text: by @mention or by its plain name. */
export const mentionCount = (html: string, text: string, entity: WikiEntity): number => {
  let byName = 0;
  if (entity.name.trim()) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(entity.name.trim())}(?![\\p{L}\\p{N}])`, 'giu');
    byName = (text.match(re) || []).length;
  }
  // Mentions made before an entry was renamed still point at it by id (or, in older text, by name)
  const idRe = new RegExp(`data-id="(?:${escapeRegex(entity.id)}|${escapeRegex(entity.name)})"`, 'g');
  const byId = (html.match(idRe) || []).length;
  return Math.max(byName, byId);
};

export interface Appearance {
  chapter: Chapter;
  index: number;
  count: number;
}

export const appearances = (entity: WikiEntity, chapters: ChapterText[]): Appearance[] =>
  chapters
    .map((c) => ({ chapter: c.chapter, index: c.index, count: mentionCount(c.html, c.text, entity) }))
    .filter((a) => a.count > 0);
