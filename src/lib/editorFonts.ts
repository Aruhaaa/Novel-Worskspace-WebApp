export interface EditorFont {
  id: string;
  label: string;
  family: string;
}

// Fonts the author can write in. The rest of the app always uses Outfit and Playfair Display.
export const EDITOR_FONTS: EditorFont[] = [
  { id: 'lora', label: 'Lora', family: '"Lora", Georgia, serif' },
  { id: 'playfair', label: 'Playfair Display', family: '"Playfair Display", serif' },
  { id: 'merriweather', label: 'Merriweather', family: '"Merriweather", Georgia, serif' },
  { id: 'crimson', label: 'Crimson Pro', family: '"Crimson Pro", Georgia, serif' },
  { id: 'garamond', label: 'EB Garamond', family: '"EB Garamond", Georgia, serif' },
  { id: 'times', label: 'Times New Roman', family: '"Times New Roman", Times, serif' },
  { id: 'outfit', label: 'Outfit', family: '"Outfit", sans-serif' },
  { id: 'inter', label: 'Inter', family: '"Inter", sans-serif' },
  { id: 'courier', label: 'Courier Prime', family: '"Courier Prime", "Courier New", monospace' },
];

const STORAGE_KEY = 'novelist_editor_font';

export const loadEditorFont = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && EDITOR_FONTS.some((f) => f.id === saved)) return saved;
  } catch {
    // storage unavailable, fall back to default
  }
  return EDITOR_FONTS[0].id;
};

export const saveEditorFont = (id: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
};

export const getEditorFontFamily = (id: string): string =>
  (EDITOR_FONTS.find((f) => f.id === id) || EDITOR_FONTS[0]).family;
