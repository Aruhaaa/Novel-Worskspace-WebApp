import { _electron as electron } from '@playwright/test';
import { expect, test } from './fixtures';
import { PASSWORD, signIn } from './helpers';
import packageJson from '../package.json' with { type: 'json' };

// The desktop app has two halves: the window (this app, with a small bridge handed to it) and the program around the
// window (electron/main.js). The first describe block gives the window a pretend bridge, so what it shows for each
// state of an update can be seen. The second starts the real desktop app, to see that the bridge really arrives and
// really reaches the program around the window.
//
// What is NOT tested anywhere: downloading and installing a real release. That needs a published release to fetch.

test.describe('the window, with a pretend desktop bridge', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      let state: Record<string, unknown> = { status: 'idle' };
      const listeners = new Set<(s: Record<string, unknown>) => void>();
      const push = (next: Record<string, unknown>) => {
        state = next;
        listeners.forEach((l) => l(next));
      };
      w.__pushUpdate = push;
      w.__installs = 0;
      w.__checks = 0;
      w.novelistDesktop = {
        isDesktop: true,
        version: async () => '1.2.3',
        getUpdateState: async () => state,
        checkForUpdates: async () => {
          w.__checks = (w.__checks as number) + 1;
          push({ status: 'checking' });
          await new Promise((r) => setTimeout(r, 50));
          push({ status: 'current', checkedAt: new Date().toISOString() });
          return state;
        },
        installUpdate: async () => {
          w.__installs = (w.__installs as number) + 1;
          return true;
        },
        onUpdate: (listener: (s: Record<string, unknown>) => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    });
  });

  const push = (page: import('@playwright/test').Page, state: Record<string, unknown>) => page.evaluate((s) => (window as unknown as { __pushUpdate: (s: unknown) => void }).__pushUpdate(s), state);
  const count = (page: import('@playwright/test').Page, what: '__installs' | '__checks') => page.evaluate((k) => (window as unknown as Record<string, number>)[k], what);

  test('Preferences shows the version and what an update is doing, and a newer version asks to restart', async ({ page }) => {
    await signIn(page, 'desktop@example.com', 'Write');
    await page.goto('/#/preferences');
    const section = page.getByRole('region', { name: 'App updates' });
    await expect(section.getByText('You are using version 1.2.3.')).toBeVisible();
    await expect(section.getByText('looks for a newer version a few seconds after it opens')).toBeVisible();

    // Asking now
    await section.getByRole('button', { name: 'Check for updates' }).click();
    await expect(section.getByText('You have the newest version.')).toBeVisible();
    expect(await count(page, '__checks')).toBe(1);

    // One is found and downloaded
    await push(page, { status: 'downloading', version: '1.3.0', percent: 42 });
    await expect(section.getByText('Downloading version 1.3.0… 42%')).toBeVisible();
    await expect(section.getByRole('button', { name: 'Check for updates' })).toBeDisabled();
    await expect(page.locator('.update-notice')).toHaveCount(0);

    // It is ready: the notice appears wherever the person is, with the choice
    await push(page, { status: 'ready', version: '1.3.0' });
    const notice = page.locator('.update-notice');
    await expect(notice).toContainText('Version 1.3.0 is ready. Restart to finish updating.');
    await expect(section.getByText('Version 1.3.0 is ready. It is installed when you close the app, or now.')).toBeVisible();

    // "Later" puts the notice away, but a still newer version is announced again
    await notice.getByRole('button', { name: 'Later' }).click();
    await expect(notice).toHaveCount(0);
    await push(page, { status: 'ready', version: '1.4.0' });
    await expect(notice).toContainText('Version 1.4.0 is ready');

    // "Restart now" asks the desktop app to install
    await notice.getByRole('button', { name: 'Restart now' }).click();
    await expect.poll(() => count(page, '__installs')).toBe(1);
  });

  test('a failed check says so plainly and does not block anything', async ({ page }) => {
    await signIn(page, 'offline@example.com', 'Write');
    await page.goto('/#/preferences');
    await push(page, { status: 'error', message: 'net::ERR_INTERNET_DISCONNECTED' });
    const section = page.getByRole('region', { name: 'App updates' });
    await expect(section.getByText('Could not check for updates right now (net::ERR_INTERNET_DISCONNECTED). The app tries again later.')).toBeVisible();
    await expect(section.getByRole('button', { name: 'Check for updates' })).toBeEnabled();
    await expect(page.locator('.update-notice')).toHaveCount(0);
  });

  test('a copy run from source says it does not update itself', async ({ page }) => {
    await signIn(page, 'source@example.com', 'Write');
    await page.goto('/#/preferences');
    await push(page, { status: 'unavailable' });
    const section = page.getByRole('region', { name: 'App updates' });
    await expect(section.getByText('This copy is running from source, so it does not update itself.')).toBeVisible();
    await expect(section.getByRole('button', { name: 'Check for updates' })).toBeDisabled();
  });
});

