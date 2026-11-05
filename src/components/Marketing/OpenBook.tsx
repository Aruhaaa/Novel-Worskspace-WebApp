import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FALLBACK_NOVEL, loadShelf, paginate, type FeaturedNovel, type TextPage } from '../../lib/featuredNovel';

const COMPACT = '(max-width: 740px)';
const subscribeCompact = (cb: () => void) => {
  const m = window.matchMedia(COMPACT);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const useCompact = () => React.useSyncExternalStore(subscribeCompact, () => window.matchMedia(COMPACT).matches, () => false);

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** What one printed side holds. The first leaf is the cover (front) and the title page (back). */
type Face =
  | { kind: 'cover' }
  | { kind: 'title' }
  | { kind: 'text'; page: TextPage; number: number }
  | { kind: 'end' }
  | { kind: 'blank' };

const TextFace: React.FC<{ page: TextPage; number: number }> = ({ page, number }) => (
  <div className="ob-in">
    {page.chapter && (
      <header className="ob-chapter">
        <span>{page.chapter.label}</span>
        <h3>{page.chapter.title}</h3>
      </header>
    )}
    {page.paras.map((p, i) => (
      <p key={i} className={p.cont ? 'is-cont' : undefined}>
        {p.text}
      </p>
    ))}
    <span className="ob-folio">{number}</span>
  </div>
);

interface Flight {
  from: DOMRect;
  tone: string;
}

/**
 * A shelf of the library's most liked novels, and a table below it. Pick a spine and the book slides out, lands
 * on the table, and opens. The most liked novel starts on the table, closed. Click the right page (or press the
 * right arrow) to turn a page; click the left page to turn back, and from the first page that closes the book.
 */
export const OpenBook: React.FC = () => {
  const { loginAsGuest } = useApp();
  const compact = useCompact();
  const [shelf, setShelf] = useState<FeaturedNovel[]>([FALLBACK_NOVEL]);
  const [selectedId, setSelectedId] = useState<string>(FALLBACK_NOVEL.id);
  const [turned, setTurned] = useState(0);
  const [flight, setFlight] = useState<Flight | null>(null);
  // The real book appears under the flyer a little before the flyer has finished fading
  const [landed, setLanded] = useState(false);
  const flyerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadShelf()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setShelf(list);
        setSelectedId(list[0].id);
        setTurned(0);
      })
      .catch(() => {
        // The sample book stays; the landing page never depends on the library being reachable
      });
    const pending = timers.current;
    return () => {
      cancelled = true;
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const novel = shelf.find((n) => n.id === selectedId) ?? shelf[0];
  const toneOf = (id: string) => Math.max(0, shelf.findIndex((n) => n.id === id)) % 5;
  const isTop = novel.id === shelf[0].id && novel.likes > 0;

  const faces: Face[] = useMemo(() => {
    const pages = paginate(novel.chapters, compact ? 420 : 1050, compact ? 8 : 10);
    const list: Face[] = [{ kind: 'cover' }, { kind: 'title' }];
    pages.forEach((page, i) => list.push({ kind: 'text', page, number: i + 1 }));
    list.push({ kind: 'end' });
    if (list.length % 2 === 1) list.push({ kind: 'blank' });
    return list;
  }, [novel, compact]);

  const leaves = faces.length / 2;
  // The pages are laid out again when the screen changes size, so keep the place inside the new count
  const at = Math.min(turned, leaves);
  const next = () => setTurned(Math.min(leaves, at + 1));
  const prev = () => setTurned(Math.max(0, at - 1));

  const choose = (n: FeaturedNovel, spine: HTMLElement) => {
    if (n.id === selectedId) return;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setSelectedId(n.id);
    setTurned(0);
    if (prefersReducedMotion()) {
      setTurned(1);
      return;
    }
    setLanded(false);
    setFlight({ from: spine.getBoundingClientRect(), tone: getComputedStyle(spine).backgroundColor });
  };

  // Carry the chosen spine to the closed book on the table, then open it
  useLayoutEffect(() => {
    const flyer = flyerRef.current;
    const target = tableRef.current?.querySelector('.ob-stack')?.getBoundingClientRect();
    if (!flight || !flyer || !target) return;
    const { from } = flight;
    // The flyer rests exactly where the closed book lies, and starts its move from the spine
    Object.assign(flyer.style, { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px` });
    const dx = from.left + from.width / 2 - (target.left + target.width / 2);
    const dy = from.top + from.height / 2 - (target.top + target.height / 2);
    const scale = `scale(${from.width / target.width}, ${from.height / target.height})`;
    const anim = flyer.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) ${scale}`, opacity: 1, offset: 0 },
        { transform: `translate(${dx}px, ${dy - 18}px) ${scale}`, opacity: 0.95, offset: 0.14 },
        { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 0.85, offset: 0.62 },
        { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 0, offset: 0.8 },
        { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 0, offset: 1 },
      ],
      { duration: 1100, easing: 'cubic-bezier(.4, .05, .2, 1)' }
    );
    timers.current.push(window.setTimeout(() => setLanded(true), 620));
    timers.current.push(window.setTimeout(() => setTurned(1), 1000));
    anim.onfinish = () => setFlight(null);
    return () => anim.cancel();
  }, [flight]);

  const readNovel = () => {
    loginAsGuest(novel.project ? `/library/novel/${novel.project.id}` : undefined);
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    if (at === 0) {
      next();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left + rect.width / 2) prev();
    else next();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    }
  };

  const kicker = isTop ? 'MOST LIKED IN THE LIBRARY' : 'FROM THE LIBRARY';

  const renderFace = (face: Face) => {
    switch (face.kind) {
      case 'cover':
        return (
          <div className="ob-in ob-cover">
            <span className="ob-cover-kicker">{kicker}</span>
            <h3>{novel.title}</h3>
            <span className="ob-cover-rule" aria-hidden="true" />
            <span className="ob-cover-by">{novel.project ? novel.author : 'A novel in the making'}</span>
          </div>
        );
      case 'title':
        return (
          <div className="ob-in ob-title">
            <span className="ob-kicker">{kicker}</span>
            <h3>{novel.title}</h3>
            <p className="ob-by">{novel.project ? `by ${novel.author}` : novel.author}</p>
            {novel.genre && <span className="badge">{novel.genre}</span>}
            {novel.description && <p className="ob-blurb is-plain">{novel.description}</p>}
            {novel.likes > 0 && (
              <span className="ob-likes">
                <Heart aria-hidden="true" /> {novel.likes} {novel.likes === 1 ? 'like' : 'likes'}
              </span>
            )}
          </div>
        );
      case 'text':
        return <TextFace page={face.page} number={face.number} />;
      case 'end':
        return (
          <div className="ob-in ob-end">
            <span className="ob-ornament" aria-hidden="true">
              ✳
            </span>
            <h3>{novel.project ? 'The story goes on.' : 'Your story goes here.'}</h3>
            <p className="is-plain">
              {novel.project ? 'Read the rest of this novel in the library, free, with no account.' : 'Start a page of your own, or see what others are writing.'}
            </p>
            <button className="button button-primary" onClick={readNovel}>
              {novel.project ? 'Read the whole novel' : 'Start reading'} <span aria-hidden="true">↗</span>
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const atEnd = at >= leaves;

  return (
    <div className="open-book">
      <div className="shelf-head">
        <span className="eyebrow">ON THE SHELF</span>
        <span>Pick a spine and it opens on the table.</span>
      </div>
      <div className="shelf">
        <ul className="shelf-books">
          {shelf.map((n, i) => {
            const away = n.id === selectedId;
            return (
              <li key={n.id} className={`spine-slot${away ? ' is-away' : ''}`}>
                <button
                  className={`spine tone-${i % 5} spine-${i % 6}`}
                  onClick={(e) => choose(n, e.currentTarget)}
                  tabIndex={away ? -1 : undefined}
                  aria-hidden={away ? 'true' : undefined}
                  aria-label={`Open ${n.title}${n.project ? ` by ${n.author}` : ''} on the table`}
                  title={n.title}
                >
                  {i === 0 && n.likes > 0 && <span className="spine-ribbon" aria-hidden="true" />}
                  <span className="spine-title">{n.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="shelf-board" aria-hidden="true" />
      </div>

      <div className="book-table" ref={tableRef}>
        <div className={`ob-wrap tone-${toneOf(selectedId)}${flight && !landed ? ' is-away' : ''}`}>
          <div
            key={`${selectedId}-${compact ? 'c' : 'w'}`}
            className={`ob${at === 0 ? ' is-closed' : ''}`}
            role="group"
            aria-roledescription="book"
            aria-label={`${novel.title}. Use the arrow keys or the buttons below to open the book and turn the page.`}
            tabIndex={0}
            onClick={onClick}
            onKeyDown={onKey}
          >
            <div className="ob-plate ob-plate-l" aria-hidden="true" />
            <div className="ob-plate ob-plate-r" aria-hidden="true" />

            <div className="ob-half ob-left" aria-hidden="true" />
            <div className="ob-half ob-right ob-blank-page" aria-hidden="true" />

            <div className="ob-half ob-right ob-stack">
              {Array.from({ length: leaves }, (_, j) => {
                const isTurned = j < at;
                const z = isTurned ? (j + 1) * 2 : (leaves - j) * 2;
                return (
                  <div key={j} className={`ob-leaf${isTurned ? ' is-turned' : ''}${j === 0 ? ' is-cover' : ''}`} style={{ ['--z' as string]: `${z}px` }}>
                    <div className="ob-face ob-front" aria-hidden={j === at ? undefined : 'true'}>
                      {renderFace(faces[2 * j])}
                    </div>
                    <div className="ob-face ob-back" aria-hidden={j === at - 1 ? undefined : 'true'}>
                      {renderFace(faces[2 * j + 1])}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="ob-spine" aria-hidden="true" />
          </div>
        </div>
        <div className="ob-shadow" aria-hidden="true" />
      </div>

      <div className="ob-controls">
        <button className="icon-button" onClick={prev} disabled={at === 0} aria-label={at === 1 ? 'Close the book' : 'Turn back a page'}>
          <ChevronLeft />
        </button>
        <span className="ob-count" role="status">
          {at === 0 ? 'Closed' : `Spread ${at} of ${leaves}`}
        </span>
        {atEnd ? (
          <button className="text-link" onClick={() => setTurned(0)}>
            Close the book
          </button>
        ) : (
          <button className="icon-button" onClick={next} aria-label={at === 0 ? 'Open the book' : 'Turn the page'}>
            <ChevronRight />
          </button>
        )}
        {novel.project && (
          <button className="link-accent ob-read" onClick={readNovel}>
            Read the whole novel <span aria-hidden="true">↗</span>
          </button>
        )}
      </div>

      {flight && <div ref={flyerRef} className="ob-flyer" aria-hidden="true" style={{ background: flight.tone }} />}
    </div>
  );
};
