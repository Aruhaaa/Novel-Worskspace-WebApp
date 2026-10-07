import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { htmlToText } from '../../lib/text';
import { FIND_HANDOFF_KEY, NOTE_HANDOFF_KEY, openCapture } from '../../lib/uiEvents';
import { Dialog } from '../ui/Dialog';

interface Item {
  id: string;
  group: string;
  title: React.ReactNode;
  hint?: string;
  run: () => void;
}

const MAX_TEXT_RESULTS = 12;

/** A snippet around a match, with the match marked. */
const snippet = (text: string, at: number, len: number): React.ReactNode => {
  const start = Math.max(0, at - 45);
  const end = Math.min(text.length, at + len + 70);
  return (
    <>
      {start > 0 && '…'}
      {text.slice(start, at)}
      <mark>{text.slice(at, at + len)}</mark>
      {text.slice(at + len, end)}
      {end < text.length && '…'}
    </>
  );
};

const PaletteBody: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { activeProject, chapters, entities, setActiveChapter } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const items = useMemo<Item[]>(() => {
    const q = query.trim();
    const lower = q.toLowerCase();
    const go = (path: string) => () => navigate(path);
    const goItems: Item[] = [];
    const out: Item[] = [];
    const jotItems: Item[] = [];

    const actions: { label: string; hint?: string; run: () => void; project?: boolean }[] = [
      { label: 'Open the manuscript', run: go('/editor'), project: true },
      { label: 'Chapter index', run: go('/chapters'), project: true },
      { label: 'Story outline', run: go('/outline'), project: true },
      { label: 'World notebook', run: go('/notebook'), project: true },
      { label: 'Progress and goals', run: go('/tracker'), project: true },
      { label: 'Jot an idea', hint: 'Add to your outline', run: () => openCapture(), project: true },
      { label: 'All projects', run: go('/manuscripts') },
      { label: 'Home dashboard', run: go('/') },
      { label: 'Library', run: go('/library') },
      { label: 'Preferences', run: go('/preferences') },
    ];
    for (const a of actions) {
      if (a.project && !activeProject) continue;
      if (!q || a.label.toLowerCase().includes(lower)) goItems.push({ id: `a-${a.label}`, group: 'Go to', title: a.label, hint: a.hint, run: a.run });
    }

    if (q && activeProject) {
      jotItems.push({ id: 'a-jot', group: 'Capture', title: <>Jot “{q}” as an idea</>, hint: 'Add to your outline', run: () => openCapture(q) });
    }

    if (activeProject) {
      chapters.forEach((c, i) => {
        if (!q || (c.title || 'Untitled chapter').toLowerCase().includes(lower)) {
          out.push({
            id: `c-${c.id}`,
            group: 'Chapters',
            title: c.title || 'Untitled chapter',
            hint: `Chapter ${String(i + 1).padStart(2, '0')}`,
            run: () => {
              setActiveChapter(c);
              navigate('/editor');
            },
          });
        }
      });

      if (q) {
        for (const e of entities) {
          if (e.name.toLowerCase().includes(lower) || (e.description || '').toLowerCase().includes(lower)) {
            out.push({
              id: `e-${e.id}`,
              group: e.type === 'scene' ? 'Outline' : 'Notebook',
              title: e.name,
              hint: e.type,
              run: () => {
                if (e.type === 'scene') {
                  navigate('/outline');
                } else {
                  try {
                    sessionStorage.setItem(NOTE_HANDOFF_KEY, e.id);
                  } catch {
                    // the notebook still opens
                  }
                  navigate('/notebook');
                }
              },
            });
          }
        }
      }

      if (q.length >= 2) {
        let found = 0;
        for (const [i, c] of chapters.entries()) {
          if (found >= MAX_TEXT_RESULTS) break;
          const text = htmlToText(c.content);
          const textLower = text.toLowerCase();
          let from = 0;
          let perChapter = 0;
          while (perChapter < 2 && found < MAX_TEXT_RESULTS) {
            const at = textLower.indexOf(lower, from);
            if (at === -1) break;
            const keep = at;
            out.push({
              id: `t-${c.id}-${keep}`,
              group: 'In the text',
              title: snippet(text, keep, q.length),
              hint: `Chapter ${String(i + 1).padStart(2, '0')}`,
              run: () => {
                try {
                  sessionStorage.setItem(FIND_HANDOFF_KEY, q);
                } catch {
                  // the chapter still opens
                }
                setActiveChapter(c);
                navigate('/editor');
              },
            });
            perChapter++;
            found++;
            from = at + Math.max(q.length, 80);
          }
        }
      }
    }
    // With a search word, real matches come first so Enter opens what you were looking for
    return q ? [...out, ...goItems, ...jotItems] : [...goItems, ...out];
  }, [query, activeProject, chapters, entities, navigate, setActiveChapter]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[active]);
    }
  };

  // Scroll the highlighted row into view as the arrows move
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, items]);

  let lastGroup = '';
  return (
    <div onKeyDown={onKeyDown}>
      <h2 id="pal-h" className="sr-only">Search and jump</h2>
      <input
        className="palette-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        placeholder={activeProject ? 'Search chapters, notes and your text, or jump anywhere' : 'Jump anywhere'}
        aria-label="Search"
        role="combobox"
        aria-expanded="true"
        aria-controls="pal-list"
        aria-activedescendant={items[active] ? `pal-${items[active].id}` : undefined}
        autoFocus
      />
      <div className="palette-list" id="pal-list" role="listbox" ref={listRef}>
        {items.length === 0 && <p className="palette-empty">Nothing matches “{query}”.</p>}
        {items.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <React.Fragment key={item.id}>
              {header && <p className="palette-group">{header}</p>}
              <button
                id={`pal-${item.id}`}
                role="option"
                aria-selected={i === active}
                className="palette-row"
                onMouseMove={() => i !== active && setActive(i)}
                onClick={() => choose(item)}
              >
                <span>{item.title}</span>
                {item.hint && <small>{item.hint}</small>}
              </button>
            </React.Fragment>
          );
        })}
      </div>
      <p className="palette-foot">
        <span>↑ ↓ to move</span>
        <span>Enter to open</span>
        <span>Esc to close</span>
      </p>
    </div>
  );
};

export const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Dialog open={open} onClose={onClose} labelledBy="pal-h" className="palette">
    <PaletteBody onClose={onClose} />
  </Dialog>
);
