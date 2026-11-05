import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { anonClient, makeAccount, makeAdmin, openAs, openAsVisitor, sql } from './helpers';

// Errors on people's screens go to the database through a function the server limits and cleans, and only the admin
// can read them. Tests share one database, so every error here carries a word of its own that only it uses.
const word = () => `Zz${Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 8)}`;

const crash = (page: Page, message: string) =>
  page.evaluate((text) => {
    setTimeout(() => {
      throw new Error(text);
    }, 0);
  }, message);

interface Stored {
  message: string;
  stack: string;
  url: string;
  user_agent: string;
  source: string;
  app_version: string;
  extra: { where?: string; components?: string };
}

const stored = (testInfo: Parameters<typeof sql>[0], marker: string) =>
  sql<Stored>(testInfo, 'select message, stack, url, user_agent, source, app_version, extra from public.client_errors where message like $1 order by id', [`%${marker}%`]);

test.describe('error monitoring through the server', () => {
  test('an error on a stranger’s screen reaches the admin’s list, with nothing private, and only the admin can read it', async ({ browser }, testInfo) => {
    const marker = word();
    const admin = await makeAdmin(testInfo);
    const ben = await makeAccount(testInfo, 'Ben', 'write');

    // Someone who is not signed in at all has a problem, while a password-reset link is in the address
    const visitor = await openAsVisitor(browser, testInfo);
    await visitor.goto('/');
    await expect(visitor.locator('body')).toHaveClass(/landing/);
    await visitor.evaluate(() => history.replaceState(null, '', '/#access_token=SECRET.TOKEN.VALUE&type=recovery'));
    await crash(visitor, `Chapters would not open ${marker} for ada@example.com`);
    await expect.poll(async () => (await stored(testInfo, marker)).length).toBe(1);

    const [row] = await stored(testInfo, marker);
    expect(row.message).toBe(`Error: Chapters would not open ${marker} for [email]`);
    expect(JSON.stringify(row)).not.toContain('SECRET');
    expect(JSON.stringify(row)).not.toContain('ada@example.com');
    expect(row.url).toBe('#/');
    expect(row.source).toBe('web');
    expect(row.app_version).not.toBe('');
    expect(row.extra.where).toBe('window');
    // The stack says where in the program, not the words of the message and not the host
    expect(row.stack).toContain('at ');
    expect(row.stack).not.toContain(marker);
    expect(row.stack).not.toContain('localhost');

    // The admin reads it in the Admin screen
    const adminPage = await openAs(browser, testInfo, admin);
    await adminPage.goto('/#/admin');
    const panel = adminPage.getByRole('region', { name: 'Errors' });
    const line = panel.locator('.error-row', { hasText: marker });
    await expect(line).toHaveCount(1);
    await expect(line.locator('.error-count')).toHaveText('1×');
    await expect(panel.getByText('This device only')).toBeHidden();

    // Anyone else is refused by the server itself, not just by the screen
    const refused = await ben.api.rpc('admin_error_groups', { p_days: 14 });
    expect(refused.error?.message).toBe('Only the admin can do this.');
    const clearRefused = await ben.api.rpc('admin_clear_errors', { p_fingerprint: null });
    expect(clearRefused.error?.message).toBe('Only the admin can do this.');
    const direct = await ben.api.from('client_errors').select('*');
    expect(direct.error).not.toBeNull();
    // ...and so is someone not signed in at all (though they can report, as the visitor above just did)
    const stranger = anonClient(testInfo);
    expect((await stranger.rpc('admin_error_groups', { p_days: 14 })).error).not.toBeNull();
    expect((await stranger.from('client_errors').select('*')).error).not.toBeNull();

    // Clearing one problem clears it from the server
    await line.locator('summary').click();
    await line.getByRole('button', { name: 'Clear this one' }).click();
    await expect(line).toHaveCount(0);
    expect(await stored(testInfo, marker)).toHaveLength(0);
  });

  test('a problem that keeps happening is limited on the page, and the server limits it too', async ({ browser }, testInfo) => {
    const marker = word();
    const visitor = await openAsVisitor(browser, testInfo);
    await visitor.goto('/');
    for (let i = 0; i < 7; i++) await visitor.evaluate((text) => void Promise.reject(new Error(text)), `Loop ${marker}`);
    await expect.poll(async () => (await stored(testInfo, marker)).length).toBe(3);
    await visitor.waitForTimeout(400);
    expect(await stored(testInfo, marker)).toHaveLength(3);

    // Past the server’s daily ceiling for one problem, more are simply not kept (a loop in someone's browser cannot fill the table)
    const fingerprint = (await sql<{ fingerprint: string }>(testInfo, 'select fingerprint from public.client_errors where message like $1 limit 1', [`%${marker}%`]))[0].fingerprint;
    const api = (await makeAccount(testInfo, 'Cal', 'write')).api;
    for (let i = 0; i < 60; i++) await api.rpc('report_client_error', { p_fingerprint: fingerprint, p_message: `Loop ${marker}`, p_stack: '' });
    const count = await sql<{ n: string }>(testInfo, 'select count(*) as n from public.client_errors where fingerprint = $1', [fingerprint]);
    expect(Number(count[0].n)).toBe(50);
    // Clean up after the loop so other tests' lists stay short
    await sql(testInfo, 'delete from public.client_errors where fingerprint = $1', [fingerprint]);
  });

  test('a screen that cannot be loaded is noted with where it happened', async ({ browser }, testInfo) => {
    const ada = await makeAccount(testInfo, 'Ada', 'write');
    // The file for the Profile screen cannot be fetched, as when the connection drops or a new release replaced it
    const page = await openAs(browser, testInfo, ada, async (p) => {
      await p.route(/\/ProfileView\.tsx/, (route) => route.abort());
    });
    await page.goto('/#/profile');
    await expect(page.getByRole('heading', { name: 'This part of the app could not be loaded' })).toBeVisible();

    await expect
      .poll(async () => (await sql<Stored>(testInfo, "select message, extra from public.client_errors where message like '%dynamically imported module%ProfileView%' and created_at > now() - interval '2 minutes'")).length)
      .toBeGreaterThan(0);
    const [row] = await sql<Stored>(testInfo, "select message, extra from public.client_errors where message like '%dynamically imported module%ProfileView%' and created_at > now() - interval '2 minutes' order by id desc limit 1");
    expect(row.extra.where).toBe('screen');
    expect(row.extra.components).toBeTruthy();
    expect(row.message).not.toContain('localhost');
    // Reports are not tied to a person
    const cols = await sql<{ column_name: string }>(testInfo, "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'client_errors'");
    expect(cols.map((c) => c.column_name)).not.toContain('user_id');
    await sql(testInfo, "delete from public.client_errors where message like '%dynamically imported module%ProfileView%'");
  });

  test('switched off in Preferences, nothing is sent', async ({ browser }, testInfo) => {
    const marker = word();
    const ada = await makeAccount(testInfo, 'Ada', 'write');
    const page = await openAs(browser, testInfo, ada);
    await page.goto('/#/preferences');
    await page.getByRole('checkbox', { name: 'Send a note when something goes wrong' }).uncheck();
    await crash(page, `Quiet ${marker}`);
    await page.waitForTimeout(600);
    expect(await stored(testInfo, marker)).toHaveLength(0);
  });
});
