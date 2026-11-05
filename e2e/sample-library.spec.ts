import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { signIn } from './helpers';

// The sample novels are built into src/data/library/ (npm run library:build). This spec expects whatever is built there.
interface Entry {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorId: string;
  genre: string;
  chapters: number;
}
const INDEX = 'src/data/library/index.json';
const entries: Entry[] = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : [];

test.describe('sample library', () => {
  test.skip(entries.length === 0, 'The sample library has not been built (npm run library:build).');

  test.beforeEach(async ({ page }) => {
    // The shared fixture switches the sample novels off for every other spec; this one wants them on.
    // A test can set __e2e_keep_off in the tab's session storage to leave them off.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('__e2e_keep_off')) localStorage.removeItem('novelist_sample_library');
    });
    await signIn(page, 'sample-reader@example.com', 'Read');
  });

  const card = (page: import('@playwright/test').Page, title: string) =>
    page.locator('article.novel-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

  test('the public library lists every sample novel, and the reading home counts them', async ({ page }) => {
    await expect(page.getByText(`${entries.length} ${entries.length === 1 ? 'novel' : 'novels'} in the library`)).toBeVisible();
    await page.goto('/#/library');
    await expect(page.getByRole('status').filter({ hasText: /results?$/ })).toHaveText(`${entries.length} ${entries.length === 1 ? 'result' : 'results'}`);
    for (const e of entries) await expect(card(page, e.title)).toHaveCount(1);
    await expect(card(page, entries[0].title).getByText('Sample', { exact: true })).toBeVisible();
  });

  test('every genre chip finds exactly its novels', async ({ page }) => {
    await page.goto('/#/library');
    const genres = [...new Set(entries.map((e) => e.genre))];
    for (const genre of genres) {
      await page.getByRole('group', { name: 'Filter by genre' }).getByRole('button', { name: genre, exact: true }).click();
      const expected = entries.filter((e) => e.genre === genre);
      await expect(page.getByRole('status').filter({ hasText: /results?$/ })).toHaveText(`${expected.length} ${expected.length === 1 ? 'result' : 'results'}`);
      for (const e of expected) await expect(card(page, e.title)).toHaveCount(1);
    }
  });

  test('a sample novel opens with all of its chapters and nothing to report', async ({ page }) => {
    const e = entries[0];
    await page.goto('/#/library');
    await card(page, e.title).getByRole('button', { name: 'Read' }).click();
    await expect(page).toHaveURL(new RegExp(`#/library/novel/${e.id}$`));
    await expect(page.getByRole('heading', { level: 1, name: e.title })).toBeVisible();
    await expect(page.locator('.reader-chapter')).toHaveCount(e.chapters);
    await expect(page.locator('.reader-title')).toContainText(`${e.chapters} ${e.chapters === 1 ? 'chapter' : 'chapters'}`);
    // Real prose, not an empty page
    await expect(page.locator('.reader-chapter .prose p').first()).not.toBeEmpty();
    // It ships with the site: there is no author to report
    await expect(page.getByText('Report this novel')).toHaveCount(0);
  });

  test('a novel opens straight from its address, even after a refresh', async ({ page }) => {
    const e = entries[entries.length - 1];
    await page.goto(`/#/library/novel/${e.id}`);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: e.title })).toBeVisible();
    await expect(page.locator('.reader-chapter')).toHaveCount(e.chapters);
  });

  test('a like stays after a reload, on this device', async ({ page }) => {
    const e = entries[0];
    await page.goto('/#/library');
    const like = card(page, e.title).getByRole('button', { name: 'Like', exact: true });
    await like.click();
    await expect(card(page, e.title).getByRole('button', { name: 'Unlike' })).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, e.title).locator('.like-btn span')).toHaveText('1');
    await page.reload();
    await expect(card(page, e.title).getByRole('button', { name: 'Unlike' })).toHaveAttribute('aria-pressed', 'true');
    // It is a saved novel now
    await page.goto('/#/saved');
    await expect(card(page, e.title)).toHaveCount(1);
  });

  test('a review on a sample novel is kept', async ({ page }) => {
    const e = entries[0];
    await page.goto(`/#/library/novel/${e.id}`);
    await page.getByPlaceholder('What did you think of this novel?').fill('Kept me up past midnight.');
    await page.getByRole('button', { name: 'Post review' }).click();
    await expect(page.getByText('Kept me up past midnight.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Kept me up past midnight.')).toBeVisible();
  });

  test('the author is a pen name with nobody to follow or message', async ({ page }) => {
    const e = entries[0];
    await page.goto(`/#/library/author/${e.authorId}`);
    await expect(page.getByRole('heading', { level: 1, name: e.author })).toBeVisible();
    await expect(page.getByText('A pen name from the sample library')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Follow' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Message' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 3, name: e.title })).toBeVisible();
  });

  test('the Preferences switch hides the sample novels and brings them back', async ({ page }) => {
    await page.goto('/#/preferences');
    await expect(page.getByText(`The library comes with ${entries.length} sample novels`)).toBeVisible();
    const box = page.getByRole('checkbox', { name: 'Show the sample novels in the library' });
    await expect(box).toBeChecked();
    await box.uncheck();
    await page.goto('/#/library');
    await expect(page.getByText('No novels found')).toBeVisible();
    await page.goto('/#/preferences');
    await box.check();
    await page.goto('/#/library');
    await expect(card(page, entries[0].title)).toHaveCount(1);
  });

  test('the sample novels can be switched off on a device', async ({ page }) => {
    await page.evaluate(() => {
      sessionStorage.setItem('__e2e_keep_off', '1');
      localStorage.setItem('novelist_sample_library', 'off');
    });
    await page.goto('/#/library');
    await page.reload();
    await expect(page.getByText('No novels found')).toBeVisible();
    await expect(card(page, entries[0].title)).toHaveCount(0);
  });
});
