import { useSyncExternalStore } from 'react';

/**
 * Languages. English is the source: every message is written in English in the code, `t('Sign in')`, and a language
 * file maps that sentence to its translation. A sentence with no translation is shown in English, so a language can
 * be added one screen at a time and nothing ever shows as a blank or a code.
 *
 * Placeholders are written {name}: t('Hello, {name}', { name }). Counts use tp(): tp(n, '{n} word', '{n} words').
 */
export type Lang = 'en' | 'ms';

export const LANGUAGES: { code: Lang; label: string; locale: string }[] = [
  { code: 'en', label: 'English', locale: 'en' },
  { code: 'ms', label: 'Bahasa Melayu', locale: 'ms-MY' },
];

const KEY = 'novelist_lang';

let lang: Lang = 'en';
let catalog: Record<string, string> = {};
const listeners = new Set<() => void>();

const isLang = (v: unknown): v is Lang => v === 'en' || v === 'ms';

/** The saved choice, else the browser's language when it is one we have, else English. */
const detect = (): Lang => {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch {
    // storage can be blocked
  }
  const nav = typeof navigator !== 'undefined' ? (navigator.language || '').toLowerCase() : '';
  return nav === 'ms' || nav.startsWith('ms-') ? 'ms' : 'en';
};

const loadCatalog = async (next: Lang): Promise<Record<string, string>> => {
  if (next === 'ms') return (await import('./ms')).default;
  return {};
};

const apply = (next: Lang, strings: Record<string, string>) => {
  lang = next;
  catalog = strings;
  if (typeof document !== 'undefined') document.documentElement.lang = LANGUAGES.find((l) => l.code === next)?.locale ?? 'en';
  listeners.forEach((fn) => fn());
};

/** Call once before the first screen is drawn, so the first paint is already in the right language. */
export const initI18n = async (): Promise<void> => {
  const wanted = detect();
  try {
    apply(wanted, await loadCatalog(wanted));
  } catch {
    // The language file could not be loaded (offline, first visit): English it is, and the choice is kept for next time
    apply('en', {});
  }
};

export const getLang = (): Lang => lang;

/** The language's code for dates and numbers. English keeps the browser's own habits. */
export const locale = (): string | undefined => (lang === 'en' ? undefined : LANGUAGES.find((l) => l.code === lang)?.locale);

export const setLang = async (next: Lang): Promise<void> => {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // The choice then lasts until the page is closed
  }
  try {
    apply(next, await loadCatalog(next));
  } catch {
    // Keep what is showing; the saved choice applies at the next start
  }
};

/**
 * Marks a sentence in a list of data (a theme's description, a genre's name) as something to translate, without translating it
 * yet. The screen that shows it calls t() on it. This is what lets `npm run i18n:check` find sentences that are not in code calls.
 */
export const mark = (source: string): string => source;

const fill = (text: string, vars?: Record<string, string | number>): string =>
  vars ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole)) : text;

/** Translate a sentence. Anything without a translation stays in English. */
export const t = (source: string, vars?: Record<string, string | number>): string => fill(lang === 'en' ? source : (catalog[source] ?? source), vars);

/** Translate a sentence that depends on a count: the language decides which form fits. */
export const tp = (n: number, one: string, other: string, vars?: Record<string, string | number>): string => {
  const form = new Intl.PluralRules(locale()).select(n);
  return t(form === 'one' ? one : other, { n: n.toLocaleString(locale()), ...vars });
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The current language, re-rendering the screen when it changes. */
export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang, getLang);

/** `t` for a screen: the screen redraws when the language changes. */
export const useT = () => {
  useLang();
  return t;
};

export const fmtDate = (value: string | number | Date, options?: Intl.DateTimeFormatOptions): string => new Date(value).toLocaleDateString(locale(), options);
export const fmtTime = (value: string | number | Date, options?: Intl.DateTimeFormatOptions): string => new Date(value).toLocaleTimeString(locale(), options);
export const fmtNumber = (n: number): string => n.toLocaleString(locale());
