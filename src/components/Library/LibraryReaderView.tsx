import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { databaseService } from '../../services/database';
import type { Chapter } from '../../services/types';
import { EmptyState } from '../ui/EmptyState';
import { ReaderReviews } from './ReaderReviews';
import { ReaderComments } from './ReaderComments';
import { ReportButton } from '../Safety/ReportDialog';
import { useToast } from '../ui/toastContext';
import { sanitizeHtml } from '../../lib/sanitize';
import { getReadingPlace, setReadingPlace } from '../../lib/readingPlace';
import { isBundledNovel } from '../../lib/bundledLibrary';
import { publishedChapters } from '../../lib/chapterPublishing';
import { useDomReadAloud } from '../Speech/useDomReadAloud';
import { ReadAloudBar } from '../Speech/ReadAloudBar';
import { tp, useT } from '../../i18n';

export const LibraryReaderView: React.FC = () => {
  const t = useT();
  // The title and the text of every chapter, in order
  const ra = useDomReadAloud('.reader-text .reader-chapter > h2, .reader-text .reader-chapter .prose p, .reader-text .reader-chapter .prose h1, .reader-text .reader-chapter .prose h2, .reader-text .reader-chapter .prose h3, .reader-text .reader-chapter .prose li');
  const { user, activePublicProject, setActivePublicProject, publicProjects, loadPublicProjects, trackProjectView, recentlyRead, setRecentlyRead } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const hasTrackedView = useRef<string | null>(null);
  // The novel this screen has already asked the library for, and the one it has finished looking for
  const askedFor = useRef<string | null>(null);
  const [checkedFor, setCheckedFor] = useState<string | null>(null);

  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'times'>('times');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Sync URL ID with activePublicProject and track view
  useEffect(() => {
    if (!id || activePublicProject?.id === id) return;
    const project = publicProjects.find(p => p.id === id);
    if (project) {
      setActivePublicProject(project);
      return;
    }
    // Opened by its address, or after a refresh: the library has not been loaded yet, so ask for it once
    if (askedFor.current !== id) {
      askedFor.current = id;
      void loadPublicProjects().finally(() => setCheckedFor(id));
    }
  }, [id, activePublicProject, publicProjects, setActivePublicProject, loadPublicProjects]);

  useEffect(() => {
    if (activePublicProject?.id && hasTrackedView.current !== activePublicProject.id) {
      hasTrackedView.current = activePublicProject.id;
      trackProjectView(activePublicProject.id);
      
      const current = recentlyRead.filter(pid => pid !== activePublicProject.id);
      setRecentlyRead([activePublicProject.id, ...current].slice(0, 5));
    }
  }, [activePublicProject?.id, trackProjectView, recentlyRead, setRecentlyRead]);

  useEffect(() => {
    const fetchChapters = async () => {
      if (!activePublicProject) return;
      setLoading(true);
      try {
        const data = await databaseService.getChapters(activePublicProject.id);
        // Drafts are for the writer: a reader (the owner included) sees only what has been published
        setChapters(publishedChapters(data));
      } catch (err) {
        console.error('Failed to load chapters for reader', err);
      } finally {
        setLoading(false);
      }
    };
    fetchChapters();
  }, [activePublicProject]);

  // Other people's chapters are shown, so only plain writing is let through (the same rule the private reading links use)
  const safeChapters = useMemo(() => chapters.map((c) => ({ ...c, html: sanitizeHtml(c.content || '') })), [chapters]);

  const userId = user?.id;
  const projectId = activePublicProject?.id;
  // Where this reader stopped last time. Read once per novel, so saving as they read does not move it
  const savedPlace = useMemo(() => (userId && projectId ? getReadingPlace(userId, projectId) : null), [userId, projectId]);
  const resumedFor = useRef<string | null>(null);
  // Scrolling only counts as reading once the jump back to the saved chapter has settled
  const trackFrom = useRef(Number.MAX_SAFE_INTEGER);

  useEffect(() => {
    if (loading || !userId || !projectId || chapters.length === 0 || resumedFor.current === projectId) return;
    resumedFor.current = projectId;
    trackFrom.current = Date.now() + 700;
    const at = savedPlace ? chapters.findIndex((c) => c.id === savedPlace.chapterId) : -1;
    if (at > 0) {
      document.getElementById(`reader-ch-${chapters[at].id}`)?.scrollIntoView({ block: 'start' });
      toast({
        message: t('Back where you left off: {title}.', { title: chapters[at].title || t('chapter {n}', { n: at + 1 }) }),
        actionLabel: t('Start from the beginning'),
        onAction: () => document.querySelector('.reader-title')?.scrollIntoView({ block: 'start' }),
      });
    }
  }, [loading, chapters, userId, projectId, savedPlace, toast, t]);

  // The chapter whose top has passed about a third of the way down the screen is the one being read
  useEffect(() => {
    if (!userId || !projectId || safeChapters.length === 0) return;
    let measureTimer = 0;
    let timer = 0;
    let pending = -1;
    const flush = () => {
      window.clearTimeout(timer);
      if (pending >= 0) setReadingPlace(userId, projectId, safeChapters[pending].id, pending);
      pending = -1;
    };
    const measure = () => {
      measureTimer = 0;
      if (Date.now() < trackFrom.current) return;
      const line = window.innerHeight * 0.35;
      let current = -1;
      safeChapters.forEach((c, i) => {
        const el = document.getElementById(`reader-ch-${c.id}`);
        if (el && el.getBoundingClientRect().top <= line) current = i;
      });
      if (current < 0 || current === pending) return;
      pending = current;
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, 800);
    };
    // Measured a few times a second at most, not on every scroll event
    const onScroll = () => {
      if (!measureTimer) measureTimer = window.setTimeout(measure, 120);
    };
    // Captured, because the page may scroll inside a container rather than the window
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.clearTimeout(measureTimer);
      flush();
    };
  }, [userId, projectId, safeChapters]);

  if (!activePublicProject || activePublicProject.id !== id) {
    // Asked for and not there: unpublished, removed, or by someone this reader has blocked
    if (checkedFor === id && !publicProjects.some((p) => p.id === id)) {
      return (
        <div className="studio-view">
          <div className="page">
            <EmptyState icon="book" title={t('That novel is not available')} text={t('It may have been unpublished or removed.')}>
              <button className="small-btn is-primary" onClick={() => navigate('/library')}>{t('Back to the library')}</button>
            </EmptyState>
          </div>
        </div>
      );
    }
    return (
      <div className="studio-view">
        <div className="page">
          <p className="meta" role="status">{t('Loading novel…')}</p>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    setActivePublicProject(null);
    navigate('/library');
  };

  // A novel from the sample library has no author to report: it ships with the site
  const sample = isBundledNovel(activePublicProject.id);

  const FONTS = {
    sans: 'var(--sans)',
    serif: 'var(--serif)',
    times: 'Georgia, "Times New Roman", serif',
  } as const;

  // The reader keeps its own light/dark choice, separate from the app theme
  const surface: React.CSSProperties =
    theme === 'dark'
      ? { background: '#16171b', color: '#ece8df' }
      : theme === 'light'
        ? { background: '#fffdf8', color: '#262722' }
        : {};

  return (
    <>
      <Helmet>
        <title>{`${activePublicProject.title} | Novelist`}</title>
        <meta name="description" content={activePublicProject.description || `Read ${activePublicProject.title} on Novelist.`} />
        <meta property="og:title" content={`${activePublicProject.title} | Novelist`} />
        <meta property="og:description" content={activePublicProject.description || `Read ${activePublicProject.title} on Novelist.`} />
        {activePublicProject.cover_url && <meta property="og:image" content={activePublicProject.cover_url} />}
      </Helmet>

      <ReadAloudBar ra={ra} />
      <div
        className="studio-view"
        style={{ ...surface, ['--reader-font' as string]: FONTS[fontFamily], ['--reader-size' as string]: `${fontSize}px` } as React.CSSProperties}
      >
        <div className="reader-layout">
          <div className="reader-body">
            <div className="reader-text">
              <button className="small-btn back" onClick={handleBack}>
                <ArrowLeft /> {t('Back to Library')}
              </button>

              <div className="reader-title">
                <h1>{activePublicProject.title}</h1>
                <p>
                  {t('by')}{' '}
                  <Link className="link-accent" to={`/library/author/${activePublicProject.user_id}`}>
                    {activePublicProject.author_name || t('Anonymous')}
                  </Link>
                  {activePublicProject.genre ? ` · ${activePublicProject.genre}` : ''} · {tp(chapters.length, '{n} chapter', '{n} chapters')}
                  {sample ? (
                    ` · ${t('Sample novel')}`
                  ) : (
                    <>
                      {' · '}
                      <ReportButton
                        subject={{
                          type: 'novel',
                          targetId: activePublicProject.id,
                          authorId: activePublicProject.user_id,
                          authorName: activePublicProject.author_name,
                          projectId: activePublicProject.id,
                          excerpt: `${activePublicProject.title} - ${activePublicProject.description || ''}`,
                        }}
                        label={t('Report this novel')}
                      />
                    </>
                  )}
                </p>
              </div>

              {loading ? (
                <p className="meta" role="status">{t('Loading chapters…')}</p>
              ) : chapters.length === 0 ? (
                <EmptyState icon="book" title={t('No chapters yet')} text={t('The author hasn\'t written any chapters for this novel yet.')} />
              ) : (
                <>
                  {safeChapters.map((chapter) => (
                    <article key={chapter.id} id={`reader-ch-${chapter.id}`} className="reader-chapter">
                      <h2>{chapter.title}</h2>
                      <div className="prose" dangerouslySetInnerHTML={{ __html: chapter.html }} />
                      <ReaderComments projectId={activePublicProject.id} chapterId={chapter.id} />
                    </article>
                  ))}
                  <ReaderReviews projectId={activePublicProject.id} />
                  <p className="reader-end" style={{ fontFamily: 'var(--serif)' }}>{t('End of published content.')}</p>
                </>
              )}
            </div>
          </div>

          <aside className="reader-aside" aria-labelledby="rs-h">
            <h2 id="rs-h">{t('Reading settings')}</h2>
            <div className="field">
              <span>{t('THEME')}</span>
              <div className="seg" role="group" aria-label={t('Reading theme')}>
                <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>{t('Light')}</button>
                <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>{t('Dark')}</button>
                <button aria-pressed={theme === 'system'} onClick={() => setTheme('system')}>{t('System')}</button>
              </div>
            </div>
            <div className="field">
              <span>{t('FONT')}</span>
              <div className="seg" role="group" aria-label={t('Reading font')}>
                <button aria-pressed={fontFamily === 'sans'} onClick={() => setFontFamily('sans')}>{t('Sans')}</button>
                <button aria-pressed={fontFamily === 'serif'} onClick={() => setFontFamily('serif')}>{t('Serif')}</button>
                <button aria-pressed={fontFamily === 'times'} onClick={() => setFontFamily('times')}>{t('Times')}</button>
              </div>
            </div>
            <div className="field">
              <span>{t('SIZE')}</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="small-btn" aria-label={t('Smaller text')} onClick={() => setFontSize((n) => Math.max(14, n - 2))}>{t('A−')}</button>
                <output style={{ fontSize: 13, minWidth: 44, textAlign: 'center' }}>{fontSize}px</output>
                <button className="small-btn" aria-label={t('Larger text')} onClick={() => setFontSize((n) => Math.min(26, n + 2))}>{t('A+')}</button>
              </div>
            </div>
            {ra.supported && (
              <div className="field">
                <span>{t('LISTEN')}</span>
                <button className="small-btn" onClick={ra.state === 'idle' ? ra.start : ra.stop} disabled={loading || chapters.length === 0}>
                  {ra.state === 'idle' ? t('Read this novel aloud') : t('Stop reading aloud')}
                </button>
              </div>
            )}
            <p className="meta" style={{ lineHeight: 1.7 }}>
              {t('Reading settings are separate from your app theme and your writing font.')}
            </p>
          </aside>
        </div>
      </div>
    </>
  );
};
