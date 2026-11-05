import { expect, test } from '@playwright/test';
import { makeAccount, openAs } from './helpers';

test.describe('live messages through the server', () => {
  test('a message arrives at once with a count, shows typing and Seen, and stays read after a reload', async ({ browser }, testInfo) => {
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const ada = await makeAccount(testInfo, 'Ada', 'read');
    const benPage = await openAs(browser, testInfo, ben);
    const adaPage = await openAs(browser, testInfo, ada);

    // Ada writes to Ben
    await adaPage.goto(`/#/messages/${ben.id}`);
    await adaPage.getByLabel('Message', { exact: true }).fill('Are you there?');
    await adaPage.getByRole('button', { name: 'Send' }).click();
    await expect(adaPage.locator('.bubble.me', { hasText: 'Are you there?' })).toBeVisible();

    // Ben, on another screen, is told with a count (and a line in the bell) without reloading
    const messagesLink = benPage.getByRole('link', { name: /^Messages/ });
    await expect(messagesLink.locator('.nav-count')).toHaveText('1');
    await expect(benPage.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications, 1 new');
    const counts = await ben.api.rpc('unread_message_counts');
    expect(counts.data?.map((r: { unread: number | string }) => Number(r.unread))).toEqual([1]);

    // He opens the conversation: the count clears, here and on the server
    await benPage.goto(`/#/messages/${ada.id}`);
    await expect(benPage.locator('.bubble', { hasText: 'Are you there?' })).toBeVisible();
    await expect(messagesLink.locator('.nav-count')).toHaveCount(0);
    await expect(benPage.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications');
    await expect.poll(async () => (await ben.api.rpc('unread_message_counts')).data?.length).toBe(0);

    // Ada sees Seen, delivered live from the server's read mark
    await expect(adaPage.locator('.bubble.me', { hasText: 'Are you there?' }).locator('.seen')).toHaveText(/Seen/);

    // Ben types: Ada is told before anything is sent
    await benPage.getByLabel('Message', { exact: true }).pressSequentially('Yes, I am', { delay: 20 });
    await expect(adaPage.getByText('Ben is typing…')).toBeVisible();

    // He sends it; it appears for Ada straight away and she has nothing unread because the chat is open
    await benPage.getByRole('button', { name: 'Send' }).click();
    await expect(adaPage.locator('.bubble', { hasText: 'Yes, I am' })).toBeVisible();
    await expect(adaPage.getByText('Ben is typing…')).toHaveCount(0);
    await expect(adaPage.getByRole('link', { name: /^Messages/ }).locator('.nav-count')).toHaveCount(0);

    // After a reload nothing is unread: the read marks are on the server, not just in the page
    await benPage.reload();
    await expect(benPage.locator('.bubble', { hasText: 'Are you there?' })).toBeVisible();
    await expect(benPage.getByRole('link', { name: /^Messages/ }).locator('.nav-count')).toHaveCount(0);
    await adaPage.reload();
    await expect(adaPage.locator('.bubble', { hasText: 'Yes, I am' })).toBeVisible();
    await expect(adaPage.getByRole('link', { name: /^Messages/ }).locator('.nav-count')).toHaveCount(0);
  });

  test('three messages are three unread, one line in the bell counting up', async ({ browser }, testInfo) => {
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const ada = await makeAccount(testInfo, 'Ada', 'read');
    const benPage = await openAs(browser, testInfo, ben);
    const adaPage = await openAs(browser, testInfo, ada);
    await adaPage.goto(`/#/messages/${ben.id}`);
    for (const text of ['One', 'Two', 'Three']) {
      await adaPage.getByLabel('Message', { exact: true }).fill(text);
      await adaPage.getByRole('button', { name: 'Send' }).click();
      await expect(adaPage.locator('.bubble.me', { hasText: text })).toBeVisible();
    }
    await expect(benPage.getByRole('link', { name: /^Messages/ }).locator('.nav-count')).toHaveText('3');
    await benPage.getByRole('button', { name: /^Notifications/ }).click();
    await expect(benPage.locator('.notif-item')).toHaveCount(1);
    await expect(benPage.locator('.notif-item')).toContainText('Ada sent you 3 new messages');
  });
});
