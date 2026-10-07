/** Spelling and style preferences for the manuscript editor. Kept on this device. */
export interface SpellPrefs {
  /** Let the browser underline misspelled words while you write */
  check: boolean;
  /** Language the browser should check against; empty means the browser's own setting */
  lang: string;
}

export const SPELL_LANGUAGES: { id: string; label: string }[] = [
  { id: '', label: "Browser's default" },
  { id: 'en-US', label: 'English (US)' },
  { id: 'en-GB', label: 'English (UK)' },
  { id: 'en-AU', label: 'English (Australia)' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'it', label: 'Italiano' },
  { id: 'pt', label: 'Português' },
  { id: 'nl', label: 'Nederlands' },
  { id: 'id', label: 'Bahasa Indonesia' },
];

const SPELL_KEY = 'novelist_spell';
const STYLE_KEY = 'novelist_style_notes';

const DEFAULT_SPELL: SpellPrefs = { check: true, lang: '' };

export const loadSpellPrefs = (): SpellPrefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(SPELL_KEY) || 'null');
    if (raw && typeof raw.check === 'boolean') {
      return { check: raw.check, lang: SPELL_LANGUAGES.some((l) => l.id === raw.lang) ? raw.lang : '' };
    }
  } catch {
    // fall through to the default
  }
  return DEFAULT_SPELL;
};

export const saveSpellPrefs = (prefs: SpellPrefs) => {
  try {
    localStorage.setItem(SPELL_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
};

/** Whether the style bar is open, and which kinds of note it shows. */
export interface StylePrefs {
  on: boolean;
  kinds: string[];
}

export const loadStylePrefs = (allKinds: string[]): StylePrefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(STYLE_KEY) || 'null');
    if (raw && typeof raw.on === 'boolean' && Array.isArray(raw.kinds)) {
      return { on: raw.on, kinds: raw.kinds.filter((k: unknown) => typeof k === 'string' && allKinds.includes(k)) };
    }
  } catch {
    // fall through
  }
  return { on: false, kinds: allKinds };
};

export const saveStylePrefs = (prefs: StylePrefs) => {
  try {
    localStorage.setItem(STYLE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
};
