import { expect, test } from './fixtures';
import { signIn } from './helpers';
import type { BrowserContext, Page } from '@playwright/test';

// Two accounts in one browser: Ada reads and writes to Ben; Ben has the studio open in another tab. Local mode saves
// everything in the browser, and the browser tells the other tab when saved data changes, so what Ben sees
// arrives as it happens, without a reload.
const ADA = 'mock-user-ada@example.com';
const BEN = 'mock-user-ben@example.com';

const seed = async (context: BrowserContext) => {
  await context.addInitScript(
    ({ ADA, BEN }) => {
      if (localStorage.getItem('__notify_seeded')) return;
      const now = new Date().toISOString();
      localStorage.setItem(
        'novel_projects',
        JSON.stringify([{ id: 'pub1', user_id: BEN, title: 'Long Tides', description: 'A seeded novel', is_published: true, author_name: 'Ben Writer', genre: 'Fantasy', likes: [], views: [], created_at: now, updated_at: now }])
      );
      localStorage.setItem(
        'novel_chapters',
        JSON.stringify([{ id: 'rc1', project_id: 'pub1', title: 'Part 1', content: '<p>The tide came in slowly.</p>', position: 0, created_at: now, updated_at: now }])
      );
      localStorage.setItem(
        'novel_profiles',
        JSON.stringify([
          { id: BEN, display_name: 'Ben Writer', bio: 'Writes about the sea', daily_word_goal: 1000, followers: [], following: [] },
          { id: ADA, display_name: 'Ada Reader', bio: 'Reads everything', daily_word_goal: 1000, followers: [], following: [] },
        ])
      );
      localStorage.setItem('novel_comments', '[]');
      localStorage.setItem('novel_reviews', '[]');
      localStorage.setItem('novelist_sample_library', 'off');
      localStorage.setItem('__notify_seeded', '1');
    },
    { ADA, BEN }
  );
};

// Both tabs share the browser's storage, and a signed-in session is kept there. Each tab starts signed out; once signed in
// it holds its own account in memory, so the other tab signing in does not change who it is.
const startSignedOut = async (tab: Page) => {
  await tab.addInitScript(() => {
    if (!sessionStorage.getItem('__fresh_tab')) {
      sessionStorage.setItem('__fresh_tab', '1');
      localStorage.removeItem('novelist_local_session');
    }
  });
};

const secondTab = async (context: BrowserContext): Promise<Page> => {
  const tab = await context.newPage();
  await startSignedOut(tab);
  await tab.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (route) => route.abort());
  return tab;
};

