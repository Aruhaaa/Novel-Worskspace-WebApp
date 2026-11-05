import { expect, test } from './fixtures';

// Google and Apple need the cloud database, so in local mode (what these tests always run in) there is nothing to
// offer. The working buttons are tested against the stand-in Supabase in e2e/cloud/providers.cloud.spec.ts.
test.describe('sign in with Google or Apple, in local mode', () => {
  test('there are no provider buttons without a cloud database', async ({ page }) => {
    await page.goto('/#/login');
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Continue with/ })).toHaveCount(0);
  });

  test('a sign-in that did not finish is explained on the sign-in form, not the forgot-password form', async ({ page }) => {
    await page.goto('/#error=access_denied&error_code=access_denied&error_description=The+user+denied+access');
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('That sign-in did not finish: The user denied access');
    await expect(page.getByRole('heading', { name: 'Forgot it?' })).toHaveCount(0);
  });

  test('an expired password-reset link is still the forgot-password form', async ({ page }) => {
    await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    await expect(page.getByRole('heading', { name: 'Forgot it?' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('expired or was already used');
  });
});
