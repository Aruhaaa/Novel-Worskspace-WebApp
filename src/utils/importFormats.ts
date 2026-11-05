import JSZip from 'jszip';
import { countWords } from '../lib/text';
import { t as tr, tp } from '../i18n';

/**
 * Reads a manuscript from a Word (.docx), plain text or Markdown file and splits it into chapters.
 *
 * Reading and splitting are separate steps. A file is read once into a neutral list of blocks (a ManuscriptSource);
 * splitManuscript() then cuts that list into chapters for any SplitMode, so changing "Split by" never re-reads the file.
 * Everything that reaches the editor is built here from escaped text. Raw HTML is never passed through.
 */

// ---------------------------------------------------------------- public types

export interface ImportedChapter {
  title: string;
  html: string;
  words: number;
}

export interface ImportedManuscript {
  title: string;
  author: string;
  chapters: ImportedChapter[];
  warnings: string[];
  format: 'docx' | 'txt' | 'md';
}

export type SplitMode = 'auto' | 'headings' | 'chapter-lines' | 'scene-breaks' | 'none';

export interface ParseOptions {
  split?: SplitMode;
  /** The file's name, used when the file itself does not say what the book is called */
  fileName?: string;
}

type Align = 'center' | 'right' | 'justify';

interface HeadingBlock {
  t: 'h';
  level: number;
  html: string;
  text: string;
}
interface ParaBlock {
  t: 'p';
  html: string;
  /** Plain text, kept only for short paragraphs (enough to recognise a chapter line) */
  text: string;
  align?: Align;
  quote?: boolean;
  /** Alone between blank lines, so a bare "1." on its own may be a chapter number */
  solo?: boolean;
  role?: 'title' | 'subtitle';
}
interface ItemBlock {
  t: 'li';
  depth: number;
  ordered: boolean;
  /** Items with the same id (and the same kind) belong to one list */
  list: string;
  html: string;
}
interface RuleBlock {
  t: 'hr';
}
export type Block = HeadingBlock | ParaBlock | ItemBlock | RuleBlock;

/** A file read into blocks, before it is cut into chapters. */
export interface ManuscriptSource {
  format: 'docx' | 'txt' | 'md';
  /** Best guess at the book's title */
  title: string;
  author: string;
  /** True when the title came from the text itself (a Title style, front matter or a lone top heading) */
  titleFound: boolean;
  authorFound: boolean;
  /** The file name without its extension */
  fileTitle: string;
  blocks: Block[];
  warnings: string[];
  /** The heading level that starts a chapter: the shallowest one in the file */
  chapterLevel: number;
  counts: { headings: number; chapterLines: number; sceneBreaks: number };
}

// ---------------------------------------------------------------- limits and messages

export const MAX_IMPORT_BYTES = 30 * 1024 * 1024;
const MAX_XML_BYTES = 120 * 1024 * 1024;
const MAX_TITLE = 200;

/** Errors whose message is meant to be shown to the person as it is. */
export class ImportError extends Error {}

const MSG_NOT_DOCX = 'That does not look like a Word .docx file. If it is an older .doc, open it in Word and choose Save As, then .docx.';
const MSG_TOO_BIG = 'That file is larger than 30 MB, which is more than an import can handle. Try splitting the manuscript into smaller files.';
const MSG_XML_BIG = 'That Word file expands to far more text than a manuscript should hold, so it was not opened. Try saving it again from Word.';
const MSG_XML_BAD = 'That Word file could not be read. Open it in Word, choose Save As, then .docx, and try again.';
const MSG_NO_TEXT = 'No text was found in that file.';
const MSG_GENERIC = 'That file type is not supported. Use a Word (.docx), plain text (.txt) or Markdown (.md) file.';

const UNSUPPORTED: Record<string, string> = {
  doc: 'That is an older Word .doc file. Open it in Word, choose Save As, then .docx, and import that.',
  rtf: 'Rich Text (.rtf) files are not supported. Open it in Word or another editor and save it as .docx or plain text.',
  odt: 'OpenDocument (.odt) files are not supported. Open it in LibreOffice or Word and save it as .docx.',
  pages: 'Pages files are not supported. In Pages choose File, Export To, Word, then import the .docx.',
  pdf: 'A PDF does not keep chapters or formatting, so it cannot be imported. Use the original Word file, or copy the text into a .txt file.',
  epub: 'E-books (.epub) are not supported. Use the original Word or text file instead.',
};

// ---------------------------------------------------------------- text helpers

// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL = /[\u0000-\u0008\u000B\u000E-\u001F\u007F]/g;
const WS_RUN = /[ \t\r\n\f\v]+/g;

const collapse = (s: string): string => s.replace(WS_RUN, ' ').trim();
const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n).trimEnd() : s);

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string): string => escapeHtml(s).replace(/"/g, '&quot;');

/** Only web and mail links survive. Anything else (javascript:, file:, data:) becomes plain text. */
const safeHref = (raw: string | null | undefined): string | undefined => {
  if (!raw) return undefined;
  const s = raw.replace(CONTROL, '').trim();
  if (!/^(https?:\/\/|mailto:)/i.test(s) || s.length > 2000) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:' ? s.replace(/\s/g, '%20') : undefined;
  } catch {
    return undefined;
  }
};

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'up']);

