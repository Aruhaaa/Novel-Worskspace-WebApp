import React from 'react';
import { useT } from '../../i18n';
import { languageLabel, NOVEL_LANGUAGES } from '../../lib/novelLanguage';

interface LanguageSelectProps {
  id: string;
  value: string;
  onChange: (code: string) => void;
  /** Offer "Select a language" as an answer (a novel can be left without one) */
  allowUnset?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** Choose the language a novel is written in. Each name is shown in its own script, with the app's language beside it when that helps. */
export const LanguageSelect: React.FC<LanguageSelectProps> = ({ id, value, onChange, allowUnset, disabled, className = 'select', style }) => {
  const t = useT();
  const known = NOVEL_LANGUAGES.some((l) => l.code === value);
  return (
    <select id={id} className={className} style={style} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {(allowUnset || !value) && <option value="">{t('Select a language')}</option>}
      {NOVEL_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code} lang={l.code}>
          {languageLabel(l.code)}
        </option>
      ))}
      {value && !known && <option value={value}>{languageLabel(value)}</option>}
    </select>
  );
};

/** A small tag naming a novel's language, for cards and headings. Nothing for a novel with none. */
export const LanguageTag: React.FC<{ code?: string | null }> = ({ code }) => {
  const t = useT();
  if (!code) return null;
  return (
    <span className="badge" title={t('Language of this novel')} data-testid="language-tag">
      {languageLabel(code).split(' (')[0]}
    </span>
  );
};
