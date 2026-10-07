import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { Chapter } from '../services/types';
import { FIND_HANDOFF_KEY, requestFind } from './uiEvents';

/** Open a chapter in the editor, optionally with a word already found in it. */
export const useOpenChapter = () => {
  const { activeChapter, setActiveChapter } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (chapter: Chapter, find?: string) => {
      const alreadyOpen = location.pathname === '/editor' && activeChapter?.id === chapter.id;
      // The find hand-off is read when the editor opens, so only leave one when the editor will open
      if (find && !alreadyOpen) {
        try {
          sessionStorage.setItem(FIND_HANDOFF_KEY, find);
        } catch {
          // the chapter still opens
        }
      }
      setActiveChapter(chapter);
      if (!alreadyOpen) navigate('/editor');
      else if (find) requestFind(find);
    },
    [activeChapter, location.pathname, navigate, setActiveChapter]
  );
};
