import { expect, test } from './fixtures';
import { addChapter, createProject, signIn, typeInEditor, waitForSaved } from './helpers';

// Publishing a novel one chapter at a time. Local mode (no cloud keys): the database rules are tested in
// supabase/tests/chapter-publishing.test.mjs, and the cloud path in the cloud specs.

const tile = (page: import('@playwright/test').Page, title: string) => page.locator('.chapter-tile').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

const novelCard = (page: import('@playwright/test').Page, title: string) => page.getByRole('article').filter({ hasText: title });

test.describe('chapter by chapter', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'serial@example.com', 'Write');
    await createProject(page, 'Serial Novel');
    await addChapter(page, 'One');
    await typeInEditor(page, 'alpha words for the first chapter');
    await waitForSaved(page, 'alpha words for the first chapter');
    await addChapter(page, 'Two');
    await typeInEditor(page, 'bravo words for the second chapter');
    await waitForSaved(page, 'bravo words for the second chapter');
    await addChapter(page, 'Three');
    await typeInEditor(page, 'charlie words for the third chapter');
    await waitForSaved(page, 'charlie words for the third chapter');
    await page.goto('/#/chapters');
  });

  test('new chapters are drafts, and nothing is in the library until one is published', async ({ page }) => {
    await expect(page.getByTestId('publish-summary')).toContainText('Nothing here is published yet');
    for (const title of ['One', 'Two', 'Three']) await expect(tile(page, title).locator('.tile-pub')).toHaveText('Draft');
    await page.goto('/#/library');
    await expect(novelCard(page, 'Serial Novel')).toHaveCount(0);
  });

  test('publishing one chapter lists the novel, and readers see only that chapter', async ({ page }) => {
    await page.getByRole('button', { name: 'Publish One', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Publish chapter 1?' })).toBeVisible();
    await expect(page.getByText('This also puts “Serial Novel” in the Public Library.')).toBeVisible();
    await page.getByRole('button', { name: 'Publish chapter', exact: true }).click();
    await expect(page.getByText('Chapter 1 is now public.')).toBeVisible();
    await expect(page.getByTestId('publish-summary')).toContainText('1 of 3 chapters are published');
    await expect(tile(page, 'One').locator('.tile-pub')).toHaveText('Published');
    await expect(tile(page, 'Two').locator('.tile-pub')).toHaveText('Draft');

    await page.goto('/#/library');
    await novelCard(page, 'Serial Novel').getByRole('button', { name: 'Read' }).click();
    await expect(page.getByRole('heading', { name: 'One', exact: true })).toBeVisible();
    await expect(page.getByText('alpha words for the first chapter')).toBeVisible();
    // The writer is reading her own novel, and still sees only what readers see
    await expect(page.getByRole('heading', { name: 'Two', exact: true })).toHaveCount(0);
    await expect(page.getByText('bravo words for the second chapter')).toHaveCount(0);
    await expect(page.getByText('1 chapter', { exact: false }).first()).toBeVisible();
  });

  test('"Publish up to here" publishes every draft before a chapter, after asking', async ({ page }) => {
    await page.getByRole('button', { name: 'Publish every draft up to Three' }).click();
    await expect(page.getByRole('heading', { name: 'Publish 3 chapters?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(tile(page, 'One').locator('.tile-pub')).toHaveText('Draft');

    await page.getByRole('button', { name: 'Publish every draft up to Two' }).click();
    await expect(page.getByRole('heading', { name: 'Publish 2 chapters?' })).toBeVisible();
    await page.getByRole('button', { name: 'Publish chapters', exact: true }).click();
    await expect(page.getByTestId('publish-summary')).toContainText('2 of 3 chapters are published');
    await expect(tile(page, 'Three').locator('.tile-pub')).toHaveText('Draft');
    await expect(page.getByRole('button', { name: 'Publish all drafts' })).toBeVisible();
  });

  test('unpublishing can be undone, and unpublishing the last chapter takes the novel out of the library', async ({ page }) => {
    await page.getByRole('button', { name: 'Publish Two', exact: true }).click();
    await page.getByRole('button', { name: 'Publish chapter', exact: true }).click();
    await expect(page.getByTestId('publish-summary')).toContainText('1 of 3 chapters are published');

    await page.getByRole('button', { name: 'Publish One', exact: true }).click();
    await page.getByRole('button', { name: 'Publish chapter', exact: true }).click();
    await expect(page.getByTestId('publish-summary')).toContainText('2 of 3 chapters are published');

    await page.getByRole('button', { name: 'Unpublish One', exact: true }).click();
    await expect(page.getByText('1 chapter is a draft again.')).toBeVisible();
    // Earlier messages may still be on screen: take the one about this change
    await page.locator('.snack').filter({ hasText: '1 chapter is a draft again.' }).getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('publish-summary')).toContainText('2 of 3 chapters are published');

    await page.getByRole('button', { name: 'Unpublish One', exact: true }).click();
    await expect(page.getByTestId('publish-summary')).toContainText('1 of 3 chapters are published');
    await page.getByRole('button', { name: 'Unpublish Two', exact: true }).click();
    await expect(page.getByText('is no longer in the Public Library, because none of its chapters is published.')).toBeVisible();
    await expect(page.getByTestId('publish-summary')).toContainText('Nothing here is published yet');
    await page.goto('/#/library');
    await expect(novelCard(page, 'Serial Novel')).toHaveCount(0);
  });

  test('the whole-novel Publish button publishes every chapter, and turning it off keeps which were published', async ({ page }) => {
    await page.goto('/#/write');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('is now in the Public Library')).toBeVisible();
    await page.goto('/#/chapters');
    await expect(page.getByTestId('publish-summary')).toContainText('3 of 3 chapters are published');

    await page.goto('/#/write');
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await page.goto('/#/library');
    await expect(novelCard(page, 'Serial Novel')).toHaveCount(0);
    await page.goto('/#/chapters');
    await expect(page.getByTestId('publish-summary')).toContainText('3 of 3 chapters are published');
  });

  test('a chapter can be published from the editor menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Two', exact: false }).first().click();
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'Publish this chapter…' }).click();
    await expect(page.getByRole('heading', { name: 'Publish chapter 2?' })).toBeVisible();
    await page.getByRole('button', { name: 'Publish chapter', exact: true }).click();
    await expect(page.getByText('Chapter 2 is now public.')).toBeVisible();
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('menuitem', { name: 'Unpublish this chapter' })).toBeVisible();
  });
});
