import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { makeAccount, makeProject, openAs, sql } from './helpers';

// The language a novel is written in, through the real app and the database column and rules
// (supabase/setup_scripts/20261107_novel_language.sql).

const card = (page: Page, title: string) => page.getByRole('article').filter({ hasText: title });
const languageOf = async (testInfo: TestInfo, projectId: string) =>
  (await sql<{ language: string | null }>(testInfo, 'select language from public.projects where id = $1', [projectId]))[0].language;

test.describe('novel language, through the server', () => {
  test('a writer chooses the language of each version, the database keeps it, and readers filter by it', async ({ browser }, testInfo) => {
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const ada = await makeAccount(testInfo, 'Ada', 'read');
    const english = await makeProject(ben, 'Tide Tables');
    const page = await openAs(browser, testInfo, ben);

    // The first version: set in Edit details
    await page.goto('/#/manuscripts');
    await card(page, 'Tide Tables').getByRole('button', { name: 'Edit details' }).click();
    await expect(page.locator('#ps-lang')).toHaveValue('');
    await page.locator('#ps-lang').selectOption('en');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#ps-h')).toHaveCount(0);
    expect(await languageOf(testInfo, english.id)).toBe('en');

    // The second version: made as its own novel, in the new project dialog
    await page.getByRole('button', { name: /New project/ }).first().click();
    await expect(page.locator('#ms-np-lang')).toHaveValue('en');
    await page.getByLabel('Project title').fill('Jadual Pasang Surut');
    await page.locator('#ms-np-lang').selectOption('ms');
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(card(page, 'Jadual Pasang Surut').getByTestId('language-tag')).toHaveText('Bahasa Melayu');
    const rows = await sql<{ id: string; language: string | null }>(testInfo, "select id, language from public.projects where title = 'Jadual Pasang Surut' and user_id = $1", [ben.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].language).toBe('ms');
    const malay = rows[0].id;

    // Both are published one by one, as the writer wishes (here from the writer's home)
    await page.goto('/#/write');
    for (const title of ['Tide Tables', 'Jadual Pasang Surut']) {
      await card(page, title).getByRole('button', { name: 'Publish', exact: true }).click();
      await expect(card(page, title).getByRole('button', { name: 'Unpublish' })).toBeVisible();
    }
    // Nothing was asked: both already had a language
    expect(await languageOf(testInfo, english.id)).toBe('en');
    expect(await languageOf(testInfo, malay)).toBe('ms');

    // A reader sees two versions, tagged, and can choose one
    const adaPage = await openAs(browser, testInfo, ada);
    await adaPage.goto('/#/library');
    await expect(card(adaPage, 'Tide Tables').getByTestId('language-tag')).toHaveText('English');
    await expect(card(adaPage, 'Jadual Pasang Surut').getByTestId('language-tag')).toHaveText('Bahasa Melayu');
    await adaPage.getByTestId('language-filter').selectOption('ms');
    await expect(card(adaPage, 'Jadual Pasang Surut')).toBeVisible();
    await expect(card(adaPage, 'Tide Tables')).toHaveCount(0);
  });

  test('publishing a novel that has no language asks first, then lists it under that language', async ({ browser }, testInfo) => {
    const cleo = await makeAccount(testInfo, 'Cleo', 'write');
    const project = await makeProject(cleo, 'Unlabelled Tale');
    const page = await openAs(browser, testInfo, cleo);
    await page.goto('/#/write');
    await card(page, 'Unlabelled Tale').getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Which language is this version in?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect((await sql<{ is_published: boolean }>(testInfo, 'select is_published from public.projects where id = $1', [project.id]))[0].is_published).toBe(false);

    await card(page, 'Unlabelled Tale').getByRole('button', { name: 'Publish', exact: true }).click();
    await page.locator('#pl-lang').selectOption('ta');
    await page.locator('dialog[open]').getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(card(page, 'Unlabelled Tale').getByRole('button', { name: 'Unpublish' })).toBeVisible();
    const row = (await sql<{ is_published: boolean; language: string | null }>(testInfo, 'select is_published, language from public.projects where id = $1', [project.id]))[0];
    expect(row).toEqual({ is_published: true, language: 'ta' });
  });

  test('the database refuses what is not a language code, and a stranger cannot change another person\'s novel', async ({ browser }, testInfo) => {
    // (This test talks to the database directly; the fixture is only named because the test runner needs one to be.)
    void browser;
    const dan = await makeAccount(testInfo, 'Dan', 'write');
    const eve = await makeAccount(testInfo, 'Eve', 'write');
    const project = await makeProject(dan, 'Guarded Tale');

    expect((await dan.api.from('projects').update({ language: 'ms' }).eq('id', project.id).select()).data).toHaveLength(1);
    expect((await dan.api.from('projects').update({ language: 'Malay' }).eq('id', project.id).select()).error).not.toBeNull();
    expect((await dan.api.from('projects').update({ language: null }).eq('id', project.id).select()).data).toHaveLength(1);
    // Eve is nobody to Dan's novel: nothing changes, and no error either, as for any other setting
    expect((await eve.api.from('projects').update({ language: 'zh' }).eq('id', project.id).select()).data ?? []).toHaveLength(0);
    expect(await languageOf(testInfo, project.id)).toBeNull();
  });
});
