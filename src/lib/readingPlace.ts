/**
 * Where a reader stopped in each novel, so "Continue reading" can open the chapter they were on. Kept in this
 * browser, per person (the key holds the user id, so deleting an account clears it).
 */
export interface ReadingPlace {
  chapterId: string;
  /** Position of the chapter in the novel when it was saved, for the "Chapter 5" label before the chapters load */
  index: number;
  at: number;
}

const MAX_NOVELS = 60;

const key = (userId: string) => `novelist_reading_${userId}`;

const readAll = (userId: string): Record<string, ReadingPlace> => {
  try {
    const raw = JSON.parse(localStorage.getItem(key(userId)) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, ReadingPlace>) : {};
  } catch {
    return {};
  }
};

const writeAll = (userId: string, places: Record<string, ReadingPlace>) => {
  try {
    localStorage.setItem(key(userId), JSON.stringify(places));
  } catch {
    // Private windows can refuse storage; the place is then simply not kept
  }
};

export const getReadingPlace = (userId: string, projectId: string): ReadingPlace | null => {
  const place = readAll(userId)[projectId];
  return place && typeof place.chapterId === 'string' ? place : null;
};

export const setReadingPlace = (userId: string, projectId: string, chapterId: string, index: number): void => {
  const places = readAll(userId);
  places[projectId] = { chapterId, index, at: Date.now() };
  // Old novels fall off the end so this never grows without limit
  const entries = Object.entries(places).sort((a, b) => b[1].at - a[1].at);
  writeAll(userId, Object.fromEntries(entries.slice(0, MAX_NOVELS)));
};

export const forgetReadingPlace = (userId: string, projectId: string): void => {
  const places = readAll(userId);
  if (!(projectId in places)) return;
  delete places[projectId];
  writeAll(userId, places);
};
