import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/toastContext';
import { describeSplits, readManuscriptSource, splitManuscript, type ManuscriptSource, type SplitMode } from '../../utils/importFormats';
import { mark, tp, useT } from '../../i18n';
import './import.css';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** A new project made from the file, or the open project, with the chapters added after its last one */
  target: 'new' | 'append';
}

type Step = 'choose' | 'reading' | 'review' | 'importing';

const MAX_CHAPTERS = 500;
const ACCEPT = '.docx,.txt,.md,.markdown,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const SPLITS: { id: SplitMode; label: string }[] = [
  { id: 'auto', label: mark('Automatic') },
  { id: 'headings', label: mark('Headings') },
  { id: 'chapter-lines', label: mark('“Chapter” lines') },
  { id: 'scene-breaks', label: mark('Scene breaks') },
  { id: 'none', label: mark('One chapter') },
];

interface RowProps {
  index: number;
  title: string;
  words: number;
  on: boolean;
  onToggle: (index: number) => void;
  onTitle: (index: number, value: string) => void;
}

const Row = React.memo(function Row({ index, title, words, on, onToggle, onTitle }: RowProps) {
  const t = useT();
  return (
    <li className={`imp-row${on ? '' : ' is-off'}`}>
      <label className="imp-pick">
        <input type="checkbox" checked={on} onChange={() => onToggle(index)} aria-label={t('Import chapter {n}', { n: index + 1 })} />
      </label>
      <input
        className="imp-name"
        value={title}
        placeholder={t('Untitled chapter')}
        aria-label={t('Title of chapter {n}', { n: index + 1 })}
        autoComplete="off"
        onChange={(e) => onTitle(index, e.target.value)}
      />
      <span className="imp-words">{tp(words, '{n} word', '{n} words')}</span>
    </li>
  );
});

