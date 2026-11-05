import { expect, test } from './fixtures';
import { addChapter, createProject, signIn, typeInEditor, waitForSaved } from './helpers';
import type { BrowserContext, Page } from '@playwright/test';

// Two accounts in one browser, each in a tab of their own. Local mode keeps everything in the browser, so what one tab
// does (an invitation, a membership, a notification) is seen by the other, and the tabs reach each other through the
// browser's own messaging, which is also how the live writing travels here. In the cloud the same things go through
// the database and a private Realtime channel; that is tested in e2e/cloud/collab.cloud.spec.ts.

// Each tab starts signed out; once signed in it holds its own account in memory
const startSignedOut = async (tab: Page) => {
  await tab.addInitScript(() => {
    if (!sessionStorage.getItem('__fresh_tab')) {
      sessionStorage.setItem('__fresh_tab', '1');
      localStorage.removeItem('novelist_local_session');
    }
  });
};

const anotherTab = async (context: BrowserContext): Promise<Page> => {
  const tab = await context.newPage();
  await startSignedOut(tab);
  await tab.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (route) => route.abort());
  return tab;
};

/** The token of the newest invitation, read from where local mode keeps it */
const newestInviteToken = (page: Page) =>
  page.evaluate(() => {
    const invites = JSON.parse(localStorage.getItem('novel_project_invites') || '[]') as { token: string; created_at: string }[];
    return invites.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.token ?? '';
  });

/** Ben makes a project with one chapter and writes in it */
const benWrites = async (ben: Page, text: string) => {
  await signIn(ben, 'ben@example.com', 'Write');
  await createProject(ben, 'Shared Tale');
  await addChapter(ben, 'Opening');
  await typeInEditor(ben, text);
  await waitForSaved(ben, text);
};

/** Ben invites someone from the Manuscripts screen, and the link comes back */
const benInvites = async (ben: Page, role: 'co-author' | 'editor' | 'viewer') => {
  await ben.goto('/#/manuscripts');
  await ben.getByRole('button', { name: 'Share', exact: true }).click();
  const dialog = ben.locator('dialog[open]');
  await expect(dialog.getByRole('heading', { name: 'Share “Shared Tale”' })).toBeVisible();
  await dialog.getByLabel('They can').selectOption({ label: role });
  await dialog.getByRole('button', { name: 'Make an invitation link' }).click();
  await expect(dialog.locator('.share-row', { hasText: `as ${role}` })).toBeVisible();
  const token = await newestInviteToken(ben);
  expect(token).not.toBe('');
  await dialog.getByRole('button', { name: 'Done' }).click();
  return token;
};