test.describe('notifications', () => {
  test('a follow, a comment and a review reach the writer as they happen, and can be read, removed and switched off', async ({ page: adaPage, context }) => {
    await seed(context);
    const ben = await secondTab(context);
    await startSignedOut(adaPage);
    await signIn(ben, 'ben@example.com', 'Write');
    await signIn(adaPage, 'ada@example.com', 'Read');

    const bell = ben.getByRole('button', { name: /^Notifications/ });
    await expect(bell).toHaveAccessibleName('Notifications');

    // Ada follows Ben
    await adaPage.goto(`/#/library/author/${BEN}`);
    await adaPage.getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(bell).toHaveAccessibleName('Notifications, 1 new');

    // Ada comments on his chapter and reviews the novel
    await adaPage.goto('/#/library/novel/pub1');
    await adaPage.getByPlaceholder('Share your thoughts on this chapter…').fill('I loved the tide.');
    await adaPage.getByRole('button', { name: 'Post comment' }).click();
    await expect(bell).toHaveAccessibleName('Notifications, 2 new');
    await adaPage.getByPlaceholder('What did you think of this novel?').fill('Beautiful and calm.');
    await adaPage.getByRole('button', { name: 'Post review' }).click();
    await expect(bell).toHaveAccessibleName('Notifications, 3 new');

    // The panel says what happened, newest first
    await bell.click();
    const panel = ben.getByRole('dialog', { name: 'Notifications' });
    const items = panel.locator('.notif-item');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('Ada Reader reviewed Long Tides');
    await expect(items.nth(0)).toContainText('Beautiful and calm.');
    await expect(items.nth(1)).toContainText('Ada Reader commented on Long Tides');
    await expect(items.nth(1)).toContainText('I loved the tide.');
    await expect(items.nth(2)).toContainText('Ada Reader started following you');

    // Opening one marks it read and goes to it
    await items.nth(2).click();
    await expect(ben).toHaveURL(new RegExp(`#/library/author/${ADA.replace(/[.@]/g, '\\$&')}`));
    await expect(bell).toHaveAccessibleName('Notifications, 2 new');

    // The full list, with filters, "Mark all as read" and Remove
    await ben.goto('/#/notifications');
    await expect(ben.locator('.notif-page-list li')).toHaveCount(3);
    await ben.getByRole('tab', { name: /^Unread/ }).click();
    await expect(ben.locator('.notif-page-list li')).toHaveCount(2);
    await ben.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(bell).toHaveAccessibleName('Notifications');
    await expect(ben.getByText('You are all caught up')).toBeVisible();
    await ben.getByRole('tab', { name: 'All' }).click();
    await ben.getByRole('button', { name: 'Remove this notification' }).first().click();
    await expect(ben.locator('.notif-page-list li')).toHaveCount(2);

    // Switch comments off in Preferences: the next one is not recorded
    await ben.goto('/#/preferences');
    await expect(ben.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
    await ben.getByLabel('Comments on your novels: in the app').uncheck();
    await expect(ben.getByText('Saved on this device.', { exact: true })).toBeVisible();
    await adaPage.getByPlaceholder('Share your thoughts on this chapter…').fill('A second comment.');
    await adaPage.getByRole('button', { name: 'Post comment' }).click();
    await expect(adaPage.getByText('A second comment.')).toBeVisible();
    await ben.waitForTimeout(600);
    await expect(bell).toHaveAccessibleName('Notifications');

    // Switched back on, it is recorded again
    await ben.getByLabel('Comments on your novels: in the app').check();
    await adaPage.getByPlaceholder('Share your thoughts on this chapter…').fill('A third comment.');
    await adaPage.getByRole('button', { name: 'Post comment' }).click();
    await expect(bell).toHaveAccessibleName('Notifications, 1 new');
  });

  test('nothing is recorded for your own actions, and guests have no bell', async ({ page, context }) => {
    await seed(context);
    await signIn(page, 'ben@example.com', 'Write');
    await expect(page.getByRole('button', { name: /^Notifications/ })).toBeVisible();
    // Ben comments on his own novel
    await page.goto('/#/library/novel/pub1');
    await page.getByPlaceholder('Share your thoughts on this chapter…').fill('Note to self.');
    await page.getByRole('button', { name: 'Post comment' }).click();
    await expect(page.getByText('Note to self.')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications');
  });
});

test.describe('live messages', () => {
  test('a message arrives at once with an unread count, shows typing and Seen, and clears when read', async ({ page: adaPage, context }) => {
    await seed(context);
    const ben = await secondTab(context);
    await startSignedOut(adaPage);
    await signIn(ben, 'ben@example.com', 'Write');
    await signIn(adaPage, 'ada@example.com', 'Read');

    // Ada has Ben's conversation open
    await adaPage.goto(`/#/messages/${BEN}`);
    await expect(adaPage.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible();
    await adaPage.getByLabel('Message', { exact: true }).fill('Are you there?');
    await adaPage.getByRole('button', { name: 'Send' }).click();
    await expect(adaPage.getByText('Are you there?')).toBeVisible();

    // Ben, elsewhere in the app, sees a count beside Messages without reloading
    const nav = ben.getByRole('link', { name: /^Messages/ });
    await expect(nav.locator('.nav-count')).toHaveText('1');
    await expect(ben.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications, 1 new');

    // He opens the conversation: it is there, and the counts clear
    await ben.goto(`/#/messages/${ADA}`);
    await expect(ben.locator('.bubble', { hasText: 'Are you there?' })).toBeVisible();
    await expect(nav.locator('.nav-count')).toHaveCount(0);
    await expect(ben.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications');

    // Ada sees "Seen" under her message
    await expect(adaPage.locator('.bubble.me', { hasText: 'Are you there?' }).locator('.seen')).toHaveText(/Seen/);

    // Ben types: Ada is told, before anything is sent
    await ben.getByLabel('Message', { exact: true }).pressSequentially('Yes, I am', { delay: 20 });
    await expect(adaPage.getByText('Ben Writer is typing…')).toBeVisible();

    // Ben sends it, and it appears for Ada straight away, with no unread count because the chat is open
    await ben.getByRole('button', { name: 'Send' }).click();
    await expect(adaPage.locator('.bubble', { hasText: 'Yes, I am' })).toBeVisible();
    await expect(adaPage.getByText('Ben Writer is typing…')).toHaveCount(0);
    await expect(adaPage.getByRole('link', { name: /^Messages/ }).locator('.nav-count')).toHaveCount(0);
  });

  test('messages that arrive while another screen is open are counted per person', async ({ page: adaPage, context }) => {
    await seed(context);
    const ben = await secondTab(context);
    await startSignedOut(adaPage);
    await signIn(ben, 'ben@example.com', 'Write');
    await signIn(adaPage, 'ada@example.com', 'Read');
    await adaPage.goto(`/#/messages/${BEN}`);
    for (const text of ['One', 'Two', 'Three']) {
      await adaPage.getByLabel('Message', { exact: true }).fill(text);
      await adaPage.getByRole('button', { name: 'Send' }).click();
      await expect(adaPage.locator('.bubble.me', { hasText: text })).toBeVisible();
    }
    await expect(ben.getByRole('link', { name: /^Messages/ }).locator('.nav-count')).toHaveText('3');
    // One line in the bell, counting up
    await ben.getByRole('button', { name: /^Notifications/ }).click();
    await expect(ben.locator('.notif-item')).toHaveCount(1);
    await expect(ben.locator('.notif-item')).toContainText('Ada Reader sent you 3 new messages');
  });
});
