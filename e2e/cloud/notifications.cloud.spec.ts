import { expect, test } from '@playwright/test';
import { makeAccount, openAs, publishNovel } from './helpers';

// Two people, each in a browser of their own, talking to the database through the real app: the server writes the
// notifications (database triggers) and tells the other person's open page the moment they exist (Realtime).
test.describe('notifications through the server', () => {
  test('a follow, a comment and a review reach the writer live, and stay read once read', async ({ browser }, testInfo) => {
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const ada = await makeAccount(testInfo, 'Ada', 'read');
    const novel = await publishNovel(ben, 'Long Tides');
    const benPage = await openAs(browser, testInfo, ben);
    const adaPage = await openAs(browser, testInfo, ada);

    const bell = benPage.getByRole('button', { name: /^Notifications/ });
    await expect(bell).toHaveAccessibleName('Notifications');

    // Ada follows Ben on his author page
    await adaPage.goto(`/#/library/author/${ben.id}`);
    await adaPage.getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(bell).toHaveAccessibleName('Notifications, 1 new');
    // The server updated both profiles, which a plain update by the follower could not
    const adaProfile = await ada.api.from('profiles').select('following').eq('id', ada.id).single();
    const benProfile = await ben.api.from('profiles').select('followers').eq('id', ben.id).single();
    expect(adaProfile.data?.following).toContain(ben.id);
    expect(benProfile.data?.followers).toContain(ada.id);

    // She comments on his novel and reviews it
    await adaPage.goto(`/#/library/novel/${novel.id}`);
    await adaPage.getByPlaceholder('Share your thoughts on this chapter…').fill('I loved the tide.');
    await adaPage.getByRole('button', { name: 'Post comment' }).click();
    await expect(bell).toHaveAccessibleName('Notifications, 2 new');
    await adaPage.getByPlaceholder('What did you think of this novel?').fill('Beautiful and calm.');
    await adaPage.getByRole('button', { name: 'Post review' }).click();
    await expect(bell).toHaveAccessibleName('Notifications, 3 new');

    await bell.click();
    const items = benPage.getByRole('dialog', { name: 'Notifications' }).locator('.notif-item');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('Ada reviewed Long Tides');
    await expect(items.nth(0)).toContainText('★★★★★ Beautiful and calm.');
    await expect(items.nth(1)).toContainText('Ada commented on Long Tides');
    await expect(items.nth(2)).toContainText('Ada started following you');

    // They are the same after a reload, because they live on the server
    await benPage.reload();
    await expect(benPage.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications, 3 new');

    // Reading them is remembered by the server too
    await benPage.goto('/#/notifications');
    await expect(benPage.locator('.notif-page-list li')).toHaveCount(3);
    await benPage.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(benPage.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications');
    await benPage.reload();
    await expect(benPage.getByRole('button', { name: /^Notifications/ })).toHaveAccessibleName('Notifications');
    await expect(benPage.locator('.notif-page-list li')).toHaveCount(3);
    const unread = await ben.api.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    expect(unread.count).toBe(0);
  });

  test('what is switched off is never recorded, and a blocked person cannot notify you', async ({ browser }, testInfo) => {
    const ben = await makeAccount(testInfo, 'Ben', 'write');
    const ada = await makeAccount(testInfo, 'Ada', 'read');
    const novel = await publishNovel(ben, 'Long Tides');
    const benPage = await openAs(browser, testInfo, ben);
    const adaPage = await openAs(browser, testInfo, ada);
    const bell = benPage.getByRole('button', { name: /^Notifications/ });

    // Ben turns comments off in Preferences: the choice is saved to his account
    await benPage.goto('/#/preferences');
    await benPage.getByLabel('Comments on your novels: in the app').uncheck();
    await expect(benPage.getByText('Saved to your account.')).toBeVisible();
    const saved = await ben.api.from('notification_settings').select('muted_kinds').eq('user_id', ben.id).single();
    expect(saved.data?.muted_kinds).toEqual(['comment']);

    await adaPage.goto(`/#/library/novel/${novel.id}`);
    await adaPage.getByPlaceholder('Share your thoughts on this chapter…').fill('Muted comment');
    await adaPage.getByRole('button', { name: 'Post comment' }).click();
    await expect(adaPage.getByText('Muted comment')).toBeVisible();
    await adaPage.getByPlaceholder('What did you think of this novel?').fill('A review still counts');
    await adaPage.getByRole('button', { name: 'Post review' }).click();
    // The review is recorded and the comment is not
    await expect(bell).toHaveAccessibleName('Notifications, 1 new');
    const kinds = await ben.api.from('notifications').select('kind');
    expect(kinds.data?.map((k) => k.kind)).toEqual(['review']);

    // Switched on again
    await benPage.getByLabel('Comments on your novels: in the app').check();
    await expect(benPage.getByText('Saved to your account.')).toBeVisible();
    await adaPage.getByPlaceholder('Share your thoughts on this chapter…').fill('Unmuted comment');
    await adaPage.getByRole('button', { name: 'Post comment' }).click();
    await expect(bell).toHaveAccessibleName('Notifications, 2 new');

    // Ben blocks Ada: nothing she does reaches him now
    await ben.api.from('user_blocks').insert({ blocker_id: ben.id, blocked_id: ada.id });
    await adaPage.getByPlaceholder('Share your thoughts on this chapter…').fill('Comment from a blocked person');
    await adaPage.getByRole('button', { name: 'Post comment' }).click();
    await expect(adaPage.getByText('Comment from a blocked person')).toBeVisible();
    await benPage.waitForTimeout(800);
    await expect(bell).toHaveAccessibleName('Notifications, 2 new');
  });
});
