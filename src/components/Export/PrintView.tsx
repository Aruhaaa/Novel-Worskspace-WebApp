import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

export const PrintView: React.FC = () => {
  const { activeProject, chapters } = useApp();

  if (!activeProject) return null;

  const sortedChapters = [...chapters].sort((a, b) => a.position - b.position);

  return (
    <>
      <style>{`@media print { .studio-header, .studio-sidebar, .studio-toolbar, .mobile-scrim { display: none !important; } .studio-layout { display: block !important; } .print-sheet { border: 0; } }`}</style>
      <div className="studio-toolbar">
        <h1>
          Print view <span>/ {activeProject.title}</span>
        </h1>
        <div className="toolbar-actions">
          <Link className="small-btn" to="/editor">Back to manuscript</Link>
          <button className="small-btn is-primary" onClick={() => window.print()}>Print or save as PDF</button>
        </div>
      </div>
      <div className="studio-view" style={{ padding: '30px 18px 60px' }}>
        <article className="print-sheet">
          <div className="print-title">
            <h1>{activeProject.title}</h1>
            {activeProject.author_name && <p>by {activeProject.author_name}</p>}
          </div>
          {sortedChapters.map((chapter, index) => (
            <section className="print-chapter" key={chapter.id} style={{ marginBottom: 60 }}>
              <h2>
                Chapter {index + 1}: {chapter.title || 'Untitled'}
              </h2>
              <div dangerouslySetInnerHTML={{ __html: chapter.content }} />
            </section>
          ))}
        </article>
      </div>
    </>
  );
};
