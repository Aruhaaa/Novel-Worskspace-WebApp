import { getLang } from '../i18n';
import { isSupabaseConfigured } from './supabase';
import type { Project } from '../services/types';

/**
 * The language a novel is written in.
 *
 * One novel is one language. A writer with the same story in two languages makes two novels, gives each its own language and
 * publishes them one by one; readers then pick a language in the library. `projects.language` holds a two or three letter code
 * (supabase/setup_scripts/20261107_novel_language.sql), or nothing for a novel whose language was never chosen.
 */

/** Each language under the name its own readers know it by, so a reader finds theirs at a glance */
export const NOVEL_LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'zh', name: '中文' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'ar', name: 'العربية' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'th', name: 'ไทย' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'tl', name: 'Filipino' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
];

const NAMES = new Map(NOVEL_LANGUAGES.map((l) => [l.code, l.name]));

/** What the database accepts: two or three lowercase letters */
export const isLanguageCode = (code: unknown): code is string => typeof code === 'string' && /^[a-z]{2,3}$/.test(code);

/** The language a new novel starts in: the one the app is being used in, when it is one of ours */
export const defaultNovelLanguage = (): string => (getLang() === 'ms' ? 'ms' : 'en');

/** "Bahasa Melayu (Malay)": its own name, and the name in the language the app is shown in when that says something more */
export const languageLabel = (code: string | null | undefined): string => {
  if (!code) return '';
  const own = NAMES.get(code) ?? code.toUpperCase();
  try {
    const shown = new Intl.DisplayNames([getLang()], { type: 'language' }).of(code);
    if (shown && shown.toLowerCase() !== code && !own.toLowerCase().includes(shown.toLowerCase())) return `${own} (${shown})`;
  } catch {
    // an engine without language names: the language's own name is enough
  }
  return own;
};

/** Just its own name, for a small badge */
export const languageBadge = (code: string | null | undefined): string => (code ? (NAMES.get(code) ?? code.toUpperCase()) : '');

/**
 * Whether choosing a language can work for this project. On a database that has not had the novel language setup run, its rows have no
 * `language` at all (not even an empty one), so the choice is not offered. Local mode (no cloud) always has it.
 */
export const supportsLanguage = (project: Pick<Project, 'language'> | null | undefined): boolean => !isSupabaseConfigured || (!!project && 'language' in project);

/** Same question with no project in hand yet (a first novel): offered unless the rows already seen say otherwise */
export const languageAvailable = (seen: Pick<Project, 'language'>[]): boolean => !isSupabaseConfigured || seen.length === 0 || seen.some((p) => 'language' in p);

/** The languages that published novels are written in, most-used first */
export const languagesIn = (projects: Pick<Project, 'language'>[]): string[] => {
  const counts = new Map<string, number>();
  for (const p of projects) if (p.language) counts.set(p.language, (counts.get(p.language) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || languageBadge(a[0]).localeCompare(languageBadge(b[0]))).map(([code]) => code);
};

/** What a database says when it has no `language` column yet */
export const isMissingLanguageColumn = (error: { code?: string; message?: string } | null | undefined): boolean =>
  !!error && (error.code === '42703' || error.code === 'PGRST204' || /column .*language|language.* column/i.test(error.message ?? ''));
