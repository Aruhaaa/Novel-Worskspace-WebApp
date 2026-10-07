import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Dashboard/Sidebar';
import { EditorView } from './components/Editor/EditorView';
import { ChapterIndexView } from './components/Editor/ChapterIndexView';
import { NotebookView } from './components/Planner/NotebookView';
import { OutlineView } from './components/Planner/OutlineView';
import { HomeView } from './components/Dashboard/HomeView';
import { ManuscriptsView } from './components/Dashboard/ManuscriptsView';
import { TrackerView } from './components/Tracker/TrackerView';
import { AuthView } from './components/Auth/AuthView';
import { LibraryView } from './components/Library/LibraryView';
import { ReaderHomeView } from './components/Library/ReaderHomeView';
import { ModeChooser } from './components/Auth/ModeChooser';
import { openingPath } from './lib/mode';
import { SavedLibraryView } from './components/Library/SavedLibraryView';
import { LibraryReaderView } from './components/Library/LibraryReaderView';
import { ProfileView } from './components/Profile/ProfileView';
import { PrintView } from './components/Export/PrintView';
import { AdminView } from './components/Admin/AdminView';
import { PublicProfileView } from './components/Profile/PublicProfileView';
import { MessagesView } from './components/Chat/MessagesView';
import { LandingView } from './components/Marketing/LandingView';
import { PreferencesView } from './components/Preferences/PreferencesView';
import { AppHeader } from './components/Dashboard/AppHeader';
import { EmptyState } from './components/ui/EmptyState';
import { CommandPalette } from './components/Search/CommandPalette';
import { QuickCapture } from './components/Capture/QuickCapture';
import { onOpenCapture, onOpenSearch } from './lib/uiEvents';
import { ToastProvider } from './components/ui/Toast';
import { TourHost } from './components/Tour/TourHost';
import { SharedReaderView } from './components/Share/SharedReaderView';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';

const PROJECT_ROUTES = ['/editor', '/chapters', '/outline', '/notebook', '/tracker', '/print'];

const WorkspaceContent: React.FC = () => {
  const { loading, activeProject, activeChapter, mode } = useApp();
  const location = useLocation();

  const isProjectRoute = PROJECT_ROUTES.includes(location.pathname);

  if (loading && !activeProject && isProjectRoute) {
    return (
      <div className="studio-view">
        <div className="page">
          <p className="meta" role="status">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  const noProject = (
    <div className="studio-view">
      <div className="page">
        <EmptyState
          icon="pen"
          title="No project selected"
          text="Choose a project from your manuscripts to start writing, or start a new one."
        >
          <Link className="small-btn is-primary" to="/manuscripts">Choose a project</Link>
        </EmptyState>
      </div>
    </div>
  );

  return (
    <Routes>
      {/* The front door: readers open to something to read, writers to the studio */}
      <Route path="/" element={<Navigate to={openingPath(mode)} replace />} />
      <Route path="/read" element={<ReaderHomeView />} />
      <Route path="/write" element={<HomeView />} />
      <Route path="/manuscripts" element={<ManuscriptsView />} />
      <Route path="/library" element={<LibraryView />} />
      <Route path="/library/novel/:id" element={<LibraryReaderView />} />
      <Route path="/library/author/:id" element={<PublicProfileView />} />
      <Route path="/saved" element={<SavedLibraryView />} />
      <Route path="/profile" element={<ProfileView />} />
      <Route path="/messages" element={<MessagesView />} />
      <Route path="/messages/:id" element={<MessagesView />} />
      <Route path="/admin" element={<AdminView />} />
      <Route path="/preferences" element={<PreferencesView />} />

      {/* Project required routes */}
      <Route path="/editor" element={activeProject ? <EditorView key={activeChapter?.id} /> : noProject} />
      <Route path="/chapters" element={activeProject ? <ChapterIndexView /> : noProject} />
      <Route path="/outline" element={activeProject ? <OutlineView key={activeProject?.id} /> : noProject} />
      <Route path="/notebook" element={activeProject ? <NotebookView key={activeProject?.id} /> : noProject} />
      <Route path="/planner" element={<Navigate to="/notebook" replace />} />
      <Route path="/tracker" element={activeProject ? <TrackerView key={activeProject?.id} /> : noProject} />
      <Route path="/print" element={activeProject ? <PrintView /> : noProject} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

/** Which kind of page the stylesheet should lay out: marketing, sign-in, or the studio shell. */
const useBodyMode = (mode: 'landing' | 'auth' | 'app' | 'shared', focused: boolean) => {
  React.useEffect(() => {
    const body = document.body;
    body.classList.remove('landing', 'studio-page', 'app', 'is-focused');
    if (mode === 'landing') body.classList.add('landing');
    if (mode === 'app') body.classList.add('studio-page', 'app');
    if (mode === 'app' && focused) body.classList.add('is-focused');
    return () => body.classList.remove('landing', 'studio-page', 'app', 'is-focused');
  }, [mode, focused]);
};

const AuthWrapper: React.FC = () => {
  const { user, loading, zenMode, activeView, activeProject, isGuest, mode } = useApp();
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [capture, setCapture] = React.useState<{ open: boolean; text: string }>({ open: false, text: '' });
  const signedIn = !!user;

  // Ctrl/Cmd+K opens search anywhere; the header button and editor menu use the same hand-offs
  React.useEffect(() => {
    if (!signedIn) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    const offSearch = onOpenSearch(() => setSearchOpen(true));
    const offCapture = onOpenCapture((text) => setCapture({ open: true, text }));
    return () => {
      document.removeEventListener('keydown', onKey);
      offSearch();
      offCapture();
    };
  }, [signedIn]);

  // A private reading link works for anyone, signed in or not, and shows no app chrome
  const isShared = location.pathname.startsWith('/read/');
  // Someone signed in on a device that has not been asked yet gets the one question first
  const needsMode = !!user && !isGuest && !mode;
  const bodyMode: 'landing' | 'auth' | 'app' | 'shared' = isShared ? 'shared' : needsMode ? 'auth' : user ? 'app' : location.pathname === '/' ? 'landing' : 'auth';
  useBodyMode(bodyMode, zenMode);

  if (isShared) {
    return (
      <Routes>
        <Route path="/read/:token" element={<SharedReaderView />} />
      </Routes>
    );
  }

  if (loading && !user) {
    return (
      <div className="auth-wrap" role="status">
        <p className="meta" style={{ margin: 'auto' }}>Opening the studio…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingView />} />
        <Route path="/login" element={<AuthView />} />
        {/* If they hit a protected route while logged out, send them to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (needsMode) return <ModeChooser />;

  const hasContext = !!activeProject && ['editor', 'outline', 'notebook'].includes(activeView);

  return (
    <>
      <AppHeader onOpenMenu={() => setSidebarOpen(true)} menuOpen={isSidebarOpen} />
      <div className={`studio-layout${hasContext ? '' : ' no-context'}`}>
        <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="studio-main" id="studio-main" tabIndex={-1}>
          <WorkspaceContent />
        </main>
        <div id="context-slot" style={{ display: 'contents' }} />
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickCapture open={capture.open} initial={capture.text} onClose={() => setCapture({ open: false, text: '' })} />
      <TourHost />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppProvider>
        <AuthWrapper />
      </AppProvider>
    </ToastProvider>
  );
};

export default App;
