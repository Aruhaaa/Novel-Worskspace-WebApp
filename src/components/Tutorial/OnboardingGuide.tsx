// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useApp } from '../../context/AppContext';

export const OnboardingGuide: React.FC = () => {
  const { profile, updateProfile } = useApp();
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Only run if they haven't completed it before and we have loaded their profile
    if (profile && !profile.tutorial_completed) {
      // Slight delay to ensure the DOM is painted
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  const steps: any[] = [
    {
      target: 'body',
      content: 'Welcome to Novelist Workspace! Let us give you a quick 30-second tour to help you get started.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.tour-sidebar-nav',
      content: 'This is your main navigation. You can jump between your Dashboard, Editor, Planner, and Settings from here.',
      placement: 'right',
    },
    {
      target: '.tour-project-grid',
      content: 'Here are all your novels. You can click on one to start writing, or create a new project to begin a fresh story.',
      placement: 'top',
    },
    {
      target: '.tour-user-profile',
      content: 'Finally, you can customize your pen name, bio, and daily word-count goals here. Happy writing!',
      placement: 'right',
    }
  ];

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      updateProfile({ tutorial_completed: true });
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      // @ts-ignore - React Joyride types are strict on Styles
      styles={{
        options: {
          primaryColor: '#4f46e5', // Indigo-600
          backgroundColor: '#0f172a', // Slate-900
          textColor: '#f1f5f9', // Slate-100
          arrowColor: '#0f172a',
          overlayColor: 'rgba(0, 0, 0, 0.7)',
        },
        tooltipContainer: {
          textAlign: 'left',
          fontSize: '14px',
        },
        buttonNext: {
          backgroundColor: '#4f46e5',
          borderRadius: '6px',
        },
        buttonBack: {
          color: '#cbd5e1', // Slate-300
        },
        buttonSkip: {
          color: '#94a3b8', // Slate-400
        }
      }}
    />
  );
};
