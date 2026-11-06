import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Brand } from '../Brand';
import landscape from '../../assets/quiet-landscape.svg';
import { OpenBook } from './OpenBook';
import { mark, useT } from '../../i18n';
import { appBaseUrl } from '../../lib/share';
import { sampleNovelCount } from '../../lib/bundledLibrary';

/** A plain page next to the app (About, Privacy, Contact). Built from the site's own address so it also works from the desktop app. */
const pageUrl = (file: string): string => new URL(file, appBaseUrl()).href;

type PreviewTab = 'write' | 'shape' | 'world';

const TABS: { id: PreviewTab; num: string; label: string; location: string }[] = [
  { id: 'write', num: '01', label: mark('Write'), location: mark('Manuscript') },
  { id: 'shape', num: '02', label: mark('Shape'), location: mark('Storyboard') },
  { id: 'world', num: '03', label: mark('Imagine'), location: mark('World notebook') },
];

const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/**
 * The design's motion, kept small: sections fade up once as they enter view, and the book and
 * manuscript shift a few pixels with a fine pointer. Both are off for reduced-motion users, and
 * content is always visible if IntersectionObserver is missing.
 */
const useLandingMotion = (art: React.RefObject<HTMLDivElement | null>) => {
  React.useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const cleanups: (() => void)[] = [];

    if ('IntersectionObserver' in window && !motion.matches) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.08 }
      );
      document.querySelectorAll('.reveal').forEach((el) => {
        // Only animate sections that have not already entered the viewport
        if (el.getBoundingClientRect().top <= window.innerHeight) return;
        el.classList.add('reveal-waiting');
        observer.observe(el);
      });
      const onMotionChange = () => {
        if (!motion.matches) return;
        document.querySelectorAll('.reveal-waiting').forEach((el) => el.classList.add('is-visible'));
        observer.disconnect();
      };
      motion.addEventListener('change', onMotionChange);
      cleanups.push(() => {
        observer.disconnect();
        motion.removeEventListener('change', onMotionChange);
        document.querySelectorAll('.reveal-waiting').forEach((el) => el.classList.remove('reveal-waiting', 'is-visible'));
      });
    }

    const node = art.current;
    if (node) {
      const onMove = (event: PointerEvent) => {
        if (motion.matches || !finePointer.matches) return;
        const rect = node.getBoundingClientRect();
        node.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width - 0.5) * 10}px`);
        node.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height - 0.5) * 8}px`);
      };
      const onLeave = () => {
        node.style.setProperty('--mx', '0px');
        node.style.setProperty('--my', '0px');
      };
      node.addEventListener('pointermove', onMove);
      node.addEventListener('pointerleave', onLeave);
      cleanups.push(() => {
        node.removeEventListener('pointermove', onMove);
        node.removeEventListener('pointerleave', onLeave);
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, [art]);
};