/** A title typed in capitals (this app's text export does that) reads better in title case. */
const tidyTitle = (raw: string): string => {
  let t = clip(collapse(raw), MAX_TITLE);
  if (/\p{Lu}/u.test(t) && !/\p{Ll}/u.test(t) && t.replace(/[^\p{L}]/gu, '').length > 3) {
    const words = t.toLowerCase().split(' ');
    t = words
      .map((w, i) => (i > 0 && i < words.length - 1 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ');
  }
  return t;
};

const fileTitleOf = (name: string | undefined): string => {
  if (!name) return '';
  const base = name.split(/[\\/]/).pop() || '';
  return collapse(base.replace(/\.[A-Za-z0-9]{1,8}$/, ''));
};

// ---------------------------------------------------------------- inline pieces to HTML

const F_B = 1;
const F_I = 2;
const F_U = 4;
const F_S = 8;
const F_M = 16;

interface Piece {
  s: string;
  f: number;
  h?: string;
}
const BR: Piece = { s: '', f: -1 };

const MARKS: { flag: number; key: string; open: string; close: string }[] = [
  { flag: F_B, key: 'b', open: '<strong>', close: '</strong>' },
  { flag: F_I, key: 'i', open: '<em>', close: '</em>' },
  { flag: F_U, key: 'u', open: '<u>', close: '</u>' },
  { flag: F_S, key: 's', open: '<s>', close: '</s>' },
  { flag: F_M, key: 'm', open: '<mark>', close: '</mark>' },
];
const LINK_KEY = 'a\u0000';

const markKeys = (f: number, href?: string): string[] => {
  const keys: string[] = [];
  if (href) keys.push(LINK_KEY + href);
  for (const m of MARKS) if (f & m.flag) keys.push(m.key);
  return keys;
};

const openTag = (key: string): string => (key.startsWith(LINK_KEY) ? `<a href="${escapeAttr(key.slice(LINK_KEY.length))}">` : MARKS.find((m) => m.key === key)!.open);
const closeTag = (key: string): string => (key.startsWith(LINK_KEY) ? '</a>' : MARKS.find((m) => m.key === key)!.close);

/**
 * Turns runs of text into the HTML for one paragraph. Whitespace is collapsed (a Word tab or a double space is just a
 * space here), the ends are trimmed, and neighbouring runs with the same formatting are written as one tag.
 * `drop` removes formatting flags; `flat` turns line breaks into spaces (for headings).
 */
const renderInline = (pieces: Piece[], drop = 0, flat = false): { html: string; text: string } => {
  const norm: Piece[] = [];
  let lead = true;
  let sp = true;
  for (const p of pieces) {
    if (p === BR) {
      if (flat) {
        if (!sp) {
          norm.push({ s: ' ', f: 0 });
          sp = true;
        }
        continue;
      }
      if (lead) continue;
      const last = norm[norm.length - 1];
      if (last && last !== BR && last.s.endsWith(' ')) last.s = last.s.slice(0, -1);
      norm.push(BR);
      sp = true;
      continue;
    }
    let s = p.s.replace(WS_RUN, ' ');
    if (sp && s.startsWith(' ')) s = s.slice(1);
    if (!s) continue;
    norm.push({ s, f: p.f & ~drop, h: p.h });
    sp = s.endsWith(' ');
    lead = false;
  }
  for (;;) {
    const last = norm[norm.length - 1];
    if (!last) break;
    if (last === BR) {
      norm.pop();
      continue;
    }
    if (last.s.endsWith(' ')) {
      last.s = last.s.slice(0, -1);
      if (!last.s) {
        norm.pop();
        continue;
      }
    }
    break;
  }
  // Tags nest instead of repeating: bold text with an italic word inside is one <strong> around an <em>
  const html: string[] = [];
  const text: string[] = [];
  const open: string[] = [];
  for (const p of norm) {
    if (p === BR) {
      html.push('<br>');
      text.push(' ');
      continue;
    }
    const want = markKeys(p.f, p.h);
    let keep = 0;
    while (keep < open.length && want.includes(open[keep])) keep++;
    while (open.length > keep) html.push(closeTag(open.pop()!));
    for (const key of want) {
      if (!open.includes(key)) {
        open.push(key);
        html.push(openTag(key));
      }
    }
    html.push(escapeHtml(p.s));
    text.push(p.s);
  }
  while (open.length) html.push(closeTag(open.pop()!));
  return { html: html.join(''), text: text.join('').trim() };
};

// ---------------------------------------------------------------- chapter lines and scene breaks

const ONES = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen';
const TENS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
const WORDNUM = `(?:(?:${TENS})(?:[\\s-]+(?:${ONES}))?|${ONES}|zero|hundred)`;
const WORDNUM_RE = new RegExp(`^${WORDNUM}$`, 'i');
// Roman numerals are only believed in capitals ("Chapter did" is not a chapter)
const ROMAN_RE = /^(?=[IVXLCDM])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/;
const SEP = '[:.\\u2013\\u2014-]';
const CHAPTER_RE = new RegExp(
  `^(chapter|part|book)\\s+(\\d{1,4}|${WORDNUM}|[ivxlcdm]{1,7})(?![\\p{L}\\p{N}])\\s*(?:${SEP}+\\s*(.*))?$`,
  'iu'
);
const NAMED_RE = new RegExp(
  `^(?:prologue|epilogue|interlude|foreword|preface|afterword|introduction|acknowledg(?:e)?ments)(?![\\p{L}\\p{N}])\\s*(?:${SEP}+\\s*.*)?$`,
  'iu'
);
const BARE_RE = /^(\d{1,4}|[IVXLCDM]{1,7})\.?$/;

const numberToken = (tok: string): boolean => /^\d+$/.test(tok) || WORDNUM_RE.test(tok) || ROMAN_RE.test(tok);
const bareNumber = (t: string, needDot: boolean): boolean => {
  const m = BARE_RE.exec(t);
  if (!m) return false;
  if (needDot && !t.endsWith('.')) return false;
  const tok = m[1];
  if (/^\d+$/.test(tok)) return true;
  // A single capital such as "C." or "D." is far more likely an initial than a numeral
  return ROMAN_RE.test(tok) && (tok.length > 1 || 'IVX'.includes(tok));
};

/** If a line reads like the start of a chapter, its title (which may be empty); otherwise null. */
const chapterLine = (text: string, solo: boolean): { title: string } | null => {
  const t = collapse(text);
  if (!t || t.length > 120) return null;
  const m = CHAPTER_RE.exec(t);
  if (m) {
    if (!numberToken(m[2])) return null;
    return { title: m[1].toLowerCase() === 'chapter' ? clip((m[3] ?? '').trim(), MAX_TITLE) : clip(t, MAX_TITLE) };
  }
  if (NAMED_RE.test(t)) return { title: clip(t, MAX_TITLE) };
  if (solo && t.length <= 80 && bareNumber(t, true)) return { title: '' };
  return null;
};

/** "Chapter 3: The Wind" becomes "The Wind", because the app numbers chapters itself. */
const cleanChapterTitle = (raw: string): string => {
  const t = collapse(raw);
  const m = CHAPTER_RE.exec(t);
  let out = t;
  if (m && m[1].toLowerCase() === 'chapter' && numberToken(m[2])) out = (m[3] ?? '').trim();
  else if (bareNumber(t, false)) out = '';
  return clip(out, MAX_TITLE);
};

/** A line of nothing but * - _ # ~ marks. `loose` also accepts a lone "*", "#" or "~" (a Word paragraph). */
const isSceneBreakText = (text: string, loose: boolean): boolean => {
  const s = text.replace(/\s+/g, '');
  if (!s || s.length > 40 || !/^[*#~\-_•·∗⁂◆◇❖✦✧❋✱]+$/.test(s)) return false;
  return s.length >= 3 || (loose && /^[*#~]+$/.test(s));
};

const HR: RuleBlock = { t: 'hr' };

const textOf = (b: Block): string => (b.t === 'h' || b.t === 'p' ? b.text : '');

const isBoundaryLine = (b: Block): boolean =>
  (b.t === 'h' || (b.t === 'p' && !b.quote)) && chapterLine(b.text, b.t === 'h' || !!b.solo) !== null;

// ---------------------------------------------------------------- blocks to HTML

const renderItems = (items: ItemBlock[]): string => {
  const out: string[] = [];
  const stack: string[] = [];
  for (const it of items) {
    const d = Math.min(it.depth, stack.length);
    while (stack.length > d + 1) {
      out.push(`</li></${stack.pop()}>`);
    }
    if (stack.length === d + 1) {
      out.push('</li>');
    } else {
      const tag = it.ordered ? 'ol' : 'ul';
      stack.push(tag);
      out.push(`<${tag}>`);
    }
    out.push(`<li><p>${it.html}</p>`);
  }
  while (stack.length) out.push(`</li></${stack.pop()}>`);
  return out.join('');
};

/** Consecutive list items become one list; each separate list stays separate. */
const renderLists = (items: ItemBlock[]): string => {
  const out: string[] = [];
  let run: ItemBlock[] = [];
  for (const it of items) {
    const head = run[0];
    if (head && it.depth === 0 && (it.ordered !== head.ordered || it.list !== head.list)) {
      out.push(renderItems(run));
      run = [];
    }
    run.push(it);
  }
  if (run.length) out.push(renderItems(run));
  return out.join('');
};

const paraHtml = (b: ParaBlock): string => `<p${b.align ? ` style="text-align: ${b.align}"` : ''}>${b.html}</p>`;

/** `base` is the heading level that started the chapter, so headings inside it step down from h1. */
const blocksToHtml = (blocks: Block[], base: number): string => {
  const out: string[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.t === 'li') {
      let j = i;
      while (j < blocks.length && blocks[j].t === 'li') j++;
      out.push(renderLists(blocks.slice(i, j) as ItemBlock[]));
      i = j;
    } else if (b.t === 'p' && b.quote) {
      let j = i;
      const inner: string[] = [];
      while (j < blocks.length) {
        const q = blocks[j];
        if (q.t !== 'p' || !q.quote) break;
        inner.push(paraHtml(q));
        j++;
      }
      out.push(`<blockquote>${inner.join('')}</blockquote>`);
      i = j;
    } else {
      if (b.t === 'p') out.push(paraHtml(b));
      else if (b.t === 'h') {
        const n = Math.min(3, Math.max(1, b.level - base));
        out.push(`<h${n}>${b.html}</h${n}>`);
      } else out.push('<hr>');
      i++;
    }
  }
  return out.join('');
};

/** Drops scene breaks at the start and end of a chapter, and doubled ones. */
const tidyBreaks = (blocks: Block[]): Block[] => {
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.t === 'hr' && (out.length === 0 || out[out.length - 1].t === 'hr')) continue;
    out.push(b);
  }
  while (out.length && out[out.length - 1].t === 'hr') out.pop();
  return out;
};

// ---------------------------------------------------------------- from blocks to a source, and to chapters

interface SourceInit {
  format: 'docx' | 'txt' | 'md';
  blocks: Block[];
  warnings: string[];
  title?: string;
  author?: string;
  coreTitle?: string;
  coreAuthor?: string;
  fileName?: string;
}

const countSplits = (blocks: Block[], chapterLevel: number) => {
  let headings = 0;
  let chapterLines = 0;
  let sceneBreaks = 0;
  for (const b of blocks) {
    if (b.t === 'h' && b.level === chapterLevel) headings++;
    if (b.t === 'hr') sceneBreaks++;
    else if (isBoundaryLine(b)) chapterLines++;
  }
  return { headings, chapterLines, sceneBreaks };
};

/** A file with one top heading and several second-level ones has the book's title on top. */
const takeLoneTitle = (blocks: Block[]): { blocks: Block[]; title: string } | null => {
  const first = blocks.findIndex((b) => b.t !== 'hr');
  const head = blocks[first];
  if (!head || head.t !== 'h' || head.level !== 1) return null;
  let tops = 0;
  let seconds = 0;
  for (const b of blocks) {
    if (b.t !== 'h') continue;
    if (b.level === 1) tops++;
    else if (b.level === 2) seconds++;
  }
  if (tops !== 1 || seconds < 2) return null;
  return { blocks: blocks.filter((_, i) => i !== first), title: tidyTitle(head.text) };
};

const makeSource = (init: SourceInit): ManuscriptSource => {
  let blocks = init.blocks;
  let title = init.title ? tidyTitle(init.title) : '';
  if (!title) {
    const lone = takeLoneTitle(blocks);
    if (lone) {
      blocks = lone.blocks;
      title = lone.title;
    }
  }
  const author = init.author ? clip(collapse(init.author), MAX_TITLE) : '';
  const fileTitle = fileTitleOf(init.fileName);
  let level = 9;
  for (const b of blocks) if (b.t === 'h' && b.level < level) level = b.level;
  if (level === 9 && !blocks.some((b) => b.t === 'h')) level = 1;
  return {
    format: init.format,
    title: title || (init.coreTitle ? tidyTitle(init.coreTitle) : '') || fileTitle,
    author: author || (init.coreAuthor ? clip(collapse(init.coreAuthor), MAX_TITLE) : ''),
    titleFound: !!title,
    authorFound: !!author,
    fileTitle,
    blocks,
    warnings: init.warnings,
    chapterLevel: level,
    counts: countSplits(blocks, level),
  };
};

/** Which strategy "Automatic" would pick, and how many chapters each strategy would find. */
export const describeSplits = (source: ManuscriptSource): { auto: Exclude<SplitMode, 'auto'>; headings: number; chapterLines: number; sceneBreaks: number } => {
  const { headings, chapterLines, sceneBreaks } = source.counts;
  const auto = headings >= 2 ? 'headings' : chapterLines >= 2 ? 'chapter-lines' : 'none';
  return { auto, headings, chapterLines, sceneBreaks };
};

/** A title and "by Name" before the first chapter are the title page, not a chapter of their own. */
const takeTitlePage = (pre: Block[], allowLone: boolean): { title: string; author: string } | null => {
  const paras: ParaBlock[] = [];
  for (const b of pre) {
    if (b.t === 'hr') continue;
    if (b.t !== 'p' || b.quote) return null;
    paras.push(b);
    if (paras.length > 2) return null;
  }
  if (!paras.length) return null;
  const first = collapse(paras[0].text);
  if (!first || first.length > 100) return null;
  if (paras.length === 2) {
    const by = /^by\s+(.{1,100})$/i.exec(collapse(paras[1].text));
    return by ? { title: tidyTitle(first), author: collapse(by[1]) } : null;
  }
  // A single line is only believed when it is in capitals, the way this app's own text export writes it
  if (!allowLone || first.length > 80 || /\p{Ll}/u.test(first) || /[.!?,;:]$/.test(first)) return null;
  return { title: tidyTitle(first), author: '' };
};

type Strategy = Exclude<SplitMode, 'auto'>;

interface Group {
  head: Block | null;
  title: string;
  body: Block[];
}

const MODE_NOTES: Record<'headings' | 'chapter-lines' | 'scene-breaks', string> = {
  headings: 'No headings were found, so the whole file is one chapter.',
  'chapter-lines': 'No lines such as “Chapter 1” were found, so the whole file is one chapter.',
  'scene-breaks': 'No scene breaks were found, so the whole file is one chapter.',
};

/** Cuts a read file into chapters. Cheap enough to run on every change of the "Split by" choice. */
export function splitManuscript(source: ManuscriptSource, mode: SplitMode = 'auto'): ImportedManuscript {
  const warnings = [...source.warnings];
  let use: Strategy = mode === 'auto' ? describeSplits(source).auto : mode;
  const found = { headings: source.counts.headings, 'chapter-lines': source.counts.chapterLines, 'scene-breaks': source.counts.sceneBreaks };
  if (use !== 'none' && found[use] === 0) {
    if (mode !== 'auto') warnings.push(MODE_NOTES[use]);
    use = 'none';
  }

  const level = source.chapterLevel;
  const groups: Group[] = [];
  if (use === 'none') {
    groups.push({ head: null, title: source.fileTitle || source.title, body: source.blocks });
  } else if (use === 'scene-breaks') {
    let cur: Group = { head: null, title: '', body: [] };
    for (const b of source.blocks) {
      if (b.t === 'hr') {
        groups.push(cur);
        cur = { head: null, title: '', body: [] };
      } else cur.body.push(b);
    }
    groups.push(cur);
  } else {
    const isBoundary = use === 'headings' ? (b: Block) => b.t === 'h' && b.level === level : isBoundaryLine;
    let cur: Group = { head: null, title: 'Opening', body: [] };
    for (const b of source.blocks) {
      if (isBoundary(b)) {
        groups.push(cur);
        cur = { head: b, title: cleanChapterTitle(textOf(b)), body: [] };
      } else cur.body.push(b);
    }
    groups.push(cur);
  }

  let title = source.title;
  let author = source.author;
  const pre = groups[0];
  if (use !== 'none' && use !== 'scene-breaks' && !pre.head && pre.body.length && !source.titleFound) {
    const page = takeTitlePage(pre.body, source.format === 'txt');
    if (page) {
      title = page.title;
      if (!source.authorFound && page.author) author = page.author;
      pre.body = [];
    }
  }

  const base = use === 'headings' ? level : 0;
  const chapters: ImportedChapter[] = [];
  const empty: string[] = [];
  for (const g of groups) {
    const html = blocksToHtml(tidyBreaks(g.body), base);
    const words = countWords(html);
    if (words === 0) {
      if (g.head) empty.push(clip(collapse(textOf(g.head)), 60));
      continue;
    }
    chapters.push({ title: g.title, html, words });
  }
  if (chapters.length === 1 && use === 'scene-breaks') chapters[0].title = source.fileTitle || source.title;

  if (empty.length > 3) warnings.push(`${empty.length} headings with no text under them were left out.`);
  else for (const h of empty) warnings.push(`“${h}” had no text under it, so it was left out.`);

  return { title, author, chapters, warnings, format: source.format };
}

// ---------------------------------------------------------------- shared warnings

interface Tally {
  images: number;
  tables: number;
  notes: boolean;
  toc: boolean;
}
const newTally = (): Tally => ({ images: 0, tables: 0, notes: false, toc: false });

const tallyWarnings = (t: Tally): string[] => {
  const w: string[] = [];
  if (t.images) w.push(tp(t.images, '{n} image was skipped', '{n} images were skipped'));
  if (t.notes) w.push(tr('Footnotes and endnotes were left out'));
  if (t.tables) w.push(tp(t.tables, '{n} table was turned into plain paragraphs', '{n} tables were turned into plain paragraphs'));
  if (t.toc) w.push(tr('The table of contents was left out'));
  return w;
};

const makePara = (r: { html: string; text: string }, extra: Partial<ParaBlock> = {}): ParaBlock => ({
  t: 'p',
  html: r.html,
  text: r.text.length <= 200 ? r.text : '',
  ...extra,
});

const makeHeading = (level: number, r: { html: string; text: string }): HeadingBlock => ({
  t: 'h',
  level,
  html: r.html,
  text: clip(r.text, 400),
});

// ---------------------------------------------------------------- plain text

const prepText = (text: string): string =>
  text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\f/g, '\n').replace(CONTROL, '');

const ATX_RE = /^(#{1,6})(?=[ \t]|$)(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const endsSentence = (line: string): boolean => /[.!?…]["'”’)\]]*$/.test(line);

/** Short lines that never end a sentence read as verse. */
const looksLikeVerse = (lines: string[]): boolean => lines.length > 1 && lines.every((l) => l.length <= 60 && !endsSentence(l));

/**
 * Lines of one block that read like "Chapter 4" or "Prologue" start a chapter of their own, even with no blank line
 * after them. In the middle of a block, only a bare one counts, so a wrapped line of prose is not mistaken for one.
 */
const splitAtChapterLines = (lines: string[]): string[][] => {
  const groups: string[][] = [];
  let cur: string[] = [];
  lines.forEach((line, i) => {
    const hit = chapterLine(line, false);
    if (hit && (i === 0 || hit.title === '')) {
      if (cur.length) groups.push(cur);
      groups.push([line]);
      cur = [];
    } else cur.push(line);
  });
  if (cur.length) groups.push(cur);
  return groups;
};

const textPara = (lines: string[], solo: boolean): ParaBlock | null => {
  const clean = lines.map((l) => l.trim());
  const pieces: Piece[] = [];
  if (looksLikeVerse(clean)) {
    clean.forEach((l, i) => {
      if (i) pieces.push(BR);
      pieces.push({ s: l, f: 0 });
    });
  } else pieces.push({ s: clean.join(' '), f: 0 });
  const r = renderInline(pieces);
  return r.text ? makePara(r, solo ? { solo: true } : {}) : null;
};

const textHeading = (level: number, text: string): HeadingBlock | null => {
  const r = renderInline([{ s: text, f: 0 }], 0, true);
  return r.text ? makeHeading(level, r) : null;
};

const parseTextBlocks = (text: string): Block[] => {
  const lines = prepText(text).split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const blankSeparated = lines.some((l) => !l.trim());
  const out: Block[] = [];
  const add = (b: Block | null) => {
    if (b) out.push(b);
  };

  // Without any blank line, every line is its own paragraph
  const chunks: string[][] = [];
  if (blankSeparated) {
    let cur: string[] = [];
    for (const l of lines) {
      if (l.trim()) cur.push(l);
      else if (cur.length) {
        chunks.push(cur);
        cur = [];
      }
    }
    if (cur.length) chunks.push(cur);
  } else for (const l of lines) chunks.push([l]);

  chunks.forEach((chunk, index) => {
    const solo = blankSeparated && chunk.length === 1;
    // "TITLE" over "by Name" on two lines is a title page, not a two-line verse
    if (index === 0 && chunk.length === 2 && chunk[0].trim().length <= 100 && /^by\s+\S/i.test(chunk[1].trim()) && !isSceneBreakText(chunk[0].trim(), false)) {
      add(textPara([chunk[0]], true));
      add(textPara([chunk[1]], true));
      return;
    }
    let para: string[] = [];
    const flush = () => {
      if (!para.length) return;
      for (const g of splitAtChapterLines(para)) add(textPara(g, solo && g.length === 1));
      para = [];
    };
    for (const raw of chunk) {
      const line = raw.trim();
      const atx = ATX_RE.exec(line);
      // A single short line over a row of = or - is a heading; after a full sentence the row is a divider
      if (para.length === 1 && /^(={3,}|-{3,})$/.test(line) && para[0].length <= 100 && !endsSentence(para[0])) {
        const head = textHeading(line[0] === '=' ? 1 : 2, para[0]);
        para = [];
        add(head);
      } else if (isSceneBreakText(line, false)) {
        flush();
        out.push(HR);
      } else if (atx) {
        flush();
        if (atx[2]) add(textHeading(atx[1].length, atx[2]));
      } else para.push(line);
    }
    flush();
  });
  return out;
};

export function readTextSource(text: string, opts: ParseOptions = {}): ManuscriptSource {
  return makeSource({ format: 'txt', blocks: parseTextBlocks(text), warnings: [], fileName: opts.fileName });
}

export function parseText(text: string, opts: ParseOptions = {}): ImportedManuscript {
  return splitManuscript(readTextSource(text, opts), opts.split ?? 'auto');
}

/** Decodes a text file: a byte order mark decides, else UTF-8 if it is valid UTF-8, else Windows-1252. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3));
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  // UTF-16 saved without a mark shows as a zero in every other byte of the first few characters
  if (bytes.length >= 4 && bytes[1] === 0 && bytes[3] === 0 && bytes[0] !== 0) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[2] === 0 && bytes[1] !== 0) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

// ---------------------------------------------------------------- Markdown

type INode =
  | { k: 'text'; s: string }
  | { k: 'br' }
  | { k: 'fmt'; f: number; kids: INode[] }
  | { k: 'link'; href?: string; kids: INode[] };

interface Delim {
  k: 'delim';
  ch: string;
  n: number;
  orig: number;
  open: boolean;
  close: boolean;
}
type Tok = Delim | { k: 'node'; node: INode };

const PUNCT = /[\p{P}\p{S}]/u;
const SPACE = /\s/;
const ESCAPABLE = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';

const flushTexts = (toks: Tok[], from: number, to: number): INode[] => {
  const out: INode[] = [];
  for (let i = from; i < to; i++) {
    const t = toks[i];
    if (t.k === 'node') out.push(t.node);
    else if (t.n > 0) out.push({ k: 'text', s: t.ch.repeat(t.n) });
  }
  return out;
};

/** The emphasis pass from CommonMark, trimmed to what a manuscript needs: * _ ** __ ~~ == */
const resolveEmphasis = (toks: Tok[]): INode[] => {
  let ci = 0;
  while (ci < toks.length) {
    const closer = toks[ci];
    if (closer.k !== 'delim' || !closer.close || closer.n === 0) {
      ci++;
      continue;
    }
    let oi = ci - 1;
    let found = -1;
    for (; oi >= 0; oi--) {
      const o = toks[oi];
      if (o.k !== 'delim' || !o.open || o.n === 0 || o.ch !== closer.ch) continue;
      if (closer.ch === '~' || closer.ch === '=') {
        if (o.n >= 2 && closer.n >= 2) {
          found = oi;
          break;
        }
        continue;
      }
      if ((o.close || closer.open) && (o.orig + closer.orig) % 3 === 0 && !(o.orig % 3 === 0 && closer.orig % 3 === 0)) continue;
      found = oi;
      break;
    }
    if (found < 0) {
      ci++;
      continue;
    }
    const opener = toks[found] as Delim;
    const use = closer.ch === '~' || closer.ch === '=' ? 2 : opener.n >= 2 && closer.n >= 2 ? 2 : 1;
    const f = closer.ch === '~' ? F_S : closer.ch === '=' ? F_M : use === 2 ? F_B : F_I;
    const inner: Tok = { k: 'node', node: { k: 'fmt', f, kids: flushTexts(toks, found + 1, ci) } };
    toks.splice(found + 1, ci - found - 1, inner);
    ci = found + 2;
    opener.n -= use;
    closer.n -= use;
    if (opener.n === 0) {
      toks.splice(found, 1);
      ci--;
    }
    if (closer.n === 0) toks.splice(ci, 1);
  }
  return flushTexts(toks, 0, toks.length);
};

/** Finds the ] that closes the [ at `start`, skipping escapes and code. Returns -1 if there is none. */
const matchBracket = (s: string, start: number): number => {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') i++;
    else if (c === '`') {
      let n = 1;
      while (s[i + n] === '`') n++;
      const close = s.indexOf('`'.repeat(n), i + n);
      if (close >= 0) i = close + n - 1;
      else i += n - 1;
    } else if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
};

/** Reads a link destination and optional title starting just after "(". Returns where the ")" is. */
const readDestination = (s: string, start: number): { href: string; end: number } | null => {
  let i = start;
  while (s[i] === ' ' || s[i] === '\n') i++;
  let href: string;
  if (s[i] === '<') {
    const close = s.indexOf('>', i);
    if (close < 0) return null;
    href = s.slice(i + 1, close);
    i = close + 1;
  } else {
    let depth = 0;
    const from = i;
    for (; i < s.length; i++) {
      const c = s[i];
      if (c === '\\') i++;
      else if (c === '(') depth++;
      else if (c === ')') {
        if (depth === 0) break;
        depth--;
      } else if (c === ' ' || c === '\n') break;
    }
    href = s.slice(from, i);
  }
  while (s[i] === ' ' || s[i] === '\n') i++;
  if (s[i] === '"' || s[i] === "'" || s[i] === '(') {
    const closeCh = s[i] === '(' ? ')' : s[i];
    const close = s.indexOf(closeCh, i + 1);
    if (close < 0) return null;
    i = close + 1;
    while (s[i] === ' ' || s[i] === '\n') i++;
  }
  return s[i] === ')' ? { href: href.replace(/\\([!-/:-@[-`{-~])/g, '$1'), end: i } : null;
};

const mdNodes = (s: string, t: Tally, depth = 0): INode[] => {
  if (s.length > 200000 || depth > 6) return [{ k: 'text', s }];
  const toks: Tok[] = [];
  let buf = '';
  const text = () => {
    if (buf) toks.push({ k: 'node', node: { k: 'text', s: buf } });
    buf = '';
  };
  const atom = (node: INode) => {
    text();
    toks.push({ k: 'node', node });
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length && ESCAPABLE.includes(s[i + 1])) {
      buf += s[i + 1];
      i += 2;
    } else if (c === '\u0001') {
      atom({ k: 'br' });
      i++;
    } else if (c === '`') {
      let n = 1;
      while (s[i + n] === '`') n++;
      const close = s.indexOf('`'.repeat(n), i + n);
      if (close >= 0 && s[close + n] !== '`') {
        let code = s.slice(i + n, close).replace(/\n/g, ' ');
        if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ')) code = code.slice(1, -1);
        atom({ k: 'text', s: code });
        i = close + n;
      } else {
        buf += s.slice(i, i + n);
        i += n;
      }
    } else if (c === '!' && s[i + 1] === '[') {
      const end = matchBracket(s, i + 1);
      const dest = end >= 0 && s[end + 1] === '(' ? readDestination(s, end + 2) : null;
      if (dest) {
        t.images++;
        i = dest.end + 1;
      } else {
        buf += c;
        i++;
      }
    } else if (c === '[') {
      const end = matchBracket(s, i);
      const dest = end >= 0 && s[end + 1] === '(' ? readDestination(s, end + 2) : null;
      if (dest) {
        atom({ k: 'link', href: safeHref(dest.href), kids: mdNodes(s.slice(i + 1, end), t, depth + 1) });
        i = dest.end + 1;
      } else {
        buf += c;
        i++;
      }
    } else if (c === '<') {
      const auto = /^<((?:https?:\/\/|mailto:)[^\s<>]*)>/i.exec(s.slice(i, i + 2100));
      if (auto) {
        atom({ k: 'link', href: safeHref(auto[1]), kids: [{ k: 'text', s: auto[1] }] });
        i += auto[0].length;
      } else {
        buf += c;
        i++;
      }
    } else if (c === '*' || c === '_' || c === '~' || c === '=') {
      let n = 1;
      while (s[i + n] === c) n++;
      if ((c === '~' || c === '=') && n < 2) {
        buf += c;
        i++;
        continue;
      }
      const before = i > 0 ? s[i - 1] : ' ';
      const after = i + n < s.length ? s[i + n] : ' ';
      const wsBefore = SPACE.test(before);
      const wsAfter = SPACE.test(after);
      const pBefore = PUNCT.test(before);
      const pAfter = PUNCT.test(after);
      const left = !wsAfter && (!pAfter || wsBefore || pBefore);
      const right = !wsBefore && (!pBefore || wsAfter || pAfter);
      const open = c === '_' ? left && (!right || pBefore) : left;
      const close = c === '_' ? right && (!left || pAfter) : right;
      text();
      toks.push({ k: 'delim', ch: c, n, orig: n, open, close });
      i += n;
    } else {
      buf += c;
      i++;
    }
  }
  text();
  return resolveEmphasis(toks);
};

const flattenNodes = (nodes: INode[], f: number, href: string | undefined, out: Piece[]): void => {
  for (const n of nodes) {
    if (n.k === 'text') out.push({ s: n.s, f, h: href });
    else if (n.k === 'br') out.push(BR);
    else if (n.k === 'fmt') flattenNodes(n.kids, f | n.f, href, out);
    else flattenNodes(n.kids, f, n.href, out);
  }
};

const mdPieces = (s: string, t: Tally): Piece[] => {
  const out: Piece[] = [];
  flattenNodes(mdNodes(s, t), 0, undefined, out);
  return out;
};

/** Lines of one paragraph, with a hard break (two trailing spaces, or a backslash) marked for the inline pass. */
const joinMdLines = (lines: string[]): string => {
  let s = '';
  lines.forEach((raw, i) => {
    let line = raw.replace(/^[ \t]+/, '');
    let hard = / {2,}$/.test(line);
    const slashes = /\\+$/.exec(line);
    if (!hard && slashes && slashes[0].length % 2 === 1) {
      line = line.slice(0, -1);
      hard = true;
    }
    s += line.replace(/[ \t]+$/, '');
    if (i < lines.length - 1) s += hard ? '\u0001' : ' ';
  });
  return s;
};

const LIST_RE = /^([ \t]*)([-+*]|\d{1,3}[.)])[ \t]+(.*)$/;
const TABLE_DELIM = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

const indentWidth = (s: string): number => s.replace(/\t/g, '    ').length;

const mdBlocks = (lines: string[], t: Tally): Block[] => {
  const out: Block[] = [];
  let para: string[] = [];
  let stack: number[] = [];
  let listSeq = 0;
  const inline = (s: string, flat = false) => renderInline(mdPieces(s, t), 0, flat);
  const flush = () => {
    if (!para.length) return;
    for (const g of splitAtChapterLines(para)) {
      const r = inline(joinMdLines(g));
      if (r.text) out.push(makePara(r, g.length === 1 ? { solo: true } : {}));
    }
    para = [];
    stack = [];
  };
  const startsBlock = (line: string): boolean => {
    const tr = line.trim();
    return !tr || /^ {0,3}(`{3,}|~{3,})/.test(line) || isSceneBreakText(tr, false) || ATX_RE.test(tr) || /^ {0,3}>/.test(line) || LIST_RE.test(line);
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const tr = line.trim();
    if (!tr) {
      flush();
      i++;
      continue;
    }

    const fence = /^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/.exec(line);
    if (fence && (fence[1][0] === '`' ? !fence[2].includes('`') : fence[2] !== '')) {
      flush();
      stack = [];
      const closing = new RegExp(`^ {0,3}\\${fence[1][0]}{${fence[1].length},}[ \\t]*$`);
      i++;
      while (i < lines.length && !closing.test(lines[i])) {
        const r = renderInline([{ s: lines[i], f: 0 }]);
        if (r.text) out.push(makePara(r));
        i++;
      }
      i++;
      continue;
    }

    if (para.length === 1 && /^(={2,}|-{3,})[ \t]*$/.test(tr)) {
      const r = inline(joinMdLines(para), true);
      const level = tr[0] === '=' ? 1 : 2;
      para = [];
      stack = [];
      if (r.text) out.push(makeHeading(level, r));
      i++;
      continue;
    }

    if (isSceneBreakText(tr, false)) {
      flush();
      stack = [];
      out.push(HR);
      i++;
      continue;
    }

    const atx = ATX_RE.exec(tr);
    if (atx) {
      flush();
      stack = [];
      if (atx[2]) {
        const r = inline(atx[2], true);
        if (r.text) out.push(makeHeading(atx[1].length, r));
      }
      i++;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      flush();
      stack = [];
      const inner: string[] = [];
      while (i < lines.length && /^ {0,3}>/.test(lines[i])) {
        inner.push(lines[i].replace(/^ {0,3}> ?/, ''));
        i++;
      }
      for (const b of mdBlocks(inner, t)) {
        if (b.t === 'p') out.push({ ...b, quote: true });
        else if (b.t === 'h' || b.t === 'li') out.push({ t: 'p', html: b.html, text: b.t === 'h' ? b.text : '', quote: true });
      }
      continue;
    }

    const item = LIST_RE.exec(line);
    if (item && (para.length === 0 || /^[-+*]$/.test(item[2]) || parseInt(item[2], 10) === 1)) {
      flush();
      const indent = indentWidth(item[1]);
      if (stack.length === 0) listSeq++;
      while (stack.length && indent < stack[stack.length - 1]) stack.pop();
      if (!stack.length || indent > stack[stack.length - 1]) stack.push(indent);
      const body = [item[3]];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() && !startsBlock(lines[j])) {
        body.push(lines[j]);
        j++;
      }
      const r = inline(joinMdLines(body));
      if (r.text) out.push({ t: 'li', depth: stack.length - 1, ordered: /\d/.test(item[2]), list: String(listSeq), html: r.html });
      i = j;
      continue;
    }

    if (para.length === 0 && tr.includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && TABLE_DELIM.test(lines[i + 1].trim())) {
      stack = [];
      t.tables++;
      let j = i;
      while (j < lines.length && lines[j].trim() && lines[j].includes('|')) {
        if (j !== i + 1) {
          const cells = lines[j].trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/);
          for (const cell of cells) {
            const r = inline(cell.replace(/\\\|/g, '|').trim());
            if (r.text) out.push(makePara(r));
          }
        }
        j++;
      }
      i = j;
      continue;
    }

    para.push(line);
    i++;
  }
  flush();
  return out;
};

/** Reads title and author from a YAML block at the very top (--- ... ---), if there is one. */
const takeFrontMatter = (lines: string[]): { title: string; author: string; rest: string[] } => {
  const none = { title: '', author: '', rest: lines };
  if (lines[0]?.trim() !== '---') return none;
  let end = -1;
  for (let k = 1; k < Math.min(lines.length, 80); k++) {
    const l = lines[k].trim();
    if (l === '---' || l === '...') {
      end = k;
      break;
    }
  }
  if (end < 0) return none;
  const inner = lines.slice(1, end);
  const KEY = /^([A-Za-z_][\w -]*):(?:\s+(.*))?$/;
  if (!inner.some((l) => KEY.test(l)) || !inner.every((l) => !l.trim() || KEY.test(l) || /^\s+\S/.test(l) || /^\s*-\s/.test(l) || /^\s*#/.test(l))) return none;
  const unquote = (v: string) => v.trim().replace(/^(["'])(.*)\1$/, '$2').trim();
  let title = '';
  let author = '';
  inner.forEach((l, idx) => {
    const m = KEY.exec(l);
    if (!m) return;
    const key = m[1].trim().toLowerCase();
    let value = m[2] ? unquote(m[2]) : '';
    if (!value && key.startsWith('author')) {
      const next = /^\s*-\s+(.*)$/.exec(inner[idx + 1] ?? '');
      if (next) value = unquote(next[1]);
    }
    if (key === 'title' && !title) title = value;
    else if ((key === 'author' || key === 'authors') && !author) author = value.replace(/^\[|\]$/g, '').split(',')[0].trim();
  });
  return { title, author, rest: lines.slice(end + 1) };
};

export function readMarkdownSource(text: string, opts: ParseOptions = {}): ManuscriptSource {
  const t = newTally();
  const front = takeFrontMatter(prepText(text).split('\n'));
  const blocks = mdBlocks(front.rest, t);
  return makeSource({ format: 'md', blocks, warnings: tallyWarnings(t), title: front.title, author: front.author, fileName: opts.fileName });
}

export function parseMarkdown(text: string, opts: ParseOptions = {}): ImportedManuscript {
  return splitManuscript(readMarkdownSource(text, opts), opts.split ?? 'auto');
}

// ---------------------------------------------------------------- Word (.docx)

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_W_STRICT = 'http://purl.oclc.org/ooxml/wordprocessingml/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_R_STRICT = 'http://purl.oclc.org/ooxml/officeDocument/relationships';
const NS_MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const NS_XML = 'http://www.w3.org/XML/1998/namespace';

/** The XML parts are only ever read through DOM Level 2, so this runs in a browser and under a plain XML parser. */
const parseXml = (xml: string): Document | null => {
  try {
    const Parser = DOMParser as unknown as new (options?: unknown) => DOMParser;
    const doc = new Parser({
      onError: (level: string) => {
        if (level !== 'warning') throw new Error('xml');
      },
    }).parseFromString(xml, 'application/xml');
    if (!doc || !doc.documentElement) return null;
    if (doc.getElementsByTagName('parsererror').length > 0) return null;
    return doc;
  } catch {
    return null;
  }
};

const nameOf = (el: Element): string => {
  const ns = el.namespaceURI;
  if (ns === NS_W || ns === NS_W_STRICT) return el.localName;
  if (ns === NS_MC) return `mc:${el.localName}`;
  return '';
};

const at = (el: Element, ns: string, name: string): string | null => el.getAttributeNS(ns, name) || el.getAttribute(`w:${name}`) || null;
const relId = (el: Element): string | null => el.getAttributeNS(NS_R, 'id') || el.getAttributeNS(NS_R_STRICT, 'id') || el.getAttribute('r:id') || null;

interface Fmt {
  b?: boolean;
  i?: boolean;
  u?: boolean;
  s?: boolean;
  m?: boolean;
}

interface RawStyle {
  name: string;
  basedOn: string | null;
  outline?: number;
  fmt: Fmt;
  numId?: string;
  ilvl?: number;
  jc?: string;
  left?: number;
  right?: number;
}

interface ResolvedStyle {
  headingLevel: number;
  role?: 'title' | 'subtitle' | 'quote' | 'toc';
  fmt: Fmt;
  numId?: string;
  ilvl?: number;
  jc?: string;
  left?: number;
  right?: number;
}

const NO_STYLE: ResolvedStyle = { headingLevel: 0, fmt: {} };

const ROLE_NAMES: Record<string, ResolvedStyle['role']> = {
  title: 'title',
  subtitle: 'subtitle',
  quote: 'quote',
  'intense quote': 'quote',
  'block text': 'quote',
  'block quote': 'quote',
  blockquote: 'quote',
  'table of contents': 'toc',
  'toc heading': 'toc',
};

const roleOf = (name: string): ResolvedStyle['role'] => (/^toc\s*\d*$/.test(name) ? 'toc' : Object.hasOwn(ROLE_NAMES, name) ? ROLE_NAMES[name] : undefined);

const flag = (el: Element, ns: string): boolean => {
  const v = at(el, ns, 'val');
  return v === null || !/^(0|false|off)$/i.test(v);
};

const int = (v: string | null): number | undefined => {
  if (v === null) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
};

const readRPr = (rPr: Element, ns: string): { fmt: Fmt; style: string | null; vanish: boolean } => {
  const fmt: Fmt = {};
  let style: string | null = null;
  let vanish = false;
  for (let c = rPr.firstChild; c; c = c.nextSibling) {
    if (c.nodeType !== 1) continue;
    const el = c as Element;
    switch (nameOf(el)) {
      case 'b':
        fmt.b = flag(el, ns);
        break;
      case 'i':
        fmt.i = flag(el, ns);
        break;
      case 'u':
        fmt.u = (at(el, ns, 'val') ?? 'single') !== 'none';
        break;
      case 'strike':
        fmt.s = flag(el, ns);
        break;
      case 'dstrike':
        if (flag(el, ns)) fmt.s = true;
        break;
      case 'highlight':
        fmt.m = (at(el, ns, 'val') ?? 'yellow') !== 'none';
        break;
      case 'rStyle':
        style = at(el, ns, 'val');
        break;
      case 'vanish':
        vanish = flag(el, ns);
        break;
    }
  }
  return { fmt, style, vanish };
};

interface PInfo {
  style: string | null;
  jc?: string;
  numId?: string;
  ilvl?: number;
  left?: number;
  right?: number;
  hanging?: number;
  outline?: number;
  rule: boolean;
}

const readPPr = (pPr: Element | null, ns: string): PInfo => {
  const info: PInfo = { style: null, rule: false };
  if (!pPr) return info;
  for (let c = pPr.firstChild; c; c = c.nextSibling) {
    if (c.nodeType !== 1) continue;
    const el = c as Element;
    switch (nameOf(el)) {
      case 'pStyle':
        info.style = at(el, ns, 'val');
        break;
      case 'jc':
        info.jc = at(el, ns, 'val') ?? undefined;
        break;
      case 'outlineLvl':
        info.outline = int(at(el, ns, 'val'));
        break;
      case 'numPr':
        for (let n = el.firstChild; n; n = n.nextSibling) {
          if (n.nodeType !== 1) continue;
          const name = nameOf(n as Element);
          if (name === 'numId') info.numId = at(n as Element, ns, 'val') ?? undefined;
          else if (name === 'ilvl') info.ilvl = int(at(n as Element, ns, 'val'));
        }
        break;
      case 'ind':
        info.left = int(at(el, ns, 'left') ?? at(el, ns, 'start'));
        info.right = int(at(el, ns, 'right') ?? at(el, ns, 'end'));
        info.hanging = int(at(el, ns, 'hanging'));
        break;
      case 'pBdr':
        for (let n = el.firstChild; n; n = n.nextSibling) {
          if (n.nodeType !== 1) continue;
          const name = nameOf(n as Element);
          if ((name === 'bottom' || name === 'top') && !/^(nil|none)$/i.test(at(n as Element, ns, 'val') ?? '')) info.rule = true;
        }
        break;
    }
  }
  return info;
};

const readStyles = (root: Element, ns: string): Map<string, RawStyle> => {
  const styles = new Map<string, RawStyle>();
  for (let c = root.firstChild; c; c = c.nextSibling) {
    if (c.nodeType !== 1 || nameOf(c as Element) !== 'style') continue;
    const el = c as Element;
    const id = at(el, ns, 'styleId');
    if (!id) continue;
    const raw: RawStyle = { name: '', basedOn: null, fmt: {} };
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 1) continue;
      const child = n as Element;
      const name = nameOf(child);
      if (name === 'name') raw.name = (at(child, ns, 'val') ?? '').trim().toLowerCase();
      else if (name === 'basedOn') raw.basedOn = at(child, ns, 'val');
      else if (name === 'rPr') raw.fmt = readRPr(child, ns).fmt;
      else if (name === 'pPr') {
        const p = readPPr(child, ns);
        raw.outline = p.outline;
        raw.numId = p.numId;
        raw.ilvl = p.ilvl;
        raw.jc = p.jc;
        raw.left = p.left;
        raw.right = p.right;
      }
    }
    // Word's two built-in character styles for emphasis carry no formatting of their own in some files
    if (raw.name === 'strong' && raw.fmt.b === undefined) raw.fmt.b = true;
    if (raw.name === 'emphasis' && raw.fmt.i === undefined) raw.fmt.i = true;
    styles.set(id, raw);
  }
  return styles;
};

/** Looks a style up through its basedOn chain: names decide what it is, formatting is inherited. */
const makeStyleResolver = (styles: Map<string, RawStyle>) => {
  const cache = new Map<string, ResolvedStyle>();
  return (id: string): ResolvedStyle => {
    const hit = cache.get(id);
    if (hit) return hit;
    const chain: RawStyle[] = [];
    const seen = new Set<string>();
    for (let cur: string | null = id; cur && !seen.has(cur) && chain.length < 20; ) {
      seen.add(cur);
      const raw = styles.get(cur);
      if (!raw) break;
      chain.push(raw);
      cur = raw.basedOn;
    }
    const res: ResolvedStyle = { headingLevel: 0, fmt: {} };
    let decided = false;
    for (const raw of chain) {
      if (!res.role) res.role = roleOf(raw.name);
      if (decided) continue;
      const m = /^heading\s*([1-9])$/.exec(raw.name);
      if (m) {
        res.headingLevel = parseInt(m[1], 10);
        decided = true;
      } else if (raw.outline !== undefined) {
        res.headingLevel = raw.outline < 9 ? raw.outline + 1 : 0;
        decided = true;
      }
    }
    for (let k = chain.length - 1; k >= 0; k--) {
      const raw = chain[k];
      Object.assign(res.fmt, raw.fmt);
      if (raw.numId !== undefined) res.numId = raw.numId;
      if (raw.ilvl !== undefined) res.ilvl = raw.ilvl;
      if (raw.jc !== undefined) res.jc = raw.jc;
      if (raw.left !== undefined) res.left = raw.left;
      if (raw.right !== undefined) res.right = raw.right;
    }
    cache.set(id, res);
    return res;
  };
};

/** Whether a list level is bulleted or numbered, from numbering.xml. */
const readNumbering = (root: Element, ns: string): ((numId: string, ilvl: number) => string) => {
  const abstracts = new Map<string, Map<number, string>>();
  const nums = new Map<string, { abstract: string; over: Map<number, string> }>();
  const levelFormat = (lvl: Element): string => {
    for (let n = lvl.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1 && nameOf(n as Element) === 'numFmt') return at(n as Element, ns, 'val') ?? '';
    }
    return '';
  };
  for (let c = root.firstChild; c; c = c.nextSibling) {
    if (c.nodeType !== 1) continue;
    const el = c as Element;
    const name = nameOf(el);
    if (name === 'abstractNum') {
      const id = at(el, ns, 'abstractNumId');
      if (!id) continue;
      const levels = new Map<number, string>();
      for (let l = el.firstChild; l; l = l.nextSibling) {
        if (l.nodeType === 1 && nameOf(l as Element) === 'lvl') levels.set(int(at(l as Element, ns, 'ilvl')) ?? 0, levelFormat(l as Element));
      }
      abstracts.set(id, levels);
    } else if (name === 'num') {
      const id = at(el, ns, 'numId');
      if (!id) continue;
      const entry = { abstract: '', over: new Map<number, string>() };
      for (let n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType !== 1) continue;
        const child = n as Element;
        const childName = nameOf(child);
        if (childName === 'abstractNumId') entry.abstract = at(child, ns, 'val') ?? '';
        else if (childName === 'lvlOverride') {
          for (let l = child.firstChild; l; l = l.nextSibling) {
            if (l.nodeType === 1 && nameOf(l as Element) === 'lvl') entry.over.set(int(at(child, ns, 'ilvl')) ?? 0, levelFormat(l as Element));
          }
        }
      }
      nums.set(id, entry);
    }
  }
  return (numId, ilvl) => {
    const num = nums.get(numId);
    if (!num) return '';
    return num.over.get(ilvl) ?? abstracts.get(num.abstract)?.get(ilvl) ?? '';
  };
};

const readRels = (root: Element): Map<string, { type: string; target: string; external: boolean }> => {
  const rels = new Map<string, { type: string; target: string; external: boolean }>();
  for (let c = root.firstChild; c; c = c.nextSibling) {
    if (c.nodeType !== 1 || (c as Element).localName !== 'Relationship') continue;
    const el = c as Element;
    const id = el.getAttribute('Id');
    const target = el.getAttribute('Target');
    if (id && target) rels.set(id, { type: el.getAttribute('Type') || '', target, external: (el.getAttribute('TargetMode') || '').toLowerCase() === 'external' });
  }
  return rels;
};

/** Reads one part of the zip as text, counting the bytes that actually come out so a zip bomb is stopped early. */
const readPart = (zip: JSZip, path: string, max: number): Promise<string | null> => {
  const entry = zip.file(path);
  if (!entry || entry.dir) return Promise.resolve(null);
  // The size in the file's own headers is only a hint: a crafted file can understate it, so the bytes are counted too
  const declared = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (typeof declared === 'number' && declared > max) return Promise.reject(new ImportError(MSG_XML_BIG));
  return new Promise((resolve, reject) => {
    let total = 0;
    let settled = false;
    const parts: string[] = [];
    let decoder: TextDecoder | null = null;
    const stream = (entry as unknown as { internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array> }).internalStream('uint8array');
    stream
      .on('data', (chunk) => {
        if (settled) return;
        total += chunk.length;
        if (total > max) {
          settled = true;
          stream.pause();
          reject(new ImportError(MSG_XML_BIG));
          return;
        }
        if (!decoder) decoder = new TextDecoder(chunk[0] === 0xff && chunk[1] === 0xfe ? 'utf-16le' : chunk[0] === 0xfe && chunk[1] === 0xff ? 'utf-16be' : 'utf-8');
        parts.push(decoder.decode(chunk, { stream: true }));
      })
      .on('error', () => {
        if (settled) return;
        settled = true;
        reject(new ImportError(MSG_XML_BAD));
      })
      .on('end', () => {
        if (settled) return;
        settled = true;
        if (decoder) parts.push(decoder.decode());
        resolve(parts.join(''));
      })
      .resume();
  });
};

const resolvePath = (base: string, target: string): string => {
  if (target.startsWith('/')) return target.slice(1);
  const dir = base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '';
  const parts = (dir + target).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
};

const yieldToUi = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const HYPERLINK_FIELD = /^\s*HYPERLINK\s+(?:\\[a-z]\s+)*"([^"]+)"/i;

interface DocxEnv {
  ns: string;
  resolveStyle: (id: string) => ResolvedStyle;
  listFormat: (numId: string, ilvl: number) => string;
  links: Map<string, string>;
}

/** Walks word/document.xml once and returns its content as blocks. */
const walkDocx = (body: Element, env: DocxEnv, tally: Tally): Block[] => {
  const { ns } = env;
  const blocks: Block[] = [];
  let cur: Piece[] = [];
  let pictRule = false;
  // Complex fields (begin / separate / end): text between begin and separate is the field's code, not content
  const fields: { code: boolean; instr: string; href?: string }[] = [];
  let hiddenDepth = 0;

  const chooseAlt = (el: Element): Element | null => {
    let choice: Element | null = null;
    let fallback: Element | null = null;
    for (let c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const name = nameOf(c as Element);
      if (name === 'mc:Choice' && !choice) choice = c as Element;
      else if (name === 'mc:Fallback') fallback = c as Element;
    }
    return choice || fallback;
  };

  const fieldHref = (outer: string | undefined): string | undefined => {
    for (let i = fields.length - 1; i >= 0; i--) {
      if (!fields[i].code && fields[i].href) return fields[i].href;
    }
    return outer;
  };

  const hasHorizontalRule = (el: Element): boolean => {
    for (let c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const child = c as Element;
      if (child.localName === 'rect' && (child.getAttribute('o:hr') === 't' || child.getAttribute('hr') === 't')) return true;
      if (hasHorizontalRule(child)) return true;
    }
    return false;
  };

  const textOfT = (el: Element): string => {
    const raw = el.textContent || '';
    const preserve = el.getAttributeNS(NS_XML, 'space') || el.getAttribute('xml:space');
    return (preserve === 'preserve' ? raw : raw.trim()).replace(CONTROL, '').replace(/\u00AD/g, '');
  };

  const run = (r: Element, outer: string | undefined) => {
    let f = 0;
    let vanish = false;
    const content = (el: Element) => {
      switch (nameOf(el)) {
        case 'rPr': {
          const info = readRPr(el, ns);
          const base = info.style ? env.resolveStyle(info.style).fmt : {};
          const b = info.fmt.b ?? base.b;
          const i = info.fmt.i ?? base.i;
          const u = info.fmt.u ?? base.u;
          const s = info.fmt.s ?? base.s;
          const m = info.fmt.m ?? base.m;
          f = (b ? F_B : 0) | (i ? F_I : 0) | (u ? F_U : 0) | (s ? F_S : 0) | (m ? F_M : 0);
          vanish = info.vanish;
          break;
        }
        case 't':
          if (!hiddenDepth && !vanish) cur.push({ s: textOfT(el), f, h: fieldHref(outer) });
          break;
        case 'instrText': {
          const top = fields[fields.length - 1];
          if (top && top.code) top.instr += el.textContent || '';
          break;
        }
        case 'fldChar': {
          const type = at(el, ns, 'fldCharType');
          if (type === 'begin') {
            fields.push({ code: true, instr: '' });
            hiddenDepth++;
          } else if (type === 'separate') {
            const top = fields[fields.length - 1];
            if (top && top.code) {
              top.code = false;
              hiddenDepth--;
              const m = HYPERLINK_FIELD.exec(top.instr);
              if (m) top.href = safeHref(m[1]);
            }
          } else if (type === 'end') {
            const top = fields.pop();
            if (top && top.code) hiddenDepth--;
          }
          break;
        }
        case 'tab':
        case 'ptab':
          if (!hiddenDepth && !vanish) cur.push({ s: '\t', f });
          break;
        case 'br': {
          const type = at(el, ns, 'type');
          if ((type === 'page' || type === 'column') || hiddenDepth || vanish) break;
          cur.push(BR);
          break;
        }
        case 'cr':
          if (!hiddenDepth && !vanish) cur.push(BR);
          break;
        case 'noBreakHyphen':
          if (!hiddenDepth && !vanish) cur.push({ s: '-', f });
          break;
        case 'drawing':
        case 'object':
          if (!hiddenDepth && !vanish) tally.images++;
          break;
        case 'pict':
          if (!hiddenDepth && !vanish) {
            if (hasHorizontalRule(el)) pictRule = true;
            else tally.images++;
          }
          break;
        case 'footnoteReference':
        case 'endnoteReference':
          tally.notes = true;
          break;
        case 'mc:AlternateContent': {
          const pick = chooseAlt(el);
          if (pick) {
            for (let c = pick.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) content(c as Element);
          }
          break;
        }
      }
    };
    for (let c = r.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) content(c as Element);
  };

  const inline = (parent: Element, href: string | undefined) => {
    for (let c = parent.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const el = c as Element;
      switch (nameOf(el)) {
        case 'r':
          run(el, href);
          break;
        case 'hyperlink': {
          const id = relId(el);
          const target = id ? env.links.get(id) : undefined;
          inline(el, safeHref(target));
          break;
        }
        case 'fldSimple': {
          const m = HYPERLINK_FIELD.exec(at(el, ns, 'instr') ?? '');
          inline(el, (m ? safeHref(m[1]) : undefined) ?? href);
          break;
        }
        case 'ins':
        case 'moveTo':
        case 'smartTag':
        case 'customXml':
        case 'sdtContent':
        case 'dir':
        case 'bdo':
          inline(el, href);
          break;
        case 'sdt':
          for (let n = el.firstChild; n; n = n.nextSibling) {
            if (n.nodeType === 1 && nameOf(n as Element) === 'sdtContent') inline(n as Element, href);
          }
          break;
        case 'mc:AlternateContent': {
          const pick = chooseAlt(el);
          if (pick) inline(pick, href);
          break;
        }
      }
    }
  };

  const consumePrefix = (pieces: Piece[], n: number) => {
    let left = n;
    while (left > 0 && pieces.length) {
      const p = pieces[0];
      if (p === BR) break;
      if (p.s.length <= left) {
        left -= p.s.length;
        pieces.shift();
      } else {
        pieces[0] = { s: p.s.slice(left), f: p.f, h: p.h };
        left = 0;
      }
    }
  };

  const alignOf = (jc: string | undefined, direct: boolean): Align | undefined => {
    if (jc === 'center') return 'center';
    if (jc === 'right' || jc === 'end') return 'right';
    if (direct && (jc === 'both' || jc === 'distribute')) return 'justify';
    return undefined;
  };

  const lastIsRule = () => blocks.length > 0 && blocks[blocks.length - 1].t === 'hr';

  const paragraph = (p: Element) => {
    let pPr: Element | null = null;
    for (let c = p.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && nameOf(c as Element) === 'pPr') {
        pPr = c as Element;
        break;
      }
    }
    const info = readPPr(pPr, ns);
    const style = info.style ? env.resolveStyle(info.style) : NO_STYLE;
    cur = [];
    pictRule = false;
    inline(p, undefined);
    // A field whose code never reached its result is damaged; dropping it keeps the rest of the book readable
    for (let i = fields.length - 1; i >= 0; i--) if (fields[i].code) fields.splice(i, 1);
    hiddenDepth = 0;
    const pieces = cur;
    cur = [];

    const level = info.outline !== undefined ? (info.outline < 9 ? info.outline + 1 : 0) : style.headingLevel;

    if (style.role === 'toc') {
      if (pieces.some((x) => x !== BR && x.s.trim())) tally.toc = true;
      return;
    }

    // This app's own export writes list items as plain paragraphs: a bullet or "1." then a tab, with a hanging indent
    let fake: { ordered: boolean } | null = null;
    if (!level && !style.role) {
      let head = '';
      for (const x of pieces) {
        if (x === BR) break;
        head += x.s;
        if (head.length >= 12) break;
      }
      const m = /^[ \t]*(?:([•·▪◦‣⁃●○■])|(\d{1,3}[.)]))\t/.exec(head);
      if (m && (m[1] || (info.hanging ?? 0) > 0)) {
        fake = { ordered: !!m[2] };
        consumePrefix(pieces, m[0].length);
      }
    }

    const r = level ? renderInline(pieces, F_B, true) : renderInline(pieces);
    if (!r.text) {
      if ((pictRule || info.rule) && !lastIsRule() && blocks.length) blocks.push(HR);
      return;
    }
    if (level) {
      blocks.push(makeHeading(level, r));
      return;
    }
    if (style.role === 'title' || style.role === 'subtitle') {
      blocks.push(makePara(r, { role: style.role, solo: true }));
      return;
    }
    if (isSceneBreakText(r.text, true)) {
      if (!lastIsRule()) blocks.push(HR);
      return;
    }
    const numId = info.numId ?? style.numId;
    if (numId && numId !== '0') {
      const ilvl = Math.min(8, Math.max(0, info.ilvl ?? style.ilvl ?? 0));
      const kind = env.listFormat(numId, ilvl);
      blocks.push({ t: 'li', depth: ilvl, ordered: kind !== '' && kind !== 'bullet', list: numId, html: r.html });
      return;
    }
    if (fake) {
      const left = info.left ?? style.left ?? 720;
      blocks.push({ t: 'li', depth: Math.min(3, Math.max(0, Math.round((left - 720) / 360))), ordered: fake.ordered, list: fake.ordered ? 'typed-n' : 'typed-b', html: r.html });
      return;
    }
    const left = info.left ?? style.left ?? 0;
    const right = info.right ?? style.right ?? 0;
    const quote = style.role === 'quote' || (left >= 720 && right >= 720);
    blocks.push(makePara(r, { align: alignOf(info.jc, true) ?? alignOf(style.jc, false), quote: quote || undefined, solo: true }));
  };

  const walk = (parent: Element) => {
    for (let c = parent.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const el = c as Element;
      switch (nameOf(el)) {
        case 'p':
          paragraph(el);
          break;
        case 'tbl':
          tally.tables++;
          walkTable(el);
          break;
        case 'sdt': {
          let toc = false;
          let content: Element | null = null;
          for (let n = el.firstChild; n; n = n.nextSibling) {
            if (n.nodeType !== 1) continue;
            const name = nameOf(n as Element);
            if (name === 'sdtContent') content = n as Element;
            else if (name === 'sdtPr') toc = galleryOf(n as Element).some((g) => /table of contents/i.test(g));
          }
          if (toc) tally.toc = true;
          else if (content) walk(content);
          break;
        }
        case 'sdtContent':
        case 'customXml':
        case 'smartTag':
        case 'ins':
        case 'moveTo':
        case 'dir':
        case 'bdo':
          walk(el);
          break;
        case 'mc:AlternateContent': {
          const pick = chooseAlt(el);
          if (pick) walk(pick);
          break;
        }
      }
    }
  };

  const galleryOf = (sdtPr: Element): string[] => {
    const found: string[] = [];
    for (let n = sdtPr.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 1 || nameOf(n as Element) !== 'docPartObj') continue;
      for (let g = n.firstChild; g; g = g.nextSibling) {
        if (g.nodeType === 1 && nameOf(g as Element) === 'docPartGallery') found.push(at(g as Element, ns, 'val') ?? '');
      }
    }
    return found;
  };

  const walkTable = (parent: Element) => {
    for (let c = parent.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const el = c as Element;
      switch (nameOf(el)) {
        case 'tr':
        case 'sdt':
        case 'sdtContent':
        case 'customXml':
          walkTable(el);
          break;
        case 'tc':
          walk(el);
          break;
      }
    }
  };

  walk(body);
  return blocks;
};

/** Title and Subtitle paragraphs before the first heading are the title page. */
const takeTitleStyles = (blocks: Block[]): { blocks: Block[]; title: string; author: string } => {
  let title = '';
  let author = '';
  let past = false;
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.t === 'h') past = true;
    if (b.t === 'p' && b.role) {
      if (!past) {
        if (b.role === 'title') title = title || b.text;
        else {
          const m = /^by\s+(.+)$/i.exec(b.text);
          if (m && !author) author = m[1];
        }
        continue;
      }
      out.push({ ...b, role: undefined });
      continue;
    }
    out.push(b);
  }
  return { blocks: out, title, author };
};

const PLACEHOLDER_TITLE = /^(untitled|document\s*\d*|new document|microsoft word.*)$/i;
const PLACEHOLDER_AUTHOR = /^(user|admin|administrator|owner|author|unknown|pc|windows user|microsoft office user|office user|word)$/i;

const textOfFirst = (root: Element, local: string): string => {
  for (let c = root.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 1 && (c as Element).localName === local) return collapse((c as Element).textContent || '');
  }
  return '';
};

async function readDocx(input: ArrayBuffer | Uint8Array, opts: ParseOptions): Promise<ManuscriptSource> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw new ImportError(MSG_TOO_BIG);
  if (bytes.byteLength < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new ImportError(MSG_NOT_DOCX);

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new ImportError(MSG_NOT_DOCX);
  }

  // The main part is named by the package, usually word/document.xml
  let mainPath = 'word/document.xml';
  const pkgRels = await readPart(zip, '_rels/.rels', 4 * 1024 * 1024).catch(() => null);
  const pkgDoc = pkgRels ? parseXml(pkgRels) : null;
  if (pkgDoc) {
    for (const rel of readRels(pkgDoc.documentElement).values()) {
      // Targets in the package's own relationships are relative to the root of the zip
      const target = rel.target.replace(/^\//, '');
      if (/\/officeDocument$/.test(rel.type) && zip.file(target)) {
        mainPath = target;
        break;
      }
    }
  }
  if (!zip.file(mainPath)) throw new ImportError(MSG_NOT_DOCX);

  const mainXml = await readPart(zip, mainPath, MAX_XML_BYTES);
  if (!mainXml) throw new ImportError(MSG_NOT_DOCX);

  const relsPath = `${mainPath.slice(0, mainPath.lastIndexOf('/') + 1)}_rels/${mainPath.slice(mainPath.lastIndexOf('/') + 1)}.rels`;
  const relsXml = await readPart(zip, relsPath, 16 * 1024 * 1024).catch(() => null);
  const rels = (() => {
    const doc = relsXml ? parseXml(relsXml) : null;
    return doc ? readRels(doc.documentElement) : new Map<string, { type: string; target: string; external: boolean }>();
  })();
  const partOf = (suffix: string, fallback: string): string => {
    for (const rel of rels.values()) if (rel.type.endsWith(suffix) && !rel.external) return resolvePath(mainPath, rel.target);
    return fallback;
  };
  const stylesXml = await readPart(zip, partOf('/styles', 'word/styles.xml'), MAX_XML_BYTES).catch((e) => {
    if (e instanceof ImportError && e.message === MSG_XML_BIG) throw e;
    return null;
  });
  const numberingXml = await readPart(zip, partOf('/numbering', 'word/numbering.xml'), MAX_XML_BYTES).catch((e) => {
    if (e instanceof ImportError && e.message === MSG_XML_BIG) throw e;
    return null;
  });
  const coreXml = await readPart(zip, 'docProps/core.xml', 4 * 1024 * 1024).catch(() => null);

  await yieldToUi();

  const mainDoc = parseXml(mainXml);
  const root = mainDoc?.documentElement;
  if (!mainDoc || !root) throw new ImportError(MSG_XML_BAD);
  if (root.localName !== 'document' || (root.namespaceURI !== NS_W && root.namespaceURI !== NS_W_STRICT)) throw new ImportError(MSG_NOT_DOCX);
  const ns = root.namespaceURI;
  let body: Element | null = null;
  for (let c = root.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 1 && nameOf(c as Element) === 'body') body = c as Element;
  }
  if (!body) throw new ImportError(MSG_NOT_DOCX);

  const stylesDoc = stylesXml ? parseXml(stylesXml) : null;
  const numberingDoc = numberingXml ? parseXml(numberingXml) : null;
  const links = new Map<string, string>();
  for (const [id, rel] of rels) if (rel.external && /\/hyperlink$/.test(rel.type)) links.set(id, rel.target);
  const env: DocxEnv = {
    ns,
    resolveStyle: stylesDoc ? makeStyleResolver(readStyles(stylesDoc.documentElement, ns)) : () => NO_STYLE,
    listFormat: numberingDoc ? readNumbering(numberingDoc.documentElement, ns) : () => '',
    links,
  };

  const tally = newTally();
  const walked = walkDocx(body, env, tally);
  const titled = takeTitleStyles(walked);

  let coreTitle = '';
  let coreAuthor = '';
  const coreDoc = coreXml ? parseXml(coreXml) : null;
  if (coreDoc) {
    coreTitle = textOfFirst(coreDoc.documentElement, 'title');
    coreAuthor = textOfFirst(coreDoc.documentElement, 'creator');
    if (PLACEHOLDER_TITLE.test(coreTitle)) coreTitle = '';
    if (PLACEHOLDER_AUTHOR.test(coreAuthor)) coreAuthor = '';
  }

  if (!titled.blocks.some((b) => b.t !== 'hr') && !titled.title) throw new ImportError(MSG_NO_TEXT);
  return makeSource({
    format: 'docx',
    blocks: titled.blocks,
    warnings: tallyWarnings(tally),
    title: titled.title,
    author: titled.author,
    coreTitle,
    coreAuthor,
    fileName: opts.fileName,
  });
}

export async function readDocxSource(input: ArrayBuffer | Uint8Array, opts: ParseOptions = {}): Promise<ManuscriptSource> {
  try {
    return await readDocx(input, opts);
  } catch (err) {
    // Anything unexpected, such as a file built to break a reader, is reported as a file that could not be read
    throw err instanceof ImportError ? err : new ImportError(MSG_XML_BAD);
  }
}

export async function parseDocx(buffer: ArrayBuffer | Uint8Array, opts: ParseOptions = {}): Promise<ImportedManuscript> {
  return splitManuscript(await readDocxSource(buffer, opts), opts.split ?? 'auto');
}

// ---------------------------------------------------------------- files

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const kindOf = (name: string, type: string): 'docx' | 'txt' | 'md' => {
  const ext = /\.([A-Za-z0-9]+)$/.exec(name)?.[1]?.toLowerCase() ?? '';
  if (ext === 'docx') return 'docx';
  if (ext === 'txt' || ext === 'text') return 'txt';
  if (ext === 'md' || ext === 'markdown' || ext === 'mdown') return 'md';
  if (Object.hasOwn(UNSUPPORTED, ext)) throw new ImportError(UNSUPPORTED[ext]);
  if (type === MIME_DOCX) return 'docx';
  if (type === 'text/plain') return 'txt';
  if (type === 'text/markdown') return 'md';
  throw new ImportError(MSG_GENERIC);
};

/** Checks a file's name and size before anything is read. Returns the problem in plain words, or null. */
export const checkManuscriptFile = (file: { name: string; type?: string; size: number }): string | null => {
  try {
    kindOf(file.name, file.type || '');
  } catch (err) {
    return err instanceof Error ? err.message : MSG_GENERIC;
  }
  return file.size > MAX_IMPORT_BYTES ? MSG_TOO_BIG : null;
};

async function readSource(file: File, opts: ParseOptions): Promise<ManuscriptSource> {
  const problem = checkManuscriptFile(file);
  if (problem) throw new ImportError(problem);
  const name = file.name || opts.fileName || '';
  const kind = kindOf(name, file.type);
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new ImportError('That file could not be read. Check that it is still there and try again.');
  }
  if (kind === 'docx') return readDocxSource(buffer, { ...opts, fileName: name });
  const text = decodeText(new Uint8Array(buffer));
  if (!text.trim()) throw new ImportError(MSG_NO_TEXT);
  const source = kind === 'md' ? readMarkdownSource(text, { ...opts, fileName: name }) : readTextSource(text, { ...opts, fileName: name });
  if (!source.blocks.some((b) => b.t !== 'hr')) throw new ImportError(MSG_NO_TEXT);
  return source;
}

/** Reads a file into blocks, ready to be cut into chapters. Throws an ImportError whose message is fit to show. */
export async function readManuscriptSource(file: File, opts: ParseOptions = {}): Promise<ManuscriptSource> {
  try {
    return await readSource(file, opts);
  } catch (err) {
    throw err instanceof ImportError ? err : new ImportError('Something went wrong while reading that file. Try saving it again, or use another copy.');
  }
}

/** Picks the reader by file type, reads the file and splits it. */
export async function readManuscriptFile(file: File, opts: ParseOptions = {}): Promise<ImportedManuscript> {
  return splitManuscript(await readManuscriptSource(file, opts), opts.split ?? 'auto');
}
