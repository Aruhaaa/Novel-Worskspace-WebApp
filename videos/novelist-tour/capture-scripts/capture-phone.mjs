// Takes real screenshots of the phone app (its web build, at phone size) loaded with the demo novel.
// Usage: node capture-phone.mjs explore      (prints what the screen offers, for building the steps)
//        node capture-phone.mjs [shot ...]   (no names = every shot)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildPhoneSeed } from './phone-seed.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../capture/screenshots/phone');
const BASE = process.env.PHONE_URL || 'http://127.0.0.1:5191';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', args: ['--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-gl=swiftshader'] });
const seed = buildPhoneSeed(new Date());

const open = async ({ theme } = {}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  // Only the app itself, and the font service it uses for reading typefaces
  await context.route((url) => !['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname), (r) => r.abort());
  await context.addInitScript(
    ({ data, theme }) => {
      if (!localStorage.getItem('__seeded')) {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        if (theme) localStorage.setItem('flutter.theme', JSON.stringify(theme));
        localStorage.setItem('__seeded', '1');
      }
    },
    { data: seed, theme }
  );
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [page error]', m.text().slice(0, 160)); });
  await page.goto(BASE);
  // Flutter draws to a canvas; switching on its accessibility layer gives real elements to find and tap
  await page.waitForSelector('flt-semantics-placeholder, flt-glass-pane', { state: 'attached', timeout: 60000 });
  await page.evaluate(() => document.querySelector('flt-semantics-placeholder')?.click());
  await page.waitForTimeout(2500);
  return { page, context };
};

// Each element on screen, with the text it shows (own text) or the label it announces
const NODES = `[...document.querySelectorAll('flt-semantics')].map((n) => {
  const own = [...n.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join(' ');
  const text = ((n.getAttribute('aria-label') || '') + ' ' + own).replace(/\s+/g, ' ').trim();
  const r = n.getBoundingClientRect();
  return { role: n.getAttribute('role') || '', text, x: r.x, y: r.y, w: r.width, h: r.height };
}).filter((n) => n.text && n.w > 4 && n.h > 4)`;

const labels = (page) => page.evaluate(`(${'() => ' + NODES})()`);

if (process.argv[2] === 'explore') {
  const { page, context } = await open();
  console.log(JSON.stringify(await labels(page), null, 1));
  await page.screenshot({ path: `${OUT}/_explore.png` });
  await context.close();
  await browser.close();
  process.exit(0);
}

const settle = (page, ms = 900) => page.waitForTimeout(ms);

// Tap the on-screen element whose text or label matches
const tap = async (page, match, { index = 0 } = {}) => {
  const rx = match instanceof RegExp ? match : new RegExp(match);
  const hits = (await labels(page)).filter((n) => rx.test(n.text));
  const hit = hits[index];
  if (!hit) throw new Error(`nothing on screen matches ${rx}`);
  await page.touchscreen.tap(hit.x + hit.w / 2, hit.y + hit.h / 2);
  await settle(page, 1100);
};

const tapAt = async (page, x, y) => {
  await page.touchscreen.tap(x, y);
  await settle(page, 1200);
};

const show = async (page) => console.log(JSON.stringify((await labels(page)).map((n) => `${n.role}:${n.text.slice(0, 40)}`)));

const shot = async (page, name) => {
  await settle(page, 700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
};

const shots = {
  async read() {
    const { page, context } = await open();
    await shot(page, 'p01-discover');
    await tap(page, /^The Lamp Year/, { index: 0 });
    await shot(page, 'p02-novel');
    await tap(page, /Continue: chapter 2/);
    await shot(page, 'p03-reader');
    await context.close();
  },

  async saved() {
    const { page, context } = await open();
    await tap(page, /^Saved/);
    await shot(page, 'p04-saved');
    await context.close();
  },

  async write() {
    const { page, context } = await open();
    await tap(page, /^Write$/);
    await shot(page, 'p05-write');
    await tapAt(page, 195, 200);
    await shot(page, 'p06-project');
    // The chapter editor
    await tap(page, /Lantern Hill/);
    await settle(page, 1500);
    await shot(page, 'p07-editor');
    await context.close();
  },

  async notebook() {
    const { page, context } = await open();
    await tap(page, /^Write$/);
    await tapAt(page, 195, 200);
    await tap(page, /^Notebook$/);
    await settle(page, 1200);
    await shot(page, 'p08-notebook');
    await context.close();
  },

  async progress() {
    const { page, context } = await open();
    await tap(page, /^Write$/);
    await tapAt(page, 195, 200);
    await tapAt(page, 348, 134);
    await settle(page, 1500);
    await shot(page, 'p09-progress');
    await context.close();
  },

  async me() {
    const { page, context } = await open();
    await tap(page, /^Me$/);
    await shot(page, 'p10-me');
    await tap(page, /Midnight Reading Nook/);
    await shot(page, 'p11-me-dark');
    await tap(page, /^Read$/);
    await shot(page, 'p12-discover-dark');
    await context.close();
  },
};

const wanted = process.argv.slice(2);
for (const [name, fn] of Object.entries(shots)) {
  if (wanted.length && !wanted.includes(name)) continue;
  try {
    await fn();
    console.log('ok   ', name);
  } catch (error) {
    console.log('FAIL ', name, '-', String(error.message).split('\n')[0]);
  }
}
await browser.close();
