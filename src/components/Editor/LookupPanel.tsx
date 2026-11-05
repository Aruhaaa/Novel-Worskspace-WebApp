import React, { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { X } from 'lucide-react';
import { cleanWord, LookupError, lookupWord, matchCase, type Lookup } from '../../lib/dictionary';
import { useT } from '../../i18n';

/** The word under the caret or selected: its text and where it is in the chapter. */
const wordAtCaret = (editor: Editor): { word: string; from: number; to: number } | null => {
  const { selection, doc } = editor.state;
  if (!selection.empty) {
    const word = cleanWord(doc.textBetween(selection.from, selection.to, ' '));
    if (!word) return null;
    // The selection may include a space or a full stop around the word: find the word inside it
    const text = doc.textBetween(selection.from, selection.to, ' ');
    const offset = text.indexOf(word);
    return { word, from: selection.from + offset, to: selection.from + offset + word.length };
  }
  const $pos = selection.$from;
  const text = $pos.parent.textContent;
  const at = $pos.parentOffset;
  const isLetter = (ch: string | undefined) => !!ch && /[\p{L}'’-]/u.test(ch);
  let start = at;
  let end = at;
  while (start > 0 && isLetter(text[start - 1])) start--;
  while (end < text.length && isLetter(text[end])) end++;
  const word = cleanWord(text.slice(start, end));
  if (!word) return null;
  const real = text.slice(start, end).indexOf(word) + start;
  const base = $pos.start();
  return { word, from: base + real, to: base + real + word.length };
};

/** A small panel beside the page: what the word means, and words to put in its place. */
export const LookupPanel: React.FC<{ editor: Editor; onClose: () => void }> = ({ editor, onClose }) => {
  const t = useT();
  const [target] = useState(() => wordAtCaret(editor));
  const [result, setResult] = useState<Lookup | null>(null);
  const [error, setError] = useState<'offline' | 'bad-word' | null>(target ? null : 'bad-word');
  const [loading, setLoading] = useState(!!target);

  useEffect(() => {
    if (!target) return;
    let live = true;
    lookupWord(target.word)
      .then((r) => {
        if (live) setResult(r);
      })
      .catch((e) => {
        if (live) setError(e instanceof LookupError ? e.reason : 'offline');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [target]);

  const replaceWith = (word: string) => {
    if (!target) return;
    editor.chain().focus().insertContentAt({ from: target.from, to: target.to }, matchCase(target.word, word)).run();
    onClose();
  };

  return (
    <aside className="lookup-panel" role="complementary" aria-label={t('Word lookup')}>
      <div className="lookup-head">
        <div>
          <span className="eyebrow">{t('LOOK UP')}</span>
          <h3>{target?.word ?? ''}</h3>
          {result?.phonetic && <span className="lookup-phonetic">{result.phonetic}</span>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label={t('Close')} title={t('Close')}>
          <X />
        </button>
      </div>

      {loading && <p className="meta" role="status">{t('Looking it up…')}</p>}
      {error === 'bad-word' && <p className="meta">{t('Put the cursor in a word, or select one, and try again.')}</p>}
      {error === 'offline' && <p className="meta" role="alert">{t("Could not look that up. Check your connection and try again. Words you have looked up before work without one.")}</p>}

      {result && result.meanings.length === 0 && result.synonyms.length === 0 && <p className="meta">{t('No entry found for "{word}".', { word: result.word })}</p>}

      {result?.meanings.map((m, i) => (
        <section key={i} className="lookup-meaning">
          {m.partOfSpeech && <h4>{m.partOfSpeech}</h4>}
          <ol>
            {m.definitions.map((d, j) => (
              <li key={j}>
                {d.definition}
                {d.example && <em>“{d.example}”</em>}
              </li>
            ))}
          </ol>
        </section>
      ))}

      {result && result.synonyms.length > 0 && (
        <section className="lookup-synonyms">
          <h4>{t('Similar words')}</h4>
          <div className="chips">
            {result.synonyms.map((w) => (
              <button key={w} className="chip" onClick={() => replaceWith(w)} title={t('Replace "{word}" with "{replacement}"', { word: target?.word ?? '', replacement: w })}>
                {w}
              </button>
            ))}
          </div>
          <small>{t('Click a word to put it in place of yours.')}</small>
        </section>
      )}

      <p className="lookup-source">{t('English words. Looked up with dictionaryapi.dev and Datamuse: only the word is sent.')}</p>
    </aside>
  );
};
