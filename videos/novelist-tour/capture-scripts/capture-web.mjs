// Takes real screenshots of the website from the running app (local mode, demo novel from seed-data.mjs).
// Usage: node capture-web.mjs [shot-name ...]   (no names = every shot)
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import JSZip from 'jszip';
import { buildSeed, totalWords, USER_ID, PROJECT_ID } from './seed-data.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../capture/screenshots/web');
const BASE = process.env.APP_URL || 'http://localhost:5190';
mkdirSync(OUT, { recursive: true });

const only = new Set(process.argv.slice(2));
const seed = buildSeed(new Date());
console.log(`demo novel: ${totalWords(seed).toLocaleString()} words`);

const browser = await chromium.launch({ channel: 'msedge', args: ['--hide-scrollbars'] });

const newPage = async ({ theme = 'studio', clock = false, seedData = seed } = {}) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, acceptDownloads: true });
  // Nothing leaves this computer: only the app itself is allowed to load
  await context.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (r) => r.abort());
  await context.addInitScript(
    ({ data, theme }) => {
      if (!localStorage.getItem('__seeded')) {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem('novelist_theme_v2', theme);
        localStorage.setItem('__seeded', '1');
      }
    },
    { data: seedData, theme }
  );
  const page = await context.newPage();
  if (clock) await page.clock.install();
  return { page, context };
};

const settle = async (page, ms = 700) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
};

// Words for a realistic writing session: about 300 words of the book's own voice
const SESSION = [
  'The water had begun to speak in a language she half remembered, all sibilants and patience. Ada listened the way her mother had taught her to listen to the lamp, with her whole body and none of her hopes.',
  'The causeway ran ahead of her like a held breath, pale stones laid so long ago that nobody remembered the hands. Weed clung to the edges in dark fringes. Every step left a print that filled and shone and was gone.',
  'Wren had gone quiet, which was worse than his talking. He walked a pace behind her with his boots tied round his neck, watching the horizon as though it owed him a debt.',
  '“Do you hear it?” she said.',
  '“The bell?” He shrugged. “It rings for anyone who lies. You’ll hear it plenty, out here.”',
  'Ada thought of the tide table in her pocket, and of the handwriting that was not her mother’s, and she said nothing at all. Ahead of them the hill rose out of the haze, black and patient, with a single light burning in its crown.',
  'The first stones were dry and the next were not, and between them lay a hand’s width of sea that moved as though it were thinking. Ada put her boots on her shoulders and her faith in the table, and stepped across.',
  'Behind them the harbour had shrunk to a smear of roofs. The gulls had stopped following. Even the wind had gone somewhere else, and in its absence she could hear her own pulse, and under it, steady as a metronome, the slow patient pull of the water going out.',
  '“How long?” Wren asked.',
  '“Twenty-two minutes.” She did not need the book for that. She had been counting since the wall, the way you count between a flash and the thunder, and her body had learned to carry the number without being asked.',
  'He grinned, all teeth and no worry. “That’s plenty,” he said. “If the sea keeps its word.”',
  'But Ada had read the margin of the table, and in the margin, in the stranger’s small and careful hand, someone had written: it never does.',
  'Halfway across, the causeway widened into a platform of flat grey stones, and on it, as if it had been waiting, sat a single wooden chair facing the open sea. It was dry. Its seat was worn smooth by years of someone sitting very still.',
  'Ada did not sit in it. She laid her palm on the back of it instead, and the wood was warm, which was impossible, and she took her hand away as though she had been caught stealing.',
  'It was not yet evening. The lamp had no business being lit. She counted the waves in sevens, as she always did, and on the seventh the light went out, and in the dark the bell began to ring.',
].join('\n');

