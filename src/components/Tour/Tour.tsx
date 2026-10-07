import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface TourStep {
  /** CSS selector of the thing to point at. Without one (or if it is not on screen) the step is shown in the middle. */
  target?: string;
  title: string;
  body: string;
  placement?: 'right' | 'bottom' | 'left' | 'top';
  /** An extra button for this step, for example "Open the sample project" */
  action?: { label: string; run: () => void | Promise<void> };
}

interface TourProps {
  steps: TourStep[];
  /** Called when the tour ends. `completed` is false if it was skipped. */
  onClose: (completed: boolean) => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const POP_WIDTH = 330;
const POP_HEIGHT = 230;
const GAP = 14;

const place = (box: Box | null, placement: TourStep['placement'] = 'bottom'): React.CSSProperties => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(POP_WIDTH, vw - 24);
  if (!box) return { top: Math.max(12, (vh - POP_HEIGHT) / 2), left: Math.max(12, (vw - width) / 2), width };
  let top = box.top + box.height + GAP;
  let left = box.left;
  if (placement === 'right') {
    top = box.top;
    left = box.left + box.width + GAP;
  } else if (placement === 'left') {
    top = box.top;
    left = box.left - width - GAP;
  } else if (placement === 'top') {
    top = box.top - POP_HEIGHT - GAP;
  }
  // Keep it on screen; if it would cover the target, flip below
  left = Math.min(Math.max(12, left), vw - width - 12);
  top = Math.min(Math.max(12, top), vh - POP_HEIGHT - 12);
  return { top, left, width };
};

/** A guided look around: dims the page, lights up one thing at a time and says what it is for. */
export const Tour: React.FC<TourProps> = ({ steps, onClose }) => {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const measure = useCallback(() => {
    const el = step.target ? document.querySelector(step.target) : null;
    const r = el?.getBoundingClientRect();
    // A hidden element (a side panel on a small screen) is as good as missing
    if (!r || r.width === 0 || r.height === 0) {
      setBox((prev) => (prev === null ? prev : null));
      return;
    }
    const next = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
    // Only update when it actually moved, so re-measuring often costs nothing
    setBox((prev) =>
      prev && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height ? prev : next
    );
  }, [step.target]);

  // Bring the target into view, then follow it as the window changes
  useEffect(() => {
    const el = step.target ? document.querySelector(step.target) : null;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const frame = requestAnimationFrame(measure);
    const onChange = () => requestAnimationFrame(measure);
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    // The page can settle after the tour opens (a project loads, a panel appears), so keep following the target
    const follow = window.setInterval(measure, 250);
    return () => {
      window.clearInterval(follow);
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [step.target, measure]);

  // Move focus into the step so keyboard and screen reader users follow along
  useEffect(() => {
    popRef.current?.focus();
  }, [index]);

  const finish = (completed: boolean) => onClose(completed);
  const next = () => (last ? finish(true) : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      back();
    } else if (e.key === 'Tab') {
      // Keep Tab inside the step
      const items = popRef.current?.querySelectorAll<HTMLElement>('button');
      if (!items || items.length === 0) return;
      const first = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === popRef.current) {
        e.preventDefault();
        lastItem.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="tour-layer" onKeyDown={onKeyDown}>
      {box ? (
        <div className="tour-spot" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} aria-hidden="true" />
      ) : (
        <div className="tour-scrim" aria-hidden="true" />
      )}
      <div
        ref={popRef}
        className="tour-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-h"
        aria-describedby="tour-b"
        tabIndex={-1}
        style={place(box, step.placement)}
      >
        <p className="eyebrow">
          {index + 1} OF {steps.length}
        </p>
        <h2 id="tour-h">{step.title}</h2>
        <p id="tour-b">{step.body}</p>
        <div className="tour-actions">
          <button className="link-accent" onClick={() => finish(false)}>
            Skip tour
          </button>
          <span style={{ flex: 1 }} />
          {index > 0 && (
            <button className="small-btn" onClick={back}>
              Back
            </button>
          )}
          {step.action && (
            <button
              className="small-btn is-primary"
              onClick={async () => {
                await step.action!.run();
                finish(true);
              }}
            >
              {step.action.label}
            </button>
          )}
          <button className={`small-btn${step.action ? '' : ' is-primary'}`} onClick={next}>
            {last ? (step.action ? 'No thanks' : 'Done') : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};
