import { expect, test } from '@playwright/test';
import { addMember, anonClient, makeAccount, makeProject, openAs, openAsVisitor, sql } from './helpers';

// Publishing one chapter at a time, through the real app and the database with its access rules
// (supabase/setup_scripts/20261106_chapter_publishing.sql): who can read a draft, who can publish, and likes saved by a function.

test.describe('chapter by chapter, through the server', () => {
  test('the writer publishes one chapter, and readers, visitors and the database see only that one', async ({ browser }, testInfo) => {
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const ada = await makeAccount(testInfo, 'Ada', 'read');
    const project = await makeProject(ben, 'Serial Tale', 'First words.');
    const second = await ben.api.from('chapters').insert({ project_id: project.id, title: 'Part 2', content: '<p>Second words.</p>', position: 1 }).select().single();
    expect(second.error).toBeNull();

    // Nobody can read it yet, and it is not in the library
    const stranger = anonClient(testInfo);
    expect((await stranger.from('chapters').select('id').eq('project_id', project.id)).data).toHaveLength(0);
    expect((await stranger.from('projects').select('id').eq('id', project.id)).data).toHaveLength(0);

    // Ben publishes the first chapter from the chapter index, after being asked
    const benPage = await openAs(browser, testInfo, ben);
    await benPage.goto('/#/chapters');
    await expect(benPage.getByTestId('publish-summary')).toContainText('Nothing here is published yet');
    await benPage.getByRole('button', { name: 'Publish Part 1', exact: true }).click();
    await expect(benPage.getByRole('heading', { name: 'Publish chapter 1?' })).toBeVisible();
    await benPage.getByRole('button', { name: 'Publish chapter', exact: true }).click();
    await expect(benPage.getByText('Chapter 1 is now public.')).toBeVisible();
    await expect(benPage.getByTestId('publish-summary')).toContainText('1 of 2 chapters are published');

    // The database now lists the novel under his name, with one chapter published
    const rows = await sql<{ is_published: boolean; author_name: string }>(testInfo, 'select is_published, author_name from public.projects where id = $1', [project.id]);
    expect(rows[0].is_published).toBe(true);
    expect(rows[0].author_name).toBe('Ben');

    // A stranger, a signed-in reader and a visitor see that chapter and not the other
    expect(((await stranger.from('chapters').select('title').eq('project_id', project.id)).data ?? []).map((c) => c.title)).toEqual(['Part 1']);
    expect(((await ada.api.from('chapters').select('title').eq('project_id', project.id)).data ?? []).map((c) => c.title)).toEqual(['Part 1']);
    const adaPage = await openAs(browser, testInfo, ada);
    await adaPage.goto(`/#/library/novel/${project.id}`);
    await expect(adaPage.getByText('First words.')).toBeVisible();
    await expect(adaPage.getByText('Second words.')).toHaveCount(0);
    const visitor = await openAsVisitor(browser, testInfo);
    await visitor.goto(`/#/library/novel/${project.id}`);
    await expect(visitor.getByText('First words.')).toBeVisible();
    await expect(visitor.getByText('Second words.')).toHaveCount(0);

    // Ada cannot publish, or change, what is not hers
    const refused = await ada.api.from('chapters').update({ published_at: new Date().toISOString() }).eq('id', second.data!.id).select();
    expect(refused.data ?? []).toHaveLength(0);
    expect((await sql(testInfo, 'select 1 from public.chapters where id = $1 and published_at is null', [second.data!.id])).length).toBe(1);

    // A viewer on the project reads the draft but cannot publish it; the owner can, and the novel stays listed
    await addMember(testInfo, project.id, ada.id, 'viewer');
    expect(((await ada.api.from('chapters').select('title').eq('project_id', project.id)).data ?? []).map((c) => c.title).sort()).toEqual(['Part 1', 'Part 2']);
    const viewerTry = await ada.api.from('chapters').update({ published_at: new Date().toISOString() }).eq('id', second.data!.id).select();
    expect(viewerTry.data ?? []).toHaveLength(0);

    // Unpublishing the only published chapter takes the novel out of the library
    await benPage.getByRole('button', { name: 'Unpublish Part 1', exact: true }).click();
    await expect(benPage.getByText('is no longer in the Public Library, because none of its chapters is published.')).toBeVisible();
    expect((await stranger.from('projects').select('id').eq('id', project.id)).data).toHaveLength(0);
  });

  test('a like and a view are saved by the server, and cannot be written straight into a novel', async ({ browser }, testInfo) => {
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const ada = await makeAccount(testInfo, 'Ada', 'read');
    const project = await makeProject(ben, 'Liked Tale', 'Words to like.');
    // The whole-novel switch publishes its chapters
    const on = await ben.api.from('projects').update({ is_published: true }).eq('id', project.id);
    expect(on.error).toBeNull();
    expect((await sql(testInfo, 'select 1 from public.chapters where project_id = $1 and published_at is not null', [project.id])).length).toBe(1);

    const adaPage = await openAs(browser, testInfo, ada);
    await adaPage.goto(`/#/library/novel/${project.id}`);
    await expect(adaPage.getByText('Words to like.')).toBeVisible();
    await adaPage.goto('/#/library');
    await adaPage.getByRole('article').filter({ hasText: 'Liked Tale' }).getByRole('button', { name: 'Like', exact: true }).click();
    await expect
      .poll(async () => (await sql<{ likes: string[]; views: string[] }>(testInfo, 'select likes, views from public.projects where id = $1', [project.id]))[0].likes)
      .toContain(ada.id);
    expect((await sql<{ views: string[] }>(testInfo, 'select views from public.projects where id = $1', [project.id]))[0].views).toContain(ada.id);

    // Writing likes straight into the table is refused
    const direct = await ada.api.from('projects').update({ likes: ['someone-else'] }).eq('id', project.id);
    expect(direct.error).not.toBeNull();
    // Someone not signed in cannot like at all
    expect((await anonClient(testInfo).rpc('toggle_project_like', { p_project: project.id })).error).not.toBeNull();
  });
});