const shots = {
  async home() {
    const { page, context } = await newPage();
    await page.goto(`${BASE}/#/write`);
    await page.getByText('Welcome back').waitFor();
    await settle(page);
    await page.screenshot({ path: `${OUT}/01-home.png` });
    await context.close();
  },

  async editor() {
    const { page, context } = await newPage();
    await page.goto(`${BASE}/#/chapters`);
    await page.getByLabel('Reorder Lantern Hill').waitFor();
    await page.goto(`${BASE}/#/editor`);
    await page.locator('.ProseMirror').waitFor();
    await settle(page, 1200);
    await page.screenshot({ path: `${OUT}/02-editor.png` });
    await context.close();
  },

  async chapters() {
    const { page, context } = await newPage();
    await page.goto(`${BASE}/#/chapters`);
    await page.getByLabel('Reorder Lantern Hill').waitFor();
    await settle(page);
    await page.screenshot({ path: `${OUT}/03-chapters.png` });
    await context.close();
  },

  async notebook() {
    const { page, context } = await newPage();
    await page.goto(`${BASE}/#/notebook`);
    await page.getByText('Ada Marlow').first().waitFor();
    await settle(page);
    await page.screenshot({ path: `${OUT}/04-notebook.png` });
    await context.close();
  },

  async outline() {
    const { page, context } = await newPage();
    await page.goto(`${BASE}/#/outline`);
    await page.getByText('Wren on the wall').first().waitFor();
    await settle(page);
    await page.screenshot({ path: `${OUT}/05-outline-board.png` });
    // The same story laid out in reading order
    const timeline = page.getByRole('tab', { name: /timeline/i }).or(page.getByRole('button', { name: /timeline/i }));
    if (await timeline.count()) {
      await timeline.first().click();
      await settle(page);
      await page.screenshot({ path: `${OUT}/06-outline-timeline.png` });
    }
    await context.close();
  },

  async tracker() {
    const { page, context } = await newPage();
    await page.goto(`${BASE}/#/tracker`);
    await page.getByText('Writing sprints').waitFor();
    await settle(page, 1500);
    await page.screenshot({ path: `${OUT}/07-tracker.png` });
    await page.getByText('Writing sprints').first().scrollIntoViewIfNeeded();
    await settle(page, 600);
    await page.screenshot({ path: `${OUT}/07c-tracker-sprints.png` });
    await context.close();
  },

  async sprint() {
    // A fake clock so the countdown can be moved to a good moment, and the sprint can finish on cue
    const { page, context } = await newPage({ clock: true });
    await page.goto(`${BASE}/#/editor`);
    await page.locator('.ProseMirror').waitFor();
    await settle(page);
    await page.getByRole('button', { name: 'Start a writing sprint' }).click();
    const panel = page.getByRole('dialog', { name: 'Start a writing sprint' });
    await settle(page, 400);
    await page.screenshot({ path: `${OUT}/08a-sprint-start.png` });
    await panel.getByLabel(/Or your own length/).fill('25');
    await panel.getByLabel('Word goal (optional)').fill('400');
    await panel.getByRole('button', { name: 'Start', exact: true }).click();
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.press('Control+End');
    const lines = SESSION.split('\n');
    const firstHalf = lines.slice(0, 4).join('\n');
    const secondHalf = lines.slice(4).join('\n');
    const tidy = async () => {
      // Focus off the page and the chapter back at its title, so the shot shows the writing room and not a cursor
      await page.evaluate(() => {
        document.activeElement?.blur?.();
        for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) el.scrollTop = 0;
      });
      await settle(page, 700);
    };
    await page.keyboard.insertText('\n' + firstHalf);
    await page.keyboard.press('Enter');
    await page.clock.fastForward('04:10');
    await tidy();
    await page.screenshot({ path: `${OUT}/08b-sprint-running.png` });
    await page.getByRole('button', { name: /^Sprint 0?\d|Pause sprint/ }).first().waitFor().catch(() => undefined);
    await editor.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText(secondHalf);
    await page.clock.fastForward('21:00');
    await page.locator('.sprint-card').waitFor();
    await tidy();
    await page.screenshot({ path: `${OUT}/08c-sprint-done.png` });
    await context.close();
  },

  async import() {
    const { page, context } = await newPage();
    await page.goto(`${BASE}/#/manuscripts`);
    await page.getByRole('button', { name: 'Import', exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Import', exact: true }).first().click();
    await settle(page, 500);
    await page.screenshot({ path: `${OUT}/09a-import-choose.png` });

    // A Word file written the way Word writes them
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const run = (t, p = '') => `<w:r>${p ? `<w:rPr>${p}</w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
    const para = (inner, p = '') => `<w:p>${p ? `<w:pPr>${p}</w:pPr>` : ''}${inner}</w:p>`;
    const chapter = (title, text) => para(run(title), '<w:pStyle w:val="Heading1"/>') + text.map((t) => para(run(t))).join('');
    const body =
      para(run('The Lamp Year'), '<w:pStyle w:val="Title"/>') +
      para(run('by Iris Okafor'), '<w:pStyle w:val="Subtitle"/>') +
      chapter('Chapter 1: The Lamplighter’s Round', ['Before the first bell, before the milk and the news, Odile walked the length of Tanner Street with a brass pole over her shoulder.', 'Each lamp took her four seconds.', 'By the ninth lamp she had stopped being afraid of anything.']) +
      chapter('Chapter 2: A Street That Remembers', ['Tanner Street kept its own accounts.', 'The baker’s step was worn on the left because he always came in carrying something.']) +
      chapter('Chapter 3: Gas and Gossip', ['By Friday everyone had a theory.', 'The grocer said it was the pipes.', 'The child on the second floor said it was the lamp, which was offended.']) +
      chapter('Chapter 4: The Spare Mantle', ['Odile carried a spare mantle in her left pocket where a more sociable woman would have kept a handkerchief.']) +
      `<w:tbl><w:tr><w:tc>${para(run('Street map'))}</w:tc></w:tr></w:tbl>`;
    const styles = `<?xml version="1.0"?><w:styles ${W}>${[['Title', 'Title'], ['Subtitle', 'Subtitle'], ['Heading1', 'heading 1']].map(([id, n]) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${n}"/></w:style>`).join('')}</w:styles>`;
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`);
    zip.file('word/styles.xml', styles);
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await page.locator('dialog input[type=file]').setInputFiles({ name: 'the-lamp-year.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer });
    await page.locator('dialog[open]').getByLabel('Project title').waitFor();
    await settle(page, 600);
    await page.screenshot({ path: `${OUT}/09b-import-review.png` });
    await context.close();
  },

  async export() {
    const { page, context } = await newPage();
    await page.goto(`${BASE}/#/chapters`);
    await page.getByLabel('Reorder Lantern Hill').waitFor();
    await page.getByRole('button', { name: 'Export' }).click();
    await page.locator('dialog[open]').getByText('Word document').waitFor();
    await settle(page, 600);
    await page.screenshot({ path: `${OUT}/10-export.png` });
    await context.close();
  },

  async library() {
    const { page, context } = await newPage();
    await page.goto(`${BASE}/#/library`);
    await page.getByText('The Lamp Year').first().waitFor();
    await settle(page, 900);
    await page.screenshot({ path: `${OUT}/11-library.png` });
    await context.close();
  },

  async reader() {
    for (const [theme, label] of [['studio', 'light'], ['midnight', 'dark']]) {
      const { page, context } = await newPage({ theme });
      await page.goto(`${BASE}/#/library`);
      await page.getByText('The Lamp Year').first().waitFor();
      await page.goto(`${BASE}/#/library/novel/p1`);
      await page.getByRole('heading', { name: 'The Lamplighter’s Round' }).waitFor();
      if (label === 'dark') await page.getByRole('button', { name: 'Dark', exact: true }).click();
      await settle(page, 900);
      await page.screenshot({ path: `${OUT}/12-reader-${label}.png` });
      await context.close();
    }
  },

  async readerHome() {
    const { page, context } = await newPage();
    await page.goto(`${BASE}/#/read`);
    await page.getByText('Continue reading').waitFor();
    await settle(page, 900);
    await page.screenshot({ path: `${OUT}/13-reader-home.png` });
    await context.close();
  },

  async themes() {
    const { page, context } = await newPage();
    await page.goto(`${BASE}/#/preferences`);
    await page.getByText('Midnight Reading Nook').waitFor();
    // Bring the theme cards to the top of the screen
    await page.getByRole('heading', { name: 'Theme', exact: true }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await settle(page);
    await page.screenshot({ path: `${OUT}/14-themes.png` });
    await context.close();
  },

  async zen() {
    const { page, context } = await newPage();
    await page.goto(`${BASE}/#/chapters`);
    await page.getByLabel('Reorder Lantern Hill').waitFor();
    await page.goto(`${BASE}/#/editor`);
    await page.locator('.ProseMirror').waitFor();
    await page.getByRole('button', { name: /focus mode/i }).click();
    await settle(page, 900);
    await page.screenshot({ path: `${OUT}/15-zen.png` });
    await context.close();
  },

  async dark() {
    // The studio in the dark theme: the editor, for the closing scenes
    const { page, context } = await newPage({ theme: 'midnight' });
    await page.goto(`${BASE}/#/chapters`);
    await page.getByLabel('Reorder Lantern Hill').waitFor();
    await page.goto(`${BASE}/#/editor`);
    await page.locator('.ProseMirror').waitFor();
    await settle(page, 1200);
    await page.screenshot({ path: `${OUT}/16-editor-dark.png` });
    await context.close();
  },
};

for (const [name, fn] of Object.entries(shots)) {
  if (only.size && !only.has(name)) continue;
  try {
    await fn();
    console.log('ok   ', name);
  } catch (error) {
    console.log('FAIL ', name, '-', String(error.message).split('\n')[0]);
  }
}
await browser.close();
writeFileSync(path.resolve(HERE, '../capture/screenshots/web/_seed-info.json'), JSON.stringify({ user: USER_ID, project: PROJECT_ID, words: totalWords(seed) }, null, 2));
