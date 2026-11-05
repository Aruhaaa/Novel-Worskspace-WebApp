import { defineConfig } from '@playwright/test';

// The smoke tests run the app in its local fallback mode: the cloud keys are blanked below, so everything is
// kept in the test browser and the real database can never be touched.
const PORT = 5181;

// Uses the Edge that comes with Windows, so nothing has to be downloaded. On a machine without it, run
// "npx playwright install chromium" once and set PW_CHANNEL=bundled.
const channel = process.env.PW_CHANNEL === 'bundled' ? undefined : (process.env.PW_CHANNEL ?? 'msedge');

export default defineConfig({
  testDir: './e2e',
  // The cloud tests need the stand-in Supabase and have their own config: npm run test:e2e:cloud
  testIgnore: '**/cloud/**',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  // Few at once: the editor tests type and wait on timers, and too many together make them time out (with 4 at once a
  // different test or two timed out on each full run; with 2 the whole suite passes, and it takes about as long)
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel,
    acceptDownloads: true,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Never reuse a server that is already running: it could be pointed at the real database
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    timeout: 60_000,
  },
});