const ImportBody: React.FC<{ target: 'new' | 'append'; onClose: () => void }> = ({ target, onClose }) => {
  const t = useT();
  const { activeProject, chapters, importManuscript, undoImport } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('choose');
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [source, setSource] = useState<ManuscriptSource | null>(null);
  const [mode, setMode] = useState<SplitMode>('auto');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [titles, setTitles] = useState<Record<number, string>>({});
  const [off, setOff] = useState<Set<number>>(() => new Set());

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const splitRef = useRef<HTMLSelectElement>(null);
  // Set to false when the dialog closes, so a file that finishes reading later changes nothing
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Keyboard focus follows the step: back to the picker after a problem, to the first field once there is something to review
  useEffect(() => {
    if (step === 'choose') dropRef.current?.focus();
    if (step === 'review') (target === 'new' ? titleRef : splitRef).current?.focus();
  }, [step, target]);

  // Escape would close the dialog in the middle of saving; the import carries on either way, so it is held back until done
  useEffect(() => {
    if (step !== 'importing') return;
    const dialog = rootRef.current?.closest('dialog');
    const hold = (e: Event) => e.preventDefault();
    dialog?.addEventListener('cancel', hold);
    return () => dialog?.removeEventListener('cancel', hold);
  }, [step]);

  const split = useMemo(() => (source ? splitManuscript(source, mode) : null), [source, mode]);
  const found = useMemo(() => (source ? describeSplits(source) : null), [source]);

  const list = split ? split.chapters : [];
  const chosen = list.filter((_, i) => !off.has(i));
  const chosenWords = chosen.reduce((sum, c) => sum + c.words, 0);
  const tooMany = chosen.length > MAX_CHAPTERS;
  const importing = step === 'importing';
  const canImport = step === 'review' && chosen.length > 0 && !tooMany && (target === 'append' ? !!activeProject : title.trim().length > 0);

  const start = async (file: File) => {
    setError(null);
    setFileName(file.name);
    setStep('reading');
    try {
      const read = await readManuscriptSource(file);
      if (!alive.current) return;
      const first = splitManuscript(read, 'auto');
      setSource(read);
      setMode('auto');
      setTitle(first.title);
      setAuthor(first.author);
      setDescription('');
      setTitles({});
      setOff(new Set());
      setStep('review');
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof Error && err.message ? err.message : t('That file could not be read. Try another one.'));
      setStep('choose');
    }
  };

  const take = (files: FileList | null | undefined) => {
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      setError(t('Choose one file at a time.'));
      return;
    }
    void start(files[0]);
  };

  const toggle = useCallback((index: number) => {
    setOff((prev) => {
      const next = new Set(prev);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }, []);

  const rename = useCallback((index: number, value: string) => {
    setTitles((prev) => ({ ...prev, [index]: value }));
  }, []);

  const changeMode = (next: SplitMode) => {
    // A different split makes a different list, so edits and ticks to the old one do not carry over
    setMode(next);
    setTitles({});
    setOff(new Set());
  };

  const run = async () => {
    if (!split || !canImport) return;
    setError(null);
    setStep('importing');
    const result = await importManuscript({
      target:
        target === 'new'
          ? { kind: 'new', title: title.trim(), description: description.trim(), authorName: author.trim() || undefined }
          : { kind: 'append' },
      chapters: split.chapters.flatMap((c, i) => (off.has(i) ? [] : [{ title: titles[i] ?? c.title, html: c.html }])),
    });
    if (result.error) {
      if (alive.current) {
        setError(result.error);
        setStep('review');
      }
      return;
    }
    onClose();
    const n = result.chapterIds?.length ?? 0;
    toast({
      message: t('Imported {chapters} ({words}).', { chapters: tp(n, '{n} chapter', '{n} chapters'), words: tp(result.words ?? 0, '{n} word', '{n} words') }),
      actionLabel: t('Undo'),
      onAction: async () => {
        const undone = await undoImport(result);
        toast({ message: undone.error ?? t('The import has been undone.') });
      },
    });
    if (target === 'new') navigate('/chapters');
  };

  const total = list.length;
  const chaptersText =
    chosen.length === total
      ? tp(total, '{n} chapter', '{n} chapters')
      : t('{n} of {total}', { n: chosen.length.toLocaleString(), total: tp(total, '{n} chapter', '{n} chapters') });
  const totals = `${chaptersText} · ${tp(chosenWords, '{n} word', '{n} words')}`;
  const autoLabel = found ? t(SPLITS.find((s) => s.id === found.auto)?.label ?? '').toLowerCase() : '';

  return (
    // Dropping a file beside the drop zone would make the browser open it and leave the app, so the whole dialog catches it
    <div ref={rootRef} className="imp-body" onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
      <p className="eyebrow">{target === 'new' ? t('IMPORT A MANUSCRIPT') : t('IMPORT CHAPTERS')}</p>
      <h2 id="imp-h">{target === 'new' ? t('Import a manuscript') : t('Import chapters')}</h2>

      {(step === 'choose' || step === 'reading') && (
        <>
          <p>
            {t('Choose a Word (.docx), plain text (.txt) or Markdown (.md) file. It is split into chapters, and you check them before anything is saved')}
            {target === 'append' && activeProject ? `. They are added after the last chapter of “${activeProject.title}”` : ''}.
          </p>
          {step === 'choose' ? (
            <>
              <button
                type="button"
                ref={dropRef}
                className={`imp-drop${dragging ? ' is-over' : ''}`}
                aria-describedby="imp-private"
                onClick={() => inputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragging(false);
                  take(e.dataTransfer.files);
                }}
              >
                <Upload aria-hidden="true" />
                <strong>{t('Choose a file')}</strong>
                <span>{t('or drop it here')}</span>
                <small>{t('Word (.docx), plain text (.txt) or Markdown (.md)')}</small>
              </button>
              <input
                ref={inputRef}
                className="imp-file"
                type="file"
                accept={ACCEPT}
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  take(e.target.files);
                  // Choosing the same file again after a problem should still count as a choice
                  e.target.value = '';
                }}
              />
              <p id="imp-private" className="imp-private">{t('Your file is read on this device. Only the chapters you keep are saved.')}</p>
              {error && (
                <p className="imp-error" role="alert">
                  {error}
                </p>
              )}
            </>
          ) : (
            <p className="imp-reading" role="status">
              {t('Reading')} <strong>{fileName}</strong>…
            </p>
          )}
          <div className="dialog-actions imp-actions">
            <button type="button" className="button button-outline button-small" onClick={onClose}>
              {t('Cancel')}
            </button>
          </div>
        </>
      )}

      {(step === 'review' || step === 'importing') && split && found && (
        <>
          <p className="imp-from">
            From <strong>{fileName}</strong>
          </p>
          <fieldset className="imp-fieldset" disabled={importing} aria-busy={importing}>
            {target === 'new' ? (
              <div className="imp-fields">
                <div className="imp-field">
                  <label htmlFor="imp-title">{t('Project title')}</label>
                  <input id="imp-title" ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" required />
                </div>
                <div className="imp-field">
                  <label htmlFor="imp-author">{t('Author (optional)')}</label>
                  <input id="imp-author" value={author} onChange={(e) => setAuthor(e.target.value)} autoComplete="off" />
                </div>
                <div className="imp-field imp-wide">
                  <label htmlFor="imp-desc">{t('Description (optional)')}</label>
                  <input id="imp-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('A short summary of the theme, setting or plot')} autoComplete="off" />
                </div>
              </div>
            ) : (
              <p className="imp-where">
                {chapters.length > 0
                  ? t('These chapters will be added after chapter {n} of “{title}”.', { n: chapters.length, title: activeProject?.title ?? '' })
                  : t('These chapters will be the first in “{title}”.', { title: activeProject?.title ?? '' })}
              </p>
            )}

            <div className="imp-field">
              <label htmlFor="imp-split">{t('Split by')}</label>
              <select id="imp-split" ref={splitRef} className="select" value={mode} aria-describedby="imp-split-hint" onChange={(e) => changeMode(e.target.value as SplitMode)}>
                {SPLITS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t(s.label)}
                  </option>
                ))}
              </select>
              <p id="imp-split-hint" className="imp-hint">
                {t('Found {headings}, {chapterLines} and {sceneBreaks}.', { headings: tp(found.headings, '{n} heading', '{n} headings'), chapterLines: tp(found.chapterLines, '{n} “Chapter” line', '{n} “Chapter” lines'), sceneBreaks: tp(found.sceneBreaks, '{n} scene break', '{n} scene breaks') })}
                {mode === 'auto' ? ` ${t('Automatic picks {split}.', { split: autoLabel })}` : ''}
              </p>
            </div>

            <div className="imp-head">
              <span className="imp-total" role="status" aria-live="polite">
                {totals}
              </span>
              <span className="imp-bulk">
                <button type="button" className="small-btn" onClick={() => setOff(new Set())}>
                  {t('Select all')}
                </button>
                <button type="button" className="small-btn" onClick={() => setOff(new Set(list.map((_, i) => i)))}>
                  {t('Select none')}
                </button>
              </span>
            </div>

            {total > 0 ? (
              <ul className="imp-list" aria-label={t('Chapters found')}>
                {list.slice(0, MAX_CHAPTERS).map((c, i) => (
                  <Row key={i} index={i} title={titles[i] ?? c.title} words={c.words} on={!off.has(i)} onToggle={toggle} onTitle={rename} />
                ))}
              </ul>
            ) : (
              <p className="imp-notice mock-note" role="status">
                {t('No chapters came out of this split. Choose a different one above.')}
              </p>
            )}
            {total > MAX_CHAPTERS && (
              <p className="imp-notice mock-note" role="status">
                {tooMany
                  ? t('This split found {total} chapters, and only the first {max} are listed. At most {max} can be imported at once, so choose a different split above, or untick chapters.', { total: total.toLocaleString(), max: MAX_CHAPTERS })
                  : t('This split found {total} chapters, and only the first {max} are listed. At most {max} can be imported at once, so choose a different split above.', { total: total.toLocaleString(), max: MAX_CHAPTERS })}
              </p>
            )}

            {split.warnings.length > 0 && (
              <div className="imp-warnings" role="status">
                <strong>{t('Left out or simplified')}</strong>
                <ul>
                  {split.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </fieldset>

          {error && (
            <p className="imp-error" role="alert">
              {error}
            </p>
          )}
          {importing && (
            <p className="sr-only" role="status">
              {t('Importing…')}
            </p>
          )}

          <div className="dialog-actions imp-actions">
            <button type="button" className="button button-outline button-small" disabled={importing} onClick={() => setStep('choose')}>
              {t('Choose another file')}
            </button>
            <button type="button" className="button button-outline button-small" disabled={importing} onClick={onClose}>
              {t('Cancel')}
            </button>
            <button type="button" className="button button-primary button-small" disabled={!canImport} onClick={run}>
              {importing ? t('Importing…') : chosen.length > 0 ? t('Import {chapters}', { chapters: tp(chosen.length, '{n} chapter', '{n} chapters') }) : t('Import')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/** Brings a book in from a Word, plain text or Markdown file, split into chapters you can check first. */
export const ImportDialog: React.FC<ImportDialogProps> = ({ open, onClose, target }) => (
  <Dialog open={open} onClose={onClose} labelledBy="imp-h" className="dialog-wide imp-dialog">
    <ImportBody target={target} onClose={onClose} />
  </Dialog>
);
