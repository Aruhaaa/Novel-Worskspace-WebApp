import { expect, test } from './fixtures';
import { signIn } from './helpers';
import type { Page } from '@playwright/test';

// With no cloud database (local mode) errors are kept on the device and the admin reads them in the Admin screen.
// What matters most here is what is NOT kept: no addresses with secrets in them, no email addresses, no writing.
const ADMIN = 'aruhaadmin@novelist.com';

/** Something goes wrong in the page and nobody catches it, as a bug would */
const crash = (page: Page, message: string) =>
  page.evaluate((text) => {
    setTimeout(() => {
      throw new Error(text);
    }, 0);
  }, message);

const kept = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('novelist_error_log') || '[]') as { message: string; sample_url: string; sample_stack: string; occurrences: number }[]);

test.describe('error monitoring', () => {
  test('an error nobody caught is noted without anything private, and the admin can read and clear it', async ({ page }) => {
    await signIn(page, ADMIN, 'Write');

    // A password-reset link puts a secret in the address. An error while it is showing must not carry it away.
    await page.evaluate(() => history.replaceState(null, '', '/#access_token=SECRET.TOKEN.VALUE&type=recovery'));
    await crash(page, 'Cannot read properties of undefined (reading "title") for ada@example.com');
    await expect.poll(async () => (await kept(page)).length).toBe(1);
    await page.evaluate(() => history.replaceState(null, '', '/#/write'));

    // A broken promise is noted too, and the same problem seen again counts up rather than listing twice
    await page.evaluate(() => void Promise.reject(new Error('Saving failed after 3 tries')));
    await page.evaluate(() => void Promise.reject(new Error('Saving failed after 9 tries')));
    await expect.poll(async () => (await kept(page)).length).toBe(2);

    // The browser's own noise is not an error in the app
    await crash(page, 'ResizeObserver loop completed with undelivered notifications.');
    await page.evaluate(() => void Promise.reject(new TypeError('Failed to fetch')));
    await page.waitForTimeout(150);
    expect(await kept(page)).toHaveLength(2);

    const log = await kept(page);
    const text = JSON.stringify(log);
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain('ada@example.com');
    expect(text).toContain('[email]');
    const saving = log.find((g) => g.message.includes('Saving failed'));
    expect(saving?.occurrences).toBe(2);
    // Where the problem was: only which screen, never a secret
    expect(log.find((g) => g.message.includes('Cannot read'))?.sample_url).toBe('#/');

    // The admin's list
    await page.goto('/#/admin');
    const panel = page.getByRole('region', { name: 'Errors' });
    await expect(panel.getByText('This device only')).toBeVisible();
    await expect(panel.locator('.error-row')).toHaveCount(2);
    const savingRow = panel.locator('.error-row', { hasText: 'Saving failed' });
    await expect(savingRow.locator('.error-count')).toHaveText('2×');
    await savingRow.locator('summary').click();
    await expect(savingRow.getByRole('button', { name: 'Clear this one' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('SECRET');

    await savingRow.getByRole('button', { name: 'Clear this one' }).click();
    await expect(panel.locator('.error-row')).toHaveCount(1);
    await panel.getByRole('button', { name: 'Clear all' }).click();
    await expect(panel.getByText('Nothing has gone wrong')).toBeVisible();
    expect(await kept(page)).toHaveLength(0);
  });

  test('a problem that keeps happening is not noted over and over', async ({ page }) => {
    await signIn(page, 'someone@example.com', 'Write');
    for (let i = 0; i < 8; i++) await page.evaluate(() => void Promise.reject(new Error('The same thing again')));
    await expect.poll(async () => (await kept(page))[0]?.occurrences).toBe(3);
    await page.waitForTimeout(150);
    expect((await kept(page))[0].occurrences).toBe(3);
  });

  test('switching it off in Preferences stops the notes', async ({ page }) => {
    await signIn(page, 'private@example.com', 'Write');
    await page.goto('/#/preferences');
    const toggle = page.getByRole('checkbox', { name: 'Send a note when something goes wrong' });
    await expect(toggle).toBeChecked();
    await toggle.uncheck();

    await crash(page, 'Should never be noted');
    await page.waitForTimeout(250);
    expect(await kept(page)).toHaveLength(0);

    // The choice is remembered
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Send a note when something goes wrong' })).not.toBeChecked();

    await page.getByRole('checkbox', { name: 'Send a note when something goes wrong' }).check();
    await crash(page, 'Noted again');
    await expect.poll(async () => (await kept(page)).length).toBe(1);
  });

  test('a screen that cannot be drawn shows a way back, and the problem is noted with where it happened', async ({ page }) => {
    // The file for this screen cannot be fetched, as when the connection drops or a new release replaced it
    await page.route(/\/ProfileView\.tsx/, (route) => route.abort());
    await signIn(page, 'unlucky@example.com', 'Read');
    await page.goto('/#/profile');
    await expect(page.getByRole('heading', { name: 'This part of the app could not be loaded' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
    await expect.poll(async () => (await kept(page)).length).toBe(1);
    const [entry] = await kept(page);
    expect(entry.message).toContain('Failed to fetch dynamically imported module');
    // The host and any query are gone from the message
    expect(entry.message).not.toContain('localhost');
    expect(entry.message).not.toContain('?');

    // Going to another screen gives the app another try
    await page.goto('/#/read');
    await expect(page.getByRole('heading', { name: 'This part of the app could not be loaded' })).toBeHidden();
  });
});
