import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, Pause, Play, Square, Timer } from 'lucide-react';
import {
  formatClock,
  formatSpan,
  isBetterSprint,
  rememberedMinutes,
  useSprint,
  useSprintHistory,
  useSprintStatus,
} from '../../lib/sprint';
import type { SprintPlan, SprintResult } from '../../lib/sprint';
import { tp, useT } from '../../i18n';
import './sprint.css';

const PRESETS = [10, 15, 20, 25, 30, 45, 60];
const MAX_MINUTES = 180;
const MAX_GOAL = 1_000_000;

const wordsText = (n: number) => tp(n, '{n} word', '{n} words');

interface StartPanelProps {
  sound: boolean;
  busyElsewhere: boolean;
  onSound: (on: boolean) => void;
  onStart: (plan: SprintPlan) => void;
  onCancel: () => void;
}

/** Length, an optional word goal and the chime. Mounts only while open, so it starts fresh each time. */
const StartPanel: React.FC<StartPanelProps> = ({ sound, busyElsewhere, onSound, onStart, onCancel }) => {
  const t = useT();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [last] = useState(rememberedMinutes);
  const [preset, setPreset] = useState(PRESETS.includes(last) ? last : 20);
  const [custom, setCustom] = useState(PRESETS.includes(last) ? '' : String(last));
  const [goal, setGoal] = useState('');

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-pressed="true"], input')?.focus();
  }, []);

  const typedLength = custom.trim() !== '';
  const minutes = typedLength ? Number(custom) : preset;
  const minutesOk = Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_MINUTES;
  const typedGoal = goal.trim() !== '';
  const goalWords = typedGoal ? Number(goal) : null;
  const goalOk = goalWords === null || (Number.isInteger(goalWords) && goalWords >= 1 && goalWords <= MAX_GOAL);
  const error = typedLength && !minutesOk
    ? t('Choose a length from 1 to {max} minutes.', { max: MAX_MINUTES })
    : !goalOk
      ? t('Use a whole number of words for the goal, or leave it blank.')
      : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!minutesOk || !goalOk) return;
    onStart({ durationMs: minutes * 60_000, goalWords });
  };

  return (
    <div className="sprint-pop" role="dialog" aria-label={t('Start a writing sprint')} ref={ref}>
      <form onSubmit={submit} noValidate>
        <span className="eyebrow sprint-eyebrow">{t('WRITING SPRINT')}</span>
        <fieldset className="sprint-fieldset">
          <legend>{t('How long?')}</legend>
          <div className="sprint-presets">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                className="sprint-chip"
                aria-pressed={!typedLength && preset === m}
                onClick={() => {
                  setPreset(m);
                  setCustom('');
                }}
              >
                {m} min
              </button>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor={`${id}-minutes`}>{t('Or your own length, in minutes (1 to {max})', { max: MAX_MINUTES })}</label>
          <input
            id={`${id}-minutes`}
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_MINUTES}
            step={1}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="35"
            aria-invalid={typedLength && !minutesOk}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-goal`}>{t('Word goal (optional)')}</label>
          <input
            id={`${id}-goal`}
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={t('No goal')}
            aria-invalid={!goalOk}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
        <label className="check-row">
          <input type="checkbox" checked={sound} onChange={(e) => onSound(e.target.checked)} />
          {t('Chime when time is up')}
        </label>
        {busyElsewhere && <p className="sprint-note">{t('A sprint is running in another novel. Starting one here ends it.')}</p>}
        {error && (
          <p className="sprint-note sprint-error" id={`${id}-error`} role="alert">
            {error}
          </p>
        )}
        <div className="sprint-actions">
          <button type="button" className="button button-outline button-small" onClick={onCancel}>
            {t('Cancel')}
          </button>
          <button className="button button-primary button-small" disabled={!minutesOk || !goalOk}>
            {t('Start')}
          </button>
        </div>
      </form>
    </div>
  );
};

interface SprintCardProps {
  result: SprintResult;
  history: SprintResult[];
  id: string;
  onNew: () => void;
  onDismiss: () => void;
}

/** What the sprint came to. A status region, not a dialog: it never takes focus or blocks the page. */
const SprintCard: React.FC<SprintCardProps> = ({ result, history, id, onNew, onDismiss }) => {
  const t = useT();
  const earlier = history.filter((r) => r.id !== result.id);
  const isBest = earlier.length > 0 && result.words > 0 && earlier.every((r) => isBetterSprint(result, r));
  const goal = result.goalWords;
  const goalMet = goal !== null && result.words >= goal;

  return (
    <div className="sprint-pop sprint-card" id={id} role="status">
      <p className="sprint-card-title">{result.completed ? t('Sprint complete') : t('Sprint ended')}</p>
      {result.awayWhenFinished && <p className="sprint-note">{t('The time ran out while you were away.')}</p>}
      <ul className="sprint-facts">
        <li>
          <strong>{formatSpan(result.activeMs)}</strong>
          {t('writing time')}
        </li>
        <li>
          <strong>{result.words.toLocaleString()}</strong>
          {result.words === 1 ? t('word') : t('words')}
        </li>
        {result.wpm > 0 && (
          <li>
            <strong>{result.wpm.toLocaleString()}</strong>
            {t('words a minute')}
          </li>
        )}
      </ul>
      {goal !== null && (
        <p className="sprint-line">
          {goalMet && <Check aria-hidden="true" />}
          <span>
            {goalMet
              ? t('Goal of {words} reached.', { words: wordsText(goal) })
              : t('Goal of {words} not reached: {written} written.', { words: wordsText(goal), written: result.words.toLocaleString() })}
          </span>
        </p>
      )}
      {isBest && (
        <p className="sprint-line">
          <Check aria-hidden="true" />
          <span>{t('Your best sprint yet on this novel.')}</span>
        </p>
      )}
      <div className="sprint-actions">
        <button type="button" className="button button-outline button-small" onClick={onDismiss}>
          {t('Dismiss')}
        </button>
        <button type="button" className="button button-primary button-small" onClick={onNew}>
          {t('New sprint')}
        </button>
      </div>
    </div>
  );
};

/** The Sprint control in the editor toolbar: a button, then a compact pill while running, then a summary. */
export const SprintTimer: React.FC<{ projectId: string; chapterId: string; chapterWords: number }> = ({
  projectId,
  chapterId,
  chapterWords,
}) => {
  const t = useT();
  const sprint = useSprint(projectId, chapterId, chapterWords);
  const history = useSprintHistory(projectId);
  const { active, result } = sprint;
  const cardId = useId();
  // The editor remounts for each chapter: what was said before this mount is not said again
  const [heardSeq] = useState(() => sprint.note?.seq ?? -1);
  const [open, setOpen] = useState(false);
  // The summary whose card has been folded away; the chip stays so it can be brought back
  const [folded, setFolded] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  // Where focus should land once the next change has rendered: the buttons it was on are about to disappear
  const refocus = useRef<'pause' | 'end' | null>(null);
  const running = !!active;
  const hasResult = !!result;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    const want = refocus.current;
    refocus.current = null;
    if (want === 'pause' && running) pauseRef.current?.focus();
    if (want === 'end' && !running) (chipRef.current ?? triggerRef.current)?.focus();
  }, [running, hasResult]);

  const start = (plan: SprintPlan) => {
    refocus.current = 'pause';
    setOpen(false);
    sprint.start(plan);
  };

  const stop = () => {
    refocus.current = 'end';
    sprint.stop();
  };

  // Escape closes the start panel and nothing else: focus mode also listens for it on the document
  const onWrapKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation();
    setOpen(false);
    triggerRef.current?.focus();
  };

  const paused = !!active && active.pausedAt !== null;
  const cardOpen = !!result && folded !== result.id;
  const wordsUnit = sprint.words === 1 && !active?.goalWords ? 'word' : 'words';

  return (
    <div ref={wrapRef} className={`sprint-wrap${active || result ? ' sprint-live' : ''}`} onKeyDown={onWrapKey}>
      {/* Read out only at the start, on pause and resume, at one minute left and at the end: not every second */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {sprint.note && sprint.note.seq !== heardSeq ? sprint.note.text : ''}
      </span>

      {active ? (
        <div className={`sprint-pill${paused ? ' is-paused' : ''}`} role="group" aria-label={t('Writing sprint')}>
          <Timer aria-hidden="true" />
          <span className="sprint-clock" role="timer">
            {formatClock(sprint.remainingMs)}
          </span>
          <span className="sr-only">{t('remaining')}</span>
          {paused && <span className="sprint-state">{t('Paused')}</span>}
          <span className="sprint-words">
            {sprint.goalMet && (
              <>
                <Check aria-hidden="true" />
                <span className="sr-only">{t('Goal reached.')} </span>
              </>
            )}
            {sprint.words.toLocaleString()}
            {active.goalWords ? ` / ${active.goalWords.toLocaleString()}` : ''} {wordsUnit}
          </span>
          <span className="sprint-controls">
            <button
              ref={pauseRef}
              type="button"
              className="icon-button"
              aria-label={paused ? t('Resume sprint') : t('Pause sprint')}
              title={paused ? t('Resume sprint') : t('Pause sprint')}
              onClick={paused ? sprint.resume : sprint.pause}
            >
              {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            </button>
            <button type="button" className="icon-button" aria-label={t('End sprint early')} title={t('End sprint early')} onClick={stop}>
              <Square aria-hidden="true" />
            </button>
          </span>
        </div>
      ) : result ? (
        <>
          <button
            ref={chipRef}
            type="button"
            className="button button-outline button-small sprint-trigger"
            aria-expanded={cardOpen}
            aria-controls={cardOpen ? cardId : undefined}
            aria-label={t('Sprint summary')}
            title={t('Sprint summary')}
            onClick={() => setFolded(cardOpen ? result.id : null)}
          >
            <Check aria-hidden="true" />
            <span className="sprint-label">{t('Sprint summary')}</span>
          </button>
          {cardOpen && (
            <SprintCard
              result={result}
              history={history}
              id={cardId}
              onNew={() => {
                sprint.dismissResult();
                setOpen(true);
              }}
              onDismiss={() => {
                refocus.current = 'end';
                sprint.dismissResult();
              }}
            />
          )}
        </>
      ) : (
        <>
          <button
            ref={triggerRef}
            type="button"
            className="button button-outline button-small sprint-trigger"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={t('Start a writing sprint')}
            title={t('Start a writing sprint')}
            onClick={() => setOpen((v) => !v)}
          >
            <Timer aria-hidden="true" />
            <span className="sprint-label">{t('Sprint')}</span>
          </button>
          {open && (
            <StartPanel
              sound={sprint.sound}
              busyElsewhere={sprint.busyElsewhere}
              onSound={sprint.setSound}
              onStart={start}
              onCancel={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

/** "Sprint 12:34 · 210 words" for the editor's footer, so the sprint stays in view in focus mode. */
export const SprintHint: React.FC<{ projectId: string }> = ({ projectId }) => {
  const t = useT();
  const { active, remainingMs, words } = useSprintStatus(projectId);
  if (!active) return null;
  return (
    <span className="sprint-hint">
      {t('Sprint')} {active.pausedAt !== null && `${t('paused')} `}
      {formatClock(remainingMs)} · {wordsText(words)}
    </span>
  );
};
