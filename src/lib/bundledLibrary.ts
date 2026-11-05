import type { Chapter, Project, UserProfile } from '../services/types';

/**
 * The sample library: novels that ship inside the app (written to content/library/ and built into src/data/library/ by
 * `npm run library:build`). They appear in the Public Library next to what people publish, in the cloud and local modes
 * alike, and are never written to the cloud database. Their likes and views are kept on this device only.
 *
 * Switch them off with VITE_SAMPLE_LIBRARY=off at build time, or on one device with
 * localStorage.setItem('novelist_sample_library', 'off').
 */

interface BundledEntry {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorId: string;
  authorBio: string;
  genre: string;
  subgenre: string;
  tagline: string;
  description: string;
  tags: string[];
  contentNotes: string;
  chapters: number;
  words: number;
  createdAt: string;
  updatedAt: string;
}

interface BundledBody {
  chapters: { title: string; html: string }[];
}

// Globs, so the app still builds and runs when the library has not been built
const indexModules = import.meta.glob<BundledEntry[]>('../data/library/index.json', { eager: true, import: 'default' });
const bodyModules = import.meta.glob<BundledBody>('../data/library/novels/*.json', { import: 'default' });

const OFF_KEY = 'novelist_sample_library';
const LIKES_PREFIX = 'novelist_sample_likes_';
const VIEWS_PREFIX = 'novelist_sample_views_';

export const isSampleLibraryOn = (): boolean => {
  if (import.meta.env.VITE_SAMPLE_LIBRARY === 'off') return false;
  try {
    return localStorage.getItem(OFF_KEY) !== 'off';
  } catch {
    return true;
  }
};

const builtEntries = (): BundledEntry[] => {
  const list = Object.values(indexModules)[0];
  return Array.isArray(list) ? list : [];
};

const entries = (): BundledEntry[] => (isSampleLibraryOn() ? builtEntries() : []);

/** How many sample novels this build offers, whether or not this device has them switched on. None if none were built or the build switched them off. */
export const sampleNovelCount = (): number => (import.meta.env.VITE_SAMPLE_LIBRARY === 'off' ? 0 : builtEntries().length);

/** Show or hide the sample novels on this device. */
export const setSampleLibraryOn = (on: boolean): void => {
  try {
    if (on) localStorage.removeItem(OFF_KEY);
    else localStorage.setItem(OFF_KEY, 'off');
  } catch {
    // storage unavailable: the choice just does not stick
  }
};

const entryById = (id: string): BundledEntry | undefined => entries().find((e) => e.id === id);

export const isBundledNovel = (projectId: string): boolean => !!entryById(projectId);
export const isBundledAuthor = (userId: string): boolean => entries().some((e) => e.authorId === userId);

// ------------------------------------------------------------------ covers

interface Look {
  top: string;
  bottom: string;
  ink: string;
  accent: string;
}

