import { expect, test } from '@playwright/test';
import { makeAccount, makeProject, openAs, sql } from './helpers';

// The website is updated before the cover uploads database script is run: there is no "covers" bucket. Choosing a picture must not lose
// anything the person typed, must say what is wrong, and a link to a picture must still work.

test.describe('before the cover uploads setup has been run', () => {
  test('a picture cannot be saved yet, the reason is shown, the form keeps its words, and a link still works', async ({ browser }, testInfo) => {
    const eve = await makeAccount(testInfo, 'Eve', 'write');
    const project = await makeProject(eve, 'Early Cover Tale');
    expect((await sql(testInfo, "select 1 from storage.buckets where id = 'covers'")).length).toBe(0);

    const page = await openAs(browser, testInfo, eve);
    await page.goto('/#/manuscripts');
    await page.getByRole('article').filter({ hasText: 'Early Cover Tale' }).getByRole('button', { name: 'Edit details' }).click();
    await page.getByLabel('Synopsis').fill('A new synopsis typed before the picture');
    const base64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 600;
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#336699';
      g.fillRect(0, 0, 400, 600);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.getByTestId('cover-file').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Picture upload is not switched on for this site yet.' })).toBeVisible();
    // Still open, nothing lost, nothing half-saved
    await expect(page.getByLabel('Synopsis')).toHaveValue('A new synopsis typed before the picture');
    const row = (await sql<{ description: string; cover_url: string | null }>(testInfo, 'select description, cover_url from public.projects where id = $1', [project.id]))[0];
    expect(row.description).not.toBe('A new synopsis typed before the picture');
    expect(row.cover_url ?? '').toBe('');

    // Pasting a link works as it always did
    await page.getByRole('button', { name: 'Remove picture' }).click();
    await page.getByText('Use a link to a picture instead').click();
    await page.getByLabel('Cover image URL').fill('http://127.0.0.1:1/cover.png');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#ps-h')).toHaveCount(0);
    const saved = (await sql<{ description: string; cover_url: string | null }>(testInfo, 'select description, cover_url from public.projects where id = $1', [project.id]))[0];
    expect(saved.cover_url).toBe('http://127.0.0.1:1/cover.png');
    expect(saved.description).toBe('A new synopsis typed before the picture');
  });
});
