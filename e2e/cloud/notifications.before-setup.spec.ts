import { expect, test } from '@playwright/test';
import { makeAccount, openAs } from './helpers';

// The database before supabase/setup_scripts/20261105_next_features.sql has been run: no notifications table, no
// read marks, no follow function. The app has to keep working and say what is missing, not break.
test.describe('before the new setup step has been run', () => {
  test('notifications say they are not switched on, and the rest of the app carries on', async ({ browser }, testInfo) => {
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const page = await openAs(browser, testInfo, ben);
    await expect(page.getByRole('button', { name: /^Notifications/ })).toBeVisible();
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await expect(page.getByRole('dialog', { name: 'Notifications' }).getByText('Notifications are not switched on for this site yet.')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.goto('/#/notifications');
    await expect(page.getByText('Notifications are not switched on yet')).toBeVisible();

    await page.goto('/#/preferences');
    await expect(page.getByText('Notifications are not switched on for this site yet, so these choices apply once they are.')).toBeVisible();
    // Choices are kept on this device meanwhile
    await page.getByLabel('Comments on your novels: in the app').uncheck();
    await expect(page.getByText('Saved on this device.', { exact: true })).toBeVisible();
    await page.goto('/#/write');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('messages still arrive with an unread count, counted against this device\'s read marks', async ({ browser }, testInfo) => {
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const ada = await makeAccount(testInfo, 'Ada', 'read');
    const benPage = await openAs(browser, testInfo, ben);
    const adaPage = await openAs(browser, testInfo, ada);

    await adaPage.goto(`/#/messages/${ben.id}`);
    await adaPage.getByLabel('Message', { exact: true }).fill('Hello before the setup');
    await adaPage.getByRole('button', { name: 'Send' }).click();
    await expect(adaPage.locator('.bubble.me', { hasText: 'Hello before the setup' })).toBeVisible();

    // Without live delivery the app checks every few seconds
    await expect(benPage.getByRole('link', { name: /^Messages/ }).locator('.nav-count')).toHaveText('1', { timeout: 20_000 });
    await benPage.goto(`/#/messages/${ada.id}`);
    await expect(benPage.locator('.bubble', { hasText: 'Hello before the setup' })).toBeVisible();
    await expect(benPage.getByRole('link', { name: /^Messages/ }).locator('.nav-count')).toHaveCount(0);
    // Reading it is remembered on this device
    await benPage.reload();
    await expect(benPage.locator('.bubble', { hasText: 'Hello before the setup' })).toBeVisible();
    await expect(benPage.getByRole('link', { name: /^Messages/ }).locator('.nav-count')).toHaveCount(0);
  });
});
