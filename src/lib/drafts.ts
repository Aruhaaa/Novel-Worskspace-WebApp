/**
 * A safety copy of what the author is typing, kept on this device until the server confirms the save.
 * If the tab closes or a save fails, the draft is offered back next time the chapter opens.
 */
export interface ChapterDraft {
  title: string;
  content: string;
  savedAt: number;
}

const key = (chapterId: string) => `novelist_draft_${chapterId}`;

export const saveDraft = (chapterId: string, title: string, content: string) => {
  try {
    const draft: ChapterDraft = { title, content, savedAt: Date.now() };
    localStorage.setItem(key(chapterId), JSON.stringify(draft));
  } catch {
    // Storage full or unavailable: the normal save still runs
  }
};

export const getDraft = (chapterId: string): ChapterDraft | null => {
  try {
    const raw = localStorage.getItem(key(chapterId));
    return raw ? (JSON.parse(raw) as ChapterDraft) : null;
  } catch {
    return null;
  }
};

export const clearDraft = (chapterId: string) => {
  try {
    localStorage.removeItem(key(chapterId));
  } catch {
    // ignore
  }
};
