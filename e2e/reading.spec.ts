import { expect, test } from './fixtures';
import { paragraphs, seedPublishedNovel, signIn } from './helpers';

const HOSTILE =
  '<p>Safe words.</p><img src="x" onerror="window.__xss=1"><script>window.__xss=2</script><iframe src="https://example.com"></iframe><a href="javascript:window.__xss=3">click</a><p onclick="window.__xss=4">more safe words</p>';

const NOVEL = [
  { id: 'rc1', title: 'Part 1', html: paragraphs(1, 40) },
  { id: 'rc2', title: 'Part 2: Hostile', html: HOSTILE + paragraphs(2, 30) },
  { id: 'rc3', title: 'Part 3', html: paragraphs(3, 40) },
  { id: 'rc4', title: 'Part 4', html: paragraphs(4, 40) },
  { id: 'rc5', title: 'Part 5', html: paragraphs(5, 40) },
];

test.describe('reading', () => {
  test.beforeEach(async ({ page }) => {
    await seedPublishedNovel(page, NOVEL);
    await signIn(page, 'reader@example.com', 'Read');
  });

  test('a novel opens straight from its address, even after a refresh', async ({ page }) => {
    await page.goto('/#/library/novel/pub1');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Part 1' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Part 5' })).toBeAttached();
  });

  test('a novel that is not there says so instead of loading for ever', async ({ page }) => {
    await page.goto('/#/library/novel/no-such-novel');
    await page.reload();
    await expect(page.getByText('That novel is not available')).toBeVisible();
    await page.getByRole('button', { name: 'Back to the library' }).click();
    await expect(page).toHaveURL(/#\/library$/);
  });

  test("someone else's chapter cannot run a script in the reader's browser", async ({ page }) => {
    await page.goto('/#/library/novel/pub1');
    const hostile = page.locator('#reader-ch-rc2 .prose');
    await expect(hostile).toContainText('Safe words.');
    await expect(hostile).toContainText('more safe words');
    // None of the dangerous markup survived, and nothing ran
    await expect(hostile.locator('script, iframe, img')).toHaveCount(0);
    expect(await hostile.locator('a').first().getAttribute('href')).toBeNull();
    expect(await hostile.locator('[onclick]').count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test('reopening a novel jumps back to the chapter that was being read', async ({ page }) => {
    await page.goto('/#/library/novel/pub1');
    await expect(page.locator('#reader-ch-rc4')).toBeAttached();
    // Reading counts only once the page has settled and the reader scrolls
    await page.waitForTimeout(1200);
    await page.locator('#reader-ch-rc4').scrollIntoViewIfNeeded();
    await page.locator('#reader-ch-rc4').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await expect
      .poll(() => page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('novelist_reading_')).map(([, v]) => JSON.parse(v as string).pub1?.chapterId)))
      .toEqual(['rc4']);

    // Back on the reading home, the list says where they were
    await page.goto('/#/read');
    const row = page.getByRole('button', { name: /Long Tides/ });
    await expect(row).toContainText('You were on chapter 4');
    await row.click();

    await expect(page.getByText('Back where you left off: Part 4.')).toBeVisible();
    await expect.poll(async () => (await page.locator('#reader-ch-rc4').boundingBox())?.y ?? 9999).toBeLessThan(250);

    // "Start from the beginning" goes back to the top
    await page.getByRole('button', { name: 'Start from the beginning' }).click();
    await expect.poll(async () => (await page.locator('.reader-title').boundingBox())?.y ?? 9999).toBeLessThan(250);
  });

  test('a novel that was only opened, not read, does not count as a place', async ({ page }) => {
    await page.goto('/#/library/novel/pub1');
    await expect(page.getByRole('heading', { name: 'Part 1' })).toBeVisible();
    await page.waitForTimeout(1500);
    const saved = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('novelist_reading_')));
    expect(saved).toEqual([]);
  });
});
