import { useCallback, useRef } from 'react';
import { useReadAloud, type ReadAloud } from '../../lib/useReadAloud';

const BLOCKS = 'p, h1, h2, h3, h4, h5, h6, li';

/**
 * Read aloud for a page that is already on screen, such as a novel in the reader: the blocks of text inside `root`
 * that match `selector` are read in order, and the one being read is marked with the class `is-speaking`.
 * `lang` is the language of that text (a novel's own language), so a voice that speaks it is chosen; without it the app's language is used.
 */
export const useDomReadAloud = (selector: string, lang?: string): ReadAloud => {
  const elements = useRef<HTMLElement[]>([]);
  const marked = useRef<HTMLElement | null>(null);

  const collect = useCallback((): string[] => {
    const all = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) => (el.textContent ?? '').trim() !== '');
    // A list item that holds a paragraph would be read twice, so only the innermost block is kept
    elements.current = all.filter((el) => !el.querySelector(BLOCKS));
    return elements.current.map((el) => el.textContent ?? '');
  }, [selector]);

  const startAt = useCallback((): number => {
    // From the first block fully below the top of the page, so reading starts where the person is looking
    const i = elements.current.findIndex((el) => el.getBoundingClientRect().top >= 80);
    return i < 0 ? 0 : i;
  }, []);

  const highlight = useCallback((index: number | null) => {
    marked.current?.classList.remove('is-speaking');
    marked.current = null;
    if (index === null) return;
    const el = elements.current[index];
    if (!el) return;
    el.classList.add('is-speaking');
    marked.current = el;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  // The list is made when reading starts; startAt needs it, so it is read from the same moment
  return useReadAloud({
    paragraphs: collect,
    startAt: () => {
      return startAt();
    },
    onHighlight: highlight,
    lang,
  });
};
