import { expect, test, type Page } from '@playwright/test';
import { makeAccount, makeProject, openAs, sql } from './helpers';

// The website is updated before the novel language database script is run: projects have no `language` column. Nothing may break: the
// choice is not offered where it cannot work, saving and publishing carry on, and a novel made with a language chosen is still made.

const card = (page: Page, title: string) => page.getByRole('article').filter({ hasText: title });

test.describe('before the novel language setup has been run', () => {
  test('the choice says it is not switched on, and saving, creating and publishing all still work', async ({ browser }, testInfo) => {
    const eve = await makeAccount(testInfo, 'Eve', 'write');
    const project = await makeProject(eve, 'Early Tale');
    expect((await sql(testInfo, "select 1 from information_schema.columns where table_name = 'projects' and column_name = 'language'")).length).toBe(0);

    const page = await openAs(browser, testInfo, eve);
    await page.goto('/#/manuscripts');
    await card(page, 'Early Tale').getByRole('button', { name: 'Edit details' }).click();
    await expect(page.getByText('Choosing a language is not switched on for this site yet.')).toBeVisible();
    await expect(page.locator('select#ps-lang')).toHaveCount(0);
    await page.getByLabel('Novel title').fill('Early Tale, Revised');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#ps-h')).toHaveCount(0);
    expect((await sql<{ title: string }>(testInfo, 'select title from public.projects where id = $1', [project.id]))[0].title).toBe('Early Tale, Revised');

    // A new novel: no language to choose, and it is made
    await page.getByRole('button', { name: /New project/ }).first().click();
    await expect(page.locator('#ms-np-lang')).toHaveCount(0);
    await page.getByLabel('Project title').fill('A Second Early Tale');
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(card(page, 'A Second Early Tale')).toBeVisible();

    // Publishing asks nothing about a language, and the library has no language controls
    await page.goto('/#/write');
    await card(page, 'A Second Early Tale').getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(card(page, 'A Second Early Tale').getByRole('button', { name: 'Unpublish' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Which language is this version in?' })).toHaveCount(0);
    await page.goto('/#/library');
    await expect(card(page, 'A Second Early Tale')).toBeVisible();
    await expect(page.getByTestId('language-filter')).toHaveCount(0);
    await expect(page.getByTestId('language-tag')).toHaveCount(0);
  });

  test('a first novel made with a language chosen is still made, without it', async ({ browser }, testInfo) => {
    const fay = await makeAccount(testInfo, 'Fay', 'write');
    const page = await openAs(browser, testInfo, fay);
    await page.goto('/#/manuscripts');
    await page.getByRole('button', { name: /New project|Create your first project/ }).first().click();
    // With no novel yet there is nothing to tell the website the column is missing, so the choice is offered
    await page.locator('#ms-np-lang').selectOption('ms');
    await page.getByLabel('Project title').fill('First Of All');
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(card(page, 'First Of All')).toBeVisible();
    expect((await sql(testInfo, "select 1 from public.projects where title = 'First Of All' and user_id = $1", [fay.id])).length).toBe(1);
  });
});
