import { expect, test } from './fixtures';
import { addChapter, createProject, signIn, typeInEditor } from './helpers';
import type { Page } from '@playwright/test';

// A fake clock lets a one-minute sprint finish in an instant. Time still flows by itself, so the page behaves normally.
test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await signIn(page, 'writer@example.com');
  await createProject(page, 'Sprint Book');
  await addChapter(page, 'One');
});

const startSprint = async (page: Page, minutes: number, goal?: number) => {
  await page.getByRole('button', { name: 'Start a writing sprint' }).click();
  const panel = page.getByRole('dialog', { name: 'Start a writing sprint' });
  await panel.getByLabel(/Or your own length/).fill(String(minutes));
  if (goal) await panel.getByLabel('Word goal (optional)').fill(String(goal));
  await panel.getByRole('button', { name: 'Start', exact: true }).click();
};

test.describe('writing sprint', () => {
  test('counts the words written in the time, then says how it went', async ({ page }) => {
    await startSprint(page, 1, 5);
    await typeInEditor(page, 'one two three four five six');
    await expect(page.locator('.studio-statusbar')).toContainText('6 words');

    await page.clock.fastForward('01:05');
    const summary = page.locator('.sprint-card');
    await expect(summary).toContainText('Sprint complete');
    await expect(summary).toContainText('6');
    await expect(summary).toContainText('Goal of 5 words reached.');
    // The countdown has gone from the footer and the page title is back to normal
    await expect(page.locator('.studio-statusbar')).not.toContainText('Sprint 0');
    await expect(page).toHaveTitle('Novelist Workspace: write, plan and publish your novel');
  });

  test('only the words written during the sprint count, not what was already on the page', async ({ page }) => {
    await typeInEditor(page, 'five words were here already');
    await startSprint(page, 10);
    await typeInEditor(page, ' and three more');
    await expect(page.locator('.studio-statusbar')).toContainText('3 words');
  });

  test('pausing stops the clock and resuming starts it again', async ({ page }) => {
    await startSprint(page, 10);
    const pill = page.getByRole('group', { name: 'Writing sprint' });
    await page.getByRole('button', { name: 'Pause sprint' }).click();
    const paused = await pill.textContent();
    await page.clock.fastForward('05:00');
    await expect(pill).toHaveText(paused ?? '');

    await page.getByRole('button', { name: 'Resume sprint' }).click();
    await page.clock.fastForward('00:30');
    await expect.poll(() => pill.textContent()).not.toBe(paused);
  });

  test('ending early saves a sprint that ran long enough, and it shows on the tracker', async ({ page }) => {
    await startSprint(page, 20);
    await typeInEditor(page, 'a few quick words');
    await page.clock.fastForward('00:40');
    await page.getByRole('button', { name: 'End sprint early' }).click();
    await expect(page.locator('.sprint-card')).toContainText('Sprint ended');

    await page.goto('/#/tracker');
    const card = page.getByRole('region', { name: /Writing sprints/ }).or(page.locator('section', { hasText: 'Writing sprints' }).first());
    await expect(card).toContainText('Writing sprints');
    await expect(card).toContainText('4');
    const history = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('novelist_sprint_history_')).map(([, v]) => JSON.parse(v as string).length));
    expect(history).toEqual([1]);
  });

  test('a sprint ended almost at once is not kept', async ({ page }) => {
    await startSprint(page, 10);
    await page.getByRole('button', { name: 'End sprint early' }).click();
    const kept = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('novelist_sprint_history_')));
    expect(kept).toEqual([]);
  });

  test('after a finished sprint is dismissed, nothing is left running when the page is reloaded', async ({ page }) => {
    await startSprint(page, 1);
    await typeInEditor(page, 'written before leaving');
    await page.clock.fastForward('02:00');
    await expect(page.locator('.sprint-card')).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await page.reload();
    // Nothing is left running after a reload
    await expect(page.getByRole('group', { name: 'Writing sprint' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start a writing sprint' })).toBeVisible();
  });
});
