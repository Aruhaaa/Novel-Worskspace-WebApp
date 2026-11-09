import { expect, test } from './fixtures';
import { addChapter, createProject, signIn, typeInEditor, waitForSaved } from './helpers';
import type { Page } from '@playwright/test';

// The language a novel is written in. Local mode (no cloud keys): the column and who can change it are tested in
// supabase/tests/novel-language.test.mjs, and the cloud path in e2e/cloud/language.*.spec.ts.

const card = (page: Page, title: string) => page.getByRole('article').filter({ hasText: title });

/** Open Edit details for a project and change its language ('' for none) */
const setLanguage = async (page: Page, title: string, code: string) => {
  await page.goto('/#/manuscripts');
  await card(page, title).getByRole('button', { name: 'Edit details' }).click();
  await expect(page.locator('#ps-h')).toHaveText(title);
  await page.locator('#ps-lang').selectOption(code);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#ps-h')).toHaveCount(0);
};

test.describe('novel language', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'lang@example.com', 'Write');
  });

  test('a new novel starts in the app\'s language and can be made in another, and the card says which', async ({ page }) => {
    await page.goto('/#/manuscripts');
    await page.getByRole('button', { name: /New project|Create your first project/ }).first().click();
    await expect(page.locator('#ms-np-lang')).toHaveValue('en');
    await page.getByLabel('Project title').fill('Tide Tables');
    await page.locator('#ms-np-lang').selectOption('ms');
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByRole('heading', { name: 'Tide Tables' })).toBeVisible();

    await page.goto('/#/manuscripts');
    await expect(card(page, 'Tide Tables').getByTestId('language-tag')).toHaveText('Bahasa Melayu');
    await card(page, 'Tide Tables').getByRole('button', { name: 'Edit details' }).click();
    await expect(page.locator('#ps-lang')).toHaveValue('ms');
    // Each language is named in its own words, with the app's language beside it
    await expect(page.locator('#ps-lang option[value="ms"]')).toHaveText('Bahasa Melayu (Malay)');
    await expect(page.locator('#ps-lang option[value="zh"]')).toHaveText('中文 (Chinese)');
    await expect(page.locator('#ps-lang option[value="en"]')).toHaveText('English');
  });

  test('the language can be changed and taken away in Edit details', async ({ page }) => {
    await createProject(page, 'Changing Tongue');
    await setLanguage(page, 'Changing Tongue', 'zh');
    await expect(card(page, 'Changing Tongue').getByTestId('language-tag')).toHaveText('中文');
    await setLanguage(page, 'Changing Tongue', '');
    await expect(card(page, 'Changing Tongue').getByTestId('language-tag')).toHaveCount(0);
  });

  test('two versions of one story are two novels, and readers can filter the library by language', async ({ page }) => {
    for (const [title, code] of [['Tide Tables', 'en'], ['Jadual Pasang Surut', 'ms']] as const) {
      await createProject(page, title);
      await setLanguage(page, title, code);
    }
    await page.goto('/#/write');
    for (const title of ['Tide Tables', 'Jadual Pasang Surut']) {
      await card(page, title).getByRole('button', { name: 'Publish', exact: true }).click();
      await expect(card(page, title).getByRole('button', { name: 'Unpublish' })).toBeVisible();
    }

    await page.goto('/#/library');
    await expect(card(page, 'Tide Tables')).toBeVisible();
    await expect(card(page, 'Jadual Pasang Surut')).toBeVisible();
    await expect(card(page, 'Tide Tables').getByTestId('language-tag')).toHaveText('English');
    await expect(card(page, 'Jadual Pasang Surut').getByTestId('language-tag')).toHaveText('Bahasa Melayu');

    const filter = page.getByTestId('language-filter');
    await expect(filter.locator('option')).toHaveText(['All languages', 'Bahasa Melayu (Malay)', 'English']);
    await filter.selectOption('ms');
    await expect(card(page, 'Jadual Pasang Surut')).toBeVisible();
    await expect(card(page, 'Tide Tables')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: '1 result' })).toBeVisible();
    await filter.selectOption('All');
    await expect(card(page, 'Tide Tables')).toBeVisible();
  });

  test('with novels in only one language there is nothing to filter', async ({ page }) => {
    await createProject(page, 'Only English');
    await page.goto('/#/write');
    await card(page, 'Only English').getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(card(page, 'Only English').getByRole('button', { name: 'Unpublish' })).toBeVisible();
    await page.goto('/#/library');
    await expect(card(page, 'Only English')).toBeVisible();
    await expect(page.getByTestId('language-filter')).toHaveCount(0);
  });

  test('publishing a novel with no language asks which one first, and backing out publishes nothing', async ({ page }) => {
    await createProject(page, 'Undecided');
    await setLanguage(page, 'Undecided', '');
    await page.goto('/#/write');
    await card(page, 'Undecided').getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Which language is this version in?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(card(page, 'Undecided').getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
    await expect(card(page, 'Undecided').getByTestId('language-tag')).toHaveCount(0);

    await card(page, 'Undecided').getByRole('button', { name: 'Publish', exact: true }).click();
    await page.locator('#pl-lang').selectOption('ms');
    await page.locator('dialog[open]').getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(card(page, 'Undecided').getByRole('button', { name: 'Unpublish' })).toBeVisible();
    await expect(card(page, 'Undecided').getByTestId('language-tag')).toHaveText('Bahasa Melayu');
  });

  test('a novel that already has a language is published without being asked', async ({ page }) => {
    await createProject(page, 'Already Decided');
    await page.goto('/#/write');
    await card(page, 'Already Decided').getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(card(page, 'Already Decided').getByRole('button', { name: 'Unpublish' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Which language is this version in?' })).toHaveCount(0);
  });

  test('publishing the first chapter of a novel with no language asks for it in the same dialog', async ({ page }) => {
    await createProject(page, 'Serial With No Language');
    await addChapter(page, 'One');
    await typeInEditor(page, 'words in the first chapter');
    await waitForSaved(page, 'words in the first chapter');
    await setLanguage(page, 'Serial With No Language', '');
    await page.goto('/#/chapters');
    await page.getByRole('button', { name: 'Publish One', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Publish chapter 1?' })).toBeVisible();
    await page.locator('#pc-lang').selectOption('ms');
    await page.getByRole('button', { name: 'Publish chapter', exact: true }).click();
    await expect(page.getByText('Chapter 1 is now public.')).toBeVisible();
    await page.goto('/#/manuscripts');
    await expect(card(page, 'Serial With No Language').getByTestId('language-tag')).toHaveText('Bahasa Melayu');
  });

  test('the reader marks the novel\'s text with its language, and says it in the heading', async ({ page }) => {
    await createProject(page, 'Cerita Laut');
    await setLanguage(page, 'Cerita Laut', 'ms');
    await addChapter(page, 'Bab Satu');
    await typeInEditor(page, 'ombak datang perlahan-lahan');
    await waitForSaved(page, 'ombak datang perlahan-lahan');
    await page.goto('/#/write');
    await card(page, 'Cerita Laut').getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(card(page, 'Cerita Laut').getByRole('button', { name: 'Unpublish' })).toBeVisible();

    await page.goto('/#/library');
    await card(page, 'Cerita Laut').getByRole('button', { name: 'Read' }).click();
    await expect(page.getByText('ombak datang perlahan-lahan')).toBeVisible();
    await expect(page.locator('.reader-chapter .prose')).toHaveAttribute('lang', 'ms');
    await expect(page.locator('.reader-title h1')).toHaveAttribute('lang', 'ms');
    await expect(page.locator('.reader-title p')).toContainText('Bahasa Melayu');
  });
});
