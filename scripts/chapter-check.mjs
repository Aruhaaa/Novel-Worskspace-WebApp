#!/usr/bin/env node
// Checks chapter files of the sample library: format, length and the habits that make generated fiction read as generated.
//
//   node scripts/chapter-check.mjs content/library/<slug>/chapters/01.md --min 2200
//   node scripts/chapter-check.mjs content/library/<slug>/chapters --from 7 --to 12 --min 2200   (a whole range at once)
//
// Prints PASS or FAIL for each chapter, the facts, and what to fix. Exit code 1 if any chapter fails.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChapter, toHtml, countWords, plain } from './lib/chapter.mjs';

/** Names and places that generated fiction reaches for far too often. Any of them fails the chapter. */
export const OVERUSED_NAMES = [
  'Elara', 'Elora', 'Kael', 'Kaelen', 'Kaelith', 'Lyra', 'Lyria', 'Thorne', 'Voss', 'Blackwood', 'Ashford', 'Sterling', 'Elias', 'Aria',
  'Seraphina', 'Elowen', 'Lysander', 'Caden', 'Aldric', 'Eldoria', 'Eldrin', 'Zephyr', 'Aurelia', 'Evangeline', 'Alistair', 'Corvin',
  'Silas', 'Mara', 'Zara', 'Nyx', 'Lila', 'Willowbrook', 'Oakhaven', 'Ravenswood', 'Ravenwood', 'Elderwood', 'Silverbrook', 'Millbrook',
  'Thornfield', 'Whisperwood', 'Hollowbrook', 'Sarah Chen', 'Marcus',
];

/** Phrases that fail the chapter on sight. */
export const HARD_PHRASES = [
  'a testament to', 'tapestry', 'shiver down', 'shivers down', 'shiver ran', 'shivers ran', 'breath she didn\'t know', 'breath he didn\'t know',
  'breath i didn\'t know', 'breath they didn\'t know', 'breath she hadn\'t', 'breath he hadn\'t', 'couldn\'t help but', 'could not help but',
  'little did she know', 'little did he know', 'little did they know', 'little did i know', 'palpable', 'symphony of', 'kaleidoscope', 'orbs',
  'ministrations', 'myriad', 'bustling', 'ethereal', 'unbeknownst', 'delved', 'the air was thick', 'thick with tension', 'a mixture of emotions',
  'rich tapestry', 'sent shivers', 'sent a shiver',
];

/** Fine now and then, a habit in bulk. More than SOFT_LIMIT of them in one chapter fails it. */
export const SOFT_PHRASES = [
  'in that moment', 'heart hammered', 'heart pounded', 'heart pounding', 'heart raced', 'heart skipped', 'heart thundered', 'pit of her stomach',
  'pit of his stomach', 'pit of my stomach', 'knot in her stomach', 'knot in his stomach', 'knot in my stomach', 'silence stretched', 'hung heavy',
  'hung in the air', 'unreadable', 'steeled herself', 'steeled himself', 'steeled myself', 'squared her shoulders', 'squared his shoulders',
  'jaw clenched', 'jaw tightened', 'eyes widened', 'ghost of a smile', 'barely above a whisper', 'barely a whisper', 'something shifted',
  'the weight of', 'a mix of', 'a mixture of', 'let out a breath', 'released a breath', 'took a deep breath', 'drew a breath', 'chill ran',
  'mask of', 'time seemed to', 'the world narrowed', 'seemed to hold its breath', 'unspoken', 'electric', 'for a long moment', 'for a heartbeat',
];
export const SOFT_LIMIT = 4;
export const EM_DASH_PER_1000 = 14;

