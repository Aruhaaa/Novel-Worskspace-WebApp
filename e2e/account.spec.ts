import { expect, test } from './fixtures';
import { createProject, paragraphs, seedPublishedNovel, signIn } from './helpers';

const NOW = new Date().toISOString();
const COMMENT = { id: 'cm1', project_id: 'pub1', chapter_id: 'rc1', user_id: 'author-2', content: 'Buy my spammy thing now', created_at: NOW, updated_at: NOW };
const REVIEW = { id: 'rv1', project_id: 'pub1', user_id: 'author-2', rating: 4, content: 'A great read overall', created_at: NOW, updated_at: NOW };
const CHAPTERS = [{ id: 'rc1', title: 'Part 1', html: paragraphs(1, 5) }];

test.describe('report and block', () => {
  test.beforeEach(async ({ page }) => {
    await seedPublishedNovel(page, CHAPTERS, { comments: [COMMENT], reviews: [REVIEW] });
    await signIn(page, 'reader@example.com', 'Read');
  });

  test('a comment can be reported, and the writer blocked in the same step', async ({ page }) => {
    await page.goto('/#/library/novel/pub1');
    await expect(page.getByText('Buy my spammy thing now')).toBeVisible();

    await page.locator('#reader-ch-rc1').getByRole('button', { name: 'Report' }).click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog.getByRole('heading', { name: 'Report this comment' })).toBeVisible();
    // The form cannot be sent until a reason is chosen
    await expect(dialog.getByRole('button', { name: 'Send report' })).toBeDisabled();
    await dialog.getByRole('radio', { name: /Spam or advertising/ }).check();
    await dialog.getByLabel('Also block Ada Author').check();
    await dialog.getByRole('button', { name: 'Send report' }).click();

    await expect(page.getByText('The report is sent and you will no longer see them.')).toBeVisible();
    // Their comment and review are gone from this reader's view
    await expect(page.getByText('Buy my spammy thing now')).toHaveCount(0);
    await expect(page.getByText('A great read overall')).toHaveCount(0);

    const reports = await page.evaluate(() => JSON.parse(localStorage.getItem('novel_reports') ?? '[]').map((r: { target_type: string; reason: string; status: string; excerpt: string }) => `${r.target_type}/${r.reason}/${r.status}/${r.excerpt}`));
    expect(reports).toEqual(['comment/spam/open/Buy my spammy thing now']);
  });

  test('a blocked writer disappears from the library, and Unblock brings them back', async ({ page }) => {
    await page.goto('/#/library/author/author-2');
    // Blocking asks "are you sure?" first
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Block' }).click();
    await expect(page.getByRole('button', { name: /Blocked · Unblock/ })).toBeVisible();

    await page.goto('/#/library');
    await expect(page.getByRole('heading', { name: 'Long Tides' })).toHaveCount(0);

    await page.goto('/#/preferences');
    const blocked = page.getByRole('region', { name: 'Blocked people' }).or(page.locator('section', { hasText: 'Blocked people' }));
    await expect(blocked.getByText('Ada Author')).toBeVisible();
    await blocked.getByRole('button', { name: 'Unblock' }).click();
    await expect(blocked.getByText('You have not blocked anyone.')).toBeVisible();

    await page.goto('/#/library');
    await expect(page.getByRole('heading', { name: 'Long Tides' })).toBeVisible();
  });

  test("a report button is offered on other people's novels, never on your own", async ({ page }) => {
    await page.goto('/#/library/novel/pub1');
    await expect(page.getByRole('button', { name: 'Report this novel' })).toBeVisible();

    // Make a novel of your own and publish it
    await createProject(page, 'My Own Novel');
    await page.goto('/#/write');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('is now in the Public Library')).toBeVisible();
    await page.goto('/#/library');
    await page.getByRole('article').filter({ hasText: 'My Own Novel' }).getByRole('button', { name: 'Read' }).click();
    await expect(page.getByRole('heading', { name: 'My Own Novel', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Report this novel' })).toHaveCount(0);
  });
});

test.describe('the admin queue', () => {
  test('the admin sees what was reported and can remove it', async ({ page }) => {
    await page.addInitScript(
      ({ comment }) => {
        if (localStorage.getItem('__e2e_seeded')) return;
        const now = new Date().toISOString();
        localStorage.setItem('novel_projects', JSON.stringify([{ id: 'pub1', user_id: 'author-2', title: 'Long Tides', description: 'x', is_published: true, author_name: 'Ada Author', genre: 'Fantasy', likes: [], views: [], created_at: now, updated_at: now }]));
        localStorage.setItem('novel_comments', JSON.stringify([comment]));
        localStorage.setItem(
          'novel_reports',
          JSON.stringify([{ id: 'rep1', reporter_id: 'someone', target_type: 'comment', target_id: 'cm1', target_user_id: 'author-2', project_id: 'pub1', reason: 'spam', details: 'It is an advert', excerpt: 'Buy my spammy thing now', status: 'open', created_at: now }])
        );
        localStorage.setItem('__e2e_seeded', '1');
      },
      { comment: COMMENT }
    );
    await signIn(page, 'aruhaadmin@novelist.com', 'Write');
    await page.goto('/#/admin');
    const queue = page.locator('section', { hasText: 'Reports' }).first();
    await expect(queue.getByText('Buy my spammy thing now')).toBeVisible();
    await expect(queue.getByText('It is an advert')).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await queue.getByRole('button', { name: 'Remove comment' }).click();
    await expect(queue.getByText('No open reports. All clear.')).toBeVisible();

    await queue.getByRole('button', { name: /^Closed/ }).click();
    await expect(queue.getByText('actioned')).toBeVisible();
    const comments = await page.evaluate(() => JSON.parse(localStorage.getItem('novel_comments') ?? '[]').length);
    expect(comments).toBe(0);
  });

  test('anyone else is turned away from the admin page', async ({ page }) => {
    await signIn(page, 'writer@example.com', 'Write');
    await page.goto('/#/admin');
    await expect(page.getByText("You don't have permission to view this page")).toBeVisible();
  });
});

test.describe('your account', () => {
  test('deleting the account removes the work and everything kept on the device for it', async ({ page }) => {
    await signIn(page, 'leaving@example.com');
    await createProject(page, 'Soon Gone');
    await page.goto('/#/preferences');

    await page.getByRole('button', { name: 'Delete my account…' }).click();
    const dialog = page.locator('dialog[open]');
    const confirm = dialog.getByRole('button', { name: 'Delete everything' });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/^Type DELETE/).fill('delete');
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/^Type DELETE/).fill('DELETE');
    await confirm.click();

    // Signed out, on the front page
    await expect(page).toHaveURL(/#\/(login)?$/);
    const left = await page.evaluate(() => ({
      projects: JSON.parse(localStorage.getItem('novel_projects') ?? '[]').map((p: { title: string }) => p.title),
      accountKeys: Object.keys(localStorage).filter((k) => k.includes('leaving@example.com')),
    }));
    expect(left.projects).not.toContain('Soon Gone');
    expect(left.accountKeys).toEqual([]);

    // The same address starts again from nothing
    await signIn(page, 'leaving@example.com');
    await page.goto('/#/manuscripts');
    await expect(page.getByText('Soon Gone')).toHaveCount(0);
  });

  test('"what opens first" is remembered', async ({ page }) => {
    await signIn(page, 'both@example.com', 'Both');
    await page.goto('/#/preferences');
    await page.getByRole('radio', { name: /^Write/ }).click();
    await page.goto('/');
    await expect(page).toHaveURL(/#\/write/);
    await page.reload();
    await page.goto('/#/preferences');
    await page.getByRole('radio', { name: /^Read/ }).click();
    await page.goto('/');
    await expect(page).toHaveURL(/#\/read/);
  });

  test('a dead password-reset link lands on a form to ask for a new one', async ({ page }) => {
    await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    await expect(page.getByRole('heading', { name: 'Forgot it?' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('expired or was already used');
  });

  test('change password is not offered in local mode, where there is no cloud account', async ({ page }) => {
    await signIn(page, 'writer@example.com');
    await page.goto('/#/preferences');
    await expect(page.getByText('Passwords are only used when the app is connected to the cloud database.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change password' })).toHaveCount(0);
  });
});
