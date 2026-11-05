import { databaseService } from '../services/database';
import { sanitizeHtml } from './sanitize';
import type { Project } from '../services/types';

/** One paragraph of a chapter, as plain text. Only text is ever shown, never the chapter's own markup. */
export interface Block {
  text: string;
  heading?: boolean;
}

export interface RawChapter {
  title: string;
  blocks: Block[];
}

export interface FeaturedNovel {
  /** The project's id, or 'sample' for the built-in page */
  id: string;
  /** null for the built-in sample page that shows while the library loads, or when it is empty */
  project: Project | null;
  title: string;
  author: string;
  genre: string;
  description: string;
  likes: number;
  chapters: RawChapter[];
}

/** A printed page: an optional chapter opening, then paragraphs. `cont` marks a paragraph carried over from the page before. */
export interface TextPage {
  chapter?: { label: string; title: string };
  paras: { text: string; cont: boolean }[];
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'LI']);
const WRAPPERS = new Set(['UL', 'OL', 'DIV', 'SECTION']);

/** Chapter HTML to a list of plain paragraphs. The HTML is cleaned first, then only its text is read. */
export const htmlToBlocks = (html: string): Block[] => {
  const doc = new DOMParser().parseFromString(sanitizeHtml(html || ''), 'text/html');
  const out: Block[] = [];
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (WRAPPERS.has(child.tagName)) {
        walk(child);
      } else if (BLOCK_TAGS.has(child.tagName)) {
        const text = clean(child.textContent || '');
        if (text) out.push({ text, heading: /^H[1-6]$/.test(child.tagName) });
      }
    }
  };
  walk(doc.body);
  return out;
};

/**
 * Lay chapters out as pages. A page holds about `budget` characters, which is what fits at the book's text size,
 * because the text scales with the page. Paragraphs that do not fit are carried onto the next page.
 */
export const paginate = (chapters: RawChapter[], budget: number, maxPages: number): TextPage[] => {
  const pages: TextPage[] = [];
  let cur: TextPage = { paras: [] };
  let used: number;

  const turn = () => {
    if (cur.paras.length || cur.chapter) pages.push(cur);
    cur = { paras: [] };
    used = 0;
  };

  for (let ci = 0; ci < chapters.length && pages.length < maxPages; ci++) {
    const ch = chapters[ci];
    if (cur.paras.length > 0) turn();
    cur.chapter = { label: `Chapter ${ci + 1}`, title: ch.title };
    used = 150;

    for (const block of ch.blocks) {
      let rest = block.text;
      let cont = false;
      while (rest && pages.length < maxPages) {
        const room = budget - used;
        if (room < 90 && cur.paras.length > 0) {
          turn();
          continue;
        }
        let take = rest;
        if (rest.length > room) {
          const cut = rest.lastIndexOf(' ', Math.max(room, 40));
          take = rest.slice(0, cut > 30 ? cut : Math.max(room, 40));
        }
        cur.paras.push({ text: take, cont });
        used += take.length + 40;
        rest = rest.slice(take.length).trimStart();
        cont = true;
        if (rest) turn();
      }
      if (pages.length >= maxPages) break;
    }
  }
  if (pages.length < maxPages && (cur.paras.length || cur.chapter)) pages.push(cur);
  return pages.slice(0, maxPages);
};

/** Shown at once, and kept if the library has nothing to feature. */
export const FALLBACK_NOVEL: FeaturedNovel = {
  id: 'sample',
  project: null,
  title: 'The Atlas of Quiet Places',
  author: 'A novel in the making',
  genre: '',
  description: 'Every story starts with a single line. This one is waiting for yours.',
  likes: 0,
  chapters: [
    {
      title: 'The things we leave behind.',
      blocks: [
        { text: 'On the morning the sea disappeared, Ada was making tea. She had always thought the end of something would announce itself.' },
        { text: 'Instead, there was only the kettle, the open window, and a silence where the waves should have been.' },
        { text: 'She stood with the cup in both hands and listened. A gull called once, somewhere inland, and sounded as lost as she felt. Nothing else moved.' },
      ],
    },
  ],
};

const MIN_TEXT = 900;

const textLength = (chapters: RawChapter[]) => chapters.reduce((n, c) => n + c.blocks.reduce((m, b) => m + b.text.length, 0), 0);

/**
 * A few of the library's most liked published novels, best first, each with its opening chapters, for the shelf.
 * Ties go to the most recently updated. A novel with too little text to fill a few pages is left off.
 * Likes are counted as stored; none are invented, so with no likes at all this is simply the newest novels with text.
 */
export const loadShelf = async (limit = 6): Promise<FeaturedNovel[]> => {
  const all = await databaseService.getPublicProjects();
  const ranked = [...all]
    .sort(
      (a, b) =>
        (b.likes?.length || 0) - (a.likes?.length || 0) ||
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, limit + 4);

  const loaded = await Promise.all(
    ranked.map(async (project): Promise<FeaturedNovel | null> => {
      try {
        const chapters = await databaseService.getChapters(project.id);
        const raw: RawChapter[] = chapters
          .slice(0, 3)
          .map((c) => ({ title: c.title || 'Untitled', blocks: htmlToBlocks(c.content) }))
          .filter((c) => c.blocks.length > 0);
        if (textLength(raw) < MIN_TEXT) return null;
        return {
          id: project.id,
          project,
          title: project.title,
          author: project.author_name || 'Anonymous',
          genre: project.genre || '',
          description: project.description || '',
          likes: project.likes?.length || 0,
          chapters: raw,
        };
      } catch {
        return null;
      }
    })
  );
  return loaded.filter((n): n is FeaturedNovel => n !== null).slice(0, limit);
};
