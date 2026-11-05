import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/toastContext';
import { describeSplits, readManuscriptSource, splitManuscript, type ManuscriptSource, type SplitMode } from '../../utils/importFormats';
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
  { id: 'auto', label: 'Automatic' },
  { id: 'headings', label: 'Headings' },
  { id: 'chapter-lines', label: '“Chapter” lines' },
  { id: 'scene-breaks', label: 'Scene breaks' },
  { id: 'none', label: 'One chapter' },
];

const count = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

interface RowProps {
  index: number;
  title: string;
  words: number;
  on: boolean;
  onToggle: (index: number) => void;
  onTitle: (index: number, value: string) => void;
}

const Row = React.memo(function Row({ index, title, words, on, onToggle, onTitle }: RowProps) {
  return (
    <li className={`imp-row${on ? '' : ' is-off'}`}>
      <label className="imp-pick">
        <input type="checkbox" checked={on} onChange={() => onToggle(index)} aria-label={`Import chapter ${index + 1}`} />
      </label>
      <input
        className="imp-name"
        value={title}
        placeholder="Untitled chapter"
        aria-label={`Title of chapter ${index + 1}`}
        autoComplete="off"
        onChange={(e) => onTitle(index, e.target.value)}
      />
      <span className="imp-words">{count(words, 'word', 'words')}</span>
    </li>
  );
});

const ImportBody: React.FC<{ target: 'new' | 'append'; onClose: () => void }> = ({ target, onClose }) => {
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
      setError(err instanceof Error && err.message ? err.message : 'That file could not be read. Try another one.');
      setStep('choose');
    }
  };

  const take = (files: FileList | null | undefined) => {
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      setError('Choose one file at a time.');
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
      message: `Imported ${count(n, 'chapter', 'chapters')} (${(result.words ?? 0).toLocaleString()} words).`,
      actionLabel: 'Undo',
      onAction: async () => {
        const undone = await undoImport(result);
        toast({ message: undone.error ?? 'The import has been undone.' });
      },
    });
    if (target === 'new') navigate('/chapters');
  };

  const total = list.length;
  const totals = `${chosen.length === total ? count(total, 'chapter', 'chapters') : `${chosen.length.toLocaleString()} of ${count(total, 'chapter', 'chapters')}`} · ${count(chosenWords, 'word', 'words')}`;
  const autoLabel = found ? SPLITS.find((s) => s.id === found.auto)?.label.toLowerCase() : '';

  return (
    // Dropping a file beside the drop zone would make the browser open it and leave the app, so the whole dialog catches it
    <div ref={rootRef} className="imp-body" onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
      <p className="eyebrow">{target === 'new' ? 'IMPORT A MANUSCRIPT' : 'IMPORT CHAPTERS'}</p>
      <h2 id="imp-h">{target === 'new' ? 'Import a manuscript' : 'Import chapters'}</h2>

      {(step === 'choose' || step === 'reading') && (
        <>
          <p>
            Choose a Word (.docx), plain text (.txt) or Markdown (.md) file. It is split into chapters, and you check them before anything is saved
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
                <strong>Choose a file</strong>
                <span>or drop it here</span>
                <small>Word (.docx), plain text (.txt) or Markdown (.md)</small>
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
              <p id="imp-private" className="imp-private">Your file is read on this device. Only the chapters you keep are saved.</p>
              {error && (
                <p className="imp-error" role="alert">
                  {error}
                </p>
              )}
            </>
          ) : (
            <p className="imp-reading" role="status">
              Reading <strong>{fileName}</strong>…
            </p>
          )}
          <div className="dialog-actions imp-actions">
            <button type="button" className="button button-outline button-small" onClick={onClose}>
              Cancel
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
                  <label htmlFor="imp-title">Project title</label>
                  <input id="imp-title" ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" required />
                </div>
                <div className="imp-field">
                  <label htmlFor="imp-author">Author (optional)</label>
                  <input id="imp-author" value={author} onChange={(e) => setAuthor(e.target.value)} autoComplete="off" />
                </div>
                <div className="imp-field imp-wide">
                  <label htmlFor="imp-desc">Description (optional)</label>
                  <input id="imp-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short summary of the theme, setting or plot" autoComplete="off" />
                </div>
              </div>
            ) : (
              <p className="imp-where">
                {chapters.length > 0
                  ? `These chapters will be added after chapter ${chapters.length} of “${activeProject?.title ?? ''}”.`
                  : `These chapters will be the first in “${activeProject?.title ?? ''}”.`}
              </p>
            )}

            <div className="imp-field">
              <label htmlFor="imp-split">Split by</label>
              <select id="imp-split" ref={splitRef} className="select" value={mode} aria-describedby="imp-split-hint" onChange={(e) => changeMode(e.target.value as SplitMode)}>
                {SPLITS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p id="imp-split-hint" className="imp-hint">
                Found {count(found.headings, 'heading', 'headings')}, {count(found.chapterLines, '“Chapter” line', '“Chapter” lines')} and {count(found.sceneBreaks, 'scene break', 'scene breaks')}.
                {mode === 'auto' ? ` Automatic picks ${autoLabel}.` : ''}
              </p>
            </div>

            <div className="imp-head">
              <span className="imp-total" role="status" aria-live="polite">
                {totals}
              </span>
              <span className="imp-bulk">
                <button type="button" className="small-btn" onClick={() => setOff(new Set())}>
                  Select all
                </button>
                <button type="button" className="small-btn" onClick={() => setOff(new Set(list.map((_, i) => i)))}>
                  Select none
                </button>
              </span>
            </div>

            {total > 0 ? (
              <ul className="imp-list" aria-label="Chapters found">
                {list.slice(0, MAX_CHAPTERS).map((c, i) => (
                  <Row key={i} index={i} title={titles[i] ?? c.title} words={c.words} on={!off.has(i)} onToggle={toggle} onTitle={rename} />
                ))}
              </ul>
            ) : (
              <p className="imp-notice mock-note" role="status">
                No chapters came out of this split. Choose a different one above.
              </p>
            )}
            {total > MAX_CHAPTERS && (
              <p className="imp-notice mock-note" role="status">
                This split found {total.toLocaleString()} chapters, and only the first {MAX_CHAPTERS} are listed. At most {MAX_CHAPTERS} can be imported at once, so choose a different
                split above{tooMany ? ', or untick chapters' : ''}.
              </p>
            )}

            {split.warnings.length > 0 && (
              <div className="imp-warnings" role="status">
                <strong>Left out or simplified</strong>
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
              Importing…
            </p>
          )}

          <div className="dialog-actions imp-actions">
            <button type="button" className="button button-outline button-small" disabled={importing} onClick={() => setStep('choose')}>
              Choose another file
            </button>
            <button type="button" className="button button-outline button-small" disabled={importing} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="button button-primary button-small" disabled={!canImport} onClick={run}>
              {importing ? 'Importing…' : chosen.length > 0 ? `Import ${count(chosen.length, 'chapter', 'chapters')}` : 'Import'}
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
