import { defineConfig } from '@playwright/test';
import { ANON_KEY } from './scripts/dev-supabase/keys.mjs';
import { APP_PORT, APP_BARE_PORT, APP_PRE_PORT, LITE_PORT, LITE_BARE_PORT, LITE_PRE_PORT } from './e2e/cloud/env';

// The cloud tests run the real app against a stand-in for Supabase (scripts/dev-supabase): the app's real database
// schema and setup scripts on a real PostgreSQL engine, with row level security, triggers and Realtime. Nothing here can
// touch a real Supabase project: the address and key below point at the stand-in, whatever .env says.
//
//   npm run test:e2e:cloud
//
// "cloud" has the newest setup script applied. "cloud-before-setup" has none of the newer ones, and "cloud-before-publishing" has all but
// the chapter publishing one, to see that the app copes until each is run.
const channel = process.env.PW_CHANNEL === 'bundled' ? undefined : (process.env.PW_CHANNEL ?? 'msedge');

const standIn = (port: number, extra = '') => ({
  command: `node scripts/dev-supabase/server.mjs --port ${port} ${extra}`.trim(),
  url: `http://127.0.0.1:${port}/__admin/anon-key`,
  reuseExistingServer: false,
  timeout: 90_000,
});

const app = (port: number, liteUrlPort: number) => ({
  command: `npm run dev -- --port ${port} --strictPort`,
  url: `http://localhost:${port}`,
  reuseExistingServer: false,
  // The sign-in buttons for Google and Apple are switched on, to see them work against the stand-in's pretend providers
  env: { VITE_SUPABASE_URL: `http://127.0.0.1:${liteUrlPort}`, VITE_SUPABASE_ANON_KEY: ANON_KEY, VITE_AUTH_PROVIDERS: 'google,apple' },
  timeout: 60_000,
});

export default defineConfig({
  testDir: './e2e/cloud',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 3,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { channel, acceptDownloads: true, trace: 'retain-on-failure', viewport: { width: 1280, height: 800 } },
  projects: [
    { name: 'cloud', testMatch: /\.cloud\.spec\.ts$/, use: { baseURL: `http://localhost:${APP_PORT}` } },
    { name: 'cloud-before-setup', testMatch: /\.before-setup\.spec\.ts$/, use: { baseURL: `http://localhost:${APP_BARE_PORT}` } },
    { name: 'cloud-before-publishing', testMatch: /\.before-publishing\.spec\.ts$/, use: { baseURL: `http://localhost:${APP_PRE_PORT}` } },
  ],
  webServer: [
    standIn(LITE_PORT),
    standIn(LITE_BARE_PORT, '--no-next-features'),
    standIn(LITE_PRE_PORT, '--no-chapter-publishing'),
    app(APP_PORT, LITE_PORT),
    app(APP_BARE_PORT, LITE_BARE_PORT),
    app(APP_PRE_PORT, LITE_PRE_PORT),
  ],
});