export const LandingView: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const { loginAsGuest } = useApp();
  const [tab, setTab] = useState<PreviewTab>('write');
  const heroArt = React.useRef<HTMLDivElement>(null);
  useLandingMotion(heroArt);
  const current = TABS.find((t) => t.id === tab)!;

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = TABS.length - 1;
    if (next >= 0) {
      e.preventDefault();
      setTab(TABS[next].id);
      document.getElementById(`tab-${TABS[next].id}`)?.focus();
    }
  };

  return (
    <>
      <header className="site-header wrap">
        <Brand to="#/" />
        <nav className="desktop-nav" aria-label={t('Main navigation')}>
          <button onClick={() => scrollToId('workspace')}>{t('The workspace')}</button>
          <button onClick={() => scrollToId('approach')}>{t('Our approach')}</button>
          <button onClick={() => scrollToId('everything')}>{t('Everything else')}</button>
          <button onClick={() => navigate('/login')}>{t('Sign in')}</button>
        </nav>
        <button className="button button-outline header-cta" onClick={() => loginAsGuest()}>
          {t('Start reading')} <span aria-hidden="true">↗</span>
        </button>
      </header>

      <main id="main">
        <section className="hero hero-v2 wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow hero-enter">
              <span className="small-dot" /> {t('FOR THE WORLDS WITHIN YOU')}
            </p>
            <h1 id="hero-title" className="hero-enter delay-1">
              {t('A little room.')}
              <br />{t('A whole')} <em>{t('world.')}</em>
            </h1>
            <div className="hero-actions hero-enter delay-3">
              <button className="button button-primary" onClick={() => navigate('/login')}>
                {t('Start writing')} <span aria-hidden="true">↗</span>
              </button>
              <button className="button button-outline" onClick={() => loginAsGuest()}>
                {t('Start reading')} <span aria-hidden="true">↗</span>
              </button>
              <button className="text-link" onClick={() => scrollToId('workspace')}>
                {t('Take a look inside')} <span aria-hidden="true">↓</span>
              </button>
            </div>
          </div>

          <div className="hero-text hero-enter delay-2">
            <p className="hero-description">
              {t('Somewhere between the first thought and the final full stop, a story becomes yours.')}
              <br />
              {t('This is your space to write it.')}
            </p>
            <p className="hero-footnote">
              {t('A writing space. Not another distraction.')}
              <br />
              <button className="link-accent" onClick={() => loginAsGuest()}>{t('Browse the library, no account needed')}</button> ·{' '}
              <button className="link-accent" onClick={() => navigate('/login')}>{t('Sign in')}</button>
            </p>
          </div>

          <div ref={heroArt} className="hero-sheets hero-enter delay-2" aria-hidden="true">
            <div className="loose-sheet sheet-manuscript">
              <p className="sheet-label">{t('MANUSCRIPT')}</p>
              <h2>
                {t('The things')}
                <br />
                {t('we leave behind.')}
              </h2>
              <p>{t('On the morning the sea disappeared, Ada was making tea. She had always thought the end of something would announce itself.')}</p>
              <span className="manuscript-edit">{t('let the silence stay.')}</span>
            </div>
            <div className="loose-sheet sheet-notebook">
              <p className="sheet-label">{t('WORLD NOTEBOOK')}</p>
              <h3>{t('Ada Marlowe')}</h3>
              <p>{t('Keeper of the last lighthouse. Keeps the kettle on, and the door unlocked.')}</p>
              <i /><i /><i />
            </div>
            <div className="loose-sheet sheet-outline">
              <p className="sheet-label">{t('STORY OUTLINE')}</p>
              <ol>
                <li>{t('The sea disappears')}</li>
                <li>{t('A visitor with no boat')}</li>
                <li>{t('What the tide left')}</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="book-section wrap" aria-labelledby="book-h">
          <h2 id="book-h" className="sr-only">{t('An open book: the opening pages of a novel from the library')}</h2>
          <OpenBook />
        </section>

        <div className="chapter-divider wrap">
          <span>{t('YOUR STORY, FROM EVERY ANGLE')}</span>
          <div />
          <span>{t('WRITE / SHAPE / IMAGINE')}</span>
        </div>

        <section className="workspace-section wrap" id="workspace" aria-labelledby="workspace-heading">
          <div className="section-heading reveal">
            <div>
              <p className="eyebrow">{t('01 / THE WORKSPACE')}</p>
              <h2 id="workspace-heading">
                {t('Everything in its place.')}
                <br />
                <em>{t('Except your imagination.')}</em>
              </h2>
            </div>
            <p>{t('Your manuscript, your messy ideas, your impossibly detailed world. Finally, they’re all on the same page.')}</p>
          </div>

          <div className="preview-controls reveal">
            <div className="preview-tabs" role="tablist" aria-label={t('Explore workspace features')}>
              {TABS.map((item, i) => (
                <button
                  key={item.id}
                  id={`tab-${item.id}`}
                  role="tab"
                  aria-selected={tab === item.id}
                  aria-controls={`preview-${item.id}`}
                  tabIndex={tab === item.id ? 0 : -1}
                  onClick={() => setTab(item.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  {item.num} <span>{t(item.label)}</span>
                </button>
              ))}
            </div>
            <button className="text-link" onClick={() => loginAsGuest()}>
              {t('Try it as a guest')} <span aria-hidden="true">↗</span>
            </button>
          </div>

          <div className="workspace-preview reveal">
            <div className="preview-topbar">
              <span className="preview-logo">{t('n.')}</span>
              <span>
                The Atlas of Quiet Places <span className="preview-slash">/</span> <span>{t(current.location)}</span>
              </span>
              <span className="sample-label">{t('SAMPLE WORKSPACE')}</span>
            </div>

            {tab === 'write' && (
              <div className="preview-panel" id="preview-write" role="tabpanel" aria-labelledby="tab-write" tabIndex={0}>
                <aside className="preview-sidebar" aria-label={t('Sample manuscript chapters')}>
                  <span className="eyebrow">{t('MANUSCRIPT')}</span>
                  <div className="preview-chapter active"><span>01</span> {t('The quiet departure')} <i /></div>
                  <div className="preview-chapter"><span>02</span> {t('A map of elsewhere')}</div>
                  <div className="preview-chapter"><span>03</span> {t('What the water knows')}</div>
                  <div className="preview-chapter"><span>04</span> {t('The long way home')}</div>
                  <div className="preview-sidebar-bottom">
                    <span className="eyebrow">{t('ONE WORD AT A TIME')}</span>
                    <div className="mini-progress"><span /></div>
                    <span>{t('24,680 / 60,000 words')}</span>
                  </div>
                </aside>
                <div className="preview-manuscript">
                  <div className="preview-toolbar">
                    <span>{t('Manuscript')} <span aria-hidden="true">⌄</span></span>
                    <span className="format-sample" aria-hidden="true">B &nbsp; <i>{t('I')}</i> &nbsp; ¶</span>
                    <span className="saved-label"><span className="small-dot" /> {t('Sample draft')}</span>
                  </div>
                  <article className="preview-prose">
                    <p className="eyebrow">{t('CHAPTER ONE')}</p>
                    <h3>{t('The quiet departure')}</h3>
                    <p className="dropcap">{t('On the morning the sea disappeared, Ada was making tea. She had always thought the end of something would announce itself. A door closing. A glass breaking. The particular weight of a last goodbye.')}</p>
                    <p>{t('Instead, there was only the kettle, the open window, and a silence where the waves should have been.')}</p>
                    <p>{t('She set down her cup. For the first time in thirty years, she could hear the birds in the garden.')}<span className="sample-caret" aria-hidden="true" /></p>
                  </article>
                  <div className="preview-page-number">— &nbsp; 1 &nbsp; —</div>
                </div>
                <aside className="preview-margin">
                  <span className="eyebrow">{t('IN THE MARGINS')}</span>
                  <div className="margin-note">
                    <span className="note-pin" aria-hidden="true" />
                    <p>{t('What if the sea isn’t gone?')}<br />{t('What if it’s waiting?')}</p>
                    <span>{t('SCENE NOTE / 01')}</span>
                  </div>
                  <span className="margin-flower" aria-hidden="true">✳</span>
                  <p className="margin-caption">{t('Room for the thought')}<br />{t('behind the thought.')}</p>
                </aside>
              </div>
            )}

            {tab === 'shape' && (
              <div className="preview-panel preview-alternate" id="preview-shape" role="tabpanel" aria-labelledby="tab-shape" tabIndex={0}>
                <div className="alternate-heading">
                  <span className="eyebrow">{t('THE STORYBOARD')}</span>
                  <h3>{t('Make space for the unexpected.')}</h3>
                  <p>{t('A bird’s-eye view of the story, before you get lost in the details.')}</p>
                </div>
                <div className="sample-board">
                  <div>
                    <span className="board-column-label">{t('I. THE DEPARTURE')} <span>02</span></span>
                    <article className="scene-card"><span className="scene-status">{t('DRAFTING')}</span><h4>{t('The sea goes quiet')}</h4><p>{t('Ada wakes to an impossible absence.')}</p><span className="scene-meta">{t('Chapter 01 · Ada')}</span></article>
                    <article className="scene-card"><span className="scene-status">{t('TO EXPLORE')}</span><h4>{t('The unopened letter')}</h4><p>{t('A familiar hand. An unfamiliar address.')}</p><span className="scene-meta">{t('Chapter 02 · Ada')}</span></article>
                  </div>
                  <div>
                    <span className="board-column-label">{t('II. THE CROSSING')} <span>01</span></span>
                    <article className="scene-card olive-card"><span className="scene-status">{t('OUTLINED')}</span><h4>{t('A map of elsewhere')}</h4><p>{t('Every road leads somewhere that no longer exists.')}</p><span className="scene-meta">{t('Chapter 03 · Elias')}</span></article>
                  </div>
                  <div>
                    <span className="board-column-label">{t('III. THE RETURN')} <span>01</span></span>
                    <article className="scene-card"><span className="scene-status">{t('TO EXPLORE')}</span><h4>{t('What we bring home')}</h4><p>{t('Not all endings look like an arrival.')}</p><span className="scene-meta">{t('Chapter 04 · Ada')}</span></article>
                  </div>
                </div>
              </div>
            )}

            {tab === 'world' && (
              <div className="preview-panel preview-alternate" id="preview-world" role="tabpanel" aria-labelledby="tab-world" tabIndex={0}>
                <div className="alternate-heading">
                  <span className="eyebrow">{t('THE WORLD NOTEBOOK')}</span>
                  <h3>{t('A world beyond the words.')}</h3>
                  <p>{t('Keep the people, places, and little details that make it feel real.')}</p>
                </div>
                <div className="sample-world">
                  <article className="world-person"><span className="character-monogram">{t('A')}</span><span className="eyebrow">{t('CHARACTER / 01')}</span><h4>{t('Ada Wren')}</h4><p>{t('A cartographer who has spent a lifetime mapping places she has never been.')}</p><span className="entity-tag">{t('Protagonist')}</span></article>
                  <article className="world-place"><img src={landscape} alt={t('Illustrated hills and a winding river')} width="600" height="680" /><div><span className="eyebrow">{t('LOCATION / 01')}</span><h4>{t('The Hollow Coast')}</h4><p>{t('Where the land remembers what the sea forgets.')}</p></div></article>
                  <article className="world-detail"><span className="eyebrow">{t('A DETAIL TO REMEMBER')}</span><span className="large-asterisk" aria-hidden="true">✳</span><h4>{t('The blue teacup')}</h4><p>{t('A hairline crack. A gift from her mother. The one thing she takes with her.')}</p></article>
                </div>
              </div>
            )}

            <div className="preview-status">
              <span>{t('A calmer place to do your most ambitious work.')}</span>
              <span>{t('SAMPLE WORKSPACE')}</span>
            </div>
          </div>
          <div className="under-preview reveal">
            <span className="small-dot" />
            <p>{t('Less switching between tools. More staying with the story.')}</p>
            <span className="serif-asterisk" aria-hidden="true">∗</span>
          </div>
        </section>

        <section className="approach-section" id="approach" aria-labelledby="approach-heading">
          <div className="wrap approach-grid">
            <div className="approach-intro reveal">
              <p className="eyebrow">{t('02 / A DIFFERENT KIND OF SPACE')}</p>
              <h2 id="approach-heading">
                {t('Made for the craft.')}
                <br />
                <em>{t('Not the noise.')}</em>
              </h2>
              <p>{t('Writing doesn’t need another dashboard demanding your attention. It needs a little breathing room.')}</p>
              <div className="editorial-seal" aria-hidden="true">
                <span>{t('LESS, BUT')}</span>
                <strong>{t('better.')}</strong>
                <span>{t('BY DESIGN')}</span>
              </div>
            </div>
            <div className="principle-list">
              <article className="principle reveal">
                <span className="principle-number">01</span>
                <div>
                  <h3>{t('Find your flow. Stay there.')}</h3>
                  <p>{t('A considered writing canvas, readable type, and a focus mode that lets the interface step aside.')}</p>
                  <button className="text-link" onClick={() => loginAsGuest()}>{t('Enter a quieter space')} <span aria-hidden="true">↗</span></button>
                </div>
                <span className="principle-symbol" aria-hidden="true">◌</span>
              </article>
              <article className="principle reveal">
                <span className="principle-number">02</span>
                <div>
                  <h3>{t('Let the messy middle happen.')}</h3>
                  <p>{t('Chapters move. Characters change their minds. Give your outline room to evolve alongside your story.')}</p>
                </div>
                <span className="principle-symbol" aria-hidden="true">⌁</span>
              </article>
              <article className="principle reveal">
                <span className="principle-number">03</span>
                <div>
                  <h3>{t('A practice, not a performance.')}</h3>
                  <p>{t('Keep an eye on your progress without letting a number become the reason you write. A few good words count, too.')}</p>
                </div>
                <span className="principle-symbol" aria-hidden="true">↗</span>
              </article>
            </div>
          </div>
        </section>

        <section className="wrap" id="everything" aria-labelledby="everything-h" style={{ paddingBlock: '20px 80px' }}>
          <div className="section-heading reveal">
            <div>
              <p className="eyebrow">{t('03 / AND EVERYTHING ELSE')}</p>
              <h2 id="everything-h">
                {t('The rest of the room.')}
                <br />
                <em>{t('Quietly there.')}</em>
              </h2>
            </div>
            <p>{t('Progress, exporting, and the apps for wherever you write.')}</p>
          </div>
          <div className="grid-3 reveal">
            <article className="card"><span className="eyebrow">{t('GOAL TRACKING')}</span><h3>{t('A gentle count')}</h3><p style={{ margin: '10px 0 0' }}>{t('Set a daily word goal and watch a quiet ring fill. Your log keeps the real totals, without pressure.')}</p></article>
            <article className="card"><span className="eyebrow">{t('EXPORTING')}</span><h3>{t('Take it with you')}</h3><p style={{ margin: '10px 0 0' }}>{t('Export a clean manuscript or open a print-ready view when you\'re ready to share it with beta readers.')}</p></article>
            <article className="card"><span className="eyebrow">{t('EVERY DEVICE')}</span><h3>{t('Web, Windows, Android')}</h3><p style={{ margin: '10px 0 0' }}>{t('Write in the browser, or install the desktop or Android app. Your novels travel with you.')}</p></article>
          </div>
        </section>

        <section className="closing-section wrap reveal" aria-labelledby="closing-heading">
          <p className="eyebrow">{t('THE REST IS STILL UNWRITTEN')}</p>
          <h2 id="closing-heading">
            {t('Your story is waiting.')}
            <br />
            <em>{t('Pull up a chair.')}</em>
          </h2>
          <button className="button button-primary" onClick={() => navigate('/login')}>
            {t('Make room for your story')} <span aria-hidden="true">↗</span>
          </button>
          <p>{t('No credit card. Start as a guest, or make an account to keep your work.')}</p>
          <span className="closing-ornament" aria-hidden="true">✳</span>
        </section>
      </main>

      <footer className="site-footer wrap">
        <Brand to="#/" />
        <p>{t('A considered space for the writing life.')}</p>
        <div>
          {sampleNovelCount() > 0 && <a href={pageUrl('library/')}>{t('Library')}</a>}
          <a href={pageUrl('about.html')}>{t('About')}</a>
          <a href={pageUrl('privacy.html')}>{t('Privacy')}</a>
          <a href={pageUrl('contact.html')}>{t('Contact')}</a>
          <span>{t('NOVELIST WORKSPACE')}</span>
        </div>
      </footer>
    </>
  );
};
