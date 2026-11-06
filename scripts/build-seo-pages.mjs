#!/usr/bin/env node
// Writes plain HTML pages for the sample library, so a search engine (or a person with JavaScript off) can read them.
//
//   dist/library/index.html          the list of novels, by genre
//   dist/library/<slug>.html         one novel: details, the first ~600 words of chapter 1, the chapter titles
//   dist/sitemap.xml                 public/sitemap.xml plus those pages
//
// It runs after `vite build` (see the "build" script in package.json) and reads src/data/library/, which `npm run library:build`
// makes. The app itself is untouched: these pages are extra files that Vercel serves before it falls back to the app.
// The reader inside the app stays at /#/library/novel/<id>; each page's button goes there.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE = 'https://novelistworkspace.kakamond.com';
export const PUBLISHER = 'Dexxie Luminaire';
const EXCERPT_WORDS = 600;
const ADSENSE =
  '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9704386583775569" crossorigin="anonymous"></script>';

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

/** Turn character references in text (&amp; &#8217; …) into the characters. Anything unknown is left as written. */
export const decodeEntities = (s) =>
  String(s).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const n = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return NAMED[name.toLowerCase()] ?? whole;
  });

/** The plain-text paragraphs of a chapter's HTML. */
export const paragraphsOf = (html) =>
  [...String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
    .filter(Boolean);

/** Whole paragraphs from the start of a chapter until there are at least `limit` words. */
export const excerptOf = (html, limit = EXCERPT_WORDS) => {
  const paragraphs = [];
  let words = 0;
  for (const p of paragraphsOf(html)) {
    paragraphs.push(p);
    words += p.split(/\s+/).length;
    if (words >= limit) break;
  }
  return { paragraphs, words };
};

/** A short piece of text for a description tag, cut at a word. */
export const clip = (text, max = 155) => {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : cut.length).replace(/[,;:.\s]+$/, '')}…`;
};

export const genreClass = (genre) => `g-${String(genre || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other'}`;
const thousands = (n) => `${Math.max(1, Math.round(Number(n) / 1000))}k words`;
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const pageUrl = (path) => `${SITE}${path}`;

const NAV = [
  ['/library/', 'Library'],
  ['/about.html', 'About'],
  ['/privacy.html', 'Privacy'],
  ['/contact.html', 'Contact'],
];

const shell = ({ title, description, path, body, extraHead = '' }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f5f2eb" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(pageUrl(path))}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(pageUrl(path))}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/pages.css" />
    ${extraHead}
    ${ADSENSE}
  </head>
  <body>
    <div class="wrap">
      <header class="top">
        <a class="brand" href="/">Novelist Workspace</a>
        <nav aria-label="Pages">
          ${NAV.map(([href, label]) => `<a href="${href}"${path.startsWith('/library') && href === '/library/' ? ' aria-current="page"' : ''}>${label}</a>`).join('\n          ')}
        </nav>
      </header>

      <main>
${body}
      </main>

      <footer class="bottom">
        <span>© Novelist Workspace by Kakamond</span>
        <nav aria-label="Footer">
          <a href="/">App</a>
          ${NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n          ')}
        </nav>
      </footer>
    </div>
  </body>
</html>
`;

const cover = (entry) => `<div class="cover ${genreClass(entry.genre)}" aria-hidden="true"><span>${esc(entry.title)}</span></div>`;

const card = (entry) => `<a class="card" href="/library/${esc(entry.slug)}.html">
            ${cover(entry)}
            <strong>${esc(entry.title)}</strong>
            <span class="by">${esc(entry.author)}</span>
            <span class="meta">${entry.chapters} chapters · ${thousands(entry.words)}</span>
          </a>`;

export const renderLibraryIndex = (entries) => {
  const genres = [...new Set(entries.map((e) => e.genre))].sort();
  const sections = genres
    .map((g) => {
      const list = entries.filter((e) => e.genre === g).sort((a, b) => a.title.localeCompare(b.title));
      return `        <section aria-labelledby="g-${esc(genreClass(g))}">
          <h2 id="g-${esc(genreClass(g))}">${esc(g)}</h2>
          <div class="grid">
          ${list.map(card).join('\n          ')}
          </div>
        </section>`;
    })
    .join('\n');
  const description = `Free novels to read online, no account needed: ${genres.join(', ')} and more. Sample novels from ${PUBLISHER}, plus what writers publish in the app.`;
  const body = `        <h1>The library</h1>
        <p class="lead">Free novels to read, with no account. Pick a genre and open a book.</p>
        <p>
          These are sample novels from ${esc(PUBLISHER)}, shown here so there is always something to read. Each page gives the details and the start of the
          first chapter. The whole novel opens in the app, where you can keep your place, like it, and leave a review. Novels that writers publish
          themselves appear in the app's Public Library.
        </p>
        <p><a class="button" href="/#/library">Open the library in the app</a></p>
${sections}`;
  return shell({
    title: 'The library: free novels to read online | Novelist Workspace',
    description: clip(description, 160),
    path: '/library/',
    body,
    extraHead: jsonLd({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'The library',
      url: pageUrl('/library/'),
      description: clip(description, 160),
      hasPart: entries.map((e) => ({ '@type': 'Book', name: e.title, url: pageUrl(`/library/${e.slug}.html`) })),
    }),
  });
};

export const renderNovelPage = (entry, body, entries) => {
  const chapters = body?.chapters ?? [];
  const first = chapters[0];
  const { paragraphs } = excerptOf(first?.html);
  const same = entries.filter((e) => e.genre === entry.genre && e.slug !== entry.slug);
  const at = entries.findIndex((e) => e.slug === entry.slug);
  const prev = entries[(at - 1 + entries.length) % entries.length];
  const next = entries[(at + 1) % entries.length];
  const description = clip(`${entry.tagline} ${entry.description}`, 155);
  const path = `/library/${entry.slug}.html`;
  const appLink = `/#/library/novel/${encodeURIComponent(entry.id)}`;

  const pageBody = `        <p class="crumbs"><a href="/library/">Library</a> › ${esc(entry.genre)}</p>
        <div class="novel-head">
          ${cover(entry)}
          <div>
            <span class="chip">Sample novel</span>
            <h1>${esc(entry.title)}</h1>
            <p class="byline">by <strong>${esc(entry.author)}</strong> · ${esc(entry.genre)}${entry.subgenre ? ` · ${esc(entry.subgenre)}` : ''}</p>
            <p class="meta">${entry.chapters} chapters · ${thousands(entry.words)} · a sample novel from ${esc(PUBLISHER)}</p>
          </div>
        </div>
        <p class="lead">${esc(entry.tagline)}</p>
        <p>${esc(entry.description)}</p>
        ${entry.contentNotes ? `<p class="meta"><strong>Content notes:</strong> ${esc(entry.contentNotes)}</p>` : ''}
        ${entry.tags?.length ? `<p class="tags">${entry.tags.map((t) => `<span>${esc(t)}</span>`).join(' ')}</p>` : ''}

        ${
          paragraphs.length
            ? `<section class="excerpt" aria-labelledby="start">
          <h2 id="start">Start reading</h2>
          <p class="meta">Chapter 1${first.title ? `: ${esc(first.title)}` : ''}</p>
          ${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n          ')}
          <div class="fade" aria-hidden="true"></div>
          <p><a class="button" href="${appLink}">Keep reading in the app</a></p>
          <p class="meta">Free, no account needed.</p>
        </section>`
            : `<p><a class="button" href="${appLink}">Read it in the app</a></p>`
        }

        ${
          chapters.length
            ? `<h2>Contents</h2>
        <ol class="toc">
          ${chapters.map((c) => `<li>${esc(c.title)}</li>`).join('\n          ')}
        </ol>`
            : ''
        }

        ${
          same.length
            ? `<h2>More in ${esc(entry.genre)}</h2>
        <ul>
          ${same.map((e) => `<li><a href="/library/${esc(e.slug)}.html">${esc(e.title)}</a> by ${esc(e.author)}</li>`).join('\n          ')}
        </ul>`
            : ''
        }

        <p class="pager">
          <a href="/library/${esc(prev.slug)}.html" rel="prev">← ${esc(prev.title)}</a>
          <a href="/library/${esc(next.slug)}.html" rel="next">${esc(next.title)} →</a>
        </p>`;

  return shell({
    title: `${entry.title} by ${entry.author} | Novelist Workspace`,
    description,
    path,
    body: pageBody,
    extraHead: jsonLd({
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: entry.title,
      url: pageUrl(path),
      author: { '@type': 'Person', name: entry.author },
      publisher: { '@type': 'Organization', name: PUBLISHER },
      genre: entry.genre,
      description: entry.description,
      inLanguage: 'en',
      keywords: (entry.tags || []).join(', '),
      isAccessibleForFree: true,
      dateModified: String(entry.updatedAt || '').slice(0, 10) || undefined,
    }),
  });
};

/** The page files and the sitemap, as text. `bodies` maps a slug to `{ chapters: [{ title, html }] }`. */
export const buildSeoPages = ({ entries, bodies, baseSitemap }) => {
  const sorted = [...entries].sort((a, b) => a.title.localeCompare(b.title));
  const files = { 'library/index.html': renderLibraryIndex(sorted) };
  for (const e of sorted) files[`library/${e.slug}.html`] = renderNovelPage(e, bodies[e.slug], sorted);

  const today = new Date().toISOString().slice(0, 10);
  const url = (loc, lastmod, changefreq, priority) =>
    `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  const added = [
    url(pageUrl('/library/'), today, 'weekly', '0.8'),
    ...sorted.map((e) => url(pageUrl(`/library/${e.slug}.html`), String(e.updatedAt || today).slice(0, 10), 'monthly', '0.6')),
  ].filter((block) => !baseSitemap.includes(block.match(/<loc>(.*?)<\/loc>/)[1]));
  const sitemap = baseSitemap.replace('</urlset>', `${added.join('\n')}${added.length ? '\n' : ''}</urlset>`);
  return { files, sitemap };
};

const main = () => {
  if (process.env.VITE_SAMPLE_LIBRARY === 'off') {
    console.log('seo pages: the sample library is switched off for this build, so no library pages were written.');
    return;
  }
  const indexPath = join(ROOT, 'src/data/library/index.json');
  const dist = join(ROOT, process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'dist');
  if (!existsSync(indexPath)) {
    console.log('seo pages: src/data/library/index.json is missing (run `npm run library:build`), so no library pages were written.');
    return;
  }
  if (!existsSync(dist)) throw new Error(`seo pages: ${dist} does not exist. Run "vite build" first.`);
  const entries = JSON.parse(readFileSync(indexPath, 'utf8'));
  const bodies = {};
  for (const e of entries) bodies[e.slug] = JSON.parse(readFileSync(join(ROOT, `src/data/library/novels/${e.slug}.json`), 'utf8'));
  const sitemapPath = join(ROOT, 'public/sitemap.xml');
  const baseSitemap = existsSync(sitemapPath) ? readFileSync(sitemapPath, 'utf8') : '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n';
  const { files, sitemap } = buildSeoPages({ entries, bodies, baseSitemap });
  mkdirSync(join(dist, 'library'), { recursive: true });
  for (const [path, html] of Object.entries(files)) writeFileSync(join(dist, path), html);
  writeFileSync(join(dist, 'sitemap.xml'), sitemap);
  console.log(`seo pages: wrote ${Object.keys(files).length} library pages and the sitemap to ${dist}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
