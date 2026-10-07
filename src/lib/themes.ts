export interface ThemeOption {
  id: string;
  name: string;
  description: string;
  /** Used only for the preview card in Preferences */
  preview: { canvas: string; surface: string; border: string; ink: string; muted: string; accent: string };
}

export const THEMES: ThemeOption[] = [
  {
    id: 'studio',
    name: 'Literary Studio',
    description: 'Paper, ink and oxblood. The default.',
    preview: { canvas: '#F5F2EB', surface: '#F0EEE6', border: '#DCD8CD', ink: '#262722', muted: '#716E63', accent: '#813F38' },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Plain black on white.',
    preview: { canvas: '#ffffff', surface: '#f6f7f9', border: '#e5e7eb', ink: '#111827', muted: '#6b7280', accent: '#0a0a0a' },
  },
  {
    id: 'parchment',
    name: 'Archival Parchment',
    description: 'Warm cream paper and iron-gall ink, for long writing sessions.',
    preview: { canvas: '#FAF6F0', surface: '#F0EAE1', border: '#DDD3C4', ink: '#2D2825', muted: '#6E645D', accent: '#8A3324' },
  },
  {
    id: 'hardcover',
    name: 'Classic Hardcover',
    description: 'Crisp white pages with book-cloth green and a brass bookmark.',
    preview: { canvas: '#F7F8F6', surface: '#FFFFFF', border: '#E1E4DD', ink: '#1B2421', muted: '#55605A', accent: '#1C4035' },
  },
  {
    id: 'midnight',
    name: 'Midnight Reading Nook',
    description: 'Dark slate with candlelit text and a warm lamp accent.',
    preview: { canvas: '#16171B', surface: '#212328', border: '#31343D', ink: '#ECE8DF', muted: '#9A9890', accent: '#E09F3E' },
  },
  {
    id: 'coastal',
    name: 'Coastal Vintage',
    description: 'Calm paper grey with oceanic linen and a terracotta touch.',
    preview: { canvas: '#F4F5F6', surface: '#FFFFFF', border: '#DFE2E6', ink: '#1E252B', muted: '#535D66', accent: '#354F52' },
  },
];

const STORAGE_KEY = 'novelist_theme_v2';

export const loadTheme = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.some((t) => t.id === saved)) return saved;
  } catch {
    // storage unavailable
  }
  return THEMES[0].id;
};

/** Set the theme on the page. Only a deliberate choice (persist = true) is remembered. */
export const applyTheme = (id: string, persist = true) => {
  const root = document.documentElement;
  if (id === THEMES[0].id) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', id);
  if (!persist) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
};
