export interface GenrePalette {
  /** Main brand colour of the genre, used for the dot and selected state */
  base: string;
  /** Soft tint used for chip backgrounds */
  soft: string;
  /** Readable text colour on the soft tint */
  ink: string;
  /** Extra swatches shown in the filter, taken from the genre palette */
  swatches: string[];
}

// Palettes follow the genre colour guide: each genre borrows from the family it sits closest to.
export const GENRE_PALETTES: Record<string, GenrePalette> = {
  Mystery: {
    base: '#b71c1c',
    soft: '#fbeaea',
    ink: '#8e1616',
    swatches: ['#1c1f2a', '#b71c1c', '#424242', '#bdbdbd'],
  },
  Thriller: {
    base: '#424242',
    soft: '#eeeeee',
    ink: '#262626',
    swatches: ['#000000', '#b71c1c', '#424242', '#bdbdbd'],
  },
  Horror: {
    base: '#1c1f2a',
    soft: '#e8e9ee',
    ink: '#1c1f2a',
    swatches: ['#000000', '#b71c1c', '#1c1f2a', '#424242'],
  },
  Romance: {
    base: '#ff6f61',
    soft: '#fde9e6',
    ink: '#b23a2e',
    swatches: ['#f8bbd0', '#ff6f61', '#b76e79', '#fff4e0'],
  },
  Fantasy: {
    base: '#673ab7',
    soft: '#efe9f9',
    ink: '#4a2a86',
    swatches: ['#2e7d32', '#673ab7', '#ffd700', '#1a1a6e'],
  },
  'Sci-Fi': {
    base: '#1a1a6e',
    soft: '#e6e6f5',
    ink: '#1a1a6e',
    swatches: ['#1a1a6e', '#673ab7', '#bdbdbd', '#4fc3f7'],
  },
  Historical: {
    base: '#b76e79',
    soft: '#f7ebed',
    ink: '#8a4a54',
    swatches: ['#b76e79', '#fff4e0', '#424242', '#2e7d32'],
  },
  Contemporary: {
    base: '#ff7043',
    soft: '#ffece5',
    ink: '#b8441b',
    swatches: ['#ffeb3b', '#4fc3f7', '#ff4081', '#ff7043'],
  },
};

export const GENRES = Object.keys(GENRE_PALETTES);

const FALLBACK: GenrePalette = {
  base: '#6b7280',
  soft: '#f3f4f6',
  ink: '#374151',
  swatches: [],
};

export const getGenrePalette = (genre?: string | null): GenrePalette =>
  (genre && GENRE_PALETTES[genre]) || FALLBACK;