test.describe('in a browser', () => {
  test('there is no update section and no notice', async ({ page }) => {
    await signIn(page, 'browser@example.com', 'Write');
    await page.goto('/#/preferences');
    await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'App updates' })).toHaveCount(0);
    await expect(page.locator('.update-notice')).toHaveCount(0);
  });
});

test.describe('the real desktop app', () => {
  // The app is started from source, showing this test run's own copy of the website
  test('the bridge reaches the window and the program around it, and a copy from source does not update', async () => {
    test.setTimeout(120_000);
    const app = await electron.launch({
      args: ['.'],
      env: { ...process.env, ELECTRON_START_URL: 'http://localhost:5181', ELECTRON_NO_DEVTOOLS: '1' },
    });
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      // Arrived through the sandboxed window's own preload file
      await expect.poll(() => window.evaluate(() => typeof (globalThis as unknown as { novelistDesktop?: unknown }).novelistDesktop)).toBe('object');
      type Bridge = { version: () => Promise<string>; getUpdateState: () => Promise<unknown>; checkForUpdates: () => Promise<unknown>; installUpdate: () => Promise<boolean> };
      const call = <T>(fn: (b: Bridge) => Promise<T>) => window.evaluate(`(${fn.toString()})(window.novelistDesktop)`) as Promise<T>;
      expect(await call((b) => b.version())).toBe(packageJson.version);
      expect(await call((b) => b.getUpdateState())).toEqual({ status: 'unavailable' });
      expect(await call((b) => b.checkForUpdates())).toEqual({ status: 'unavailable' });
      expect(await call((b) => b.installUpdate())).toBe(false);

      // Nothing else of the computer is handed to the page
      const exposed = await window.evaluate(() => Object.keys((globalThis as unknown as { novelistDesktop: object }).novelistDesktop).sort());
      expect(exposed).toEqual(['checkForUpdates', 'getUpdateState', 'installUpdate', 'isDesktop', 'onUpdate', 'version']);
      expect(await window.evaluate(() => typeof (globalThis as unknown as { require?: unknown }).require)).toBe('undefined');
      expect(await window.evaluate(() => typeof (globalThis as unknown as { process?: unknown }).process)).toBe('undefined');

      // And the screens use it: sign in inside the desktop window and look at Preferences
      await window.addInitScript((address) => {
        for (const name of ['welcome', 'workspace']) localStorage.setItem(`novelist_tour_${name}_mock-user-${address}`, 'done');
      }, 'native@example.com');
      await window.goto('http://localhost:5181/#/login');
      await window.getByLabel('Email address').fill('native@example.com');
      await window.getByLabel('Password', { exact: true }).fill(PASSWORD);
      await window.getByRole('button', { name: 'Sign in' }).click();
      await window.getByRole('radio', { name: /^Write/ }).click();
      await window.getByRole('button', { name: 'Continue' }).click();
      await expect(window).toHaveURL(/#\/write/);
      await window.goto('http://localhost:5181/#/preferences');
      const section = window.getByRole('region', { name: 'App updates' });
      await expect(section.getByText(`You are using version ${packageJson.version}.`)).toBeVisible();
      await expect(section.getByText('This copy is running from source, so it does not update itself.')).toBeVisible();
    } finally {
      await app.close();
    }
  });
});
