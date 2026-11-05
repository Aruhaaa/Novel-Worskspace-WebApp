import { test as base, expect } from '@playwright/test';

/**
 * Every test uses this instead of the plain "test". It lets through only requests to the app itself, so a test
 * never loads the ad script in index.html, never reaches the internet, and never waits on something outside.
 */
export const test = base.extend({
  // Playwright calls this callback "use"; it is renamed so the React hooks lint rule does not mistake it for a hook
  page: async ({ page }, provide) => {
    await page.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (route) => route.abort());
    // The sample novels that ship with the site stay out of the library, so the tests see only what they put there.
    // e2e/sample-library.spec.ts removes this again, after this script has run, to test them.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('novelist_sample_library', 'off');
      } catch {
        // storage is not available on this page
      }
    });
    await provide(page);
  },
});

export { expect };
