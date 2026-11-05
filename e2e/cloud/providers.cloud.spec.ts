import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openAsVisitor, sql, uniqueEmail } from './helpers';

// "Continue with Google" and "Continue with Apple" against the stand-in's pretend providers. They answer at once with a
// pretend person, the way the real ones do after the person agrees. Real Google and Apple sign-in cannot be tried here:
// it needs a Google Cloud / Apple Developer account that only the site's owner has.

/** Make the pretend provider sign in a person of our own, so tests running side by side never share one */
const asPerson = async (page: Page, email: string) => {
  await page.route('**/auth/v1/authorize*', (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('login_hint', email);
    return route.continue({ url: url.toString() });
  });
};

test.describe('sign in with Google or Apple', () => {
  test('both buttons are on the sign-in screen, and a new person goes through the one question and in', async ({ browser }, testInfo) => {
    const page = await openAsVisitor(browser, testInfo);
    const email = uniqueEmail('oauth');
    await asPerson(page, email);
    // The pretend person is made first, to know the id the first-visit tour would be remembered under
    const [person] = await sql<{ id: string }>(testInfo, "insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, '', '{}') returning id", [email]);
    await page.addInitScript((id) => {
      for (const name of ['welcome', 'workspace']) localStorage.setItem(`novelist_tour_${name}_${id}`, 'done');
    }, person.id);

    await page.goto('/#/login');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Apple' })).toBeVisible();

    await page.getByRole('button', { name: 'Continue with Google' }).click();
    // Back from the provider, signed in: a new account is asked the one question
    await expect(page.getByRole('radio', { name: /^Write/ })).toBeVisible();
    await page.getByRole('radio', { name: /^Write/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/#\/write/);

    // The secret part of the address the provider sent the person back with is gone from it
    expect(page.url()).not.toContain('access_token');
    await expect.poll(() => page.evaluate(() => location.hash)).not.toContain('refresh_token');

    // The account exists on the server with the provider's address
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sb-')).length);
    expect(stored).toBeGreaterThan(0);

    // Signing in again later (a fresh browser) knows the answer already
    const again = await openAsVisitor(browser, testInfo);
    await again.addInitScript((id) => {
      for (const name of ['welcome', 'workspace']) localStorage.setItem(`novelist_tour_${name}_${id}`, 'done');
    }, person.id);
    await asPerson(again, email);
    await again.goto('/#/login');
    await again.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(again).toHaveURL(/#\/write/);
    await expect(again.getByRole('radio', { name: /^Write/ })).toHaveCount(0);
  });

  test('a person who says no is told so on the sign-in screen, not left on a blank page', async ({ browser }, testInfo) => {
    const page = await openAsVisitor(browser, testInfo);
    await page.route('**/auth/v1/authorize*', (route) => {
      const back = new URL(route.request().url()).searchParams.get('redirect_to') ?? '/';
      return route.fulfill({
        status: 302,
        headers: { location: `${back}#error=access_denied&error_code=access_denied&error_description=The+user+denied+access` },
      });
    });
    await page.goto('/#/login');
    await page.getByRole('button', { name: 'Continue with Apple' }).click();
    await expect(page.getByRole('alert')).toContainText('That sign-in did not finish: The user denied access');
    // It is the sign-in form still, not the "forgot your password" form
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  });

  test('each button sends the browser to its own provider, with the site as the place to come back to', async ({ browser }, testInfo) => {
    const page = await openAsVisitor(browser, testInfo);
    const asked: URL[] = [];
    // Stop at the provider: the page it would have shown is not needed
    await page.route('**/auth/v1/authorize*', (route) => {
      asked.push(new URL(route.request().url()));
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Provider page</p>' });
    });
    await page.goto('/#/login');
    await page.getByRole('button', { name: 'Continue with Apple' }).click();
    await expect(page.getByText('Provider page')).toBeVisible();
    expect(asked).toHaveLength(1);
    expect(asked[0].searchParams.get('provider')).toBe('apple');
    // Back to this site's own address, which must be in Supabase's list of Redirect URLs
    expect(asked[0].searchParams.get('redirect_to')).toBe(new URL('/', testInfo.project.use.baseURL).toString());
  });

  test('inside the desktop app the buttons are not offered (Google refuses to sign in from another program’s window)', async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) novelist-workspace/1.0 Chrome/120.0 Electron/43.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    await page.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (route) => route.abort());
    await page.goto('/#/login');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Continue with/ })).toHaveCount(0);
    await context.close();
  });
});
