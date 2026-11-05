// Shared by scripts/chapter-check.mjs and scripts/build-library.mjs.
//
// A chapter is a small Markdown file:
//
//   # Chapter title            (first line, no "Chapter 7:" prefix: the app numbers chapters itself)
//
//   A paragraph. Blank line between paragraphs.
//
//   * * *                      (a scene break)
//
//   > A letter or a document, set apart.
//
// Inline: *italic*, **bold**. Nothing else (no lists, tables, headings, code or HTML).

const BREAK = /^(?:(?:\*\s*){3,}|-{3,}|_{3,}|#\s*#\s*#)$/;

/** Plain text of the converted HTML, counted the way the app counts words (see src/lib/text.ts). */
export const htmlToText = (html) =>
  (html || '')
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

export const countWords = (html) => {
  const text = htmlToText(html);
  return text ? text.split(' ').length : 0;
};

const OPENERS = /[\s([{—–“‘]/;
const ELISIONS = /^(?:til|tis|twas|em|cause|round|bout|n|\d0s|\d\d)\b/i;

/** Straight quotes to typographic ones. Markers (* and _) are looked through when deciding which way a quote faces. */
export const smarten = (s) => {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '"' && c !== "'") {
      out += c;
      continue;
    }
    let j = i - 1;
    while (j >= 0 && (s[j] === '*' || s[j] === '_')) j--;
    const prev = j >= 0 ? s[j] : '';
    let k = i + 1;
    while (k < s.length && (s[k] === '*' || s[k] === '_')) k++;
    const next = k < s.length ? s[k] : '';
    const startsWord = prev === '' || OPENERS.test(prev);
    const nextIsSpace = next === '' || /\s/.test(next);
    if (c === '"') {
      out += startsWord && !nextIsSpace ? '“' : '”';
    } else if (/[\p{L}\p{N}]/u.test(prev) && /[\p{L}\p{N}]/u.test(next)) {
      out += '’'; // don't, o'clock
    } else if (startsWord && !nextIsSpace && !ELISIONS.test(s.slice(k, k + 6))) {
      out += '‘';
    } else {
      out += '’';
    }
  }
  return out;
};

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline Markdown to HTML. Input is already smartened. */
export const inline = (s) =>
  escapeHtml(s)
    .replace(/\*\*(?=\S)([^*]+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?=\S)([^*]+?)(?<=\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\p{L}\p{N}_])_(?=\S)([^_]+?)(?<=\S)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>');

/**
 * Parse a chapter file. Returns the title, the blocks and the problems found in the structure.
 * `blocks` are { type: 'p' | 'break' | 'quote', text }.
 */
export const parseChapter = (markdown) => {
  const problems = [];
  const lines = String(markdown).replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n');
  let at = 0;
  while (at < lines.length && lines[at].trim() === '') at++;
  const first = (lines[at] || '').trim();
  let title = '';
  if (/^#\s+\S/.test(first)) {
    title = first.replace(/^#\s+/, '').trim();
    at++;
  } else {
    problems.push('The first line must be "# Chapter title".');
  }
  if (/^(chapter|part|book)\s+(\d+|[ivxlc]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/i.test(title)) {
    problems.push(`The title "${title}" starts with a chapter number. Give the title only: the app numbers chapters itself.`);
  }
  if (/^\d+[.:)]\s/.test(title)) problems.push(`The title "${title}" starts with a number. Give the title only.`);

  const chunks = lines.slice(at).join('\n').split(/\n[ \t]*\n/).map((c) => c.trim()).filter(Boolean);
  const blocks = [];
  chunks.forEach((chunk, i) => {
    if (BREAK.test(chunk)) {
      blocks.push({ type: 'break', text: '' });
      return;
    }
    if (chunk.includes('\n')) {
      const allQuote = chunk.split('\n').every((l) => l.trim().startsWith('>'));
      if (!allQuote) problems.push(`Block ${i + 1} has a line break inside it ("${chunk.slice(0, 40).replace(/\n/g, ' / ')}…"). Separate paragraphs with a blank line.`);
    }
    if (/^>/.test(chunk)) {
      blocks.push({ type: 'quote', text: chunk.split('\n').map((l) => l.replace(/^>\s?/, '')).join(' ').trim() });
    } else {
      blocks.push({ type: 'p', text: chunk.replace(/\n/g, ' ') });
    }
  });
  return { title, blocks, problems };
};

/** The chapter as the app stores it: HTML paragraphs, <hr> for scene breaks. */
export const toHtml = (blocks) =>
  blocks
    .map((b) => {
      if (b.type === 'break') return '<hr>';
      const body = inline(smarten(b.text));
      return b.type === 'quote' ? `<blockquote><p>${body}</p></blockquote>` : `<p>${body}</p>`;
    })
    .join('');

/** Plain visible text of one block, markers removed. */
export const plain = (text) => text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/(^|\W)_(\S[^_]*?)_(?=\W|$)/g, '$1$2');
