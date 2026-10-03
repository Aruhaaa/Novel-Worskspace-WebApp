import React from 'react';
import { GENRES, getGenrePalette } from '../../lib/genres';

interface GenreFilterProps {
  value: string;
  onChange: (genre: string) => void;
}

export const GenreFilter: React.FC<GenreFilterProps> = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="Filter by genre" className="flex flex-wrap items-center gap-2">
    <button
      type="button"
      role="radio"
      aria-checked={value === 'All'}
      onClick={() => onChange('All')}
      className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
        value === 'All'
          ? 'bg-slate-100 text-white border-slate-100'
          : 'bg-white text-slate-400 border-slate-800 hover:border-slate-600'
      }`}
    >
      All genres
    </button>
    {GENRES.map((genre) => {
      const palette = getGenrePalette(genre);
      const selected = value === genre;
      return (
        <button
          key={genre}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(genre)}
          style={
            selected
              ? { backgroundColor: palette.base, borderColor: palette.base, color: '#fff' }
              : { backgroundColor: palette.soft, borderColor: palette.soft, color: palette.ink }
          }
          className="flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full text-sm font-medium border transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="flex -space-x-1" aria-hidden="true">
            {palette.swatches.slice(0, 3).map((color) => (
              <span
                key={color}
                className="w-3 h-3 rounded-full ring-1 ring-white"
                style={{ backgroundColor: color }}
              />
            ))}
          </span>
          {genre}
        </button>
      );
    })}
  </div>
);

export const GenreTag: React.FC<{ genre: string }> = ({ genre }) => {
  const palette = getGenrePalette(genre);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: palette.soft, color: palette.ink }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: palette.base }} />
      {genre}
    </span>
  );
};
