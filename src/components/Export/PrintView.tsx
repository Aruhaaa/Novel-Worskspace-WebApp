import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export const PrintView: React.FC = () => {
  const { activeProject, chapters, setActiveView } = useApp();

  useEffect(() => {
    // Small delay to ensure rendering is complete
    const timer = setTimeout(() => {
      window.print();
      // Wait for print dialog to close, then go back to editor
      // Note: window.print() is blocking in most browsers, so this fires after it closes.
      setTimeout(() => setActiveView('editor'), 500);
    }, 500);
    return () => clearTimeout(timer);
  }, [setActiveView]);

  if (!activeProject) return null;

  // Sort chapters by position
  const sortedChapters = [...chapters].sort((a, b) => a.position - b.position);

  return (
    <div className="bg-white text-black min-h-screen p-12 max-w-[800px] mx-auto print:p-0 print:m-0 print:max-w-none">
      
      {/* Title Page */}
      <div className="min-h-screen flex flex-col items-center justify-center text-center pb-32 print:break-after-page">
        <h1 className="text-5xl font-serif font-bold mb-8 uppercase tracking-widest">{activeProject.title}</h1>
        {activeProject.author_name && (
          <h2 className="text-2xl font-serif italic text-gray-700">by {activeProject.author_name}</h2>
        )}
      </div>

      {/* Chapters */}
      {sortedChapters.map((chapter, index) => (
        <div key={chapter.id} className="print:break-after-page mb-24 last:mb-0">
          <h2 className="text-3xl font-serif font-bold mb-10 text-center uppercase tracking-wider">
            Chapter {index + 1}: {chapter.title || 'Untitled'}
          </h2>
          <div 
            className="font-serif text-lg leading-relaxed text-justify prose prose-lg max-w-none prose-p:indent-8 prose-p:my-2"
            dangerouslySetInnerHTML={{ __html: chapter.content }}
          />
        </div>
      ))}
      
    </div>
  );
};
