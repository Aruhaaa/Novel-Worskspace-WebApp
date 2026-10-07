import React from 'react';
import { GENRES, GENRE_PALETTES } from '../../lib/genres';

interface GenreFilterProps {
  value: string;
  onChange: (genre: string) => void;
}

/** Genre chips with each genre's colour family, as in the studio library mockup. */
export const GenreFilter: React.FC<GenreFilterProps> = ({ value, onChange }) => (
  <div className="chips" role="group" aria-label="Filter by genre">
    <button className="chip plain" aria-pressed={value === 'All'} onClick={() => onChange('All')}>
      All genres
    </button>
    {GENRES.map((genre) => (
      <button key={genre} className="chip" aria-pressed={value === genre} onClick={() => onChange(genre)}>
        <span className="swatches" aria-hidden="true">
          {GENRE_PALETTES[genre].swatches.slice(0, 3).map((color) => (
            <i key={color} style={{ background: color }} />
          ))}
        </span>
        {genre}
      </button>
    ))}
  </div>
);

export const GenreTag: React.FC<{ genre: string }> = ({ genre }) => <span className="badge">{genre}</span>;
