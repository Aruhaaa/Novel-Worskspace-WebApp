import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Cloud, Check, Loader2, Feather, BarChart, Plus, FileText, ChevronRight, X, Maximize, Minimize } from 'lucide-react';

import { RichTextEditor } from './RichTextEditor';

export const EditorView: React.FC = () => {
  const { activeProject, chapters, activeChapter, setActiveChapter, updateChapter, createChapter, logWordCount, isSupabase, zenMode, setZenMode } = useApp();
  const [localTitle, setLocalTitle] = useState(activeChapter?.title || '');
  const [localContent, setLocalContent] = useState(activeChapter?.content || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');
  const [showNewChapterModal, setShowNewChapterModal] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  
  const saveTimeoutRef = useRef<number | null>(null);

  // Sync state if active chapter changes from outside
  useEffect(() => {
    if (activeChapter) {
      setLocalTitle(activeChapter.title || '');
      setLocalContent(activeChapter.content || '');
    }
  }, [activeChapter?.id]);

  // Clean timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const triggerAutosave = (updatedTitle: string, updatedContent: string) => {
    if (!activeChapter) return;
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        await updateChapter(activeChapter.id, {
          title: updatedTitle,
          content: updatedContent,
        });
        
        const wordCount = calculateWordCount(updatedContent);
        await logWordCount(wordCount);

        setSaveStatus('saved');
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('idle');
      }
    }, 1000);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalTitle(val);
    triggerAutosave(val, localContent);
  };

  const handleContentChange = (val: string) => {
    setLocalContent(val);
    triggerAutosave(localTitle, val);
  };

  const calculateWordCount = (text: string): number => {
    // Strip HTML tags for accurate word count
    const cleanedText = text.replace(/<[^>]*>?/gm, ' ');
    const cleaned = cleanedText.trim();
    if (!cleaned) return 0;
    return cleaned.split(/\s+/).filter(word => word.length > 0).length;
  };

  const calculateCharCount = (text: string): number => {
    const cleanedText = text.replace(/<[^>]*>?/gm, '');
    return cleanedText.length;
  };

  if (!activeChapter) {
    if (!activeProject) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-8">
          <Feather className="w-12 h-12 text-slate-600 mb-4 stroke-[1.5]" />
          <h3 className="text-lg font-medium text-slate-300">No Project Selected</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs text-center">
            Select a project from the Home Dashboard or Sidebar to view its chapters.
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col h-screen bg-slate-900 overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />
        
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 relative z-10 overflow-y-auto">
          <header className="mb-8 sm:mb-12">
            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
              Chapter Index
            </h1>
            <p className="text-slate-400">
              Manage and access all chapters for <span className="font-semibold text-slate-200">{activeProject.title}</span>.
            </p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Create New Chapter Card */}
            <div 
              onClick={() => setShowNewChapterModal(true)}
              className="group relative bg-slate-900/40 border-2 border-dashed border-slate-700/60 rounded-xl p-6 hover:bg-slate-800/40 hover:border-indigo-500/50 transition-all duration-300 flex flex-col items-center justify-center min-h-[160px] cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors mb-3">
                <Plus className="w-5 h-5" />
              </div>
              <span className="font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">
                Create New Chapter
              </span>
            </div>

            {/* Existing Chapters */}
            {chapters.map((chap, idx) => (
              <div 
                key={chap.id}
                onClick={() => setActiveChapter(chap)}
                className="group relative bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl p-6 hover:bg-slate-800/80 hover:border-indigo-500/50 transition-all duration-300 flex flex-col cursor-pointer overflow-hidden min-h-[160px]"
              >
                <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none" />
                
                <div className="flex items-center gap-3 text-indigo-400 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center font-bold text-xs">
                    {idx + 1}
                  </div>
                  <FileText className="w-4 h-4 opacity-70" />
                </div>
                
                <h3 className="text-lg font-bold text-slate-100 mb-auto line-clamp-2 group-hover:text-indigo-300 transition-colors">
                  {chap.title}
                </h3>
                
                <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-4 mt-4">
                  <span>{calculateWordCount(chap.content || '')} words</span>
                  <div className="flex items-center gap-1 text-indigo-400 font-semibold opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                    Write <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* New Chapter Modal */}
          {showNewChapterModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div 
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-6 border-b border-slate-800/60 bg-slate-900/50">
                  <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    New Chapter
                  </h3>
                  <button 
                    onClick={() => {
                      setShowNewChapterModal(false);
                      setNewChapterTitle('');
                    }}
                    className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newChapterTitle.trim()) return;
                    await createChapter(newChapterTitle.trim());
                    setShowNewChapterModal(false);
                    setNewChapterTitle('');
                  }}
                  className="p-6"
                >
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Chapter Title
                  </label>
                  <input
                    type="text"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder="e.g. Chapter 1: The Beginning"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors mb-6"
                    autoFocus
                  />
                  
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewChapterModal(false);
                        setNewChapterTitle('');
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newChapterTitle.trim()}
                      className="px-6 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/20"
                    >
                      Create Chapter
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const wordCount = calculateWordCount(localContent);
  const charCount = calculateCharCount(localContent);

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-900 overflow-hidden">
      {/* Editor Header */}
      <header className="h-16 border-b border-slate-800/80 px-4 sm:px-8 flex items-center justify-between shrink-0 bg-slate-900/50 backdrop-blur-md">
        <div className="flex-1 max-w-xl">
          <input
            type="text"
            value={localTitle}
            onChange={handleTitleChange}
            placeholder="Untitled Chapter"
            className="w-full bg-transparent text-slate-100 text-lg font-semibold focus:outline-none border-b border-transparent hover:border-slate-800 focus:border-indigo-500 transition-colors py-0.5"
          />
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          {/* Zen Mode Toggle */}
          <button 
            onClick={() => setZenMode(!zenMode)}
            className={`p-1.5 rounded-lg transition-colors flex items-center gap-2 text-xs font-semibold ${zenMode ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
            title={zenMode ? "Exit Zen Mode" : "Enter Zen Mode"}
          >
            {zenMode ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            <span className="hidden sm:inline">Zen Mode</span>
          </button>

          {/* Autosave Status Badge */}
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/80 border border-slate-800/50 px-3.5 py-1.5 rounded-full select-none">
            {saveStatus === 'saved' && (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Saved {isSupabase ? 'to Cloud' : 'locally'}</span>
                <span className="sm:hidden">Saved</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span>Saving...</span>
              </>
            )}
            {saveStatus === 'idle' && (
              <>
                <Cloud className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Changes pending</span>
                <span className="sm:hidden">Pending</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Editor Writing Board */}
      <main className="flex-1 overflow-hidden px-2 sm:px-8 py-4 sm:py-8 flex justify-center bg-[#F9F9FB] dark:bg-slate-900 transition-colors">
        <div className="w-full max-w-3xl flex flex-col h-full relative">
          <RichTextEditor 
            content={localContent} 
            onChange={handleContentChange} 
          />
        </div>
      </main>

      {/* Editor Footer / Info Bar */}
      <footer className="h-11 border-t border-slate-800/60 bg-slate-950/60 backdrop-blur-sm shrink-0 px-4 sm:px-8 flex items-center justify-between text-xs text-slate-500 select-none">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Feather className="w-3.5 h-3.5" />
            <strong>{wordCount}</strong> words
          </span>
          <span className="flex items-center gap-1.5">
            <BarChart className="w-3.5 h-3.5" />
            <strong>{charCount}</strong> characters
          </span>
        </div>
        <div className="text-[11px] font-medium tracking-wide text-slate-600">
          Focus Mode Active
        </div>
      </footer>
    </div>
  );
};
