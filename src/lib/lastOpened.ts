/** Where the writer left off, so the app can open on the same project and chapter next time. Kept in this browser. */
const projectKey = (userId: string) => `novelist_last_project_${userId}`;
const chapterKey = (projectId: string) => `novelist_last_chapter_${projectId}`;

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

export const getLastProject = (userId: string) => read(projectKey(userId));
export const setLastProject = (userId: string, projectId: string) => write(projectKey(userId), projectId);
export const getLastChapter = (projectId: string) => read(chapterKey(projectId));
export const setLastChapter = (projectId: string, chapterId: string) => write(chapterKey(projectId), chapterId);

/** Forget everything kept for a project that no longer exists. */
export const forgetProject = (userId: string, projectId: string) => {
  try {
    if (localStorage.getItem(projectKey(userId)) === projectId) localStorage.removeItem(projectKey(userId));
    for (const prefix of ['novelist_last_chapter_', 'novelist_chapter_meta_', 'novelist_goal_', 'novelist_day_']) {
      localStorage.removeItem(`${prefix}${projectId}`);
    }
  } catch {
    // ignore
  }
};
