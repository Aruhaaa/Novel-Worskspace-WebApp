import React, { Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LiveProvider } from './context/LiveContext';
import { Sidebar } from './components/Dashboard/Sidebar';
import { AppHeader } from './components/Dashboard/AppHeader';
import { LandingView } from './components/Marketing/LandingView';
import { ModeChooser } from './components/Auth/ModeChooser';
import { openingPath } from './lib/mode';
import { EmptyState } from './components/ui/EmptyState';
import { AppErrorBoundary } from './components/ui/AppErrorBoundary';
import { UpdateNotice } from './components/Desktop/UpdateNotice';
import { onOpenCapture, onOpenSearch } from './lib/uiEvents';
import { ToastProvider } from './components/ui/Toast';
import { TourHost } from './components/Tour/TourHost';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { takePendingJoin } from './lib/pendingJoin';

/**
 * Each screen is downloaded the first time it is opened, so a first visit loads only what it shows.
 * `prefetchScreens` below fetches the rest quietly once the app is idle, so it still opens offline.
 */
const loaders = {
  editor: () => import('./components/Editor/EditorView'),
  chapters: () => import('./components/Editor/ChapterIndexView'),
  notebook: () => import('./components/Planner/NotebookView'),
  outline: () => import('./components/Planner/OutlineView'),
  home: () => import('./components/Dashboard/HomeView'),
  manuscripts: () => import('./components/Dashboard/ManuscriptsView'),
  tracker: () => import('./components/Tracker/TrackerView'),
  auth: () => import('./components/Auth/AuthView'),
  reset: () => import('./components/Auth/ResetPasswordView'),
  library: () => import('./components/Library/LibraryView'),
  readerHome: () => import('./components/Library/ReaderHomeView'),
  saved: () => import('./components/Library/SavedLibraryView'),
  reader: () => import('./components/Library/LibraryReaderView'),
  profile: () => import('./components/Profile/ProfileView'),
  print: () => import('./components/Export/PrintView'),
  admin: () => import('./components/Admin/AdminView'),
  author: () => import('./components/Profile/PublicProfileView'),
  messages: () => import('./components/Chat/MessagesView'),
  notifications: () => import('./components/Notifications/NotificationsView'),
  preferences: () => import('./components/Preferences/PreferencesView'),
  shared: () => import('./components/Share/SharedReaderView'),
  join: () => import('./components/Collab/JoinProjectView'),
  search: () => import('./components/Search/CommandPalette'),
  capture: () => import('./components/Capture/QuickCapture'),
};

const EditorView = lazy(() => loaders.editor().then((m) => ({ default: m.EditorView })));
const ChapterIndexView = lazy(() => loaders.chapters().then((m) => ({ default: m.ChapterIndexView })));
const NotebookView = lazy(() => loaders.notebook().then((m) => ({ default: m.NotebookView })));
const OutlineView = lazy(() => loaders.outline().then((m) => ({ default: m.OutlineView })));
const HomeView = lazy(() => loaders.home().then((m) => ({ default: m.HomeView })));
const ManuscriptsView = lazy(() => loaders.manuscripts().then((m) => ({ default: m.ManuscriptsView })));
const TrackerView = lazy(() => loaders.tracker().then((m) => ({ default: m.TrackerView })));
const AuthView = lazy(() => loaders.auth().then((m) => ({ default: m.AuthView })));
const ResetPasswordView = lazy(() => loaders.reset().then((m) => ({ default: m.ResetPasswordView })));
const LibraryView = lazy(() => loaders.library().then((m) => ({ default: m.LibraryView })));
const ReaderHomeView = lazy(() => loaders.readerHome().then((m) => ({ default: m.ReaderHomeView })));
const SavedLibraryView = lazy(() => loaders.saved().then((m) => ({ default: m.SavedLibraryView })));
const LibraryReaderView = lazy(() => loaders.reader().then((m) => ({ default: m.LibraryReaderView })));
const ProfileView = lazy(() => loaders.profile().then((m) => ({ default: m.ProfileView })));
const PrintView = lazy(() => loaders.print().then((m) => ({ default: m.PrintView })));
const AdminView = lazy(() => loaders.admin().then((m) => ({ default: m.AdminView })));
const PublicProfileView = lazy(() => loaders.author().then((m) => ({ default: m.PublicProfileView })));
const MessagesView = lazy(() => loaders.messages().then((m) => ({ default: m.MessagesView })));
const NotificationsView = lazy(() => loaders.notifications().then((m) => ({ default: m.NotificationsView })));
const PreferencesView = lazy(() => loaders.preferences().then((m) => ({ default: m.PreferencesView })));
const SharedReaderView = lazy(() => loaders.shared().then((m) => ({ default: m.SharedReaderView })));
const JoinProjectView = lazy(() => loaders.join().then((m) => ({ default: m.JoinProjectView })));
const CommandPalette = lazy(() => loaders.search().then((m) => ({ default: m.CommandPalette })));
const QuickCapture = lazy(() => loaders.capture().then((m) => ({ default: m.QuickCapture })));

