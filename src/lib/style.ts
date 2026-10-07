/**
 * Gentle style notes. These are nudges, not rules: every flag is something a writer may well keep.
 * Pure text in, ranges out, so it is easy to reason about and test.
 */
export type StyleKind = 'repeat' | 'adverb' | 'filler' | 'long' | 'opener';

export interface StyleIssue {
  kind: StyleKind;
  /** Offsets into the block's text */
  from: number;
  to: number;
}

export const STYLE_KINDS: { id: StyleKind; label: string; hint: string }[] = [
  { id: 'repeat', label: 'Repeated words', hint: 'The same word twice in a row, like "the the". Sometimes it is meant.' },
  { id: 'adverb', label: 'Adverbs', hint: 'Words ending in -ly. A strong verb can often do the work.' },
  { id: 'filler', label: 'Filler words', hint: 'Words like very, really and just that often add little.' },
  { id: 'long', label: 'Long sentences', hint: 'Sentences over 35 words. Fine if you want the reader out of breath.' },
  { id: 'opener', label: 'Same openers', hint: 'Three sentences in a row that start with the same word.' },
];

export const LONG_SENTENCE_WORDS = 35;

// Words that end in -ly without being adverbs worth a second look
const NOT_ADVERBS = new Set([
  'only', 'family', 'early', 'lonely', 'friendly', 'lovely', 'ugly', 'holy', 'belly', 'jelly', 'silly', 'july', 'reply', 'apply',
  'supply', 'fly', 'rely', 'ally', 'bully', 'assembly', 'anomaly', 'butterfly', 'italy', 'rely', 'imply', 'multiply', 'comply',
  'lily', 'sally', 'molly', 'billy', 'willy', 'curly', 'surly', 'melancholy', 'daily', 'likely', 'unlikely', 'deadly', 'lively',
  'elderly', 'orderly', 'costly', 'cowardly', 'timely', 'homely', 'kindly', 'ghostly', 'gravelly', 'hilly', 'bubbly', 'wobbly',
]);

const FILLERS = new Set(['very', 'really', 'just', 'quite', 'rather', 'actually', 'basically', 'literally', 'suddenly', 'simply', 'totally']);

const WORD = /[\p{L}\p{N}'’]+/gu;

/** Sentences with their offsets. Splits after . ! ? … and any closing quote or bracket. */
export const sentences = (text: string): { from: number; to: number; text: string }[] => {
  const out: { from: number; to: number; text: string }[] = [];
  const re = /[^.!?…]+(?:[.!?…]+["”’)\]]*|$)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (body) out.push({ from: m.index + lead, to: m.index + lead + body.length, text: body });
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
};

const wordsOf = (s: string): string[] => s.match(WORD) || [];

/** Style flags for one paragraph or heading. */
export const analyseBlock = (text: string): StyleIssue[] => {
  const issues: StyleIssue[] = [];
  if (!text.trim()) return issues;

  // Repeated words, and adverbs and fillers, in one pass over the words
  let prev: { word: string; from: number } | null = null;
  WORD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD.exec(text)) !== null) {
    const word = m[0];
    const lower = word.toLowerCase().replace(/[’']/g, '');
    const from = m.index;
    const to = from + word.length;
    // Only a single space between the two words counts as "in a row"
    if (prev && prev.word === lower && /^\s+$/.test(text.slice(prev.from + prev.word.length, from)) && !/^\d+$/.test(lower)) {
      issues.push({ kind: 'repeat', from, to });
    }
    // A filler word that ends in -ly (really, simply) is one note, not two
    if (FILLERS.has(lower)) issues.push({ kind: 'filler', from, to });
    else if (lower.length > 3 && lower.endsWith('ly') && !NOT_ADVERBS.has(lower)) issues.push({ kind: 'adverb', from, to });
    prev = { word: lower, from };
  }

  const sents = sentences(text);
  for (const s of sents) {
    if (wordsOf(s.text).length > LONG_SENTENCE_WORDS) issues.push({ kind: 'long', from: s.from, to: s.to });
  }

  // Three sentences in a row that start with the same word
  const firstWord = (s: { text: string }) => (wordsOf(s.text)[0] || '').toLowerCase();
  for (let i = 0; i + 2 < sents.length; i++) {
    const w = firstWord(sents[i]);
    if (w && w === firstWord(sents[i + 1]) && w === firstWord(sents[i + 2])) {
      for (let k = i; k <= i + 2; k++) {
        const start = sents[k].from;
        issues.push({ kind: 'opener', from: start, to: start + (wordsOf(sents[k].text)[0] || '').length });
      }
      i += 2;
    }
  }
  return issues;
};

export interface StyleStats {
  words: number;
  sentences: number;
  avgSentence: number;
  longest: number;
  /** Share of the text that sits inside quotation marks, 0 to 100 */
  dialogue: number;
}

export const statsFor = (blocks: string[]): StyleStats => {
  let words = 0;
  let sentenceCount = 0;
  let longest = 0;
  let quoted = 0;
  let total = 0;
  for (const block of blocks) {
    words += wordsOf(block).length;
    for (const s of sentences(block)) {
      sentenceCount++;
      longest = Math.max(longest, wordsOf(s.text).length);
    }
    total += block.length;
    for (const q of block.match(/[“"][^”"]*[”"]/g) || []) quoted += q.length;
  }
  return {
    words,
    sentences: sentenceCount,
    avgSentence: sentenceCount ? Math.round(words / sentenceCount) : 0,
    longest,
    dialogue: total ? Math.round((quoted / total) * 100) : 0,
  };
};
