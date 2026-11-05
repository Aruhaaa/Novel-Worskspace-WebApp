import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { isTourDone, markTourDone, onStartTour, type TourName } from '../../lib/tour';
import { isSampleProject } from '../../lib/sample';
import { Tour, type TourStep } from './Tour';
import { mark } from '../../i18n';

/** Decides when a tour should appear: once for a new writer, and again whenever they ask for it. */
export const TourHost: React.FC = () => {
  const { user, loading, projects, activeProject, activeChapter, isGuest, createSampleProject } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [running, setRunning] = useState<TourName | null>(null);
  const userId = user?.id;

  // A writer who already has projects has found their way around: never interrupt them unasked
  // This runs once per sign-in, so a sample project made during the welcome tour still gets the workspace tour
  const checkedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || loading || checkedFor.current === userId) return;
    checkedFor.current = userId;
    if (projects.length > 0) {
      markTourDone(userId, 'welcome');
      markTourDone(userId, 'workspace');
    }
  }, [userId, loading, projects.length]);

  // A new writer sees the welcome tour on Home, and the workspace tour the first time a chapter opens
  useEffect(() => {
    if (!userId || loading || running) return;
    let want: TourName | null = null;
    if (location.pathname === '/' && projects.length === 0 && !isTourDone(userId, 'welcome')) want = 'welcome';
    else if (location.pathname === '/editor' && activeProject && activeChapter && !isTourDone(userId, 'workspace')) want = 'workspace';
    if (!want) return;
    const t = window.setTimeout(() => setRunning(want), 800);
    return () => window.clearTimeout(t);
  }, [userId, loading, running, location.pathname, projects.length, activeProject, activeChapter]);

  // "Take the tour" in the profile menu
  useEffect(
    () =>
      onStartTour((name) => {
        if (name === 'welcome' && location.pathname !== '/') navigate('/');
        if (name === 'workspace' && location.pathname !== '/editor') navigate(activeProject ? '/editor' : '/');
        // Give the page a moment to show what the tour points at
        window.setTimeout(() => setRunning(name), 500);
      }),
    [location.pathname, navigate, activeProject]
  );

  const steps = useMemo<TourStep[] | null>(() => {
    if (running === 'welcome') {
      return [
        {
          title: mark('Welcome to Novelist Workspace'),
          body: mark('A quiet place to plan, write and finish a novel. This is a two-minute look around. Skip it any time.'),
        },
        {
          target: '.studio-sidebar a[href="#/manuscripts"]',
          placement: 'right',
          title: mark('Your manuscripts'),
          body: mark('Every project lives here. Open one and it gets its own workspace: the manuscript, a story outline and a world notebook.'),
        },
        {
          target: '.studio-sidebar a[href="#/library"]',
          placement: 'right',
          title: mark('The public library'),
          body: mark("Read what other writers publish. When you're ready, publish your own. You choose when, and you can take it down again."),
        },
        {
          target: '.search-button',
          placement: 'bottom',
          title: mark('Find anything'),
          body: mark('Press Ctrl K to jump to a chapter, a character or a word in your text, or to jot down an idea.'),
        },
        {
          target: '[aria-label="Open profile menu"]',
          placement: 'bottom',
          title: mark('Your corner'),
          body: mark('Themes and your writing font are in Preferences. Your progress, messages and the Windows and Android apps are here too.'),
        },
        {
          title: mark('Want a look around first?'),
          body: mark('We can set up a small sample project with chapters, a notebook and an outline already in it, so you can see how the pieces fit. Remove it whenever you like.'),
          action: isGuest || projects.some((p) => isSampleProject(p.id))
            ? undefined
            : {
                label: mark('Open the sample project'),
                run: async () => {
                  const sample = await createSampleProject();
                  if (sample) navigate('/editor');
                },
              },
        },
      ];
    }
    if (running === 'workspace') {
      return [
        {
          target: '.studio-sidebar .studio-nav',
          placement: 'right',
          title: mark('Three rooms for one book'),
          body: mark('Manuscript is where you write. Story outline plans your scenes, as a board or a timeline. World notebook keeps your characters, places and lore.'),
        },
        {
          target: '.studio-sidebar .chapter-list',
          placement: 'right',
          title: mark('Your chapters'),
          body: mark('Jump between chapters here. The Chapter index lets you drag them into a new order and mark each as drafting, revising or done.'),
        },
        {
          target: '.tools',
          placement: 'bottom',
          title: mark('Write'),
          body: mark('Format your text, change your writing font, and find and replace. Type @ to mention a character or place from your notebook.'),
        },
        {
          target: '.studio-toolbar .toolbar-actions',
          placement: 'bottom',
          title: mark('History, export and publish'),
          body: mark('History keeps older versions of this chapter. More has export and Jot an idea. Publish shares the novel only when you choose.'),
        },
        {
          target: '.studio-context',
          placement: 'left',
          title: mark('In the margins'),
          body: mark("Set this chapter's status, write a synopsis and private notes, and see who is on the page. Click a name for a quick look."),
        },
        {
          target: '.save-status',
          placement: 'top',
          title: mark('Saved as you go'),
          body: mark('Your words save automatically, and a copy stays on this device until the save is confirmed. If a save ever fails, this says so.'),
        },
      ];
    }
    return null;
  }, [running, isGuest, projects, createSampleProject, navigate]);

  if (!running || !steps || !userId) return null;

  return (
    <Tour
      key={running}
      steps={steps}
      onClose={() => {
        markTourDone(userId, running);
        setRunning(null);
      }}
    />
  );
};
