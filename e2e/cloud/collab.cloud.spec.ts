import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addMember, makeAccount, makeProject, openAs, openAsVisitor, sql } from './helpers';

// Sharing a project and writing in it together, through the real database and its Realtime channels: the invitations and
// memberships are protected by row level security, and the live line is a private channel only people on the project can join.

const text = (page: Page) =>
  page
    .locator('.ProseMirror')
    .evaluate((el) => {
      const copy = el.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('.collaboration-carets__label').forEach((label) => label.remove());
      return copy.textContent ?? '';
    })
    .then((t) => t.split(String.fromCharCode(0x2060)).join('').replace(/\s+/g, ' ').trim());

test.describe('sharing a project through the server', () => {
  test('an invitation works once, only for what it was made for, and the server keeps everyone else out', async ({ browser }, testInfo) => {
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const ada = await makeAccount(testInfo, 'Ada', 'write');
    const cal = await makeAccount(testInfo, 'Cal', 'write');
    const project = await makeProject(ben, 'Shared Tale', 'The sea was calm.');

    // Ben invites an editor from the Manuscripts screen
    const benPage = await openAs(browser, testInfo, ben);
    await benPage.goto('/#/manuscripts');
    await benPage.locator('.project-card', { hasText: 'Shared Tale' }).getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = benPage.locator('dialog[open]');
    await dialog.getByLabel('They can').selectOption({ label: 'editor' });
    await dialog.getByLabel('Who is it for (optional)').fill('Ada, my editor');
    await dialog.getByRole('button', { name: 'Make an invitation link' }).click();
    await expect(dialog.locator('.share-row', { hasText: 'Ada, my editor' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Done' }).click();
    const [{ token }] = await sql<{ token: string }>(testInfo, 'select token from public.project_invites where project_id = $1', [project.id]);

    // Someone not signed in can see what the link is for (and nothing else), but has to sign in to join
    const visitor = await openAsVisitor(browser, testInfo);
    await visitor.goto(`/#/join/${token}`);
    await expect(visitor.getByRole('heading', { name: /Ben invited you to write “Shared Tale” with them/ })).toBeVisible();
    await expect(visitor.getByText('You need an account to join.')).toBeVisible();

    // Ada joins and lands in the project as an editor
    const adaPage = await openAs(browser, testInfo, ada);
    await adaPage.goto(`/#/join/${token}`);
    await adaPage.getByRole('button', { name: 'Join “Shared Tale”' }).click();
    await expect(adaPage).toHaveURL(/#\/chapters/);
    await expect(adaPage.getByRole('note')).toContainText('Your role on “Shared Tale”, by Ben, is editor.');
    await expect(adaPage.getByRole('button', { name: 'Create new chapter' })).toHaveCount(0);
    expect((await sql<{ role: string }>(testInfo, 'select role from public.project_members where project_id = $1 and user_id = $2', [project.id, ada.id]))[0].role).toBe('editor');

    // Ben is told, live, and his project says it is shared
    await expect(benPage.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications, 1 new');
    await benPage.goto('/#/manuscripts');
    await expect(benPage.locator('.project-card', { hasText: 'Shared Tale' }).locator('.badge', { hasText: 'Shared' })).toBeVisible();

    // The link had one use. Someone else cannot use it now.
    const used = await cal.api.rpc('accept_project_invite', { p_token: token });
    expect(used.error?.message).toBe('This invitation is no longer active.');
    expect((await visitor.evaluate(() => 1)) && (await cal.api.rpc('preview_project_invite', { p_token: token })).data).toBeNull();

    // The server, not the screens, keeps others out of the project's members and invitations
    expect((await cal.api.from('project_members').select('*').eq('project_id', project.id)).data).toEqual([]);
    expect((await cal.api.from('project_invites').select('*').eq('project_id', project.id)).data).toEqual([]);
    const calInvite = await cal.api.from('project_invites').insert({ project_id: project.id, role: 'coauthor' });
    expect(calInvite.error).not.toBeNull();
    // An editor cannot invite anyone, or raise her own role
    const adaInvite = await ada.api.from('project_invites').insert({ project_id: project.id, role: 'coauthor' });
    expect(adaInvite.error).not.toBeNull();
    await ada.api.from('project_members').update({ role: 'coauthor' }).eq('project_id', project.id).eq('user_id', ada.id);
    expect((await sql<{ role: string }>(testInfo, 'select role from public.project_members where project_id = $1 and user_id = $2', [project.id, ada.id]))[0].role).toBe('editor');

    // The owner can change her role, and she can leave on her own
    await benPage.locator('.project-card', { hasText: 'Shared Tale' }).getByRole('button', { name: 'Share', exact: true }).click();
    const again = benPage.locator('dialog[open]');
    await again.getByLabel('Role of Ada').selectOption({ label: 'viewer' });
    await expect.poll(async () => (await sql<{ role: string }>(testInfo, 'select role from public.project_members where project_id = $1 and user_id = $2', [project.id, ada.id]))[0]?.role).toBe('viewer');
    await adaPage.goto('/#/manuscripts');
    await adaPage.reload();
    const shared = adaPage.getByRole('region', { name: 'Shared with you' });
    await expect(shared.locator('.badge', { hasText: 'viewer' })).toBeVisible();
    adaPage.once('dialog', (d) => void d.accept());
    await shared.getByRole('button', { name: 'Leave' }).click();
    await expect(adaPage.getByRole('region', { name: 'Shared with you' })).toHaveCount(0);
    expect(await sql(testInfo, 'select 1 from public.project_members where project_id = $1', [project.id])).toHaveLength(0);
  });
});

test.describe('writing together through the server', () => {
  test('two people in the same chapter see each other and write at once over a private channel; a viewer sees it saved', async ({ browser }, testInfo) => {
    test.setTimeout(150_000);
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const ada = await makeAccount(testInfo, 'Ada', 'write');
    const dan = await makeAccount(testInfo, 'Dan', 'read');
    const cal = await makeAccount(testInfo, 'Cal', 'write');
    const project = await makeProject(ben, 'Shared Tale', 'The sea was calm.');
    await addMember(testInfo, project.id, ada.id, 'coauthor');
    await addMember(testInfo, project.id, dan.id, 'viewer');

    // The private channel is for the people on the project only
    const topic = `project:${project.id}:doc:${project.chapterId}`;
    const join = (who: typeof ben) =>
      new Promise<string>((resolve) => {
        const channel = who.api.channel(topic, { config: { private: true } });
        let done = false;
        const finish = (status: string) => {
          // Leaving the channel reports CLOSED, which must not start another leave
          if (done) return;
          done = true;
          clearTimeout(timer);
          void who.api.removeChannel(channel);
          resolve(status);
        };
        const timer = setTimeout(() => finish('TIMED_OUT'), 8000);
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') finish(status);
        });
      });
    expect(await join(ada)).toBe('SUBSCRIBED');
    expect(await join(dan)).toBe('SUBSCRIBED');
    expect(await join(cal)).not.toBe('SUBSCRIBED');

    const benPage = await openAs(browser, testInfo, ben);
    const adaPage = await openAs(browser, testInfo, ada);
    const danPage = await openAs(browser, testInfo, dan);

    // Ben opens the chapter first: shared project, so written together, nobody else here yet
    await benPage.goto('/#/editor');
    await expect(benPage.locator('.presence-bar')).toContainText('Writing together');
    await expect(benPage.locator('.ProseMirror')).toContainText('The sea was calm.');

    // Ada joins the same chapter, opening the project from "Shared with you"
    await adaPage.goto('/#/manuscripts');
    await adaPage.getByRole('region', { name: 'Shared with you' }).getByRole('button', { name: 'Open' }).click();
    await expect(adaPage).toHaveURL(/#\/editor/);
    await expect(adaPage.locator('.presence-bar .presence-dot')).toContainText('Ben');
    await expect(benPage.locator('.presence-bar .presence-dot')).toContainText('Ada');
    expect(await text(adaPage)).toBe('The sea was calm.');
    expect(await text(benPage)).toBe('The sea was calm.');

    // Both write at once
    await benPage.locator('.ProseMirror').click();
    await benPage.keyboard.press('Control+End');
    await adaPage.locator('.ProseMirror').click();
    await adaPage.keyboard.press('Control+Home');
    await Promise.all([benPage.keyboard.type(' Gulls wheeled.', { delay: 25 }), adaPage.keyboard.type('Dawn. ', { delay: 25 })]);
    await expect.poll(() => text(benPage), { timeout: 20_000 }).toBe('Dawn. The sea was calm. Gulls wheeled.');
    await expect.poll(() => text(adaPage), { timeout: 20_000 }).toBe('Dawn. The sea was calm. Gulls wheeled.');

    // It was saved to the database, once settled
    await expect
      .poll(async () => ((await sql<{ content: string }>(testInfo, 'select content from public.chapters where id = $1', [project.chapterId]))[0]?.content ?? '').replace(/<[^>]+>/g, ''), { timeout: 20_000 })
      .toBe('Dawn. The sea was calm. Gulls wheeled.');

    // A viewer reads it, and sees what the others save as they save it
    await danPage.goto('/#/manuscripts');
    await danPage.getByRole('region', { name: 'Shared with you' }).getByRole('button', { name: 'Open' }).click();
    await expect(danPage.getByRole('note')).toContainText('is viewer');
    await expect(danPage.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false');
    await expect.poll(() => text(danPage), { timeout: 20_000 }).toBe('Dawn. The sea was calm. Gulls wheeled.');
    await benPage.locator('.ProseMirror').click();
    await benPage.keyboard.press('Control+End');
    await benPage.keyboard.type(' Then silence.', { delay: 20 });
    await expect.poll(() => text(danPage), { timeout: 30_000 }).toBe('Dawn. The sea was calm. Gulls wheeled. Then silence.');
    expect(await text(adaPage)).toContain('Then silence.');
  });
});
