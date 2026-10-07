/** Small hand-offs between distant parts of the app (the header, the editor menu, the search palette). */

/** A word handed over by the search palette, so the chapter opens with it found */
export const FIND_HANDOFF_KEY = 'novelist_find';

/** A notebook entry handed over by the search palette, so the notebook opens on it */
export const NOTE_HANDOFF_KEY = 'novelist_open_note';

const SEARCH_EVENT = 'novelist:search';
const CAPTURE_EVENT = 'novelist:capture';

export const openSearch = () => window.dispatchEvent(new CustomEvent(SEARCH_EVENT));
export const openCapture = (text = '') => window.dispatchEvent(new CustomEvent<string>(CAPTURE_EVENT, { detail: text }));

export const onOpenSearch = (fn: () => void) => {
  window.addEventListener(SEARCH_EVENT, fn);
  return () => window.removeEventListener(SEARCH_EVENT, fn);
};

export const onOpenCapture = (fn: (text: string) => void) => {
  const handler = (e: Event) => fn((e as CustomEvent<string>).detail || '');
  window.addEventListener(CAPTURE_EVENT, handler);
  return () => window.removeEventListener(CAPTURE_EVENT, handler);
};

const FIND_EVENT = 'novelist:find';

/** Ask the open editor to find a word, for example to show where a reader left a comment. */
export const requestFind = (term: string) => window.dispatchEvent(new CustomEvent<string>(FIND_EVENT, { detail: term }));

export const onRequestFind = (fn: (term: string) => void) => {
  const handler = (e: Event) => fn((e as CustomEvent<string>).detail || '');
  window.addEventListener(FIND_EVENT, handler);
  return () => window.removeEventListener(FIND_EVENT, handler);
};
