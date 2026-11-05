#!/usr/bin/env node
// Turns the Markdown novels in content/library/ into the files the website loads.
//
//   node scripts/build-library.mjs            build src/data/library/ (index.json and one file per novel)
//   node scripts/build-library.mjs --check    only check; write nothing; exit 1 if any novel is short or broken
//
// Each novel lives in content/library/<slug>/ : meta.json, bible.md, outline.md and chapters/NN.md.
// A novel must have every chapter its brief asks for and at least MIN_WORDS words, counted the way the app counts them.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countWords, parseChapter, toHtml } from './lib/chapter.mjs';

const MIN_WORDS = 50000;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'content', 'library');
const out = join(root, 'src', 'data', 'library');
const checkOnly = process.argv.includes('--check');
const only = process.argv.filter((a) => a.startsWith('--only=')).map((a) => a.slice(7));

const briefs = JSON.parse(readFileSync(join(src, 'briefs.json'), 'utf8'));
const selected = briefs.filter((b) => only.length === 0 || only.includes(b.slug));

// Fixed dates, spread over the months before the anchor, so every build is identical
const ANCHOR = Date.UTC(2026, 9, 1);
const DAY = 86400000;
const isoDaysBefore = (days) => new Date(ANCHOR - days * DAY).toISOString();

const problems = [];
const index = [];
const rows = [];

selected.forEach((brief, i) => {
  const dir = join(src, brief.slug);
  const fail = (msg) => problems.push(`${brief.slug}: ${msg}`);
  if (!existsSync(dir)) return fail('no folder yet');

  let meta = {};
  try {
    meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  } catch {
    fail('meta.json is missing or is not valid JSON');
  }

  const chapDir = join(dir, 'chapters');
  const files = existsSync(chapDir) ? readdirSync(chapDir).filter((f) => /^\d+\.md$/.test(f)).sort() : [];
  const chapters = [];
  let words = 0;
  let shortest = Infinity;
  files.forEach((f, at) => {
    const num = Number(f.slice(0, -3));
    if (num !== at + 1) fail(`chapter files are not numbered 1..n without gaps (found ${f} at position ${at + 1})`);
    const parsed = parseChapter(readFileSync(join(chapDir, f), 'utf8'));
    parsed.problems.forEach((p) => fail(`${f}: ${p}`));
    const html = toHtml(parsed.blocks);
    const w = countWords(html);
    if (w < brief.minWords) fail(`${f} has ${w} words, under its floor of ${brief.minWords}`);
    shortest = Math.min(shortest, w);
    words += w;
    chapters.push({ title: parsed.title || `Chapter ${at + 1}`, html });
  });

  if (files.length !== brief.chapters) fail(`has ${files.length} chapters, the brief asks for ${brief.chapters}`);
  if (words < MIN_WORDS) fail(`has ${words} words, needs at least ${MIN_WORDS}`);
  for (const key of ['description', 'tagline', 'authorBio']) if (!meta[key]) fail(`meta.json has no "${key}"`);

  const updatedDays = 6 + ((i * 37) % 170);
  const updatedAt = isoDaysBefore(updatedDays);
  const createdAt = isoDaysBefore(updatedDays + 20 + ((i * 53) % 70));
  index.push({
    id: `bundled-${brief.slug}`,
    slug: brief.slug,
    title: brief.title,
    author: brief.author,
    authorId: `bundled-author-${brief.slug}`,
    authorBio: meta.authorBio || '',
    genre: brief.genre,
    subgenre: brief.subgenre,
    tagline: meta.tagline || '',
    description: meta.description || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    contentNotes: meta.contentNotes || '',
    chapters: chapters.length,
    words,
    createdAt,
    updatedAt,
    body: chapters,
  });
  rows.push({ slug: brief.slug, genre: brief.genre, chapters: `${chapters.length}/${brief.chapters}`, words, shortest: Number.isFinite(shortest) ? shortest : 0 });
});

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('novel', 36)}${pad('genre', 13)}${pad('chapters', 10)}${pad('words', 8)}shortest chapter`);
rows.forEach((r) => console.log(`${pad(r.slug, 36)}${pad(r.genre, 13)}${pad(r.chapters, 10)}${pad(r.words, 8)}${r.shortest}`));
const total = rows.reduce((n, r) => n + r.words, 0);
console.log(`${rows.length} novels, ${total.toLocaleString('en-US')} words`);

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  problems.forEach((p) => console.log(`  - ${p}`));
}
if (checkOnly) process.exit(problems.length ? 1 : 0);

// Only novels that are complete go into the site
const ready = index.filter((n) => !problems.some((p) => p.startsWith(`${n.slug}:`)));
if (only.length === 0) {
  rmSync(out, { recursive: true, force: true });
}
mkdirSync(join(out, 'novels'), { recursive: true });
for (const n of ready) {
  const { body, ...entry } = n;
  writeFileSync(join(out, 'novels', `${n.slug}.json`), JSON.stringify({ chapters: body }));
  void entry;
}
const entries = ready.map(({ body, ...entry }) => {
  void body;
  return entry;
});
writeFileSync(join(out, 'index.json'), `${JSON.stringify(entries, null, 2)}\n`);
console.log(`\nWrote ${entries.length} novels to src/data/library/`);
if (ready.length < index.length) console.log(`${index.length - ready.length} novel(s) were left out because of the problems above.`);
process.exit(0);
