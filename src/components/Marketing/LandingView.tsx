import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Brand } from '../Brand';
import landscape from '../../assets/quiet-landscape.svg';

type PreviewTab = 'write' | 'shape' | 'world';

const TABS: { id: PreviewTab; num: string; label: string; location: string }[] = [
  { id: 'write', num: '01', label: 'Write', location: 'Manuscript' },
  { id: 'shape', num: '02', label: 'Shape', location: 'Storyboard' },
  { id: 'world', num: '03', label: 'Imagine', location: 'World notebook' },
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
        <nav className="desktop-nav" aria-label="Main navigation">
          <button onClick={() => scrollToId('workspace')}>The workspace</button>
          <button onClick={() => scrollToId('approach')}>Our approach</button>
          <button onClick={() => scrollToId('everything')}>Everything else</button>
          <button onClick={() => navigate('/login')}>Sign in</button>
        </nav>
        <button className="button button-outline header-cta" onClick={loginAsGuest}>
          Start reading <span aria-hidden="true">↗</span>
        </button>
      </header>

      <main id="main">
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow hero-enter">
              <span className="small-dot" /> FOR THE WORLDS WITHIN YOU
            </p>
            <h1 id="hero-title" className="hero-enter delay-1">
              A little room.
              <br />A whole <em>world.</em>
            </h1>
            <p className="hero-description hero-enter delay-2">
              Somewhere between the first thought and the final full stop, a story becomes yours.
              <br />
              This is your space to write it.
            </p>
            <div className="hero-actions hero-enter delay-3">
              <button className="button button-primary" onClick={() => navigate('/login')}>
                Start writing <span aria-hidden="true">↗</span>
              </button>
              <button className="button button-outline" onClick={loginAsGuest}>
                Start reading <span aria-hidden="true">↗</span>
              </button>
              <button className="text-link" onClick={() => scrollToId('workspace')}>
                Take a look inside <span aria-hidden="true">↓</span>
              </button>
            </div>
            <p className="hero-footnote hero-enter delay-3">
              A writing space. Not another distraction. &nbsp;
              <button className="link-accent" onClick={loginAsGuest}>Browse the library, no account needed</button> ·{' '}
              <button className="link-accent" onClick={() => navigate('/login')}>Sign in</button>
            </p>
          </div>

          <div ref={heroArt} className="hero-art hero-enter delay-2" aria-label="An illustrated book and a manuscript page, a visual tribute to the craft of writing">
            <div className="art-orbit" aria-hidden="true" />
            <span className="art-registration reg-top" aria-hidden="true">+</span>
            <span className="art-registration reg-bottom" aria-hidden="true">+</span>
            <div className="manuscript-sheet" aria-hidden="true">
              <div className="sheet-running-head">
                THE ATLAS OF QUIET PLACES <span>01</span>
              </div>
              <p className="sheet-chapter">Chapter one</p>
              <h2>
                The things
                <br />
                we leave behind.
              </h2>
              <p>On the morning the sea disappeared, Ada was making tea. She had always thought the end of something would announce itself.</p>
              <p>Instead, there was only the kettle, the open window, and a silence where the waves should have been.</p>
              <span className="manuscript-edit">let the silence stay.</span>
            </div>
            <div className="book-object" aria-hidden="true">
              <div className="book-spine" />
              <div className="book-cover">
                <span className="cover-category">A NOVEL IN THE MAKING</span>
                <h2>
                  The Atlas of
                  <br />
                  <em>Quiet Places</em>
                </h2>
                <div className="cover-art">
                  <img src={landscape} alt="" width="600" height="680" />
                </div>
                <span className="cover-author">YOUR NEXT CHAPTER AWAITS</span>
                <span className="cover-corner" aria-hidden="true">N.</span>
              </div>
            </div>
            <div className="art-annotation" aria-hidden="true">
              <svg viewBox="0 0 100 50"><path d="M90 7C72 49 38 40 9 25m0 0 7 17M9 25l19-2" /></svg>
              <span>
                It starts with
                <br />a single line.
              </span>
            </div>
            <p className="art-caption"><span>FIG. 01</span> A PLACE FOR POSSIBILITY</p>
          </div>
        </section>

        <div className="chapter-divider wrap">
          <span>YOUR STORY, FROM EVERY ANGLE</span>
          <div />
          <span>WRITE / SHAPE / IMAGINE</span>
        </div>

        <section className="workspace-section wrap" id="workspace" aria-labelledby="workspace-heading">
          <div className="section-heading reveal">
            <div>
              <p className="eyebrow">01 / THE WORKSPACE</p>
              <h2 id="workspace-heading">
                Everything in its place.
                <br />
                <em>Except your imagination.</em>
              </h2>
            </div>
            <p>Your manuscript, your messy ideas, your impossibly detailed world. Finally, they’re all on the same page.</p>
          </div>

          <div className="preview-controls reveal">
            <div className="preview-tabs" role="tablist" aria-label="Explore workspace features">
              {TABS.map((t, i) => (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  role="tab"
                  aria-selected={tab === t.id}
                  aria-controls={`preview-${t.id}`}
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  {t.num} <span>{t.label}</span>
                </button>
              ))}
            </div>
            <button className="text-link" onClick={loginAsGuest}>
              Try it as a guest <span aria-hidden="true">↗</span>
            </button>
          </div>

          <div className="workspace-preview reveal">
            <div className="preview-topbar">
              <span className="preview-logo">n.</span>
              <span>
                The Atlas of Quiet Places <span className="preview-slash">/</span> <span>{current.location}</span>
              </span>
              <span className="sample-label">SAMPLE WORKSPACE</span>
            </div>

            {tab === 'write' && (
              <div className="preview-panel" id="preview-write" role="tabpanel" aria-labelledby="tab-write" tabIndex={0}>
                <aside className="preview-sidebar" aria-label="Sample manuscript chapters">
                  <span className="eyebrow">MANUSCRIPT</span>
                  <div className="preview-chapter active"><span>01</span> The quiet departure <i /></div>
                  <div className="preview-chapter"><span>02</span> A map of elsewhere</div>
                  <div className="preview-chapter"><span>03</span> What the water knows</div>
                  <div className="preview-chapter"><span>04</span> The long way home</div>
                  <div className="preview-sidebar-bottom">
                    <span className="eyebrow">ONE WORD AT A TIME</span>
                    <div className="mini-progress"><span /></div>
                    <span>24,680 / 60,000 words</span>
                  </div>
                </aside>
                <div className="preview-manuscript">
                  <div className="preview-toolbar">
                    <span>Manuscript <span aria-hidden="true">⌄</span></span>
                    <span className="format-sample" aria-hidden="true">B &nbsp; <i>I</i> &nbsp; ¶</span>
                    <span className="saved-label"><span className="small-dot" /> Sample draft</span>
                  </div>
                  <article className="preview-prose">
                    <p className="eyebrow">CHAPTER ONE</p>
                    <h3>The quiet departure</h3>
                    <p className="dropcap">On the morning the sea disappeared, Ada was making tea. She had always thought the end of something would announce itself. A door closing. A glass breaking. The particular weight of a last goodbye.</p>
                    <p>Instead, there was only the kettle, the open window, and a silence where the waves should have been.</p>
                    <p>She set down her cup. For the first time in thirty years, she could hear the birds in the garden.<span className="sample-caret" aria-hidden="true" /></p>
                  </article>
                  <div className="preview-page-number">— &nbsp; 1 &nbsp; —</div>
                </div>
                <aside className="preview-margin">
                  <span className="eyebrow">IN THE MARGINS</span>
                  <div className="margin-note">
                    <span className="note-pin" aria-hidden="true" />
                    <p>What if the sea isn’t gone?<br />What if it’s waiting?</p>
                    <span>SCENE NOTE / 01</span>
                  </div>
                  <span className="margin-flower" aria-hidden="true">✳</span>
                  <p className="margin-caption">Room for the thought<br />behind the thought.</p>
                </aside>
              </div>
            )}

            {tab === 'shape' && (
              <div className="preview-panel preview-alternate" id="preview-shape" role="tabpanel" aria-labelledby="tab-shape" tabIndex={0}>
                <div className="alternate-heading">
                  <span className="eyebrow">THE STORYBOARD</span>
                  <h3>Make space for the unexpected.</h3>
                  <p>A bird’s-eye view of the story, before you get lost in the details.</p>
                </div>
                <div className="sample-board">
                  <div>
                    <span className="board-column-label">I. THE DEPARTURE <span>02</span></span>
                    <article className="scene-card"><span className="scene-status">DRAFTING</span><h4>The sea goes quiet</h4><p>Ada wakes to an impossible absence.</p><span className="scene-meta">Chapter 01 · Ada</span></article>
                    <article className="scene-card"><span className="scene-status">TO EXPLORE</span><h4>The unopened letter</h4><p>A familiar hand. An unfamiliar address.</p><span className="scene-meta">Chapter 02 · Ada</span></article>
                  </div>
                  <div>
                    <span className="board-column-label">II. THE CROSSING <span>01</span></span>
                    <article className="scene-card olive-card"><span className="scene-status">OUTLINED</span><h4>A map of elsewhere</h4><p>Every road leads somewhere that no longer exists.</p><span className="scene-meta">Chapter 03 · Elias</span></article>
                  </div>
                  <div>
                    <span className="board-column-label">III. THE RETURN <span>01</span></span>
                    <article className="scene-card"><span className="scene-status">TO EXPLORE</span><h4>What we bring home</h4><p>Not all endings look like an arrival.</p><span className="scene-meta">Chapter 04 · Ada</span></article>
                  </div>
                </div>
              </div>
            )}

            {tab === 'world' && (
              <div className="preview-panel preview-alternate" id="preview-world" role="tabpanel" aria-labelledby="tab-world" tabIndex={0}>
                <div className="alternate-heading">
                  <span className="eyebrow">THE WORLD NOTEBOOK</span>
                  <h3>A world beyond the words.</h3>
                  <p>Keep the people, places, and little details that make it feel real.</p>
                </div>
                <div className="sample-world">
                  <article className="world-person"><span className="character-monogram">A</span><span className="eyebrow">CHARACTER / 01</span><h4>Ada Wren</h4><p>A cartographer who has spent a lifetime mapping places she has never been.</p><span className="entity-tag">Protagonist</span></article>
                  <article className="world-place"><img src={landscape} alt="Illustrated hills and a winding river" width="600" height="680" /><div><span className="eyebrow">LOCATION / 01</span><h4>The Hollow Coast</h4><p>Where the land remembers what the sea forgets.</p></div></article>
                  <article className="world-detail"><span className="eyebrow">A DETAIL TO REMEMBER</span><span className="large-asterisk" aria-hidden="true">✳</span><h4>The blue teacup</h4><p>A hairline crack. A gift from her mother. The one thing she takes with her.</p></article>
                </div>
              </div>
            )}

            <div className="preview-status">
              <span>A calmer place to do your most ambitious work.</span>
              <span>SAMPLE WORKSPACE</span>
            </div>
          </div>
          <div className="under-preview reveal">
            <span className="small-dot" />
            <p>Less switching between tools. More staying with the story.</p>
            <span className="serif-asterisk" aria-hidden="true">∗</span>
          </div>
        </section>

        <section className="approach-section" id="approach" aria-labelledby="approach-heading">
          <div className="wrap approach-grid">
            <div className="approach-intro reveal">
              <p className="eyebrow">02 / A DIFFERENT KIND OF SPACE</p>
              <h2 id="approach-heading">
                Made for the craft.
                <br />
                <em>Not the noise.</em>
              </h2>
              <p>Writing doesn’t need another dashboard demanding your attention. It needs a little breathing room.</p>
              <div className="editorial-seal" aria-hidden="true">
                <span>LESS, BUT</span>
                <strong>better.</strong>
                <span>BY DESIGN</span>
              </div>
            </div>
            <div className="principle-list">
              <article className="principle reveal">
                <span className="principle-number">01</span>
                <div>
                  <h3>Find your flow. Stay there.</h3>
                  <p>A considered writing canvas, readable type, and a focus mode that lets the interface step aside.</p>
                  <button className="text-link" onClick={loginAsGuest}>Enter a quieter space <span aria-hidden="true">↗</span></button>
                </div>
                <span className="principle-symbol" aria-hidden="true">◌</span>
              </article>
              <article className="principle reveal">
                <span className="principle-number">02</span>
                <div>
                  <h3>Let the messy middle happen.</h3>
                  <p>Chapters move. Characters change their minds. Give your outline room to evolve alongside your story.</p>
                </div>
                <span className="principle-symbol" aria-hidden="true">⌁</span>
              </article>
              <article className="principle reveal">
                <span className="principle-number">03</span>
                <div>
                  <h3>A practice, not a performance.</h3>
                  <p>Keep an eye on your progress without letting a number become the reason you write. A few good words count, too.</p>
                </div>
                <span className="principle-symbol" aria-hidden="true">↗</span>
              </article>
            </div>
          </div>
        </section>

        <section className="wrap" id="everything" aria-labelledby="everything-h" style={{ paddingBlock: '20px 80px' }}>
          <div className="section-heading reveal">
            <div>
              <p className="eyebrow">03 / AND EVERYTHING ELSE</p>
              <h2 id="everything-h">
                The rest of the room.
                <br />
                <em>Quietly there.</em>
              </h2>
            </div>
            <p>Progress, exporting, and the apps for wherever you write.</p>
          </div>
          <div className="grid-3 reveal">
            <article className="card"><span className="eyebrow">GOAL TRACKING</span><h3>A gentle count</h3><p style={{ margin: '10px 0 0' }}>Set a daily word goal and watch a quiet ring fill. Your log keeps the real totals, without pressure.</p></article>
            <article className="card"><span className="eyebrow">EXPORTING</span><h3>Take it with you</h3><p style={{ margin: '10px 0 0' }}>Export a clean manuscript or open a print-ready view when you're ready to share it with beta readers.</p></article>
            <article className="card"><span className="eyebrow">EVERY DEVICE</span><h3>Web, Windows, Android</h3><p style={{ margin: '10px 0 0' }}>Write in the browser, or install the desktop or Android app. Your novels travel with you.</p></article>
          </div>
        </section>

        <section className="closing-section wrap reveal" aria-labelledby="closing-heading">
          <p className="eyebrow">THE REST IS STILL UNWRITTEN</p>
          <h2 id="closing-heading">
            Your story is waiting.
            <br />
            <em>Pull up a chair.</em>
          </h2>
          <button className="button button-primary" onClick={() => navigate('/login')}>
            Make room for your story <span aria-hidden="true">↗</span>
          </button>
          <p>No credit card. Start as a guest, or make an account to keep your work.</p>
          <span className="closing-ornament" aria-hidden="true">✳</span>
        </section>
      </main>

      <footer className="site-footer wrap">
        <Brand to="#/" />
        <p>A considered space for the writing life.</p>
        <div>
          <span>NOVELIST WORKSPACE</span>
        </div>
      </footer>
    </>
  );
};
