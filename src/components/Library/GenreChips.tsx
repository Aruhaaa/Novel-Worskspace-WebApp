import React from 'react';
import { GENRES, GENRE_PALETTES, genreLabel } from '../../lib/genres';
import { t } from '../../i18n';

interface GenreFilterProps {
  value: string;
  onChange: (genre: string) => void;
}

/** Genre chips with each genre's colour family, as in the studio library mockup. */
export const GenreFilter: React.FC<GenreFilterProps> = ({ value, onChange }) => (
  <div className="chips" role="group" aria-label={t('Filter by genre')}>
    <button className="chip plain" aria-pressed={value === 'All'} onClick={() => onChange('All')}>
      {t('All genres')}
    </button>
    {GENRES.map((genre) => (
      <button key={genre} className="chip" aria-pressed={value === genre} onClick={() => onChange(genre)}>
        <span className="swatches" aria-hidden="true">
          {GENRE_PALETTES[genre].swatches.slice(0, 3).map((color) => (
            <i key={color} style={{ background: color }} />
          ))}
        </span>
        {genreLabel(genre)}
      </button>
    ))}
  </div>
);

export const GenreTag: React.FC<{ genre: string }> = ({ genre }) => <span className="badge">{genreLabel(genre)}</span>;
