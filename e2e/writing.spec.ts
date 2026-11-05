import { expect, test } from './fixtures';
import { addChapter, createProject, signIn, typeInEditor, waitForSaved } from './helpers';

test.describe('sign in and write', () => {
  test('a new writer lands in the studio after answering the one question', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await signIn(page, 'writer@example.com', 'Write');
    await expect(page.getByText(/Welcome back/)).toBeVisible();
  });

  test('forgot password explains that local mode has no email to send', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.getByLabel('Email address').fill('someone@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('alert')).toContainText('needs the cloud database');
  });

  test('a guest can browse the library but is asked for an account to write', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByRole('button', { name: 'Just browse the library' }).click();
    await expect(page).toHaveURL(/#\/read/);
    await page.goto('/#/manuscripts');
    await page.getByRole('button', { name: /New project|Create your first project/ }).first().click();
    await expect(page.getByText(/free account/i).first()).toBeVisible();
  });

  test('what is typed is saved, and is still there after a reload', async ({ page }) => {
    await signIn(page, 'writer@example.com');
    await createProject(page, 'The Salt Road');
    await addChapter(page, 'The Harbour');
    await typeInEditor(page, 'The boats came in before dawn.');
    await waitForSaved(page, 'The boats came in before dawn.');
    await page.reload();
    await expect(page.locator('.ProseMirror')).toContainText('The boats came in before dawn.');
    await expect(page.getByLabel('Chapter title')).toHaveValue('The Harbour');
  });

  test('the word count and the daily tracker follow what is typed', async ({ page }) => {
    await signIn(page, 'writer@example.com');
    await createProject(page, 'Counting');
    await addChapter(page, 'One');
    await typeInEditor(page, 'one two three four five');
    await waitForSaved(page, 'one two three four five');
    await expect(page.getByText('5 words').first()).toBeVisible();
    // The tracker's log for today is written once the chapter is saved
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('novel_word_logs') ?? '[]').map((l: { word_count: number }) => l.word_count)))
      .toContain(5);
  });
});
