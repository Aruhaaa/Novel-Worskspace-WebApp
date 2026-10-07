import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { databaseService } from '../../services/database';
import type { Chapter } from '../../services/types';
import { EmptyState } from '../ui/EmptyState';
import { ReaderReviews } from './ReaderReviews';
import { ReaderComments } from './ReaderComments';

export const LibraryReaderView: React.FC = () => {
  const { activePublicProject, setActivePublicProject, publicProjects, trackProjectView, recentlyRead, setRecentlyRead } = useApp();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const hasTrackedView = useRef<string | null>(null);

  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'times'>('times');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Sync URL ID with activePublicProject and track view
  useEffect(() => {
    if (id && (!activePublicProject || activePublicProject.id !== id)) {
      const project = publicProjects.find(p => p.id === id);
      if (project) {
        setActivePublicProject(project);
      }
    }
  }, [id, activePublicProject, publicProjects, setActivePublicProject]);

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
        setChapters(data);
      } catch (err) {
        console.error('Failed to load chapters for reader', err);
      } finally {
        setLoading(false);
      }
    };
    fetchChapters();
  }, [activePublicProject]);

  if (!activePublicProject || activePublicProject.id !== id) {
    return (
      <div className="studio-view">
        <div className="page">
          <p className="meta" role="status">Loading novel…</p>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    setActivePublicProject(null);
    navigate('/library');
  };

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

      <div
        className="studio-view"
        style={{ ...surface, ['--reader-font' as string]: FONTS[fontFamily], ['--reader-size' as string]: `${fontSize}px` } as React.CSSProperties}
      >
        <div className="reader-layout">
          <div className="reader-body">
            <div className="reader-text">
              <button className="small-btn back" onClick={handleBack}>
                <ArrowLeft /> Back to Library
              </button>

              <div className="reader-title">
                <h1>{activePublicProject.title}</h1>
                <p>
                  by{' '}
                  <Link className="link-accent" to={`/library/author/${activePublicProject.user_id}`}>
                    {activePublicProject.author_name || 'Anonymous'}
                  </Link>
                  {activePublicProject.genre ? ` · ${activePublicProject.genre}` : ''} · {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
                </p>
              </div>

              {loading ? (
                <p className="meta" role="status">Loading chapters…</p>
              ) : chapters.length === 0 ? (
                <EmptyState icon="book" title="No chapters yet" text="The author hasn't written any chapters for this novel yet." />
              ) : (
                <>
                  {chapters.map((chapter) => (
                    <article key={chapter.id} className="reader-chapter">
                      <h2>{chapter.title}</h2>
                      <div className="prose" dangerouslySetInnerHTML={{ __html: chapter.content || '' }} />
                      <ReaderComments projectId={activePublicProject.id} chapterId={chapter.id} />
                    </article>
                  ))}
                  <ReaderReviews projectId={activePublicProject.id} />
                  <p className="reader-end" style={{ fontFamily: 'var(--serif)' }}>End of published content.</p>
                </>
              )}
            </div>
          </div>

          <aside className="reader-aside" aria-labelledby="rs-h">
            <h2 id="rs-h">Reading settings</h2>
            <div className="field">
              <span>THEME</span>
              <div className="seg" role="group" aria-label="Reading theme">
                <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button>
                <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
                <button aria-pressed={theme === 'system'} onClick={() => setTheme('system')}>System</button>
              </div>
            </div>
            <div className="field">
              <span>FONT</span>
              <div className="seg" role="group" aria-label="Reading font">
                <button aria-pressed={fontFamily === 'sans'} onClick={() => setFontFamily('sans')}>Sans</button>
                <button aria-pressed={fontFamily === 'serif'} onClick={() => setFontFamily('serif')}>Serif</button>
                <button aria-pressed={fontFamily === 'times'} onClick={() => setFontFamily('times')}>Times</button>
              </div>
            </div>
            <div className="field">
              <span>SIZE</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="small-btn" aria-label="Smaller text" onClick={() => setFontSize((n) => Math.max(14, n - 2))}>A−</button>
                <output style={{ fontSize: 13, minWidth: 44, textAlign: 'center' }}>{fontSize}px</output>
                <button className="small-btn" aria-label="Larger text" onClick={() => setFontSize((n) => Math.min(26, n + 2))}>A+</button>
              </div>
            </div>
            <p className="meta" style={{ lineHeight: 1.7 }}>
              Reading settings are separate from your app theme and your writing font.
            </p>
          </aside>
        </div>
      </div>
    </>
  );
};
