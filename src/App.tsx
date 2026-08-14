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
import { AdminView } from './components/Admin/AdminView';
import { Feather, Loader2 } from 'lucide-react';
import { Routes, Route, Navigate } from 'react-router-dom';

const WorkspaceContent: React.FC = () => {
  const { loading, activeProject, activeChapter } = useApp();

  if (loading && !activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-slate-400">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-medium">Loading workspace...</p>
      </div>
    );
  }

  const NoProjectView = () => (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-8">
      <Feather className="w-12 h-12 text-slate-700 mb-4 stroke-[1.5]" />
      <h3 className="text-lg font-medium text-slate-200">No Active Project</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm text-center">
        Create a new project from the sidebar to get started on your next masterpiece.
      </p>
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<HomeView />} />
      <Route path="/library" element={<LibraryView />} />
      <Route path="/library/novel/:id" element={<LibraryReaderView />} />
      <Route path="/saved" element={<SavedLibraryView />} />
      <Route path="/profile" element={<ProfileView />} />
      <Route path="/admin" element={<AdminView />} />
      
      {/* Project required routes */}
      <Route path="/editor" element={activeProject ? <EditorView key={activeChapter?.id} /> : <NoProjectView />} />
      <Route path="/planner" element={activeProject ? <PlannerView key={activeProject?.id} /> : <NoProjectView />} />
      <Route path="/tracker" element={activeProject ? <TrackerView key={activeProject?.id} /> : <NoProjectView />} />
      <Route path="/print" element={activeProject ? <PrintView /> : <NoProjectView />} />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
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

