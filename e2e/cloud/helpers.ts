import { expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ANON_KEY } from '../../scripts/dev-supabase/keys.mjs';
import { LITE_BARE_PORT, LITE_PORT } from './env';

export const PASSWORD = 'cloud-test-pass';

/** Which stand-in the running project talks to. */
export const liteUrl = (testInfo: TestInfo) => `http://127.0.0.1:${testInfo.project.name === 'cloud-before-setup' ? LITE_BARE_PORT : LITE_PORT}`;

let counter = 0;
/** A new address for every test, so tests sharing one database never meet each other's rows. */
export const uniqueEmail = (name: string) => `${name}-${Date.now().toString(36)}-${++counter}-${Math.random().toString(36).slice(2, 6)}@example.com`;

export interface Account {
  email: string;
  name: string;
  id: string;
  /** Talks to the database directly, as this person */
  api: SupabaseClient;
}

/** Make an account straight in the database (no screens), with a profile and a chosen "what opens first". */
export const makeAccount = async (testInfo: TestInfo, name: string, mode: 'read' | 'write' = 'write'): Promise<Account> => {
  const api = createClient(liteUrl(testInfo), ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = uniqueEmail(name.toLowerCase());
  const { data, error } = await api.auth.signUp({ email, password: PASSWORD, options: { data: { use_mode: mode } } });
  if (error || !data.user) throw new Error(`sign-up failed: ${error?.message}`);
  const profile = await api.from('profiles').upsert({ id: data.user.id, display_name: name, bio: `${name} writes`, daily_word_goal: 1000 });
  if (profile.error) throw new Error(`profile failed: ${profile.error.message}`);
  return { email, name, id: data.user.id, api };
};

/** A private (not published) project with one chapter, by this person. */
export const makeProject = async (account: Account, title: string, text = 'The tide came in slowly and went out again, as it always had.') => {
  const project = await account.api.from('projects').insert({ user_id: account.id, title, description: 'A shared test project', is_published: false }).select().single();
  if (project.error) throw new Error(`project failed: ${project.error.message}`);
  const chapter = await account.api.from('chapters').insert({ project_id: project.data.id, title: 'Part 1', content: `<p>${text}</p>`, position: 0 }).select().single();
  if (chapter.error) throw new Error(`chapter failed: ${chapter.error.message}`);
  return { id: project.data.id as string, chapterId: chapter.data.id as string, title };
};

/** Put someone on a project straight in the database (the way an accepted invitation would), with a role. */
export const addMember = async (testInfo: TestInfo, projectId: string, userId: string, role: 'coauthor' | 'editor' | 'viewer') => {
  await sql(testInfo, 'insert into public.project_members (project_id, user_id, role) values ($1, $2, $3)', [projectId, userId, role]);
};

/** The one address the database treats as the admin (_is_admin() in the setup scripts) */
export const ADMIN_EMAIL = 'aruhaadmin@novelist.com';

/**
 * The admin. There is only one such address, and tests run side by side in one database, so whichever test gets here
 * first makes it and the others sign in to it.
 */
export const makeAdmin = async (testInfo: TestInfo): Promise<Account> => {
  const api = createClient(liteUrl(testInfo), ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let id: string | undefined;
  for (let attempt = 0; attempt < 4 && !id; attempt++) {
    const signedIn = await api.auth.signInWithPassword({ email: ADMIN_EMAIL, password: PASSWORD });
    if (signedIn.data.user) {
      id = signedIn.data.user.id;
      break;
    }
    const created = await api.auth.signUp({ email: ADMIN_EMAIL, password: PASSWORD, options: { data: { use_mode: 'write' } } });
    id = created.data.user?.id;
  }
  if (!id) throw new Error('could not make the admin account');
  const profile = await api.from('profiles').upsert({ id, display_name: 'Admin', bio: 'Looks after the library', daily_word_goal: 1000 });
  if (profile.error) throw new Error(`profile failed: ${profile.error.message}`);
  return { email: ADMIN_EMAIL, name: 'Admin', id, api };
};

/** Talks to the database with nobody signed in, as a stranger would */
export const anonClient = (testInfo: TestInfo): SupabaseClient => createClient(liteUrl(testInfo), ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

/** Run a statement straight on the database, with every right, to see what is really stored (the stand-in only) */
export const sql = async <T = Record<string, unknown>>(testInfo: TestInfo, statement: string, params: unknown[] = []): Promise<T[]> => {
  const res = await fetch(`${liteUrl(testInfo)}/__admin/sql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: statement, params }) });
  if (!res.ok) throw new Error(`sql failed: ${await res.text()}`);
  return (await res.json()) as T[];
};

/** A page with nobody signed in, as a visitor's, reaching only the app and the stand-in */
export const openAsVisitor = async (browser: Browser, testInfo: TestInfo): Promise<Page> => {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (route) => route.abort());
  await page.addInitScript(() => {
    try {
      localStorage.setItem('novelist_sample_library', 'off');
    } catch {
      // storage is not available on this page
    }
  });
  return page;
};

/** A published novel with one chapter, by this person. */
export const publishNovel = async (account: Account, title: string, text = 'The tide came in slowly and went out again, as it always had.') => {
  const project = await account.api
    .from('projects')
    .insert({ user_id: account.id, title, description: 'A test novel', is_published: true, author_name: account.name, genre: 'Fantasy' })
    .select()
    .single();
  if (project.error) throw new Error(`project failed: ${project.error.message}`);
  const chapter = await account.api.from('chapters').insert({ project_id: project.data.id, title: 'Part 1', content: `<p>${text}</p>`, position: 0 });
  if (chapter.error) throw new Error(`chapter failed: ${chapter.error.message}`);
  return { id: project.data.id as string, title };
};

/** Open the app as this person, in a browser of their own (their own storage, as a different person's device would be). */
export const openAs = async (browser: Browser, testInfo: TestInfo, account: Account, beforeLoad?: (page: Page) => Promise<void>): Promise<Page> => {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  // For a test that needs the page set up before anything loads, such as a file that cannot be fetched
  await beforeLoad?.(page);
  // Only the app and the stand-in are reachable; nothing else on the internet
  await page.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (route) => route.abort());
  // The first-visit guided tours would cover the screen and take clicks, so they are marked as seen
  await page.addInitScript((id) => {
    for (const name of ['welcome', 'workspace']) localStorage.setItem(`novelist_tour_${name}_${id}`, 'done');
  }, account.id);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('novelist_sample_library', 'off');
    } catch {
      // storage is not available on this page
    }
  });
  await page.goto('/#/login');
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/#\/(read|write)/);
  return page;
};
