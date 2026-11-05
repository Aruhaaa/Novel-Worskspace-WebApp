import { expect, test } from '@playwright/test';
import { makeAdmin, openAs, openAsVisitor } from './helpers';

// A database that has not had the newest setup script run yet: the app carries on, errors are kept on the device, and
// the admin is told what to run.
test.describe('error monitoring before the setup script is run', () => {
  test('nothing breaks, the error is kept on this device, and the admin is told what to run', async ({ browser }, testInfo) => {
    const visitor = await openAsVisitor(browser, testInfo);
    const pageErrors: string[] = [];
    visitor.on('pageerror', (e) => pageErrors.push(e.message));
    await visitor.goto('/');
    await visitor.evaluate(() => {
      setTimeout(() => {
        throw new Error('Before the setup');
      }, 0);
    });
    await expect
      .poll(() => visitor.evaluate(() => JSON.parse(localStorage.getItem('novelist_error_log') || '[]').length))
      .toBe(1);
    // The only error on the page is the one the test made; reporting it caused no other
    expect(pageErrors).toEqual(['Before the setup']);

    const admin = await makeAdmin(testInfo);
    const page = await openAs(browser, testInfo, admin);
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('Seen by the admin before the setup');
      }, 0);
    });
    await page.goto('/#/admin');
    const panel = page.getByRole('region', { name: 'Errors' });
    await expect(panel.getByText('The error log is not switched on yet')).toBeVisible();
    await expect(panel.locator('.error-row', { hasText: 'Seen by the admin before the setup' })).toHaveCount(1);
  });
});
