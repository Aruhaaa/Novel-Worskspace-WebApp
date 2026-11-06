import { expect, test } from '@playwright/test';
import { makeAccount, makeProject, openAs, sql } from './helpers';

// The website is updated before the chapter publishing database script is run. Nothing may break: likes still save, the
// whole-novel Publish button still works, and the per-chapter controls stay hidden (they would only fail).

test.describe('before the chapter publishing setup has been run', () => {
  test('likes still save, the whole-novel switch still works, and there are no per-chapter controls', async ({ browser }, testInfo) => {
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const ada = await makeAccount(testInfo, 'Ada', 'read');
    const project = await makeProject(ben, 'Early Tale', 'Words before the update.');
    expect((await sql(testInfo, "select 1 from information_schema.columns where table_name = 'chapters' and column_name = 'published_at'")).length).toBe(0);

    // Ben's chapter index has no publish buttons and no publish summary, and the novel can still be published as a whole
    const benPage = await openAs(browser, testInfo, ben);
    await benPage.goto('/#/chapters');
    await expect(benPage.getByRole('heading', { name: 'Part 1', exact: true })).toBeVisible();
    await expect(benPage.getByTestId('publish-summary')).toHaveCount(0);
    await expect(benPage.getByRole('button', { name: /^Publish Part 1/ })).toHaveCount(0);
    await expect(benPage.locator('.tile-pub')).toHaveCount(0);
    await benPage.goto('/#/write');
    await benPage.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(benPage.getByText('is now in the Public Library')).toBeVisible();
    expect((await sql<{ is_published: boolean }>(testInfo, 'select is_published from public.projects where id = $1', [project.id]))[0].is_published).toBe(true);

    // Ada reads it, and her like is saved the old way
    const adaPage = await openAs(browser, testInfo, ada);
    await adaPage.goto(`/#/library/novel/${project.id}`);
    await expect(adaPage.getByText('Words before the update.')).toBeVisible();
    await adaPage.goto('/#/library');
    await adaPage.getByRole('article').filter({ hasText: 'Early Tale' }).getByRole('button', { name: 'Like', exact: true }).click();
    await expect
      .poll(async () => (await sql<{ likes: string[] }>(testInfo, 'select likes from public.projects where id = $1', [project.id]))[0].likes)
      .toContain(ada.id);
  });
});
