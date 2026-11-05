import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Globe, FileText, LayoutGrid, ArrowLeft, BookOpen, Bookmark, MessageSquare } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLive } from '../../context/LiveContext';
import { tp, useT } from '../../i18n';
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
  const t = useT();
  const { activeProject, chapters, activeChapter, activeView, setActiveChapter, createChapter, space, isGuest } = useApp();
  const { unreadMessages } = useLive();
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

  const link = (current: boolean, to: string, icon: React.ReactNode, label: string, count = 0) => (
    <Link to={to} aria-current={current ? 'page' : undefined} onClick={onClose}>
      {icon}
      {label}
      {count > 0 && (
        <span className="nav-count" aria-label={t('{n} unread', { n: count })}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );

  return (
    <>
      <aside className={`studio-sidebar${isOpen ? ' is-open' : ''}`} id="studio-sidebar" aria-label={inWorkspace ? t('Workspace navigation and chapters') : t('Main navigation')}>
        {inWorkspace && activeProject ? (
          <>
            <Link to="/manuscripts" className="back-link" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 8px 12px', padding: 0 }}>
              <ArrowLeft style={{ width: 12, height: 12 }} /> {t('All projects')}
            </Link>

            <div className="project-mini">
              <span className="mini-book" aria-hidden="true">
                {activeProject.title.trim().charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2>{activeProject.title}</h2>
                <p>{`${activeProject.genre || t('Fiction')} · ${published ? t('Published') : t('Draft')}`.toUpperCase()}</p>
              </div>
            </div>

            <nav className="studio-nav" aria-label={t('Workspace')}>
              {link(activeView === 'editor', '/editor', <FileText />, t('Manuscript'))}
              {link(activeView === 'outline', '/outline', <LayoutGrid />, t('Story outline'))}
              {link(activeView === 'notebook', '/notebook', <Globe />, t('World notebook'))}
            </nav>

            <div className="sidebar-label">
              <h2 className="eyebrow">
                {t('CHAPTERS')} <span>{String(chapters.length).padStart(2, '0')}</span>
              </h2>
              <button className="icon-button" onClick={() => setShowNewChapter(true)} aria-label={t('Add a chapter')} title={t('Add a chapter')}>
                +
              </button>
            </div>
            <ol className="chapter-list">
              {chapters.length === 0 && (
                <li style={{ padding: '10px 12px', fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>{t('No chapters yet.')}</li>
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
                        {c.title || t('Untitled chapter')}
                        <small>{words > 0 ? tp(words, '{n} word', '{n} words') : t('Not started')}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="sidebar-bottom">
              <h2 className="eyebrow">{t('TODAY')}</h2>
              <p className="daily-count">
                <strong>{daily.written.toLocaleString()}</strong>
                <span>/ {t('{n} words', { n: daily.goal.toLocaleString() })}</span>
              </p>
              <progress max={daily.goal} value={Math.min(daily.written, daily.goal)} aria-label={t("Progress toward today's word goal")} />
            </div>
          </>
        ) : (
          space === 'read' ? (
            <nav className="studio-nav" aria-label={t('Reading')}>
              {link(activeView === 'read_home', '/read', <BookOpen />, t('Reading home'))}
              {link(['library', 'reader'].includes(activeView), '/library', <Globe />, t('Public Library'))}
              {!isGuest && link(activeView === 'saved_library', '/saved', <Bookmark />, t('Your Library'))}
              {!isGuest && link(activeView === 'messages', '/messages', <MessageSquare />, t('Messages'), unreadMessages)}
            </nav>
          ) : (
            <nav className="studio-nav" aria-label={t('Studio')}>
              {link(activeView === 'home', '/write', <Home />, t('Home dashboard'))}
              {link(activeView === 'manuscripts', '/manuscripts', <FileText />, t('Manuscripts'))}
              {!isGuest && link(activeView === 'messages', '/messages', <MessageSquare />, t('Messages'), unreadMessages)}
            </nav>
          )
        )}
      </aside>

      <button className={`mobile-scrim${isOpen ? ' is-open' : ''}`} tabIndex={-1} aria-label={t('Close side panel')} onClick={onClose} />

      <Dialog open={showNewChapter} onClose={() => setShowNewChapter(false)} labelledBy="nc-h">
        <form onSubmit={handleCreateChapter}>
          <p className="eyebrow">{t('A FRESH PAGE')}</p>
          <h2 id="nc-h">{t('What comes next?')}</h2>
          <label htmlFor="nc-title">{t('Chapter title')}</label>
          <input id="nc-title" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} placeholder={t('Chapter 5: The tide table')} required autoFocus />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowNewChapter(false)}>{t('Cancel')}</button>
            <button className="button button-primary button-small">{t('Create chapter')}</button>
          </div>
        </form>
      </Dialog>
    </>
  );
};