/** Check one chapter's text. Returns { ok, stats, fails, notes }. */
export const checkChapter = (raw, { min = 0, max = Infinity } = {}) => {
  const { title, blocks, problems } = parseChapter(raw);
  const html = toHtml(blocks);
  const appWords = countWords(html);
  const rawWords = blocks.filter((b) => b.type !== 'break').map((b) => plain(b.text)).join(' ').split(/\s+/).filter(Boolean).length;
  const words = Math.min(appWords, rawWords);

  const body = blocks.filter((b) => b.type !== 'break').map((b) => plain(b.text));
  const flat = ` ${body.join(' \n ')} `;
  const lower = flat.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  const fails = [...problems];
  const notes = [];

  if (words < min) fails.push(`Too short: ${words} words, needs at least ${min}. Add scenes, dialogue and detail from the outline. Do not pad or repeat.`);
  if (words > max) fails.push(`Too long: ${words} words, at most ${max}. Tighten.`);
  if (blocks.length === 0) fails.push('The chapter has no text.');

  const names = OVERUSED_NAMES.filter((n) => new RegExp(`\\b${n}\\b`).test(flat));
  if (names.length) fails.push(`Overused name or place used: ${names.join(', ')}. Choose one that fits this novel's naming palette.`);

  const hard = HARD_PHRASES.filter((p) => lower.includes(p));
  if (hard.length) fails.push(`Banned phrases: ${hard.map((p) => `"${p}"`).join(', ')}. Rewrite those sentences with something specific.`);

  const soft = [];
  for (const p of SOFT_PHRASES) {
    let from = 0;
    for (let at = lower.indexOf(p, from); at >= 0; at = lower.indexOf(p, from)) {
      soft.push(p);
      from = at + p.length;
    }
  }
  if (soft.length > SOFT_LIMIT) fails.push(`${soft.length} stock phrases (limit ${SOFT_LIMIT}): ${[...new Set(soft)].map((p) => `"${p}"`).join(', ')}. Replace most of them.`);

  const dashes = (flat.match(/—/g) || []).length;
  const perThousand = words ? (dashes / words) * 1000 : 0;
  if (perThousand > EM_DASH_PER_1000) fails.push(`${dashes} em dashes (${perThousand.toFixed(1)} per 1000 words, limit ${EM_DASH_PER_1000}). Use full stops, commas or colons for most of them.`);

  if (/<\/?[a-z][^>]*>/i.test(raw)) fails.push('HTML tags found. Use plain Markdown only.');
  if (/^\s{0,3}#{1,6}\s/m.test(raw.split('\n').slice(1).join('\n'))) fails.push('A second heading was found. Only the first line may start with #.');
  if (/^\s*[-+]\s+\S/m.test(raw) || /^\s*\d+[.)]\s+\S/m.test(raw)) fails.push('A list was found. Write prose paragraphs.');
  if (/```|^\|.*\|/m.test(raw)) fails.push('A code block or table was found. Write prose paragraphs.');
  if (/\b(todo|tbd|lorem ipsum|insert [a-z ]+ here|as an ai|word count)\b/i.test(flat)) fails.push('Placeholder or meta text found.');
  if (/\b(end of chapter|to be continued|chapter \d+ ends)\b/i.test(flat)) fails.push('Chapter-ending meta text found. End on a story beat.');

  const unbalanced = body
    .map((t, i) => ({ i, n: (t.match(/["“”]/g) || []).length, t }))
    .filter((x) => x.n % 2 === 1);
  if (unbalanced.length) {
    notes.push(`${unbalanced.length} paragraph(s) have an unclosed quotation mark, for example: "${unbalanced[0].t.slice(0, 60)}…". Close quotes inside each paragraph.`);
  }
  const longest = Math.max(0, ...body.map((t) => t.split(/\s+/).length));
  if (longest > 260) notes.push(`A paragraph runs ${longest} words. Break it up.`);
  const openers = {};
  body.forEach((t) => {
    const w = (t.replace(/^["'“‘\s]+/, '').split(/\s+/)[0] || '').toLowerCase();
    if (w) openers[w] = (openers[w] || 0) + 1;
  });
  const [topOpener, topCount] = Object.entries(openers).sort((a, b) => b[1] - a[1])[0] || ['', 0];
  if (body.length >= 12 && topCount / body.length > 0.3) notes.push(`${Math.round((topCount / body.length) * 100)}% of paragraphs begin with "${topOpener}". Vary how paragraphs open.`);
  const dialogue = body.filter((t) => /^["“]/.test(t)).length;

  const stats = `title="${title}" words=${words} paragraphs=${body.length} dialogue=${Math.round((dialogue / Math.max(1, body.length)) * 100)}% emdashes=${dashes} stock=${soft.length}`;
  return { ok: fails.length === 0, words, stats, fails, notes };
};

const print = (label, r) => {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${label}${label ? ' ' : ''}${r.stats}`);
  r.fails.forEach((f) => console.log(`  - ${f}`));
  r.notes.forEach((n) => console.log(`  (note) ${n}`));
};

// Run as a command (not when imported)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
  };
  const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
  if (!target) {
    console.error('Usage: node scripts/chapter-check.mjs <chapter.md | chapters-folder> [--from N --to N] [--min N] [--max N]');
    process.exit(2);
  }
  const min = flag('--min', 0);
  const max = flag('--max', Infinity);

  let files;
  if (existsSync(target) && statSync(target).isDirectory()) {
    const from = flag('--from', 1);
    const to = flag('--to', 999);
    files = readdirSync(target)
      .filter((f) => /^\d+\.md$/.test(f))
      .map((f) => ({ f, n: Number(f.slice(0, -3)) }))
      .filter(({ n }) => n >= from && n <= to)
      .sort((a, b) => a.n - b.n)
      .map(({ f }) => join(target, f));
    // A chapter that was asked for and is missing is a failure too
    if (args.includes('--from') && args.includes('--to')) {
      for (let n = from; n <= to; n++) {
        const name = join(target, `${String(n).padStart(2, '0')}.md`);
        if (!files.includes(name)) {
          console.log(`FAIL ${name} does not exist yet.`);
          process.exitCode = 1;
        }
      }
    }
  } else {
    files = [target];
  }

  let failed = 0;
  for (const file of files) {
    let raw;
    try {
      raw = readFileSync(file, 'utf8');
    } catch {
      console.log(`FAIL ${file} cannot be read.`);
      failed++;
      continue;
    }
    const r = checkChapter(raw, { min, max });
    print(files.length > 1 ? file.split(/[\\/]/).slice(-1)[0] : '', r);
    if (!r.ok) failed++;
  }
  if (files.length > 1) console.log(failed || process.exitCode ? `${failed || 'Some'} chapter(s) need fixing.` : 'ALL PASS');
  process.exit(failed || process.exitCode ? 1 : 0);
}
