/** Small preferences for the writing tools. Kept on this device. */

const TYPEWRITER_KEY = 'novelist_typewriter';
const LOOKUP_KEY = 'novelist_word_lookup';
const LIVE_KEY = 'novelist_live_editing';

const read = (key: string, fallback: boolean): boolean => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === 'on';
  } catch {
    return fallback;
  }
};
const write = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    // storage unavailable
  }
};

/** Keep the line being written in the middle of the screen. Off until switched on. */
export const loadTypewriter = (): boolean => read(TYPEWRITER_KEY, false);
export const saveTypewriter = (on: boolean) => write(TYPEWRITER_KEY, on);

/** Whether looking up a word may ask the online dictionary services. On unless switched off. */
export const loadLookupAllowed = (): boolean => read(LOOKUP_KEY, true);
export const saveLookupAllowed = (on: boolean) => write(LOOKUP_KEY, on);

/**
 * Whether a shared project's chapters are written together live. On unless switched off, as a way out if it ever misbehaves:
 * with it off the chapter is edited and saved on its own, as in a project nobody else is in.
 */
export const loadLiveEditing = (): boolean => read(LIVE_KEY, true);
export const saveLiveEditing = (on: boolean) => write(LIVE_KEY, on);
