import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { sanitizeHtml } from '../../lib/sanitize';
import { useT } from '../../i18n';

export const PrintView: React.FC = () => {
  const t = useT();
  const { activeProject, chapters } = useApp();

  if (!activeProject) return null;

  const sortedChapters = [...chapters].sort((a, b) => a.position - b.position);

  return (
    <>
      <style>{`@media print { .studio-header, .studio-sidebar, .studio-toolbar, .mobile-scrim { display: none !important; } .studio-layout { display: block !important; } .print-sheet { border: 0; } }`}</style>
      <div className="studio-toolbar">
        <h1>
          {t('Print view')} <span>/ {activeProject.title}</span>
        </h1>
        <div className="toolbar-actions">
          <Link className="small-btn" to="/editor">{t('Back to manuscript')}</Link>
          <button className="small-btn is-primary" onClick={() => window.print()}>{t('Print or save as PDF')}</button>
        </div>
      </div>
      <div className="studio-view" style={{ padding: '30px 18px 60px' }}>
        <article className="print-sheet">
          <div className="print-title">
            <h1>{activeProject.title}</h1>
            {activeProject.author_name && <p>{t('by {name}', { name: activeProject.author_name })}</p>}
          </div>
          {sortedChapters.map((chapter, index) => (
            <section className="print-chapter" key={chapter.id} style={{ marginBottom: 60 }}>
              <h2>
                {t('Chapter {n}', { n: index + 1 })}: {chapter.title || t('Untitled')}
              </h2>
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(chapter.content) }} />
            </section>
          ))}
        </article>
      </div>
    </>
  );
};
