// The plain library pages (scripts/build-seo-pages.mjs): what a search engine reads from them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeoPages, excerptOf, paragraphsOf, decodeEntities, clip, esc, genreClass, SITE, PUBLISHER } from '../build-seo-pages.mjs';

const para = (n, word) => `<p>${Array.from({ length: n }, () => word).join(' ')}.</p>`;

const entry = (slug, title, genre, extra = {}) => ({
  id: `bundled-${slug}`,
  slug,
  title,
  author: 'A. Writer',
  genre,
  subgenre: 'sub',
  tagline: 'A tagline.',
  description: 'A description of the book.',
  tags: ['one', 'two'],
  contentNotes: 'Peril.',
  chapters: 2,
  words: 60400,
  updatedAt: '2026-09-25T00:00:00.000Z',
  ...extra,
});

const BASE = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${SITE}/</loc>\n  </url>\n</urlset>\n`;

test('text helpers: entities, paragraphs, excerpt, clip, escape', () => {
  assert.equal(decodeEntities('Tom &amp; Jerry &#8217;s &mdash; ok &unknown;'), 'Tom & Jerry ’s — ok &unknown;');
  assert.deepEqual(paragraphsOf('<p>One <em>two</em></p>\n<p></p><p>Three &amp; four</p>'), ['One two', 'Three & four']);
  // whole paragraphs until at least the limit
  const html = para(300, 'a') + para(300, 'b') + para(300, 'c');
  const { paragraphs, words } = excerptOf(html, 600);
  assert.equal(paragraphs.length, 2);
  assert.equal(words, 600);
  assert.equal(excerptOf('<p>short</p>', 600).paragraphs.length, 1);
  assert.equal(clip('x '.repeat(200), 50).endsWith('…'), true);
  assert.ok(clip('x '.repeat(200), 50).length <= 50);
  assert.equal(esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(genreClass('Sci-Fi'), 'g-sci-fi');
});

test('a library index and one page for each novel, with a sitemap', () => {
  const entries = [entry('b-book', 'B Book', 'Mystery'), entry('a-book', 'A Book', 'Fantasy'), entry('c-book', 'C Book', 'Fantasy')];
  const bodies = Object.fromEntries(
    entries.map((e) => [e.slug, { chapters: [{ title: 'The start', html: para(300, 'alpha') + para(300, 'beta') + para(300, 'gamma') }, { title: 'The end', html: para(20, 'x') }] }])
  );
  const { files, sitemap } = buildSeoPages({ entries, bodies, baseSitemap: BASE });

  assert.deepEqual(Object.keys(files).sort(), ['library/a-book.html', 'library/b-book.html', 'library/c-book.html', 'library/index.html']);

  const index = files['library/index.html'];
  assert.match(index, /<link rel="canonical" href="https:\/\/novelistworkspace\.kakamond\.com\/library\/" \/>/);
  for (const e of entries) assert.ok(index.includes(`href="/library/${e.slug}.html"`), `index links ${e.slug}`);
  assert.ok(index.indexOf('Fantasy') < index.indexOf('Mystery'), 'genres are in order');
  assert.ok(index.includes(PUBLISHER));

  const page = files['library/a-book.html'];
  assert.match(page, /<title>A Book by A\. Writer \| Novelist Workspace<\/title>/);
  assert.match(page, /rel="canonical" href="https:\/\/novelistworkspace\.kakamond\.com\/library\/a-book\.html"/);
  assert.match(page, /"@type":"Book"/);
  assert.ok(page.includes('href="/#/library/novel/bundled-a-book"'), 'the button opens the novel in the app');
  assert.ok(page.includes('Sample novel'));
  assert.ok(page.includes('<li>The start</li>') && page.includes('<li>The end</li>'), 'chapter titles are listed');
  assert.ok(page.includes('60k words') || page.includes('60k'), 'words are rounded');
  assert.ok(page.includes('More in Fantasy') && page.includes('C Book'), 'other novels of the genre are linked');
  assert.ok(!page.includes('More in Mystery'));
  // the excerpt is the first chapter's start (the first 600 words, in whole paragraphs), not the whole of it
  assert.ok(page.includes('alpha') && page.includes('beta'), 'the start is shown');
  assert.ok(!page.includes('gamma'), 'the rest of the chapter is not');
  assert.ok(page.includes('prev') && page.includes('rel="next"'));

  // the sitemap keeps what was there and adds the library and every novel once
  assert.ok(sitemap.includes(`<loc>${SITE}/</loc>`));
  assert.ok(sitemap.includes(`<loc>${SITE}/library/</loc>`));
  for (const e of entries) assert.equal(sitemap.split(`<loc>${SITE}/library/${e.slug}.html</loc>`).length - 1, 1);
  assert.ok(sitemap.trim().endsWith('</urlset>'));
  // running it on its own output adds nothing twice
  assert.equal(buildSeoPages({ entries, bodies, baseSitemap: sitemap }).sitemap, sitemap);
});

test('text from a novel cannot break out of the page', () => {
  const evil = entry('evil', 'Tom <script>alert(1)</script> & "Jerry"', 'Horror', { author: '</title><b>x</b>', description: '"><img src=x onerror=alert(1)>' });
  const bodies = { evil: { chapters: [{ title: '<i>one</i>', html: '<p>He said <b>hi</b> & left.</p><p><script>bad()</script>real</p>' }] } };
  const { files } = buildSeoPages({ entries: [evil], bodies, baseSitemap: BASE });
  const page = files['library/evil.html'];
  assert.ok(!/<script>alert/.test(page), 'no script from the title');
  assert.ok(!page.includes('<img src=x'), 'no tag from the description');
  assert.ok(!page.includes('<b>x</b>'), 'no tag from the author');
  assert.ok(page.includes('He said hi &amp; left.'));
  // the structured data cannot close its own script tag
  const ld = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.ok(!ld.includes('</'), 'structured data has no closing tag inside');
  assert.doesNotThrow(() => JSON.parse(ld));
});

test('a novel with no chapters still gets a page that leads into the app', () => {
  const e = entry('empty', 'Empty', 'Romance', { chapters: 0, tags: [], contentNotes: '' });
  const { files } = buildSeoPages({ entries: [e], bodies: { empty: { chapters: [] } }, baseSitemap: BASE });
  const page = files['library/empty.html'];
  assert.ok(page.includes('Read it in the app'));
  assert.ok(!page.includes('Contents'));
  assert.ok(!page.includes('Content notes'));
});
