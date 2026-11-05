/**
 * Looking up a word: its meanings from the free dictionaryapi.dev service and words of similar meaning from Datamuse.
 * Only the one word is sent. Results are kept on this device, so a word asked for again needs no connection.
 * Both services are English only. Turn it off in Preferences to never send a word.
 */
export interface Definition {
  definition: string;
  example?: string;
}

export interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
  synonyms: string[];
}

export interface Lookup {
  word: string;
  phonetic: string;
  meanings: Meaning[];
  /** Words of similar meaning, best first */
  synonyms: string[];
}

export class LookupError extends Error {
  reason: 'offline' | 'bad-word';
  constructor(reason: 'offline' | 'bad-word') {
    super(reason);
    this.reason = reason;
  }
}

const CACHE_KEY = 'novelist_lookup_cache';
const CACHE_MAX = 150;
const memory = new Map<string, Lookup>();

const readCache = (): Record<string, Lookup> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') as Record<string, Lookup>;
  } catch {
    return {};
  }
};

const remember = (key: string, value: Lookup) => {
  memory.set(key, value);
  try {
    const all = readCache();
    delete all[key];
    all[key] = value;
    const keys = Object.keys(all);
    for (const old of keys.slice(0, Math.max(0, keys.length - CACHE_MAX))) delete all[old];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    // storage full or refused: the answer is still used this time
  }
};

/** The word as it is looked up: letters, apostrophes and hyphens only, no longer than a word can be. */
export const cleanWord = (raw: string): string => {
  const w = raw.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
  return w.length > 0 && w.length <= 40 && /^[\p{L}][\p{L}'’-]*$/u.test(w) ? w : '';
};

/** Give a replacement the same capitals as the word it replaces: "Quick" becomes "Swift", "QUICK" becomes "SWIFT". */
export const matchCase = (original: string, replacement: string): string => {
  if (original.length > 1 && original === original.toUpperCase() && original !== original.toLowerCase()) return replacement.toUpperCase();
  if (original[0] && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
};

const getJson = async (url: string, timeoutMs = 7000): Promise<{ status: number; body: unknown }> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } finally {
    window.clearTimeout(timer);
  }
};

interface RawEntry {
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings?: { partOfSpeech?: string; definitions?: { definition?: string; example?: string; synonyms?: string[] }[]; synonyms?: string[] }[];
}

export const lookupWord = async (raw: string): Promise<Lookup> => {
  const word = cleanWord(raw);
  if (!word) throw new LookupError('bad-word');
  const key = word.toLowerCase();
  const hit = memory.get(key) ?? readCache()[key];
  if (hit) {
    memory.set(key, hit);
    return hit;
  }

  const enc = encodeURIComponent(key);
  const [dict, syn, like] = await Promise.allSettled([
    getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc}`),
    getJson(`https://api.datamuse.com/words?rel_syn=${enc}&max=20`),
    getJson(`https://api.datamuse.com/words?ml=${enc}&max=20`),
  ]);
  if (dict.status === 'rejected' && syn.status === 'rejected' && like.status === 'rejected') throw new LookupError('offline');

  const meanings: Meaning[] = [];
  let phonetic = '';
  if (dict.status === 'fulfilled' && dict.value.status === 200 && Array.isArray(dict.value.body)) {
    const entries = dict.value.body as RawEntry[];
    phonetic = entries.map((e) => e.phonetic || e.phonetics?.find((p) => p.text)?.text || '').find(Boolean) ?? '';
    for (const entry of entries) {
      for (const m of entry.meanings ?? []) {
        const definitions = (m.definitions ?? [])
          .filter((d) => d.definition)
          .slice(0, 3)
          .map((d) => ({ definition: d.definition as string, example: d.example }));
        if (!definitions.length) continue;
        const own = [...(m.synonyms ?? []), ...(m.definitions ?? []).flatMap((d) => d.synonyms ?? [])];
        meanings.push({ partOfSpeech: m.partOfSpeech ?? '', definitions, synonyms: [...new Set(own)].slice(0, 8) });
      }
    }
  }

  const words = (r: PromiseSettledResult<{ status: number; body: unknown }>): string[] =>
    r.status === 'fulfilled' && Array.isArray(r.value.body) ? (r.value.body as { word?: string }[]).map((x) => x.word ?? '').filter(Boolean) : [];
  const synonyms = [...new Set([...words(syn), ...meanings.flatMap((m) => m.synonyms), ...words(like)])].filter((w) => w.toLowerCase() !== key).slice(0, 24);

  const result: Lookup = { word, phonetic, meanings: meanings.slice(0, 4), synonyms };
  // Nothing at all found is worth remembering too, so the same word is not asked for again and again
  remember(key, result);
  return result;
};