const LOOKS: Record<string, Look> = {
  Fantasy: { top: '#3d2b66', bottom: '#1b1236', ink: '#f3e8c9', accent: '#e8c46a' },
  'Sci-Fi': { top: '#12315a', bottom: '#08111f', ink: '#d6efff', accent: '#5cc8f2' },
  Mystery: { top: '#52201f', bottom: '#1f0c0c', ink: '#f4e3cf', accent: '#d9a066' },
  Thriller: { top: '#2f343c', bottom: '#0e1013', ink: '#f1f1ef', accent: '#e05a47' },
  Horror: { top: '#1b2823', bottom: '#060908', ink: '#dfeadb', accent: '#8fb39a' },
  Romance: { top: '#a34f55', bottom: '#5a2227', ink: '#fff0ec', accent: '#ffc9b8' },
  Historical: { top: '#6f5632', bottom: '#33271a', ink: '#f6ead0', accent: '#d8b974' },
  Contemporary: { top: '#2f6166', bottom: '#162f31', ink: '#f6eedb', accent: '#f2b66a' },
};
const FALLBACK_LOOK: Look = { top: '#3d4a55', bottom: '#1c242b', ink: '#f4ebd4', accent: '#c9b27c' };

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const wrapTitle = (title: string, max = 14): string[] => {
  const lines: string[] = [];
  let line = '';
  for (const word of title.split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

/** A quiet shape behind the title, one per genre. The title always sits in the middle band, so a wide crop still shows it. */
const motif = (genre: string, look: Look, h: number): string => {
  const a = look.accent;
  const x = 60 + (h % 180);
  const y = 70 + ((h >> 8) % 60);
  switch (genre) {
    case 'Fantasy':
      return `<circle cx="${x}" cy="${y}" r="46" fill="${a}" opacity=".18"/><circle cx="${x + 14}" cy="${y - 8}" r="40" fill="${look.top}"/>` +
        [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${(h >> (i + 3)) % 300}" cy="${380 + ((h >> (i + 9)) % 50)}" r="${1 + (i % 3)}" fill="${a}" opacity=".6"/>`).join('');
    case 'Sci-Fi':
      return [60, 100, 140].map((r) => `<circle cx="150" cy="${y + 50}" r="${r}" fill="none" stroke="${a}" stroke-width="1.2" opacity=".28"/>`).join('') +
        `<circle cx="${x}" cy="${y + 10}" r="5" fill="${a}" opacity=".8"/>`;
    case 'Mystery':
      return Array.from({ length: 9 }, (_, i) => `<rect x="${-20 + i * 42}" y="-10" width="14" height="470" fill="${a}" opacity=".08" transform="rotate(14 150 225)"/>`).join('');
    case 'Thriller':
      return `<line x1="0" y1="${y + 40}" x2="300" y2="${y - 20}" stroke="${a}" stroke-width="3" opacity=".55"/><line x1="0" y1="${y + 56}" x2="300" y2="${y - 4}" stroke="${a}" stroke-width="1" opacity=".4"/>`;
    case 'Horror':
      return Array.from({ length: 14 }, (_, i) => `<rect x="${10 + i * 21}" y="0" width="${1 + ((h >> i) % 3)}" height="${150 + ((h >> (i + 2)) % 250)}" fill="${a}" opacity=".16"/>`).join('');
    case 'Romance':
      return `<circle cx="125" cy="${y + 20}" r="52" fill="${a}" opacity=".22"/><circle cx="175" cy="${y + 20}" r="52" fill="${a}" opacity=".22"/>`;
    case 'Historical':
      return `<path d="M60 130 Q60 60 150 60 Q240 60 240 130" fill="none" stroke="${a}" stroke-width="2" opacity=".5"/><path d="M76 130 Q76 78 150 78 Q224 78 224 130" fill="none" stroke="${a}" stroke-width="1" opacity=".4"/>`;
    default:
      return `<circle cx="150" cy="${y + 40}" r="44" fill="${a}" opacity=".22"/>` + [0, 1, 2].map((i) => `<rect x="0" y="${96 + i * 8 + 40}" width="300" height="2" fill="${a}" opacity=".25"/>`).join('');
  }
};

const coverSvg = (e: BundledEntry): string => {
  const look = LOOKS[e.genre] ?? FALLBACK_LOOK;
  const h = hash(e.slug);
  const lines = wrapTitle(e.title);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const size = Math.max(26, Math.min(lines.length <= 2 ? 46 : lines.length === 3 ? 40 : 34, Math.floor(250 / (longest * 0.56))));
  const lead = size * 1.12;
  const startY = 225 - ((lines.length - 1) * lead) / 2 + size * 0.32;
  const title = lines.map((l, i) => `<text x="150" y="${(startY + i * lead).toFixed(1)}" text-anchor="middle" font-size="${size}">${esc(l)}</text>`).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450" width="300" height="450">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${look.top}"/><stop offset="1" stop-color="${look.bottom}"/></linearGradient></defs>` +
    `<rect width="300" height="450" fill="url(#g)"/>${motif(e.genre, look, h)}` +
    `<rect x="14" y="14" width="272" height="422" fill="none" stroke="${look.accent}" stroke-width="1" opacity=".45"/>` +
    `<g font-family="Georgia, 'Times New Roman', serif" fill="${look.ink}">` +
    `<text x="150" y="50" text-anchor="middle" font-size="11" letter-spacing="3" fill="${look.accent}">${esc(e.genre.toUpperCase())}</text>` +
    `${title}` +
    `<text x="150" y="404" text-anchor="middle" font-size="13" letter-spacing="2.5" fill="${look.accent}">${esc(e.author.toUpperCase())}</text>` +
    `</g></svg>`
  );
};

const covers = new Map<string, string>();
const coverFor = (e: BundledEntry): string => {
  const kept = covers.get(e.id);
  if (kept) return kept;
  const bytes = new TextEncoder().encode(coverSvg(e));
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const uri = `data:image/svg+xml;base64,${btoa(binary)}`;
  covers.set(e.id, uri);
  return uri;
};

// ------------------------------------------------------------------ likes and views, kept on this device

const readIds = (key: string): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const writeIds = (key: string, ids: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // storage full or refused: the like just does not stick
  }
};

/** Everyone on this device who has the novel in the list kept under `prefix`+their id. */
const people = (prefix: string, projectId: string): string[] => {
  const found: string[] = [];
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix) && readIds(key).includes(projectId)) found.push(key.slice(prefix.length));
    }
  } catch {
    // ignore
  }
  return found;
};

const toProject = (e: BundledEntry): Project => ({
  id: e.id,
  user_id: e.authorId,
  title: e.title,
  description: e.description,
  is_published: true,
  author_name: e.author,
  genre: e.genre,
  cover_url: coverFor(e),
  likes: people(LIKES_PREFIX, e.id),
  views: people(VIEWS_PREFIX, e.id),
  created_at: e.createdAt,
  updated_at: e.updatedAt,
});

// ------------------------------------------------------------------ what the database service asks for

export const getBundledProjects = (): Project[] => entries().map(toProject);

/** The pen name behind a sample novel, as a profile. It has no account, so it has no followers to count. */
export const getBundledAuthor = (userId: string): UserProfile | null => {
  const e = entries().find((x) => x.authorId === userId);
  return e ? { id: e.authorId, display_name: e.author, bio: e.authorBio, daily_word_goal: 0, followers: [], following: [] } : null;
};

export const getBundledAuthors = (userIds: string[]): UserProfile[] =>
  userIds.map(getBundledAuthor).filter((p): p is UserProfile => p !== null);

/** Forget this person's likes and views of the sample novels (used when their account is deleted). */
export const forgetBundledUser = (userId: string): void => {
  try {
    localStorage.removeItem(LIKES_PREFIX + userId);
    localStorage.removeItem(VIEWS_PREFIX + userId);
  } catch {
    // ignore
  }
};

const bodies = new Map<string, BundledBody>();

export const getBundledChapters = async (projectId: string): Promise<Chapter[]> => {
  const e = entryById(projectId);
  if (!e) return [];
  let body = bodies.get(e.slug);
  if (!body) {
    const load = bodyModules[`../data/library/novels/${e.slug}.json`];
    if (!load) return [];
    body = await load();
    bodies.set(e.slug, body);
  }
  return body.chapters.map((c, i) => ({
    id: `${e.slug}-${String(i + 1).padStart(2, '0')}`,
    project_id: e.id,
    title: c.title,
    content: c.html,
    position: i,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  }));
};

export const toggleBundledLike = (projectId: string, userId: string): Project => {
  const e = entryById(projectId);
  if (!e) throw new Error('Project not found');
  const key = LIKES_PREFIX + userId;
  const liked = readIds(key);
  writeIds(key, liked.includes(projectId) ? liked.filter((id) => id !== projectId) : [...liked, projectId]);
  return toProject(e);
};

export const trackBundledView = (projectId: string, userId: string): Project => {
  const e = entryById(projectId);
  if (!e) throw new Error('Project not found');
  const key = VIEWS_PREFIX + userId;
  const seen = readIds(key);
  if (!seen.includes(projectId)) writeIds(key, [...seen, projectId]);
  return toProject(e);
};
