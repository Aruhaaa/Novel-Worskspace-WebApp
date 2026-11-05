import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'test-pass-123';

/** Sign in to local mode. Any address works: the account lives only in the test browser. */
export const signIn = async (page: Page, email: string, mode: 'Read' | 'Write' | 'Both' = 'Write') => {
  // The first-visit guided tours would take the keyboard from whatever is being typed, so mark them as seen
  await page.addInitScript((address) => {
    for (const name of ['welcome', 'workspace']) localStorage.setItem(`novelist_tour_${name}_mock-user-${address}`, 'done');
  }, email);
  await page.goto('/#/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // The one question asked of someone new
  await page.getByRole('radio', { name: new RegExp(`^${mode}`) }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(mode === 'Write' ? /#\/write/ : /#\/read/);
};

/** Make a project from the Manuscripts screen and leave it open. */
export const createProject = async (page: Page, title: string) => {
  await page.goto('/#/manuscripts');
  await page.getByRole('button', { name: /New project|Create your first project/ }).first().click();
  await page.getByLabel('Project title').fill(title);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
};

/** Add a chapter on the chapter index and open it in the editor. */
export const addChapter = async (page: Page, title: string) => {
  await page.goto('/#/chapters');
  await page.getByRole('button', { name: 'Create new chapter' }).first().click();
  await page.getByLabel('Chapter title').fill(title);
  await page.getByRole('button', { name: 'Create chapter' }).click();
  // A new chapter becomes the open one but the index stays on screen, so go and write in it
  await expect(page.getByLabel(`Reorder ${title}`)).toBeVisible();
  await page.goto('/#/editor');
  await expect(page.getByLabel('Chapter title')).toHaveValue(title);
};

/** Type into the open chapter the way a person would. */
export const typeInEditor = async (page: Page, text: string) => {
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await expect(editor).toBeFocused();
  await page.keyboard.press('Control+End');
  // A little delay between keys, as a person's typing has
  await page.keyboard.type(text, { delay: 10 });
  await expect(editor).toContainText(text.trim());
};

/**
 * Wait until text has really been saved. The "Saved" label alone is not enough: it is already showing before
 * anything is typed. In local mode saving means the chapter is written to the browser's storage.
 */
export const waitForSaved = async (page: Page, text: string) => {
  await expect
    .poll(() => page.evaluate((t) => (localStorage.getItem('novel_chapters') ?? '').includes(t), text), { message: `"${text}" was not saved` })
    .toBe(true);
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
};

/**
 * Put a published novel by another author into the browser's storage before the app starts, so reader
 * features can be tried without a second account. Runs once per browser, not on every reload.
 */
export interface SeedChapter {
  id: string;
  title: string;
  html: string;
}

export const seedPublishedNovel = async (page: Page, chapters: SeedChapter[], extra: { comments?: unknown[]; reviews?: unknown[] } = {}) => {
  await page.addInitScript(
    ({ chapters, extra }) => {
      if (localStorage.getItem('__e2e_seeded')) return;
      const now = new Date().toISOString();
      localStorage.setItem(
        'novel_projects',
        JSON.stringify([{ id: 'pub1', user_id: 'author-2', title: 'Long Tides', description: 'A seeded test novel', is_published: true, author_name: 'Ada Author', genre: 'Fantasy', likes: [], views: [], created_at: now, updated_at: now }])
      );
      localStorage.setItem(
        'novel_chapters',
        JSON.stringify(chapters.map((c, i) => ({ id: c.id, project_id: 'pub1', title: c.title, content: c.html, position: i, created_at: now, updated_at: now })))
      );
      localStorage.setItem('novel_profiles', JSON.stringify([{ id: 'author-2', display_name: 'Ada Author', bio: 'Writes about the sea', daily_word_goal: 1000, followers: [], following: [] }]));
      localStorage.setItem('novel_comments', JSON.stringify(extra.comments ?? []));
      localStorage.setItem('novel_reviews', JSON.stringify(extra.reviews ?? []));
      localStorage.setItem('__e2e_seeded', '1');
    },
    { chapters, extra }
  );
};

/** A run of paragraphs, tall enough that chapters are not all on screen at once. */
export const paragraphs = (chapter: number, count: number) =>
  Array.from({ length: count }, (_, i) => `<p>Chapter ${chapter}, paragraph ${i + 1}. The tide came in slowly and went out again, as it always had.</p>`).join('');
