import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { databaseService } from '../../services/database';
import type { Chapter } from '../../services/types';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';

export const LibraryReaderView: React.FC = () => {
  const { activePublicProject, setActiveView, setActivePublicProject } = useApp();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (!activePublicProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-400">
        <p>No project selected for reading.</p>
        <button 
          onClick={() => setActiveView('library')}
          className="mt-4 text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Return to Library
        </button>
      </div>
    );
  }

  const handleBack = () => {
    setActivePublicProject(null);
    setActiveView('library');
  };

  return (
    <div className="flex-1 bg-[#F9F9FB] dark:bg-slate-950 overflow-y-auto relative font-serif text-slate-800 dark:text-slate-200 transition-colors duration-300">
      {/* Reader Header */}
      <div className="sticky top-0 z-50 bg-[#F9F9FB]/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-6 py-4 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm font-sans font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </button>
        <div className="text-center flex-1 px-4">
          <h2 className="text-lg font-bold truncate">{activePublicProject.title}</h2>
          <p className="text-xs font-sans text-slate-500 dark:text-slate-400">
            By {activePublicProject.author_name || 'Anonymous'}
          </p>
        </div>
        <div className="w-24" /> {/* Spacer for centering */}
      </div>

      {/* Reader Content */}
      <div className="max-w-3xl mx-auto px-8 py-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
            <p className="font-sans text-sm">Loading chapters...</p>
          </div>
        ) : chapters.length === 0 ? (
          <div className="text-center py-24">
            <BookOpen className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-6" />
            <h3 className="text-xl font-bold mb-2">No Chapters Yet</h3>
            <p className="text-slate-500 font-sans">
              The author hasn't written any chapters for this novel yet.
            </p>
          </div>
        ) : (
          <div className="space-y-24">
            {chapters.map((chapter) => (
              <article key={chapter.id} className="prose prose-slate dark:prose-invert prose-lg max-w-none">
                <h1 className="text-3xl font-extrabold text-center mb-12 pb-6 border-b border-slate-200 dark:border-slate-800">
                  {chapter.title}
                </h1>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {chapter.content || <span className="italic text-slate-400">This chapter is empty.</span>}
                </div>
              </article>
            ))}
            
            <div className="text-center pt-16 pb-8 border-t border-slate-200 dark:border-slate-800">
              <p className="italic text-slate-500">End of published content.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