test.describe('sharing a project', () => {
  test('an invitation lets someone in with the role it was made for, and the owner is told', async ({ page: ben, context }) => {
    await startSignedOut(ben);
    await benWrites(ben, 'The sea was calm.');
    const token = await benInvites(ben, 'editor');

    // Ada follows the link, sees what it is for, and joins
    const ada = await anotherTab(context);
    await signIn(ada, 'ada@example.com', 'Write');
    await ada.goto(`/#/join/${token}`);
    await expect(ada.getByRole('heading', { name: /ben invited you to write “Shared Tale” with them/ })).toBeVisible();
    await expect(ada.getByText('Your role would be editor.')).toBeVisible();
    await ada.getByRole('button', { name: 'Join “Shared Tale”' }).click();

    // She lands on the chapters, told what she may do, without the controls an editor does not have
    await expect(ada).toHaveURL(/#\/chapters/);
    await expect(ada.getByRole('note')).toContainText('Your role on “Shared Tale”, by ben, is editor.');
    await expect(ada.getByRole('button', { name: 'Create new chapter' })).toHaveCount(0);
    await expect(ada.getByLabel('Delete Opening')).toHaveCount(0);
    await expect(ada.getByLabel('Reorder Opening')).toHaveCount(0);
    await expect(ada.getByRole('button', { name: /Open|Opening/ }).first()).toBeVisible();

    // The project is on her Manuscripts screen under "Shared with you", and she can leave it
    await ada.goto('/#/manuscripts');
    const shared = ada.getByRole('region', { name: 'Shared with you' });
    await expect(shared.getByRole('heading', { name: 'Shared Tale' })).toBeVisible();
    await expect(shared.locator('.badge', { hasText: 'editor' })).toBeVisible();
    await expect(shared.getByText('by ben')).toBeVisible();

    // Ben is told, and his project says it is shared
    await expect(ben.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications, 1 new');
    await ben.getByRole('button', { name: /^Notifications/ }).click();
    await expect(ben.getByRole('dialog', { name: 'Notifications' }).locator('.notif-item').first()).toContainText('ada joined Shared Tale as editor');
    await ben.goto('/#/manuscripts');
    await expect(ben.locator('.project-card', { hasText: 'Shared Tale' }).locator('.badge', { hasText: 'Shared' })).toBeVisible();

    // The owner sees her in the list, and can change her role or take her out
    await ben.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = ben.locator('dialog[open]');
    await expect(dialog.locator('.share-row', { hasText: 'ada' }).first()).toBeVisible();
    await dialog.getByLabel('Role of ada').selectOption({ label: 'viewer' });
    await expect(dialog.getByLabel('Role of ada')).toHaveValue('viewer');
    // The invitation was for one person, so it is used up and no longer offered
    await expect(dialog.getByText('No open invitations.')).toBeVisible();

    // Her screen follows the new role once it looks again: she can no longer write
    await ada.reload();
    await ada.goto('/#/editor');
    await expect(ada.getByRole('note')).toContainText('is viewer');
    await expect(ada.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false');

    // Taking her out removes the project from her screen
    ben.once('dialog', (d) => void d.accept());
    await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(dialog.getByText('Nobody yet. It is just you.')).toBeVisible();
  });

  test('a link that is switched off, used up or fake says so, and joining twice is harmless', async ({ page: ben, context }) => {
    await startSignedOut(ben);
    await benWrites(ben, 'The sea was calm.');
    const token = await benInvites(ben, 'co-author');

    const ada = await anotherTab(context);
    await signIn(ada, 'ada@example.com', 'Write');
    await ada.goto('/#/join/not-a-real-token');
    await expect(ada.getByRole('heading', { name: 'This invitation is no longer active' })).toBeVisible();

    await ada.goto(`/#/join/${token}`);
    await ada.getByRole('button', { name: 'Join “Shared Tale”' }).click();
    await expect(ada).toHaveURL(/#\/chapters/);
    // A co-author arranges the manuscript
    await expect(ada.getByRole('button', { name: 'Create new chapter' }).first()).toBeVisible();
    await expect(ada.getByRole('note')).toContainText('is co-author');

    // The link had one use, and it was used
    await ada.goto(`/#/join/${token}`);
    await expect(ada.getByRole('heading', { name: 'This invitation is no longer active' })).toBeVisible();

    // Switching a link off before anyone uses it
    await ben.goto('/#/manuscripts');
    await ben.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = ben.locator('dialog[open]');
    await dialog.getByLabel('They can').selectOption({ label: 'viewer' });
    await dialog.getByRole('button', { name: 'Make an invitation link' }).click();
    await expect(dialog.locator('.share-row', { hasText: 'as viewer' })).toBeVisible();
    const second = await newestInviteToken(ben);
    await dialog.locator('.share-row', { hasText: 'as viewer' }).getByRole('button', { name: 'Switch off' }).click();
    await expect(dialog.getByText('No open invitations.')).toBeVisible();
    const cal = await anotherTab(context);
    await signIn(cal, 'cal@example.com', 'Write');
    await cal.goto(`/#/join/${second}`);
    await expect(cal.getByRole('heading', { name: 'This invitation is no longer active' })).toBeVisible();
  });

  test('someone who is not signed in is sent to sign in and brought straight back to the invitation', async ({ page: ben, context }) => {
    await startSignedOut(ben);
    await benWrites(ben, 'The sea was calm.');
    const token = await benInvites(ben, 'viewer');

    const dan = await anotherTab(context);
    await dan.goto(`/#/join/${token}`);
    await expect(dan.getByRole('heading', { name: /ben invited you to write “Shared Tale” with them/ })).toBeVisible();
    await expect(dan.getByText('You need an account to join.')).toBeVisible();
    await dan.getByRole('button', { name: 'Sign in or make an account' }).click();
    await expect(dan).toHaveURL(/#\/login/);

    await signIn(dan, 'dan@example.com', 'Read');
    // After the one question, the invitation is waiting
    await expect(dan.getByRole('button', { name: 'Join “Shared Tale”' })).toBeVisible();
    await dan.getByRole('button', { name: 'Join “Shared Tale”' }).click();
    await expect(dan.getByRole('note')).toContainText('is viewer');
    // A viewer reads: no toolbar, no typing
    await dan.goto('/#/editor');
    await expect(dan.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false');
    await expect(dan.getByRole('button', { name: 'History' })).toHaveCount(0);
    await expect(dan.getByRole('button', { name: /Publish novel|Unpublish/ })).toHaveCount(0);
    await expect(dan.locator('.ProseMirror')).toContainText('The sea was calm.');
  });
});

test.describe('writing together', () => {
  test('two people in the same chapter see each other, write at once, and end with the same text, once', async ({ page: ben, context }) => {
    test.setTimeout(120_000);
    await startSignedOut(ben);
    await benWrites(ben, 'The sea was calm.');
    const token = await benInvites(ben, 'co-author');

    const ada = await anotherTab(context);
    await signIn(ada, 'ada@example.com', 'Write');
    await ada.goto(`/#/join/${token}`);
    await ada.getByRole('button', { name: 'Join “Shared Tale”' }).click();
    await expect(ada).toHaveURL(/#\/chapters/);

    // Ben (the owner) opens the chapter. The project is shared, so it is written together; nobody else is here yet.
    await ben.goto('/#/editor');
    await expect(ben.locator('.presence-bar')).toContainText('Writing together');
    await expect(ben.locator('.ProseMirror')).toContainText('The sea was calm.');

    // Ada opens the same chapter, and each sees the other
    await ada.getByRole('button', { name: /Opening/ }).first().click();
    await expect(ada.locator('.presence-bar')).toContainText('Here with you:');
    await expect(ada.locator('.presence-bar .presence-dot')).toContainText('ben');
    await expect(ben.locator('.presence-bar .presence-dot')).toContainText('ada');
    await expect(ada.locator('.ProseMirror')).toContainText('The sea was calm.');

    // The text is there once, not twice, however it got to each of them
    // The writing, without the names above other people's cursors, which are for the eyes and not part of the text
    const text = (page: Page) =>
      page
        .locator('.ProseMirror')
        .evaluate((el) => {
          const copy = el.cloneNode(true) as HTMLElement;
          copy.querySelectorAll('.collaboration-carets__label').forEach((label) => label.remove());
          return copy.textContent ?? '';
        })
        .then((t) => t.split(String.fromCharCode(0x2060)).join('').replace(/\s+/g, ' ').trim());
    expect(await text(ben)).toBe('The sea was calm.');
    expect(await text(ada)).toBe('The sea was calm.');

    // Both write at once, in different places
    await ben.locator('.ProseMirror').click();
    await ben.keyboard.press('Control+End');
    await ada.locator('.ProseMirror').click();
    await ada.keyboard.press('Control+Home');
    await Promise.all([ben.keyboard.type(' Gulls wheeled.', { delay: 25 }), ada.keyboard.type('Dawn. ', { delay: 25 })]);

    await expect.poll(() => text(ben), { timeout: 15_000 }).toBe('Dawn. The sea was calm. Gulls wheeled.');
    await expect.poll(() => text(ada), { timeout: 15_000 }).toBe('Dawn. The sea was calm. Gulls wheeled.');

    // Each sees the other's cursor
    await expect(ben.locator('.collaboration-carets__label')).toContainText('ada');
    await expect(ada.locator('.collaboration-carets__label')).toContainText('ben');

    // Undo takes back only your own words
    await ada.locator('.ProseMirror').click();
    await ada.keyboard.press('Control+z');
    await expect.poll(() => text(ada), { timeout: 10_000 }).toBe('The sea was calm. Gulls wheeled.');
    await expect.poll(() => text(ben), { timeout: 10_000 }).toBe('The sea was calm. Gulls wheeled.');

    // And it is saved, by whoever saved last
    await waitForSaved(ben, 'Gulls wheeled.');

    // Ada leaves: her cursor goes from Ben's screen
    await ada.goto('/#/chapters');
    await expect(ben.locator('.presence-bar')).toContainText('nobody else is here yet', { timeout: 40_000 });
  });

  test('switched off in Preferences, a chapter is written on its own', async ({ page: ben }) => {
    await startSignedOut(ben);
    await benWrites(ben, 'The sea was calm.');
    await benInvites(ben, 'editor');
    // The invitation alone does not share the project: only someone joining does. Share it with a pretend member.
    await ben.evaluate(() => {
      const projects = JSON.parse(localStorage.getItem('novel_projects') || '[]') as { id: string; title: string }[];
      const project = projects.find((p) => p.title === 'Shared Tale')!;
      localStorage.setItem('novel_project_members', JSON.stringify([{ project_id: project.id, user_id: 'mock-user-zed@example.com', role: 'editor', added_by: null, created_at: new Date().toISOString() }]));
    });
    await ben.reload();
    await ben.goto('/#/editor');
    await expect(ben.locator('.presence-bar')).toContainText('Writing together');

    await ben.goto('/#/preferences');
    await ben.getByRole('checkbox', { name: 'Write shared chapters together live' }).uncheck();
    await ben.goto('/#/editor');
    await expect(ben.locator('.ProseMirror')).toContainText('The sea was calm.');
    await expect(ben.locator('.presence-bar')).toHaveCount(0);
  });
});
