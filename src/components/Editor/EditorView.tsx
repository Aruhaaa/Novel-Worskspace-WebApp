import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Cloud, Check, Loader2, Feather, BarChart } from 'lucide-react';

export const EditorView: React.FC = () => {
  const { activeChapter, updateChapter, logWordCount, isSupabase } = useApp();
  const [localTitle, setLocalTitle] = useState(activeChapter?.title || '');
  const [localContent, setLocalContent] = useState(activeChapter?.content || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');
  
  const saveTimeoutRef = useRef<number | null>(null);

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
        
        // Calculate total words in this chapter and log to word count logs
        const wordCount = calculateWordCount(updatedContent);
        await logWordCount(wordCount);

        setSaveStatus('saved');
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('idle');
      }
    }, 1000); // 1 second debounce
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalTitle(val);
    triggerAutosave(val, localContent);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalContent(val);
    triggerAutosave(localTitle, val);
  };

  const calculateWordCount = (text: string): number => {
    const cleaned = text.trim();
    if (!cleaned) return 0;
    return cleaned.split(/\s+/).length;
  };

  const calculateCharCount = (text: string): number => {
    return text.length;
  };

  if (!activeChapter) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-8">
        <Feather className="w-12 h-12 text-slate-600 mb-4 stroke-[1.5]" />
        <h3 className="text-lg font-medium text-slate-300">No Chapter Open</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xs text-center">
          Select an existing chapter from the sidebar or click the '+' button to begin writing.
        </p>
      </div>
    );
  }

  const wordCount = calculateWordCount(localContent);
  const charCount = calculateCharCount(localContent);

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-900 overflow-hidden">
      {/* Editor Header */}
      <header className="h-16 border-b border-slate-800/80 px-8 flex items-center justify-between shrink-0 bg-slate-900/50 backdrop-blur-md">
        <div className="flex-1 max-w-xl">
          <input
            type="text"
            value={localTitle}
            onChange={handleTitleChange}
            placeholder="Untitled Chapter"
            className="w-full bg-transparent text-slate-100 text-lg font-semibold focus:outline-none border-b border-transparent hover:border-slate-800 focus:border-indigo-500 transition-colors py-0.5"
          />
        </div>

        {/* Autosave Status Badge */}
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/80 border border-slate-800/50 px-3.5 py-1.5 rounded-full select-none">
          {saveStatus === 'saved' && (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saved {isSupabase ? 'to Cloud' : 'locally'}</span>
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
              <span>Changes pending</span>
            </>
          )}
        </div>
      </header>

      {/* Editor Writing Board */}
      <main className="flex-1 overflow-y-auto px-8 py-10 flex justify-center">
        <div className="w-full max-w-3xl flex flex-col h-full">
          <textarea
            value={localContent}
            onChange={handleContentChange}
            placeholder="Type your story here..."
            className="w-full flex-1 bg-transparent text-slate-200 focus:outline-none resize-none font-serif text-[19px] leading-[1.75] tracking-wide placeholder-slate-600 pb-24"
          />
        </div>
      </main>

      {/* Editor Footer / Info Bar */}
      <footer className="h-11 border-t border-slate-800/60 bg-slate-950/60 backdrop-blur-sm shrink-0 px-8 flex items-center justify-between text-xs text-slate-500 select-none">
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
