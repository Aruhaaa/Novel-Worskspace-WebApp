import { clearOfflineCache } from './offlineCache';
import { forgetLocalHistory } from './history';

/**
 * Forget everything this browser holds for an account that has just been deleted: the kept copies of its novels,
 * drafts, notes, goals, restore points and the like. Settings that belong to the device (theme, writing font,
 * spelling) are left alone, as are other accounts' keys.
 */
export const wipeDeviceData = async (userId: string, projectIds: string[], chapterIds: string[]): Promise<void> => {
  clearOfflineCache();
  const mine = [userId, ...projectIds, ...chapterIds].filter(Boolean);
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('novelist_') && !k.startsWith('novelist-')) continue;
      if (mine.some((id) => k.includes(id))) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
  await forgetLocalHistory(projectIds, chapterIds);
};
