import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { countWords } from '../../lib/text';
import { timeAgo } from '../../lib/relativeTime';

/** One tap back into the chapter the writer was last working on. */
export const ContinueCard: React.FC = () => {
  const { activeProject, activeChapter, chapters } = useApp();
  const navigate = useNavigate();

  if (!activeProject || !activeChapter || activeChapter.project_id !== activeProject.id) return null;
  const at = chapters.findIndex((c) => c.id === activeChapter.id);
  if (at === -1) return null;
  const words = countWords(activeChapter.content);

  return (
    <section className="continue-card" aria-labelledby="continue-h">
      <div>
        <span className="eyebrow" id="continue-h">CONTINUE WHERE YOU LEFT OFF</span>
        <h3>{activeChapter.title || 'Untitled chapter'}</h3>
        <p className="meta">
          {activeProject.title} · Chapter {String(at + 1).padStart(2, '0')} · {words > 0 ? `${words.toLocaleString()} words` : 'Not started'} · edited{' '}
          {timeAgo(activeChapter.updated_at)}
        </p>
      </div>
      <button className="small-btn is-primary" onClick={() => navigate('/editor')}>
        Continue writing
      </button>
    </section>
  );
};
