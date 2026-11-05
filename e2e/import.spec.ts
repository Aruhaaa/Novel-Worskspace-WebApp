import JSZip from 'jszip';
import { expect, test } from './fixtures';
import { addChapter, createProject, signIn, typeInEditor, waitForSaved } from './helpers';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const run = (text: string, props = '') => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const para = (inner: string, props = '') => `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${inner}</w:p>`;

/** A small Word file written the way Word writes them: styles by id, split runs, a tracked change, a table, an image. */
const wordFile = async (): Promise<Buffer> => {
  const body = [
    para(run('Harbour Lights'), '<w:pStyle w:val="Title"/>'),
    para(run('by Mira Vale'), '<w:pStyle w:val="Subtitle"/>'),
    para(run('Part One: Arrivals'), '<w:pStyle w:val="Heading1"/>'),
    para(run('The first morning ') + run('was cold', '<w:i/>') + run(' and ') + run('bright', '<w:b/>') + run('.')),
    para('<w:ins w:id="1" w:author="Ed"><w:r><w:t xml:space="preserve">Added by the editor. </w:t></w:r></w:ins><w:del w:id="2" w:author="Ed"><w:r><w:delText>Deleted words. </w:delText></w:r></w:del>' + run('Kept after the edit.')),
    para(run('First item'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
    para(run('Second item'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
    para(run('* * *'), '<w:jc w:val="center"/>'),
    para(run('After the break, a ') + '<w:r><w:drawing/></w:r>' + run('picture was here.')),
    `<w:tbl><w:tr><w:tc>${para(run('Cell one'))}</w:tc><w:tc>${para(run('Cell two'))}</w:tc></w:tr></w:tbl>`,
    para(run('Part Two: Departures'), '<w:pStyle w:val="Heading1"/>'),
    para(run('Everyone left by the evening boat.')),
  ].join('');
  const styles = `<?xml version="1.0" encoding="UTF-8"?><w:styles ${W}>${[
    ['Title', 'Title'],
    ['Subtitle', 'Subtitle'],
    ['Heading1', 'heading 1'],
  ]
    .map(([id, name]) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/></w:style>`)
    .join('')}</w:styles>`;
  const numbering = `<?xml version="1.0" encoding="UTF-8"?><w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`);
  zip.file('word/styles.xml', styles);
  zip.file('word/numbering.xml', numbering);
  return zip.generateAsync({ type: 'nodebuffer' });
};

const TEXT_BOOK = ['The Salt Road', 'by Mira Vale', '', 'Chapter 1: The Harbour', '', 'The boats came in before dawn.', 'Nobody on the quay spoke.', '', '* * *', '', 'Ada counted the nets twice.', '', 'Chapter 2: The Letter', '', '"It came by sea," she said.', '', 'Chapter 3: The Tide', '', 'The water kept rising.'].join('\r\n');

test.describe('import a manuscript', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'writer@example.com');
  });

  test('a plain-text book becomes a new project with its chapters, and Undo takes it away', async ({ page }) => {
    await page.goto('/#/manuscripts');
    await page.getByRole('button', { name: 'Import', exact: true }).first().click();
    await page.locator('dialog input[type=file]').setInputFiles({ name: 'salt-road.txt', mimeType: 'text/plain', buffer: Buffer.from(TEXT_BOOK) });

    const dialog = page.locator('dialog[open]');
    await expect(dialog.getByLabel('Project title')).toHaveValue('The Salt Road');
    await expect(dialog.getByLabel('Author (optional)')).toHaveValue('Mira Vale');
    await expect(dialog.getByRole('status').filter({ hasText: '3 chapters' })).toBeVisible();
    await expect(dialog.getByLabel('Title of chapter 1')).toHaveValue('The Harbour');

    await dialog.getByRole('button', { name: 'Import 3 chapters' }).click();
    await expect(page).toHaveURL(/#\/chapters/);
    await expect(page.getByText('Imported 3 chapters (26 words).')).toBeVisible();
    await expect(page.getByLabel('Reorder The Harbour')).toBeVisible();
    await expect(page.getByLabel('Reorder The Letter')).toBeVisible();
    await expect(page.getByLabel('Reorder The Tide')).toBeVisible();

    // What was stored: paragraphs, and the scene break kept as a rule
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('novel_chapters') ?? '[]').map((c: { title: string; content: string }) => [c.title, c.content]));
    expect(stored).toContainEqual(['The Harbour', '<p>The boats came in before dawn. Nobody on the quay spoke.</p><hr><p>Ada counted the nets twice.</p>']);

    // Imported words are not "written today"
    const logged = await page.evaluate(() => JSON.parse(localStorage.getItem('novel_word_logs') ?? '[]').filter((l: { project_id: string }) => !l.project_id.includes('mock')).map((l: { word_count: number }) => l.word_count));
    expect(logged.filter((n: number) => n > 0)).toEqual([]);

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('The import has been undone.')).toBeVisible();
    const left = await page.evaluate(() => JSON.parse(localStorage.getItem('novel_projects') ?? '[]').map((p: { title: string }) => p.title));
    expect(left).not.toContain('The Salt Road');
  });

  test('a Word file is added to an open novel, with its formatting, and what could not come across is listed', async ({ page }) => {
    await createProject(page, 'My Novel');
    await page.goto('/#/chapters');
    await page.getByRole('button', { name: 'Import chapters' }).click();
    await page.locator('dialog input[type=file]').setInputFiles({ name: 'harbour-lights.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await wordFile() });

    const dialog = page.locator('dialog[open]');
    await expect(dialog.getByText('will be the first in “My Novel”')).toBeVisible();
    await expect(dialog.getByRole('status').filter({ hasText: '2 chapters' })).toBeVisible();
    await expect(dialog.getByText('1 image was skipped')).toBeVisible();
    await expect(dialog.getByText('1 table was turned into plain paragraphs')).toBeVisible();
    await dialog.getByRole('button', { name: 'Import 2 chapters' }).click();

    await expect(page.getByLabel('Reorder Part One: Arrivals')).toBeVisible();
    await expect(page.getByLabel('Reorder Part Two: Departures')).toBeVisible();
    const html = await page.evaluate(() => JSON.parse(localStorage.getItem('novel_chapters') ?? '[]').find((c: { title: string }) => c.title === 'Part One: Arrivals')?.content as string);
    expect(html).toContain('<em>was cold</em>');
    expect(html).toContain('<strong>bright</strong>');
    expect(html).toContain('<ul><li><p>First item</p></li><li><p>Second item</p></li></ul>');
    expect(html).toContain('<hr>');
    // A tracked insertion is kept and a tracked deletion is not
    expect(html).toContain('Added by the editor. Kept after the edit.');
    expect(html).not.toContain('Deleted words');
  });

  test('files that cannot be imported say why, in plain words', async ({ page }) => {
    await page.goto('/#/manuscripts');
    await page.getByRole('button', { name: 'Import', exact: true }).first().click();
    const input = page.locator('dialog input[type=file]');
    const alert = page.locator('dialog[open]').getByRole('alert');

    await input.setInputFiles({ name: 'old.doc', mimeType: 'application/msword', buffer: Buffer.from('binary') });
    await expect(alert).toContainText('older Word .doc');

    await input.setInputFiles({ name: 'fake.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('this is not a zip file') });
    await expect(alert).toContainText('does not look like a Word .docx');

    await input.setInputFiles({ name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.from('') });
    await expect(alert).toContainText('No text was found');

    await input.setInputFiles({ name: 'book.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
    await expect(alert).toContainText('PDF');
  });

  test('markdown comes across safely: scripts and unsafe links are neutralised', async ({ page }) => {
    await page.goto('/#/manuscripts');
    await page.getByRole('button', { name: 'Import', exact: true }).first().click();
    const md = ['---', 'title: Glass Orchard', 'author: Tom Reyes', '---', '', '# The Orchard', '', 'She walked **slowly**. See [the map](https://example.com/map) or [bad](javascript:alert(1)).', '', '<script>alert(1)</script>', '', '# The Wall', '', 'Behind it, fog.'].join('\n');
    await page.locator('dialog input[type=file]').setInputFiles({ name: 'orchard.md', mimeType: 'text/markdown', buffer: Buffer.from(md) });
    const dialog = page.locator('dialog[open]');
    await expect(dialog.getByLabel('Project title')).toHaveValue('Glass Orchard');
    await dialog.getByRole('button', { name: /^Import \d+ chapters?$/ }).click();
    await expect(page).toHaveURL(/#\/chapters/);
    const html = await page.evaluate(() => JSON.parse(localStorage.getItem('novel_chapters') ?? '[]').map((c: { content: string }) => c.content).join('|'));
    expect(html).toContain('<strong>slowly</strong>');
    expect(html).toContain('href="https://example.com/map"');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });

  test("the app's own Word export can be imported straight back", async ({ page }, testInfo) => {
    // Make a small book by importing text, then export it as Word and bring that file back in
    await page.goto('/#/manuscripts');
    await page.getByRole('button', { name: 'Import', exact: true }).first().click();
    await page.locator('dialog input[type=file]').setInputFiles({ name: 'salt-road.txt', mimeType: 'text/plain', buffer: Buffer.from(TEXT_BOOK) });
    await page.locator('dialog[open]').getByRole('button', { name: 'Import 3 chapters' }).click();
    await expect(page).toHaveURL(/#\/chapters/);

    await page.getByRole('button', { name: 'Export' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('dialog[open]').getByRole('button', { name: /Word document/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('the_salt_road.docx');
    // Saved under its real name: the importer goes by the file extension
    const path = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(path);
    await page.keyboard.press('Escape');

    await page.goto('/#/manuscripts');
    await page.getByRole('button', { name: 'Import', exact: true }).first().click();
    await page.locator('dialog input[type=file]').setInputFiles(path);
    const dialog = page.locator('dialog[open]');
    await expect(dialog.getByLabel('Project title')).toHaveValue('The Salt Road');
    await expect(dialog.getByRole('status').filter({ hasText: '3 chapters' })).toBeVisible();
    // "Chapter 1: The Harbour" in the file comes back as the chapter title "The Harbour"
    await expect(dialog.getByLabel('Title of chapter 1')).toHaveValue('The Harbour');
    await expect(dialog.getByLabel('Title of chapter 3')).toHaveValue('The Tide');
  });

  test('importing does not count as writing today, but typing afterwards does', async ({ page }) => {
    await page.goto('/#/manuscripts');
    await page.getByRole('button', { name: 'Import', exact: true }).first().click();
    await page.locator('dialog input[type=file]').setInputFiles({ name: 'salt-road.txt', mimeType: 'text/plain', buffer: Buffer.from(TEXT_BOOK) });
    await page.locator('dialog[open]').getByRole('button', { name: 'Import 3 chapters' }).click();
    await expect(page).toHaveURL(/#\/chapters/);
    await page.getByLabel('Reorder The Tide').click({ trial: true }).catch(() => undefined);
    await page.goto('/#/editor');
    await typeInEditor(page, ' Then it stopped.');
    await waitForSaved(page, 'Then it stopped.');
    const today = await page.evaluate(() => JSON.parse(localStorage.getItem('novel_word_logs') ?? '[]').filter((l: { project_id: string }) => !l.project_id.includes('mock')).map((l: { word_count: number }) => l.word_count));
    // Only the three new words count, never the 26 that were imported
    expect(today).toEqual([3]);
  });
});

test('a chapter written by hand and one imported sit together in the index in order', async ({ page }) => {
  await signIn(page, 'writer@example.com');
  await createProject(page, 'Mixed');
  await addChapter(page, 'Written by hand');
  await page.goto('/#/chapters');
  await page.getByRole('button', { name: 'Import chapters' }).click();
  await page.locator('dialog input[type=file]').setInputFiles({ name: 'more.txt', mimeType: 'text/plain', buffer: Buffer.from('Chapter 1: Imported One\n\nSome text.\n\nChapter 2: Imported Two\n\nMore text.') });
  await page.locator('dialog[open]').getByRole('button', { name: 'Import 2 chapters' }).click();
  const titles = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('novel_chapters') ?? '[]')
      .filter((c: { title: string }) => ['Written by hand', 'Imported One', 'Imported Two'].includes(c.title))
      .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
      .map((c: { title: string; position: number }) => `${c.position}:${c.title}`)
  );
  expect(titles).toEqual(['0:Written by hand', '1:Imported One', '2:Imported Two']);
});
