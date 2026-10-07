/** The two spaces of the app. Everyone can go to both; the choice only decides which one opens first. */
export type UseMode = 'read' | 'write' | 'both';
export type Space = 'read' | 'write';

const key = (userId: string) => `novelist_mode_${userId}`;

export const loadMode = (userId: string): UseMode | null => {
  try {
    const v = localStorage.getItem(key(userId));
    return v === 'read' || v === 'write' || v === 'both' ? v : null;
  } catch {
    return null;
  }
};

export const saveMode = (userId: string, mode: UseMode) => {
  try {
    localStorage.setItem(key(userId), mode);
  } catch {
    // Private windows can refuse storage; the choice then lasts until the page closes
  }
};

/** Writers open to the studio. Readers, and people who chose both, open to something to read. */
export const openingSpace = (mode: UseMode | null): Space => (mode === 'write' ? 'write' : 'read');

export const openingPath = (mode: UseMode | null) => (openingSpace(mode) === 'read' ? '/read' : '/write');

const READ_VIEWS = ['read_home', 'library', 'saved_library', 'reader'];
const NEUTRAL_VIEWS = ['profile', 'messages', 'preferences', 'admin'];

/** Which space a screen belongs to. Account screens belong to neither, so they keep whichever space you came from. */
export const spaceOfView = (view: string): Space | null => {
  if (READ_VIEWS.includes(view)) return 'read';
  if (NEUTRAL_VIEWS.includes(view)) return null;
  return 'write';
};
