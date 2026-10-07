import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Globe, FileText, LayoutGrid, ArrowLeft, BookOpen, Bookmark } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDailyGoal } from '../../lib/dailyGoal';
import { countWords } from '../../lib/text';
import { Dialog } from '../ui/Dialog';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Views that belong to a project's workspace. Everything else is the main app.
const WORKSPACE_VIEWS = ['editor', 'outline', 'notebook', 'print'];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activeProject, chapters, activeChapter, activeView, setActiveChapter, createChapter, space, isGuest } = useApp();
  const navigate = useNavigate();
  const daily = useDailyGoal();

  const [showNewChapter, setShowNewChapter] = useState(false);
  const [chapterTitle, setChapterTitle] = useState('');

  const inWorkspace = !!activeProject && WORKSPACE_VIEWS.includes(activeView);
  const published = !!activeProject?.is_published;

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterTitle.trim()) return;
    await createChapter(chapterTitle);
    setChapterTitle('');
    setShowNewChapter(false);
  };

  const link = (current: boolean, to: string, icon: React.ReactNode, label: string) => (
    <Link to={to} aria-current={current ? 'page' : undefined} onClick={onClose}>
      {icon}
      {label}
    </Link>
  );

  return (
    <>
      <aside className={`studio-sidebar${isOpen ? ' is-open' : ''}`} id="studio-sidebar" aria-label={inWorkspace ? 'Workspace navigation and chapters' : 'Main navigation'}>
        {inWorkspace && activeProject ? (
          <>
            <Link to="/manuscripts" className="back-link" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 8px 12px', padding: 0 }}>
              <ArrowLeft style={{ width: 12, height: 12 }} /> All projects
            </Link>

            <div className="project-mini">
              <span className="mini-book" aria-hidden="true">
                {activeProject.title.trim().charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2>{activeProject.title}</h2>
                <p>{`${activeProject.genre || 'Fiction'} · ${published ? 'Published' : 'Draft'}`.toUpperCase()}</p>
              </div>
            </div>

            <nav className="studio-nav" aria-label="Workspace">
              {link(activeView === 'editor', '/editor', <FileText />, 'Manuscript')}
              {link(activeView === 'outline', '/outline', <LayoutGrid />, 'Story outline')}
              {link(activeView === 'notebook', '/notebook', <Globe />, 'World notebook')}
            </nav>

            <div className="sidebar-label">
              <h2 className="eyebrow">
                CHAPTERS <span>{String(chapters.length).padStart(2, '0')}</span>
              </h2>
              <button className="icon-button" onClick={() => setShowNewChapter(true)} aria-label="Add a chapter" title="Add a chapter">
                +
              </button>
            </div>
            <ol className="chapter-list">
              {chapters.length === 0 && (
                <li style={{ padding: '10px 12px', fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>No chapters yet.</li>
              )}
              {chapters.map((c, i) => {
                const words = countWords(c.content);
                return (
                  <li key={c.id}>
                    <button
                      aria-current={activeView === 'editor' && activeChapter?.id === c.id ? 'true' : undefined}
                      onClick={() => {
                        setActiveChapter(c);
                        navigate('/editor');
                        onClose();
                      }}
                    >
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      <span>
                        {c.title || 'Untitled chapter'}
                        <small>{words > 0 ? `${words.toLocaleString()} words` : 'Not started'}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="sidebar-bottom">
              <h2 className="eyebrow">TODAY</h2>
              <p className="daily-count">
                <strong>{daily.written.toLocaleString()}</strong>
                <span>/ {daily.goal.toLocaleString()} words</span>
              </p>
              <progress max={daily.goal} value={Math.min(daily.written, daily.goal)} aria-label="Progress toward today's word goal" />
            </div>
          </>
        ) : (
          space === 'read' ? (
            <nav className="studio-nav" aria-label="Reading">
              {link(activeView === 'read_home', '/read', <BookOpen />, 'Reading home')}
              {link(['library', 'reader'].includes(activeView), '/library', <Globe />, 'Public Library')}
              {!isGuest && link(activeView === 'saved_library', '/saved', <Bookmark />, 'Your Library')}
            </nav>
          ) : (
            <nav className="studio-nav" aria-label="Studio">
              {link(activeView === 'home', '/write', <Home />, 'Home dashboard')}
              {link(activeView === 'manuscripts', '/manuscripts', <FileText />, 'Manuscripts')}
            </nav>
          )
        )}
      </aside>

      <button className={`mobile-scrim${isOpen ? ' is-open' : ''}`} tabIndex={-1} aria-label="Close side panel" onClick={onClose} />

      <Dialog open={showNewChapter} onClose={() => setShowNewChapter(false)} labelledBy="nc-h">
        <form onSubmit={handleCreateChapter}>
          <p className="eyebrow">A FRESH PAGE</p>
          <h2 id="nc-h">What comes next?</h2>
          <label htmlFor="nc-title">Chapter title</label>
          <input id="nc-title" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} placeholder="Chapter 5: The tide table" required autoFocus />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowNewChapter(false)}>Cancel</button>
            <button className="button button-primary button-small">Create chapter</button>
          </div>
        </form>
      </Dialog>
    </>
  );
};
