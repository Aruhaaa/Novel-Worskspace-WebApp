import { expect, test } from './fixtures';
import { createProject, signIn } from './helpers';
import type { Page } from '@playwright/test';

// Uploading a cover picture instead of pasting a link. Local mode (no cloud keys): the picture is shrunk in the browser and kept inside
// the project as a data address. The upload to storage is tested in e2e/cloud/covers.cloud.spec.ts and the database rules in
// supabase/tests/cover-uploads.test.mjs.

/** A picture to upload: a gradient drawn in the browser, so no image file has to be kept in the repository */
const makePicture = async (page: Page, width: number, height: number, mime = 'image/png') => {
  const base64 = await page.evaluate(
    ([w, h, type]) => {
      const canvas = document.createElement('canvas');
      canvas.width = w as number;
      canvas.height = h as number;
      const g = canvas.getContext('2d')!;
      const grad = g.createLinearGradient(0, 0, w as number, h as number);
      grad.addColorStop(0, '#c0392b');
      grad.addColorStop(1, '#2c3e50');
      g.fillStyle = grad;
      g.fillRect(0, 0, w as number, h as number);
      return canvas.toDataURL(type as string).split(',')[1];
    },
    [width, height, mime] as const,
  );
  return { name: mime === 'image/png' ? 'cover.png' : 'cover.jpg', mimeType: mime, buffer: Buffer.from(base64, 'base64') };
};

const savedCover = (page: Page, title: string) =>
  page.evaluate((name) => {
    const projects = JSON.parse(localStorage.getItem('novel_projects') ?? '[]') as { title: string; cover_url?: string }[];
    return projects.find((p) => p.title === name)?.cover_url ?? '';
  }, title);

const card = (page: Page, title: string) => page.getByRole('article').filter({ hasText: title });

const openDetails = async (page: Page, title: string) => {
  await page.goto('/#/manuscripts');
  await card(page, title).getByRole('button', { name: 'Edit details' }).click();
  await expect(page.locator('#ps-h')).toHaveText(title);
};

test.describe('cover pictures', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'cover@example.com', 'Write');
    await createProject(page, 'Cover Test');
  });

  test('a picture is chosen from the device, shrunk, shown at once and saved with the novel', async ({ page }) => {
    await openDetails(page, 'Cover Test');
    await expect(page.getByText('No cover yet')).toBeVisible();
    // A phone photo, far bigger than a cover needs to be
    await page.getByTestId('cover-file').setInputFiles(await makePicture(page, 2400, 3600));
    await expect(page.locator('.cover-picker-preview img')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Replace picture' })).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#ps-h')).toHaveCount(0);

    const stored = await savedCover(page, 'Cover Test');
    expect(stored).toMatch(/^data:image\/jpeg;base64,/);
    // Small enough to keep in the browser's storage, and no bigger than a cover needs to be
    expect(stored.length).toBeLessThan(400_000);
    const size = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return { width: img.naturalWidth, height: img.naturalHeight };
    }, stored);
    expect(size).toEqual({ width: 800, height: 1200 });

    // It is the picture on the novel's card
    await expect(card(page, 'Cover Test').locator('img.cover-mini')).toHaveAttribute('src', stored);
  });

  test('a picture that is already small is not made bigger', async ({ page }) => {
    await openDetails(page, 'Cover Test');
    await page.getByTestId('cover-file').setInputFiles(await makePicture(page, 300, 450, 'image/jpeg'));
    await expect(page.locator('.cover-picker-preview img')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(() => savedCover(page, 'Cover Test')).toMatch(/^data:image\/jpeg/);
    const size = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return { width: img.naturalWidth, height: img.naturalHeight };
    }, await savedCover(page, 'Cover Test'));
    expect(size).toEqual({ width: 300, height: 450 });
  });

  test('pressing Save right after choosing waits for the picture instead of saving without it', async ({ page }) => {
    await openDetails(page, 'Cover Test');
    // A big picture takes a moment to shrink; Save is clicked without waiting for the preview
    await page.getByTestId('cover-file').setInputFiles(await makePicture(page, 3000, 4500));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#ps-h')).toHaveCount(0);
    expect(await savedCover(page, 'Cover Test')).toMatch(/^data:image\/jpeg;base64,/);
  });

  test('closing the form without saving changes nothing', async ({ page }) => {
    await openDetails(page, 'Cover Test');
    await page.getByTestId('cover-file').setInputFiles(await makePicture(page, 600, 900));
    await expect(page.locator('.cover-picker-preview img')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(await savedCover(page, 'Cover Test')).toBe('');
    await expect(card(page, 'Cover Test').locator('img.cover-mini')).toHaveCount(0);
  });

  test('the picture can be replaced and removed', async ({ page }) => {
    await openDetails(page, 'Cover Test');
    await page.getByTestId('cover-file').setInputFiles(await makePicture(page, 600, 900));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(() => savedCover(page, 'Cover Test')).toMatch(/^data:image\/jpeg/);
    const first = await savedCover(page, 'Cover Test');

    await openDetails(page, 'Cover Test');
    await expect(page.locator('.cover-picker-preview img')).toHaveAttribute('src', first);
    await page.getByTestId('cover-file').setInputFiles(await makePicture(page, 500, 500, 'image/jpeg'));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => (await savedCover(page, 'Cover Test')) !== first).toBe(true);

    await openDetails(page, 'Cover Test');
    await page.getByRole('button', { name: 'Remove picture' }).click();
    await expect(page.getByText('No cover yet')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(() => savedCover(page, 'Cover Test')).toBe('');
    await expect(card(page, 'Cover Test').locator('img.cover-mini')).toHaveCount(0);
  });

  test('something that is not a picture is refused with a reason, and nothing is changed', async ({ page }) => {
    await openDetails(page, 'Cover Test');
    await page.getByTestId('cover-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a picture') });
    await expect(page.getByRole('alert').filter({ hasText: 'Choose a JPEG, PNG or WebP picture.' })).toBeVisible();
    await expect(page.getByText('No cover yet')).toBeVisible();

    // Named as a picture but not one: the browser cannot read it
    await page.getByTestId('cover-file').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('definitely not png bytes') });
    await expect(page.getByRole('alert').filter({ hasText: 'That file could not be read as a picture.' })).toBeVisible();
    await expect(page.getByText('No cover yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload a picture' })).toBeEnabled();
  });

  test('a link to a picture still works', async ({ page }) => {
    await openDetails(page, 'Cover Test');
    await page.getByText('Use a link to a picture instead').click();
    await page.getByLabel('Cover image URL').fill('https://example.com/covers/mine.png');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(() => savedCover(page, 'Cover Test')).toBe('https://example.com/covers/mine.png');

    // A saved link is shown in the box the next time
    await openDetails(page, 'Cover Test');
    await expect(page.getByLabel('Cover image URL')).toHaveValue('https://example.com/covers/mine.png');
  });
});
