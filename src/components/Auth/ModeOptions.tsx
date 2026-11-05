import React from 'react';
import { Check } from 'lucide-react';
import type { UseMode } from '../../lib/mode';
import { mark, t } from '../../i18n';

const OPTIONS: { id: UseMode; title: string; text: string }[] = [
  { id: 'read', title: mark('Read'), text: mark('Find novels, keep a library and pick up where you left off.') },
  { id: 'write', title: mark('Write'), text: mark('Open straight into your studio: manuscripts, notebook and goals.') },
  { id: 'both', title: mark('Both'), text: mark('Start with something to read, and step into the studio when you want.') },
];

/** The one question: what do you mostly come here for? It only decides what opens first. Nothing is ever hidden. */
export const ModeOptions: React.FC<{ value: UseMode | null; onChange: (m: UseMode) => void; labelledBy: string }> = ({ value, onChange, labelledBy }) => (
  <div className="mode-options" role="radiogroup" aria-labelledby={labelledBy}>
    {OPTIONS.map((o) => (
      <button key={o.id} type="button" className="mode-option" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
        <span>
          <strong>{t(o.title)}</strong>
          <small>{t(o.text)}</small>
        </span>
        <span className="tick" aria-hidden="true">
          <Check />
        </span>
      </button>
    ))}
  </div>
);
