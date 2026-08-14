import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useApp } from '../../context/AppContext';
import { databaseService } from '../../services/database';
import type { Chapter } from '../../services/types';
import { ArrowLeft, BookOpen, Loader2, Settings2, Moon, Sun, Monitor, Type } from 'lucide-react';
import { ReaderReviews } from './ReaderReviews';
import { ReaderComments } from './ReaderComments';

export const LibraryReaderView: React.FC = () => {
  const { activePublicProject, setActiveView, setActivePublicProject, publicProjects, trackProjectView, recentlyRead, setRecentlyRead } = useApp();
  const { id } = useParams<{ id: string }>();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const hasTrackedView = useRef<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState<'text-base' | 'text-lg' | 'text-xl' | 'text-2xl'>('text-lg');
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'times'>('serif');
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
    <>
      <Helmet>
        <title>{`${activePublicProject.title} | Novelist`}</title>
        <meta name="description" content={activePublicProject.description || `Read ${activePublicProject.title} on Novelist.`} />
        <meta property="og:title" content={`${activePublicProject.title} | Novelist`} />
        <meta property="og:description" content={activePublicProject.description || `Read ${activePublicProject.title} on Novelist.`} />
        {activePublicProject.cover_url && <meta property="og:image" content={activePublicProject.cover_url} />}
      </Helmet>
      
      <div 
        className={`flex-1 overflow-y-auto relative transition-colors duration-300 ${
          theme === 'dark' ? 'bg-slate-950 text-slate-200' : 
          theme === 'light' ? 'bg-[#F9F9FB] text-slate-900' : 
          'bg-[#F9F9FB] dark:bg-slate-950 text-slate-900 dark:text-slate-200'
        } ${
          fontFamily === 'sans' ? 'font-sans' : 
          fontFamily === 'serif' ? 'font-serif' : ''
        }`}
        style={fontFamily === 'times' ? { fontFamily: '"Times New Roman", Times, serif' } : {}}
      >
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-16 relative z-10">
          
          <button 
            onClick={handleBack}
            className={`flex items-center gap-2 text-sm font-semibold mb-8 transition-colors ${
              theme === 'dark' ? 'text-slate-400 hover:text-slate-200' :
              theme === 'light' ? 'text-slate-500 hover:text-slate-800' :
              'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </button>

          <header className={`mb-16 pb-8 border-b transition-colors ${
            theme === 'dark' ? 'border-slate-800' :
            theme === 'light' ? 'border-slate-200' :
            'border-slate-200 dark:border-slate-800'
          }`}>
            <h2 className="text-lg font-bold truncate">{activePublicProject.title}</h2>
            <p className="text-xs font-sans text-slate-500 dark:text-slate-400">
              By {activePublicProject.author_name || 'Anonymous'}
            </p>
          </header>

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
              <article key={chapter.id}>
                <h1 className="text-3xl font-bold mb-8 text-center">{chapter.title}</h1>
                <div 
                  className={`prose prose-slate max-w-none prose-p:leading-relaxed prose-p:mb-6 ${fontSize} ${
                    theme === 'dark' ? 'prose-invert' :
                    theme === 'light' ? '' :
                    'dark:prose-invert'
                  }`}
                  dangerouslySetInnerHTML={{ __html: chapter.content || '' }} 
                />
                <ReaderComments projectId={activePublicProject.id} chapterId={chapter.id} />
              </article>
            ))}
            
            <ReaderReviews projectId={activePublicProject.id} />
            
            <div className="text-center pb-8 border-t border-slate-200 dark:border-slate-800">
              <p className="italic text-slate-500 mt-8">End of published content.</p>
            </div>
          </div>
        )}
      </div>

      {/* Settings Toggle Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-all z-40"
      >
        <Settings2 className="w-6 h-6" />
      </button>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed bottom-24 right-6 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5 z-40 text-slate-200 animate-in slide-in-from-bottom-2 fade-in">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Reading Settings</h3>
          
          {/* Theme */}
          <div className="mb-5">
            <label className="text-xs font-semibold mb-2 block text-slate-400">Theme</label>
            <div className="flex gap-2">
              <button onClick={() => setTheme('light')} className={`flex-1 py-1.5 rounded flex items-center justify-center border ${theme === 'light' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}><Sun className="w-4 h-4" /></button>
              <button onClick={() => setTheme('dark')} className={`flex-1 py-1.5 rounded flex items-center justify-center border ${theme === 'dark' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}><Moon className="w-4 h-4" /></button>
              <button onClick={() => setTheme('system')} className={`flex-1 py-1.5 rounded flex items-center justify-center border ${theme === 'system' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}><Monitor className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Font Family */}
          <div className="mb-5">
            <label className="text-xs font-semibold mb-2 block text-slate-400">Font</label>
            <div className="flex gap-2">
              <button onClick={() => setFontFamily('sans')} className={`flex-1 py-1.5 rounded text-sm font-sans border ${fontFamily === 'sans' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>Sans</button>
              <button onClick={() => setFontFamily('serif')} className={`flex-1 py-1.5 rounded text-sm font-serif border ${fontFamily === 'serif' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>Serif</button>
              <button onClick={() => setFontFamily('times')} className={`flex-1 py-1.5 rounded text-sm border ${fontFamily === 'times' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`} style={{ fontFamily: '"Times New Roman", Times, serif' }}>Times</button>
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="text-xs font-semibold mb-2 block text-slate-400">Size</label>
            <div className="flex gap-2">
              <button onClick={() => setFontSize('text-base')} className={`flex-1 py-1.5 rounded flex items-center justify-center border ${fontSize === 'text-base' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}><Type className="w-3 h-3" /></button>
              <button onClick={() => setFontSize('text-lg')} className={`flex-1 py-1.5 rounded flex items-center justify-center border ${fontSize === 'text-lg' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}><Type className="w-4 h-4" /></button>
              <button onClick={() => setFontSize('text-xl')} className={`flex-1 py-1.5 rounded flex items-center justify-center border ${fontSize === 'text-xl' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}><Type className="w-5 h-5" /></button>
              <button onClick={() => setFontSize('text-2xl')} className={`flex-1 py-1.5 rounded flex items-center justify-center border ${fontSize === 'text-2xl' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}><Type className="w-6 h-6" /></button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
};
