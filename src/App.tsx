import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Dashboard/Sidebar';
import { EditorView } from './components/Editor/EditorView';
import { PlannerView } from './components/Planner/PlannerView';
import { HomeView } from './components/Dashboard/HomeView';
import { TrackerView } from './components/Tracker/TrackerView';
import { AuthView } from './components/Auth/AuthView';
import { LibraryView } from './components/Library/LibraryView';
import { SavedLibraryView } from './components/Library/SavedLibraryView';
import { LibraryReaderView } from './components/Library/LibraryReaderView';
import { ProfileView } from './components/Profile/ProfileView';
import { PrintView } from './components/Export/PrintView';
import { Feather, Loader2 } from 'lucide-react';

const WorkspaceContent: React.FC = () => {
  const { activeView, loading, activeProject, activeChapter } = useApp();

  if (activeView === 'home') {
    return <HomeView />;
  }

  if (activeView === 'library') {
    return <LibraryView />;
  }

  if (activeView === 'saved_library') {
    return <SavedLibraryView />;
  }

  if (activeView === 'reader') {
    return <LibraryReaderView />;
  }

  if (activeView === 'profile') {
    return <ProfileView />;
  }

  if (activeView === 'print') {
    return <PrintView />;
  }

  if (loading && !activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-slate-400">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-medium">Loading workspace...</p>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-8">
        <Feather className="w-12 h-12 text-slate-700 mb-4 stroke-[1.5]" />
        <h3 className="text-lg font-medium text-slate-200">No Active Project</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm text-center">
          Create a new project from the sidebar to get started on your next masterpiece.
        </p>
      </div>
    );
  }

  switch (activeView) {
    case 'editor':
      return <EditorView key={activeChapter?.id} />;
    case 'planner':
      return <PlannerView key={activeProject?.id} />;
    case 'tracker':
      return <TrackerView key={activeProject?.id} />;
    default:
      return <EditorView key={activeChapter?.id} />;
  }
};

const AuthWrapper: React.FC = () => {
  const { user, loading } = useApp();

  if (loading && !user) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      <Sidebar />
      <WorkspaceContent />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AuthWrapper />
    </AppProvider>
  );
};

export default App;

