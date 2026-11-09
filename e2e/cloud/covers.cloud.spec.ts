import { expect, test, type Page } from '@playwright/test';
import { anonClient, makeAccount, makeProject, openAs, openAsVisitor, PASSWORD, publishNovel, sql, liteUrl } from './helpers';

// Uploading a cover picture through the real app to the storage service (supabase/setup_scripts/20261106_cover_uploads.sql): the picture
// is shrunk, stored in the person's own folder, shown from its public address, and the old file is removed when it is replaced.

const makePicture = async (page: Page, width: number, height: number) => {
  const base64 = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext('2d')!;
      const grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#1f6f78');
      grad.addColorStop(1, '#8c2f39');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      return canvas.toDataURL('image/png').split(',')[1];
    },
    [width, height] as const,
  );
  return { name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
};

const coverOf = async (testInfo: import('@playwright/test').TestInfo, projectId: string) =>
  (await sql<{ cover_url: string | null }>(testInfo, 'select cover_url from public.projects where id = $1', [projectId]))[0].cover_url ?? '';

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0]);

test.describe('cover pictures, through the server', () => {
  test('a picture goes to the person\'s own folder, shows from its address, and a replaced or removed one is deleted', async ({ browser }, testInfo) => {
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const project = await makeProject(ben, 'Covered Tale');
    const page = await openAs(browser, testInfo, ben);

    const openDetails = async () => {
      await page.goto('/#/manuscripts');
      await page.getByRole('article').filter({ hasText: 'Covered Tale' }).getByRole('button', { name: 'Edit details' }).click();
      await expect(page.locator('#ps-h')).toHaveText('Covered Tale');
    };

    // A big photo goes up, and the novel's cover becomes the address of a small file in Ben's folder
    await openDetails();
    await page.getByTestId('cover-file').setInputFiles(await makePicture(page, 2000, 3000));
    await expect(page.locator('.cover-picker-preview img')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#ps-h')).toHaveCount(0);

    const first = await coverOf(testInfo, project.id);
    expect(first).toMatch(new RegExp(`/storage/v1/object/public/covers/${ben.id}/[0-9a-f-]{36}\\.jpg$`));
    const firstFile = await page.request.get(first);
    expect(firstFile.status()).toBe(200);
    expect(firstFile.headers()['content-type']).toBe('image/jpeg');
    const bytes = await firstFile.body();
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes.length).toBeLessThan(400_000);
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    await expect(page.getByRole('article').filter({ hasText: 'Covered Tale' }).locator('img.cover-mini')).toHaveAttribute('src', first);
    // The picture really arrives in the page, not just the address
    await expect.poll(() => page.locator('img.cover-mini').first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(800);

    // Replaced: the new file is in use and the old one is gone
    await openDetails();
    await page.getByTestId('cover-file').setInputFiles(await makePicture(page, 900, 1200));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#ps-h')).toHaveCount(0);
    const second = await coverOf(testInfo, project.id);
    expect(second).not.toBe(first);
    expect((await page.request.get(second)).status()).toBe(200);
    await expect.poll(async () => (await page.request.get(first)).status()).toBe(404);

    // Removed: no cover, and that file is gone too
    await openDetails();
    await page.getByRole('button', { name: 'Remove picture' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#ps-h')).toHaveCount(0);
    expect(await coverOf(testInfo, project.id)).toBe('');
    await expect.poll(async () => (await page.request.get(second)).status()).toBe(404);
    expect(Number((await sql<{ n: string }>(testInfo, "select count(*) as n from storage.objects where bucket_id = 'covers' and name like $1", [`${ben.id}/%`]))[0].n)).toBe(0);
  });

  test('closing the form without saving sends nothing', async ({ browser }, testInfo) => {
    const ann = await makeAccount(testInfo, 'Ann', 'write');
    await makeProject(ann, 'Unsent Tale');
    const page = await openAs(browser, testInfo, ann);
    await page.goto('/#/manuscripts');
    await page.getByRole('article').filter({ hasText: 'Unsent Tale' }).getByRole('button', { name: 'Edit details' }).click();
    await page.getByTestId('cover-file').setInputFiles(await makePicture(page, 600, 900));
    await expect(page.locator('.cover-picker-preview img')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(Number((await sql<{ n: string }>(testInfo, "select count(*) as n from storage.objects where bucket_id = 'covers' and name like $1", [`${ann.id}/%`]))[0].n)).toBe(0);
  });

  test('deleting the account takes the person\'s uploaded covers with it', async ({ browser }, testInfo) => {
    const fay = await makeAccount(testInfo, 'Fay', 'write');
    await makeProject(fay, 'Soon Gone Tale');
    const page = await openAs(browser, testInfo, fay);
    await page.goto('/#/manuscripts');
    await page.getByRole('article').filter({ hasText: 'Soon Gone Tale' }).getByRole('button', { name: 'Edit details' }).click();
    await page.getByTestId('cover-file').setInputFiles(await makePicture(page, 600, 900));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#ps-h')).toHaveCount(0);
    // A second file she uploaded some other way, still in her folder
    expect((await fay.api.storage.from('covers').upload(`${fay.id}/extra.jpg`, jpegBytes, { contentType: 'image/jpeg' })).error).toBeNull();
    const filesOf = async () => Number((await sql<{ n: string }>(testInfo, "select count(*) as n from storage.objects where bucket_id = 'covers' and name like $1", [`${fay.id}/%`]))[0].n);
    expect(await filesOf()).toBe(2);

    await page.goto('/#/preferences');
    await page.getByRole('button', { name: 'Delete my account…' }).click();
    const dialog = page.locator('dialog[open]');
    await dialog.getByLabel('Password').fill(PASSWORD);
    await dialog.getByLabel(/^Type DELETE/).fill('DELETE');
    await dialog.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page).toHaveURL(/#\/(login)?$/);

    expect((await sql(testInfo, 'select 1 from public.projects where user_id = $1', [fay.id])).length).toBe(0);
    await expect.poll(filesOf).toBe(0);
  });

  test('a published novel\'s cover shows in the library, and only the owner can write into their folder', async ({ browser }, testInfo) => {
    const cleo = await makeAccount(testInfo, 'Cleo', 'write');
    const dan = await makeAccount(testInfo, 'Dan', 'write');
    const novel = await publishNovel(cleo, 'Public Tale');

    // Cleo sets the cover from the app
    const cleoPage = await openAs(browser, testInfo, cleo);
    await cleoPage.goto('/#/manuscripts');
    await cleoPage.getByRole('article').filter({ hasText: 'Public Tale' }).getByRole('button', { name: 'Edit details' }).click();
    await cleoPage.getByTestId('cover-file').setInputFiles(await makePicture(cleoPage, 800, 1200));
    await cleoPage.getByRole('button', { name: 'Save changes' }).click();
    await expect(cleoPage.locator('#ps-h')).toHaveCount(0);
    const url = await coverOf(testInfo, novel.id);
    expect(url).toContain(`/covers/${cleo.id}/`);

    // Another signed-in person sees it on the novel's card in the library, and a visitor with no account can fetch the file
    const danPage = await openAs(browser, testInfo, dan);
    await danPage.goto('/#/library');
    await expect(danPage.locator(`[style*="${url}"]`).first()).toBeVisible();
    const visitor = await openAsVisitor(browser, testInfo);
    expect((await visitor.request.get(url)).status()).toBe(200);

    // The database's rules, as other people meet them through the storage service
    const store = (client: ReturnType<typeof anonClient>) => client.storage.from('covers');
    const stranger = anonClient(testInfo);
    expect((await store(stranger).upload(`${cleo.id}/anon.jpg`, jpegBytes, { contentType: 'image/jpeg' })).error).not.toBeNull();
    expect((await store(dan.api).upload(`${cleo.id}/sneaky.jpg`, jpegBytes, { contentType: 'image/jpeg' })).error).not.toBeNull();
    expect((await store(dan.api).upload(`${dan.id}/mine.jpg`, jpegBytes, { contentType: 'image/jpeg' })).error).toBeNull();
    expect((await store(dan.api).upload(`${dan.id}/notes.txt`, new TextEncoder().encode('hello'), { contentType: 'text/plain' })).error).not.toBeNull();
    expect((await store(dan.api).upload(`${dan.id}/mine.jpg`, jpegBytes, { contentType: 'image/jpeg' })).error).not.toBeNull(); // already there, and no replacing without asking
    // Dan cannot remove Cleo's cover; the picture is still served
    const name = url.split('/covers/')[1];
    await store(dan.api).remove([name]);
    expect((await visitor.request.get(url)).status()).toBe(200);
    expect(liteUrl(testInfo)).toContain('127.0.0.1');
  });
});
