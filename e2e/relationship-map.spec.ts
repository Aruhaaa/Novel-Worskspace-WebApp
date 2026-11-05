import { expect, test } from './fixtures';
import { createProject, signIn } from './helpers';
import type { Page } from '@playwright/test';

const addEntity = async (page: Page, entity: { name: string; type?: 'Character' | 'Location'; links?: { to: string; how: string }[] }) => {
  await page.getByRole('button', { name: 'Add entity' }).click();
  const dialog = page.locator('dialog[open]');
  await dialog.getByLabel('Name').fill(entity.name);
  if (entity.type) await dialog.getByLabel('Type').selectOption({ label: entity.type });
  for (const link of entity.links ?? []) {
    await dialog.getByRole('button', { name: 'Add connection' }).click();
    const row = dialog.locator('.kv-row').last();
    await row.getByLabel('Connected to').selectOption({ label: link.to });
    await row.getByLabel('How they are connected').fill(link.how);
  }
  await dialog.getByRole('button', { name: 'Save entity' }).click();
  await expect(dialog).toBeHidden();
};

test.describe('relationship map', () => {
  test('shows every note and how they are connected, and a note can be opened, moved and filtered', async ({ page }) => {
    await signIn(page, 'mapper@example.com', 'Write');
    await createProject(page, 'The Map Test');
    await page.goto('/#/notebook');

    await addEntity(page, { name: 'Ada', type: 'Character' });
    await addEntity(page, { name: 'Ben', type: 'Character', links: [{ to: 'Ada', how: 'brother of' }] });
    await addEntity(page, { name: 'Salt House', type: 'Location', links: [{ to: 'Ada', how: 'home of' }] });
    await addEntity(page, { name: 'Lone Wolf', type: 'Character' });

    await page.getByRole('button', { name: 'Relationship map' }).click();
    const map = page.getByRole('group', { name: 'Relationship map' });
    await expect(map.locator('.relmap-node')).toHaveCount(4);
    await expect(map.locator('.relmap-edge')).toHaveCount(2);
    await expect(map.locator('.relmap-edge-label')).toHaveText(['brother of', 'home of']);
    await expect(page.getByText('4 notes, 2 connections.')).toBeVisible();

    // The same connections are there as words for anyone who cannot see the picture
    const words = page.getByRole('list', { name: 'Connections between notes' });
    await expect(words.getByRole('listitem')).toHaveText(['Ben brother of Ada', 'Salt House home of Ada']);

    // A note that is not connected to anything is drawn fainter
    await expect(map.locator('.relmap-node.is-alone')).toHaveCount(1);
    await expect(map.locator('.relmap-node.is-alone')).toContainText('Lone Wolf');

    // Clicking a note opens its details beside the map; the keyboard works too
    await map.getByRole('button', { name: 'Ben, Character' }).click();
    await expect(page.getByRole('complementary', { name: 'Entity details' }).getByRole('heading', { name: 'Ben' })).toBeVisible();
    await map.getByRole('button', { name: 'Salt House, Location' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary', { name: 'Entity details' }).getByRole('heading', { name: 'Salt House' })).toBeVisible();

    // Dragging a note moves it, and the arrangement is remembered
    const node = map.getByRole('button', { name: 'Lone Wolf, Character' });
    const before = await node.boundingBox();
    await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
    await page.mouse.down();
    await page.mouse.move(before!.x + 160, before!.y + 90, { steps: 8 });
    await page.mouse.up();
    const after = await node.boundingBox();
    expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(80);
    await page.reload();
    await page.getByRole('button', { name: 'Relationship map' }).click();
    const reloaded = await page.getByRole('group', { name: 'Relationship map' }).getByRole('button', { name: 'Lone Wolf, Character' }).boundingBox();
    expect(Math.abs(reloaded!.x - after!.x)).toBeLessThan(6);
    // Reset layout puts everything back
    await page.getByRole('button', { name: 'Reset layout' }).click();
    const reset = await page.getByRole('group', { name: 'Relationship map' }).getByRole('button', { name: 'Lone Wolf, Character' }).boundingBox();
    expect(Math.abs(reset!.x - before!.x)).toBeLessThan(6);

    // The filters above the map apply to it: only places, so only one note and no lines
    await page.getByRole('button', { name: 'Places' }).click();
    await expect(page.getByRole('group', { name: 'Relationship map' }).locator('.relmap-node')).toHaveCount(1);
    await expect(page.getByRole('group', { name: 'Relationship map' }).locator('.relmap-edge')).toHaveCount(0);
  });
});