/** Fetch every screen quietly once the app is idle, so the app still opens without a connection after one online visit. */
const prefetchScreens = () => {
  // Someone who asked their browser to save data, or is on a very slow connection, gets screens only as they open them
  const connection = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;
  const run = () => Object.values(loaders).forEach((load) => void load().catch(() => undefined));
  // Not every browser has requestIdleCallback
  const idle = (window as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle.call(window, run, { timeout: 8000 });
  else window.setTimeout(run, 3000);
};

const ScreenLoading: React.FC = () => (
  <div className="studio-view">
    <div className="page">
      <p className="meta" role="status">Loading…</p>
    </div>
  </div>
);

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
    <AppErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<ScreenLoading />}>
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
          <Route path="/notifications" element={<NotificationsView />} />
          <Route path="/admin" element={<AdminView />} />
          <Route path="/preferences" element={<PreferencesView />} />
          <Route path="/join/:token" element={<JoinProjectView />} />

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
      </Suspense>
    </AppErrorBoundary>
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
  const { user, loading, zenMode, activeView, activeProject, isGuest, mode, recovering } = useApp();
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

  // Once someone is signed in, fetch the other screens in the background
  React.useEffect(() => {
    if (signedIn) prefetchScreens();
  }, [signedIn]);

  // A private reading link works for anyone, signed in or not, and shows no app chrome
  const isShared = location.pathname.startsWith('/read/');
  // Someone signed in on a device that has not been asked yet gets the one question first
  const needsMode = !!user && !isGuest && !mode;
  // Someone who came from a password-reset email chooses a new password before anything else
  const resetting = recovering && !!user && !isGuest;
  const bodyMode: 'landing' | 'auth' | 'app' | 'shared' = isShared ? 'shared' : needsMode || resetting ? 'auth' : user ? 'app' : location.pathname === '/' ? 'landing' : 'auth';
  useBodyMode(bodyMode, zenMode);

  // An invitation link opened while signed out is picked up again once the person is signed in, has answered the one question,
  // and the app has settled on its opening page. (Signing in passes through a few redirects of its own, which would undo a
  // move made sooner.) The token is only taken when the move is made, so a cancelled wait loses nothing.
  const navigate = useNavigate();
  React.useEffect(() => {
    if (!user || isGuest || needsMode || resetting || !mode) return;
    if (location.pathname !== openingPath(mode)) return;
    const timer = window.setTimeout(() => {
      const token = takePendingJoin();
      if (token) navigate(`/join/${token}`);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [user, isGuest, needsMode, resetting, mode, location.pathname, navigate]);

  if (isShared) {
    return (
      <AppErrorBoundary>
        <Suspense fallback={<ScreenLoading />}>
          <Routes>
            <Route path="/read/:token" element={<SharedReaderView />} />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
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
      <AppErrorBoundary>
        <Suspense fallback={<ScreenLoading />}>
          <Routes>
            <Route path="/" element={<LandingView />} />
            <Route path="/login" element={<AuthView />} />
            {/* An invitation link opened by someone not signed in: it says what it is for, then sends them to sign in */}
            <Route path="/join/:token" element={<JoinProjectView />} />
            {/* If they hit a protected route while logged out, send them to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    );
  }

  if (resetting) {
    return (
      <Suspense fallback={<ScreenLoading />}>
        <ResetPasswordView />
      </Suspense>
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
      {searchOpen && (
        <Suspense fallback={null}>
          <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
      {capture.open && (
        <Suspense fallback={null}>
          <QuickCapture open={capture.open} initial={capture.text} onClose={() => setCapture({ open: false, text: '' })} />
        </Suspense>
      )}
      <TourHost />
      <UpdateNotice />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppProvider>
        <LiveProvider>
          <AuthWrapper />
        </LiveProvider>
      </AppProvider>
    </ToastProvider>
  );
};

export default App;
