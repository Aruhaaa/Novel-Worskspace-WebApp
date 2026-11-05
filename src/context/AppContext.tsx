import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User, Project, Chapter, WikiEntity, WordCountLog, UserProfile, ImportInput, ImportResult } from '../services/types';
import { databaseService } from '../services/database';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { recoveryLink } from '../lib/recovery';
import { loadBlocks, addBlock, removeBlock } from '../lib/safety';
import { wipeDeviceData } from '../lib/accountData';
import { authService } from '../services/auth';
import { addToBin } from '../lib/bin';
import { localDate } from '../lib/dates';
import { countWords } from '../lib/text';
import { loadChapterMeta, saveChapterMeta, EMPTY_META, type ChapterMeta, type ChapterMetaMap } from '../lib/chapterMeta';
import { loadProjectGoal, saveProjectGoal, type ProjectGoal } from '../lib/projectGoal';
import { pushChapterNote, pushProjectGoal, syncChapterNotes, syncProjectGoal } from '../lib/cloudSync';
import { startDay, noteWords, markExisting, forgetChapter } from '../lib/dailyWords';
import { clearOfflineCache, isNetworkFailure } from '../lib/offlineCache';
import { getLastChapter, getLastProject, setLastChapter, setLastProject, forgetProject } from '../lib/lastOpened';
import { createSampleProject as buildSampleProject, forgetSample } from '../lib/sample';
import { loadMode, saveMode, spaceOfView, openingSpace, type UseMode, type Space } from '../lib/mode';
import { can, listSharedProjects, sharedProjectIds, type Role, type SharedProject } from '../lib/collab';

interface AppContextType {
  user: User | null;
  profile: UserProfile | null;
  projects: Project[];
  activeProject: Project | null;
  chapters: Chapter[];
  activeChapter: Chapter | null;
  entities: WikiEntity[];
  wordCountLogs: WordCountLog[];
  chapterMeta: ChapterMetaMap;
  projectGoal: ProjectGoal | null;
  /** Projects other people have shared with this person */
  sharedProjects: SharedProject[];
  /** What this person may do in the open project: the owner does everything, others by their role */
  projectRole: Role;
  /** True when the open project has other people on it, or this person is one of them */
  projectIsShared: boolean;
  /** Which of this person's own projects have other people on them */
  sharedProjectIds: string[];
  /** Look again at who has shared what (after joining, leaving, or inviting someone) */
  refreshShared: () => Promise<void>;
  /** A chapter changed somewhere else (another person saved it): show the new copy */
  applyRemoteChapter: (chapter: Chapter) => void;
  publicProjects: Project[];
  activePublicProject: Project | null;
  activeView: 'home' | 'manuscripts' | 'editor' | 'notebook' | 'outline' | 'tracker' | 'library' | 'saved_library' | 'reader' | 'profile' | 'messages' | 'print' | 'admin' | 'preferences' | 'read_home' | 'notifications';
  loading: boolean;
  isGuest: boolean;
  /** Read, write or both: set once at sign-up, decides which space opens first. Guests are readers. */
  mode: UseMode | null;
  setMode: (mode: UseMode) => void;
  /** The space the person is in now (account screens keep the space they came from) */
  space: Space;
  isSupabase: boolean;
  zenMode: boolean;
  setZenMode: (val: boolean) => void;
  recentlyRead: string[];
  setRecentlyRead: (val: string[]) => void;
  login: (email: string, password: string) => Promise<{error: string | null}>;
  /** Browse as a guest. Goes to `to` if given, otherwise to the front door. */
  loginAsGuest: (to?: string) => void;
  signup: (email: string, password: string) => Promise<{error: string | null, message?: string | null}>;
  logout: () => Promise<void>;
  /** True while someone who followed a password-reset link still has to choose a new password */
  recovering: boolean;
  /** Shown on the sign-in screen when a reset link could not be used */
  recoveryNotice: string | null;
  changePassword: (password: string) => Promise<{error: string | null}>;
  finishRecovery: () => void;
  /** Permanently remove the account and everything in it. Asks for the password again when there is a cloud database. */
  deleteAccount: (password: string) => Promise<{error: string | null}>;
  /** People this person has blocked: what they write is hidden, and they cannot message each other */
  blockedIds: string[];
  blockUser: (userId: string) => Promise<{saved: 'saved' | 'device-only'}>;
  unblockUser: (userId: string) => Promise<{saved: 'saved' | 'device-only'}>;
  setActiveView: (view: 'home' | 'manuscripts' | 'editor' | 'notebook' | 'outline' | 'tracker' | 'library' | 'saved_library' | 'reader' | 'profile' | 'messages' | 'print' | 'admin' | 'preferences' | 'read_home' | 'notifications') => void;
  setActiveProject: (project: Project) => void;
  setActiveChapter: (chapter: Chapter | null) => void;
  setActivePublicProject: (project: Project | null) => void;
  loadProjects: (userId: string) => Promise<void>;
  loadPublicProjects: () => Promise<void>;
  loadProjectData: (projectId: string) => Promise<void>;
  createProject: (title: string, description: string) => Promise<void>;
  createExternalProject: (title: string, authorName: string, description: string, genre: string, coverUrl: string) => Promise<{error: string | null}>;
  publishProject: (projectId: string, isPublished: boolean, authorName: string) => Promise<void>;
  updateProjectSettings: (projectId: string, fields: Partial<Pick<Project, 'title' | 'description' | 'cover_url' | 'genre' | 'author_name'>>) => Promise<void>;
  toggleLikeProject: (projectId: string) => Promise<void>;
  trackProjectView: (projectId: string) => Promise<void>;
  updateProfile: (fields: Partial<UserProfile>) => Promise<{error: string | null}>;
  toggleFollow: (targetUserId: string) => Promise<boolean>;
  createChapter: (title: string) => Promise<void>;
  updateChapter: (chapterId: string, fields: Partial<Pick<Chapter, 'title' | 'content' | 'position'>>) => Promise<void>;
  /** Returns the chapter's id in the Recently deleted bin, so the delete can be undone */
  deleteChapter: (chapterId: string) => Promise<number | string | undefined>;
  restoreDeletedChapter: (title: string, content: string, meta?: ChapterMeta, position?: number) => Promise<void>;
  /** Save an imported manuscript into a new project, or after the last chapter of the open one. All of it or none of it. */
  importManuscript: (input: ImportInput) => Promise<ImportResult>;
  /** Take an import back: the whole new project, or just the chapters it added. Nothing goes to Recently deleted. */
  undoImport: (result: ImportResult) => Promise<{error: string | null}>;
  createSampleProject: () => Promise<Project | null>;
  deleteProject: (projectId: string) => Promise<void>;
  reorderChapters: (orderedIds: string[]) => Promise<void>;
  updateChapterMeta: (chapterId: string, patch: Partial<ChapterMeta>) => void;
  setProjectGoal: (goal: ProjectGoal | null) => void;
  recordWriting: (chapterId: string, words: number) => Promise<void>;
  createEntity: (name: string, type: WikiEntity['type'], description: string, content: Record<string, string>, imageUrl?: string) => Promise<void>;
  updateEntity: (entityId: string, fields: Partial<Pick<WikiEntity, 'name' | 'type' | 'description' | 'content' | 'image_url'>>) => Promise<WikiEntity | undefined>;
  deleteEntity: (entityId: string) => Promise<void>;
  logWordCount: (count: number, dateStr?: string) => Promise<void>;
}

/** The words an error carries, whether it is an Error or a plain object from the database client. */
const messageOf = (err: unknown, fallback: string): string => {
  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message ? message : fallback;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

/** What to tell a writer when an import could not be saved. Nothing is kept in that case. */
const importFailure = (err: unknown): string => {
  const e = err as { name?: unknown; message?: unknown } | null;
  if (e?.name === 'QuotaExceededError' || /quota/i.test(String(e?.message ?? ''))) {
    return 'There is not enough room in this browser to keep that manuscript, so nothing was imported. Free up some space or import fewer chapters, then try again.';
  }
  if (isNetworkFailure(err)) return 'Could not reach the server, so nothing was imported. Check your connection and try again.';
  return 'The import could not be saved, so nothing was imported. Try again, or import fewer chapters at a time.';
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [entities, setEntities] = useState<WikiEntity[]>([]);
  const [wordCountLogs, setWordCountLogs] = useState<WordCountLog[]>([]);
  const [chapterMeta, setChapterMeta] = useState<ChapterMetaMap>({});
  // An undo can run seconds after the click, so it reads the latest chapters rather than the ones it was created with
  const chaptersRef = useRef<Chapter[]>([]);
  const chapterMetaRef = useRef<ChapterMetaMap>({});
  const openProjectRef = useRef<string | null>(null);
  const noteTimers = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);
  // Likewise for an import that is undone a few seconds later, after other projects may have come and gone
  const projectsRef = useRef<Project[]>([]);
  const activeProjectRef = useRef<Project | null>(null);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);
  useEffect(() => {
    activeProjectRef.current = activeProject;
  }, [activeProject]);
  const [projectGoal, setProjectGoalState] = useState<ProjectGoal | null>(null);
  // Shared projects: the ones other people have shared with this person, and which of this person's own have other people on them
  const [sharedProjects, setSharedProjects] = useState<SharedProject[]>([]);
  const [sharedIds, setSharedIds] = useState<string[]>([]);
  // Whose "open the project that was open last time" has been done for the shared projects, so it happens once per sign-in
  const restoredSharedFor = useRef<string | null>(null);
  const [publicProjects, setPublicProjects] = useState<Project[]>([]);
  const [activePublicProject, setActivePublicProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [modeVersion, setModeVersion] = useState(0);
  const [lastSpace, setLastSpace] = useState<Space | null>(null);
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [recovering, setRecovering] = useState<boolean>(recoveryLink === 'recovery');
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(
    recoveryLink === 'expired' ? 'That reset link has expired or was already used. Enter your email to get a new one.' : null
  );
  // Tagged with whose list it is, so a different person signing in never sees the last person's blocks
  const [blockedList, setBlockedList] = useState<{ owner: string; ids: string[] }>({ owner: '', ids: [] });
  const [recentlyRead, setRecentlyReadState] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('novelist_recently_read');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const setRecentlyRead = (val: string[]) => {
    setRecentlyReadState(val);
    localStorage.setItem('novelist_recently_read', JSON.stringify(val));
  };
  
  const navigate = useNavigate();
  const location = useLocation();

  type ViewType = 'home' | 'manuscripts' | 'editor' | 'notebook' | 'outline' | 'tracker' | 'library' | 'saved_library' | 'reader' | 'profile' | 'messages' | 'print' | 'admin' | 'preferences' | 'read_home' | 'notifications';

  const getActiveView = (): ViewType => {
    const path = location.pathname;
    if (path === '/' || path === '/write') return 'home';
    if (path === '/read') return 'read_home';
    if (path === '/manuscripts') return 'manuscripts';
    if (path.startsWith('/library/novel/')) return 'reader';
    if (path === '/library' || path.startsWith('/library/author/')) return 'library';
    if (path === '/saved') return 'saved_library';
    if (path === '/editor' || path === '/chapters') return 'editor';
    if (path === '/notebook' || path === '/planner') return 'notebook';
    if (path === '/outline') return 'outline';
    if (path === '/tracker') return 'tracker';
    if (path.startsWith('/messages')) return 'messages';
    if (path === '/notifications') return 'notifications';
    if (path === '/profile') return 'profile';
    if (path === '/print') return 'print';
    if (path === '/admin') return 'admin';
    if (path === '/preferences') return 'preferences';
    return 'home';
  };

  const activeView = getActiveView();

  // The choice follows the account to any device; this device's own copy is the fallback. Both are read straight away,
  // so there is no flash of the question for people who already answered
  const mode = useMemo<UseMode | null>(
    () => (!user ? null : isGuest ? 'read' : user.mode ?? loadMode(user.id)),
    // modeVersion changes when the choice is saved, so the saved value is read again
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, isGuest, modeVersion]
  );
  const setMode = (next: UseMode) => {
    if (user && !isGuest) {
      saveMode(user.id, next);
      setUser({ ...user, mode: next });
      void authService.saveMode(next);
    }
    setModeVersion((v) => v + 1);
  };

  // An answer given on this device before it was kept on the account is offered to the account once
  useEffect(() => {
    if (!user || isGuest || user.mode) return;
    const local = loadMode(user.id);
    if (local) void authService.saveMode(local);
  }, [user, isGuest]);

  const viewSpace = spaceOfView(activeView);
  // Remember the last real space, so account screens keep showing the one you came from
  if (viewSpace && viewSpace !== lastSpace) setLastSpace(viewSpace);
  const space: Space = viewSpace ?? lastSpace ?? openingSpace(mode);

  const setActiveView = (view: string) => {
    switch (view) {
      case 'home': navigate('/write'); break;
      case 'read_home': navigate('/read'); break;
      case 'manuscripts': navigate('/manuscripts'); break;
      case 'library': navigate('/library'); break;
      case 'saved_library': navigate('/saved'); break;
      case 'editor': navigate('/editor'); break;
      case 'notebook': navigate('/notebook'); break;
      case 'outline': navigate('/outline'); break;
      case 'tracker': navigate('/tracker'); break;
      case 'profile': navigate('/profile'); break;
      case 'messages': navigate('/messages'); break;
      case 'notifications': navigate('/notifications'); break;
      case 'print': navigate('/print'); break;
      case 'admin': navigate('/admin'); break;
      case 'preferences': navigate('/preferences'); break;
      case 'reader': 
        if (activePublicProject) {
          navigate(`/library/novel/${activePublicProject.id}`);
        }
        break;
      default: navigate('/'); break;
    }
  };

  const refreshSharedFor = async (userId: string, own: Project[]) => {
    const [shared, mine] = await Promise.all([listSharedProjects(userId), sharedProjectIds(own.map((p) => p.id))]);
    setSharedProjects(shared);
    setSharedIds(mine);
    // The first look after signing in: the project that was open last time may be one that is shared with this person
    if (restoredSharedFor.current !== userId) {
      restoredSharedFor.current = userId;
      const last = getLastProject(userId);
      const lastShared = last ? shared.find((p) => p.id === last) : undefined;
      if (lastShared) {
        setActiveProjectState(lastShared);
        setActiveChapter(null);
        return;
      }
    }
    // A shared project that is no longer shared with this person (they left, or were removed) is not left open
    const open = activeProjectRef.current;
    if (open && open.user_id !== userId && !shared.some((p) => p.id === open.id)) {
      setActiveProjectState(own[0] ?? null);
      setActiveChapter(null);
    }
  };

  const applyRemoteChapter = (chapter: Chapter) => {
    setChapters((prev) => prev.map((c) => (c.id === chapter.id ? chapter : c)));
    setActiveChapter((prev) => (prev && prev.id === chapter.id ? chapter : prev));
  };

  const refreshShared = async () => {
    if (user && !isGuest) await refreshSharedFor(user.id, projectsRef.current);
  };

  const loadProjects = async (userId: string) => {
    setLoading(true);
    try {
      const data = await databaseService.getProjects(userId);
      setProjects(data);
      if (data.length > 0) {
        // Reopen the project that was open last time
        const last = getLastProject(userId);
        setActiveProjectState(data.find(p => p.id === last) || data[0]);
      }
      
      let p = await databaseService.getProfile(userId);
      if (!p) {
        // Initialize default profile
        p = await databaseService.updateProfile(userId, { 
          display_name: '', 
          bio: '', 
          daily_word_goal: 1000 
        });
      }
      setProfile(p);
      
      void refreshSharedFor(userId, data);
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPublicProjects = async () => {
    setLoading(true);
    try {
      const data = await databaseService.getPublicProjects();
      setPublicProjects(data);
    } catch (err) {
      console.error('Error loading public projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectData = async (projectId: string) => {
    setLoading(true);
    try {
      const [chaps, ents, logs] = await Promise.all([
        databaseService.getChapters(projectId),
        databaseService.getEntities(projectId),
        databaseService.getWordCountLogs(projectId),
      ]);
      
      setChapters(chaps);
      setEntities(ents);
      setWordCountLogs(logs);
      const localMeta = loadChapterMeta(projectId);
      chapterMetaRef.current = localMeta;
      openProjectRef.current = projectId;
      setChapterMeta(localMeta);
      setProjectGoalState(loadProjectGoal(projectId));
      // With the cloud database set up, bring chapter notes and the goal in step with it (the newer copy wins)
      void (async () => {
        const merged = await syncChapterNotes(projectId, localMeta, chaps.map(ch => ch.id));
        if (merged && openProjectRef.current === projectId) {
          // Anything edited while this was running is newer than what came back, so it stays
          const latest = chapterMetaRef.current;
          const next: ChapterMetaMap = { ...merged };
          for (const [id, mine] of Object.entries(latest)) {
            if ((mine.updatedAt ?? 0) > (next[id]?.updatedAt ?? 0)) next[id] = mine;
          }
          chapterMetaRef.current = next;
          setChapterMeta(next);
          saveChapterMeta(projectId, next);
        }
        const goal = await syncProjectGoal(projectId);
        if (goal !== undefined && openProjectRef.current === projectId) setProjectGoalState(goal);
      })();
      startDay(projectId, Object.fromEntries(chaps.map(c => [c.id, countWords(c.content)])));
      
      // Open on the chapter that was open last time, else the one edited most recently
      if (chaps.length > 0) {
        const lastId = getLastChapter(projectId);
        const byRecent = [...chaps].filter(ch => ch.content).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
        setActiveChapter(chaps.find(ch => ch.id === lastId) || byRecent || chaps[0]);
      } else {
        setActiveChapter(null);
      }
    } catch (err) {
      console.error('Error loading project details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Check auth session on mount
  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      const currentUser = await authService.getUser();
      setUser(currentUser);
      if (currentUser) {
        await loadProjects(currentUser.id);
      } else {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // Arriving through a password-reset email signs the person in; the app then asks for a new password before anything else
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // The people this person has blocked, from the server when it can be reached, else from this device
  useEffect(() => {
    if (!user || isGuest) return;
    let live = true;
    loadBlocks(user.id).then((ids) => {
      if (live) setBlockedList({ owner: user.id, ids });
    });
    return () => {
      live = false;
    };
  }, [user, isGuest]);
  const blockedIds = useMemo(() => (user && !isGuest && blockedList.owner === user.id ? blockedList.ids : []), [user, isGuest, blockedList]);

  // Remember the open project and chapter, so the app reopens where the writer left off
  useEffect(() => {
    if (user && activeProject) setLastProject(user.id, activeProject.id);
  }, [user, activeProject]);

  useEffect(() => {
    // Only a chapter of the open project counts: the old chapter lingers briefly while a project switches
    if (activeProject && activeChapter && activeChapter.project_id === activeProject.id) {
      setLastChapter(activeProject.id, activeChapter.id);
    }
  }, [activeProject, activeChapter]);

  // When active project changes, load its child data (chapters, entities, word logs)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeProject && user) {
        loadProjectData(activeProject.id);
      } else {
        setChapters([]);
        setActiveChapter(null);
        setEntities([]);
        setWordCountLogs([]);
        chapterMetaRef.current = {};
        openProjectRef.current = null;
        setChapterMeta({});
        setProjectGoalState(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeProject, user]);

  const login = async (email: string, password: string) => {
    const { user, error } = await authService.login(email, password);
    if (user) {
      setUser(user);
      setIsGuest(false);
      await loadProjects(user.id);
    }
    return { error };
  };

  const signup = async (email: string, password: string) => {
    const { user, error, message } = await authService.signup(email, password);
    if (user) {
      setUser(user);
      await loadProjects(user.id);
    }
    return { error, message };
  };

  const loginAsGuest = (to?: string) => {
    // Create a dummy guest user
    const guestUser: User = {
      id: 'guest_user',
      role: 'authenticated',
      email: 'guest@novelist.local',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString()
    } as User;
    setUser(guestUser);
    setIsGuest(true);
    if (to) {
      // For one render the signed-in routes still see the old address, and the front door would send us to Reading home.
      // Going to the destination a moment later lets that settle first.
      setTimeout(() => navigate(to), 0);
    } else {
      navigate('/');
    }
  };

  const logout = async () => {
    if (!isGuest) {
      await authService.logout();
    }
    // Do not leave a signed-out writer's manuscript behind on a shared computer
    clearOfflineCache();
    setUser(null);
    setIsGuest(false);
    setProfile(null);
    setProjects([]);
    setSharedProjects([]);
    setSharedIds([]);
    restoredSharedFor.current = null;
    setActiveProjectState(null);
    setChapters([]);
    setActiveChapter(null);
    setEntities([]);
    setWordCountLogs([]);
    setRecovering(false);
    setBlockedList({ owner: '', ids: [] });
    window.location.hash = '#/';
  };

  const changePassword = async (password: string) => authService.updatePassword(password);

  const finishRecovery = () => {
    setRecovering(false);
    setRecoveryNotice(null);
    navigate('/');
  };

  const deleteAccount = async (password: string) => {
    if (!user || isGuest) return { error: 'There is no account to delete.' };
    if (isSupabaseConfigured && !(await authService.confirmPassword(user.email, password))) {
      return { error: 'That password is not right.' };
    }
    // Work out what this device holds for the account before it is gone
    const projectIds = projects.map((p) => p.id);
    const chapterIds: string[] = [];
    for (const projectId of projectIds) {
      try {
        (await databaseService.getChapters(projectId)).forEach((c) => chapterIds.push(c.id));
      } catch {
        // offline copies of a chapter we cannot list are cleared with the project's other keys
      }
    }
    const { error } = await databaseService.deleteAccount(user.id);
    if (error) return { error };
    await wipeDeviceData(user.id, projectIds, chapterIds);
    await logout();
    return { error: null };
  };

  const blockUser = async (targetId: string) => {
    if (!user || isGuest || targetId === user.id) return { saved: 'device-only' as const };
    setBlockedList((prev) => {
      const ids = prev.owner === user.id ? prev.ids : [];
      return { owner: user.id, ids: ids.includes(targetId) ? ids : [...ids, targetId] };
    });
    // Blocking someone also stops following them
    if (profile?.following?.includes(targetId)) await toggleFollow(targetId);
    return addBlock(user.id, targetId);
  };

  const unblockUser = async (targetId: string) => {
    if (!user || isGuest) return { saved: 'device-only' as const };
    setBlockedList((prev) => ({ owner: user.id, ids: prev.owner === user.id ? prev.ids.filter((id) => id !== targetId) : [] }));
    return removeBlock(user.id, targetId);
  };

  // Novels by people this person has blocked do not show up for them
  const visiblePublicProjects = useMemo(
    () => (blockedIds.length === 0 ? publicProjects : publicProjects.filter((p) => !blockedIds.includes(p.user_id))),
    [publicProjects, blockedIds]
  );

  // The owner does everything. Anyone else is limited by the role they were invited with; a project that is not theirs and
  // not shared with them is read only.
  const projectRole: Role = useMemo(() => {
    if (!activeProject || !user || activeProject.user_id === user.id) return 'owner';
    return sharedProjects.find((p) => p.id === activeProject.id)?.role ?? 'viewer';
  }, [activeProject, user, sharedProjects]);
  const projectIsShared = !!activeProject && (projectRole !== 'owner' || sharedIds.includes(activeProject.id));

  const setActiveProject = (project: Project) => {
    setActiveProjectState(project);
    setActiveChapter(null);
  };

  const createProject = async (title: string, description: string) => {
    if (!user) return;
    try {
      const newProj = await databaseService.createProject(user.id, title, description);
      setProjects(prev => [newProj, ...prev]);
      setActiveProjectState(newProj);
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };

  const createExternalProject = async (title: string, authorName: string, description: string, genre: string, coverUrl: string) => {
    if (!user) return { error: 'Not authenticated' };
    try {
      const newProj = await databaseService.createExternalProject(user.id, title, authorName, description, genre, coverUrl);
      setProjects(prev => [newProj, ...prev]);
      setActiveProjectState(newProj);
      await loadPublicProjects();
      return { error: null };
    } catch (err) {
      console.error('Error creating external project:', err);
      return { error: messageOf(err, 'Failed to create external project') };
    }
  };

  const publishProject = async (projectId: string, isPublished: boolean, authorName: string) => {
    if (activeProject?.id === projectId && !can.manage(projectRole)) return;
    try {
      const updated = await databaseService.publishProject(projectId, isPublished, authorName);
      setProjects(prev => prev.map(p => p.id === projectId ? updated : p));
      if (activeProject && activeProject.id === projectId) {
        setActiveProjectState(updated);
      }
      loadPublicProjects(); // Refresh library
    } catch (err) {
      console.error('Error publishing project:', err);
    }
  };

  const updateProjectSettings = async (projectId: string, fields: Partial<Pick<Project, 'title' | 'description' | 'cover_url' | 'genre' | 'author_name'>>) => {
    if (activeProject?.id === projectId && !can.manage(projectRole)) return;
    try {
      const updated = await databaseService.updateProjectSettings(projectId, fields);
      setProjects(prev => prev.map(p => (p.id === projectId ? updated : p)));
      if (activeProject && activeProject.id === projectId) {
        setActiveProjectState(updated);
      }
      loadPublicProjects(); // Refresh library if it's public
    } catch (err) {
      console.error('Error updating project settings:', err);
    }
  };

  const toggleLikeProject = async (projectId: string) => {
    if (!user) return;
    try {
      const updated = await databaseService.toggleLikeProject(projectId, user.id);
      setPublicProjects(prev => prev.map(p => (p.id === projectId ? updated : p)));
      if (activePublicProject && activePublicProject.id === projectId) {
        setActivePublicProject(updated);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const trackProjectView = async (projectId: string) => {
    if (!user) return;
    try {
      const updated = await databaseService.trackProjectView(projectId, user.id);
      // Update in public projects list
      setPublicProjects(prev => prev.map(p => (p.id === projectId ? updated : p)));
      // Also update in projects list just in case author reads their own book
      setProjects(prev => prev.map(p => (p.id === projectId ? updated : p)));
      if (activePublicProject && activePublicProject.id === projectId) {
        setActivePublicProject(updated);
      }
    } catch (err) {
      console.error('Error tracking view:', err);
    }
  };

  const updateProfile = async (fields: Partial<UserProfile>) => {
    if (!user) return { error: 'No active user' };
    try {
      const updated = await databaseService.updateProfile(user.id, fields);
      setProfile(updated);
      
      // Sync the new display_name to all projects as author_name
      if (fields.display_name) {
        const updatedProjects = await Promise.all(
          projects.map(async (p) => {
            if (p.author_name !== fields.display_name) {
              const res = await databaseService.updateProjectSettings(p.id, { author_name: fields.display_name });
              return res;
            }
            return p;
          })
        );
        setProjects(updatedProjects);
        if (activeProject) {
          const syncedActive = updatedProjects.find(p => p.id === activeProject.id);
          if (syncedActive) setActiveProject(syncedActive);
        }
      }

      return { error: null };
    } catch (err) {
      console.error('Error updating profile:', err);
      return { error: messageOf(err, 'Failed to update profile') };
    }
  };

  const toggleFollow = async (targetUserId: string): Promise<boolean> => {
    if (!user || !profile) return false;
    try {
      const isCurrentlyFollowing = profile.following?.includes(targetUserId);
      const isNowFollowing = !isCurrentlyFollowing;

      // Optimistically update the context profile instantly
      setProfile(prev => {
        if (!prev) return prev;
        let newFollowing = prev.following ? [...prev.following] : [];
        if (isNowFollowing) {
          newFollowing.push(targetUserId);
        } else {
          newFollowing = newFollowing.filter(id => id !== targetUserId);
        }
        return { ...prev, following: newFollowing };
      });

      // Perform actual database update
      const actualNowFollowing = await databaseService.toggleFollowUser(user.id, targetUserId);
      
      // Keep it in sync
      const p = await databaseService.getProfile(user.id);
      setProfile(p);
      return actualNowFollowing;
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      return false;
    }
  };

  const createChapter = async (title: string) => {
    if (!activeProject || !can.editStructure(projectRole)) return;
    try {
      const newChap = await databaseService.createChapter(activeProject.id, title);
      setChapters(prev => [...prev, newChap]);
      setActiveChapter(newChap);
    } catch (err) {
      console.error('Error creating chapter:', err);
    }
  };

  const updateChapter = async (chapterId: string, fields: Partial<Pick<Chapter, 'title' | 'content' | 'position'>>) => {
    // A viewer cannot change anything, and an editor can write but not reorder
    if (!can.editText(projectRole) || ('position' in fields && !can.editStructure(projectRole))) {
      throw new Error('Your role on this project does not allow that change.');
    }
    try {
      const updated = await databaseService.updateChapter(chapterId, fields);
      setChapters(prev => prev.map(c => c.id === chapterId ? updated : c));
      if (activeChapter?.id === chapterId) {
        setActiveChapter(updated);
      }
    } catch (err) {
      console.error('Error updating chapter:', err);
      // The editor must know the save failed, so it can keep the draft and offer a retry
      throw err;
    }
  };

  // Deleting keeps a copy in the "Recently deleted" bin on this device, so it can be brought back
  const deleteChapter = async (chapterId: string) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter || !activeProject || !can.editStructure(projectRole)) return undefined;
    const meta = chapterMeta[chapterId];
    const binId = await addToBin({ projectId: activeProject.id, title: chapter.title, content: chapter.content, position: chapter.position, meta });
    await databaseService.deleteChapter(chapterId);
    forgetChapter(activeProject.id, chapterId);
    if (meta) {
      const rest = { ...chapterMetaRef.current };
      delete rest[chapterId];
      chapterMetaRef.current = rest;
      setChapterMeta(rest);
      saveChapterMeta(activeProject.id, rest);
    }
    const remaining = chapters.filter(c => c.id !== chapterId).sort((a, b) => a.position - b.position);
    // Close the gap so new chapters never share a position
    const renumbered = await Promise.all(
      remaining.map((c, i) => (c.position === i ? Promise.resolve(c) : databaseService.updateChapter(c.id, { position: i })))
    );
    setChapters(renumbered);
    if (activeChapter?.id === chapterId) setActiveChapter(null);
    return binId;
  };

  const restoreDeletedChapter = async (title: string, content: string, meta?: ChapterMeta, position?: number) => {
    if (!activeProject || !can.editStructure(projectRole)) return;
    const created = await databaseService.createChapter(activeProject.id, title);
    const filled = content ? await databaseService.updateChapter(created.id, { content }) : created;
    // Words that already existed are not "written today"
    markExisting(activeProject.id, filled.id, countWords(content));
    const sorted = [...chaptersRef.current].sort((a, b) => a.position - b.position);
    if (position === undefined || position >= sorted.length) {
      setChapters(prev => [...prev, filled]);
    } else {
      // Put it back where it was, shifting the chapters after it down by one
      sorted.splice(Math.max(0, position), 0, filled);
      const placed = sorted.map((ch, i) => ({ ...ch, position: i }));
      setChapters(placed);
      await Promise.all(
        placed.filter((ch, i) => ch.id !== filled.id && sorted[i].position !== i).map(ch => databaseService.updateChapter(ch.id, { position: ch.position })).concat(
          databaseService.updateChapter(filled.id, { position: Math.max(0, position) })
        )
      );
    }
    if (meta) {
      const projectId = activeProject.id;
      const stamped = { ...meta, updatedAt: Date.now() };
      const next = { ...chapterMetaRef.current, [filled.id]: stamped };
      chapterMetaRef.current = next;
      setChapterMeta(next);
      saveChapterMeta(projectId, next);
      void pushChapterNote(projectId, filled.id, stamped);
    }
  };

  /** Move chapters into a new order. The screen updates at once; the database follows. */
  const reorderChapters = async (orderedIds: string[]) => {
    if (!activeProject || !can.editStructure(projectRole)) return;
    const byId = new Map(chapters.map(c => [c.id, c]));
    const next = orderedIds.filter(id => byId.has(id)).map((id, i) => ({ ...byId.get(id)!, position: i }));
    if (next.length !== chapters.length) return;
    setChapters(next);
    try {
      await Promise.all(
        next.filter(c => byId.get(c.id)!.position !== c.position).map(c => databaseService.updateChapter(c.id, { position: c.position }))
      );
    } catch (err) {
      console.error('Error reordering chapters:', err);
      setChapters(await databaseService.getChapters(activeProject.id));
      throw err;
    }
  };

  const updateChapterMeta = (chapterId: string, patch: Partial<ChapterMeta>) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    const entry: ChapterMeta = { ...EMPTY_META, ...chapterMetaRef.current[chapterId], ...patch, updatedAt: Date.now() };
    const next = { ...chapterMetaRef.current, [chapterId]: entry };
    chapterMetaRef.current = next;
    setChapterMeta(next);
    saveChapterMeta(projectId, next);
    // Typing in the notes box edits on every key, so send to the cloud once the writer pauses
    const pending = noteTimers.current.get(chapterId);
    if (pending) window.clearTimeout(pending);
    noteTimers.current.set(
      chapterId,
      window.setTimeout(() => {
        noteTimers.current.delete(chapterId);
        const latest = chapterMetaRef.current[chapterId];
        if (latest) void pushChapterNote(projectId, chapterId, latest);
      }, 800)
    );
  };

  const setProjectGoal = (goal: ProjectGoal | null) => {
    if (!activeProject) return;
    setProjectGoalState(goal);
    const record = saveProjectGoal(activeProject.id, goal);
    void pushProjectGoal(activeProject.id, record);
  };

  const createEntity = async (
    name: string,
    type: WikiEntity['type'],
    description: string,
    content: Record<string, string>,
    imageUrl?: string
  ) => {
    if (!activeProject || !can.editStructure(projectRole)) return;
    try {
      const newEnt = await databaseService.createEntity(activeProject.id, name, type, description, content, imageUrl);
      setEntities(prev => [...prev, newEnt].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Error creating entity:', err);
    }
  };

  const updateEntity = async (
    entityId: string,
    fields: Partial<Pick<WikiEntity, 'name' | 'type' | 'description' | 'content' | 'image_url'>>
  ) => {
    if (!can.editStructure(projectRole)) return undefined;
    try {
      const updated = await databaseService.updateEntity(entityId, fields);
      setEntities(prev => prev.map(e => e.id === entityId ? updated : e).sort((a, b) => a.name.localeCompare(b.name)));
      return updated;
    } catch (err) {
      console.error('Error updating entity:', err);
    }
  };

  const deleteEntity = async (entityId: string) => {
    if (!can.editStructure(projectRole)) return;
    try {
      const success = await databaseService.deleteEntity(entityId);
      if (success) {
        setEntities(prev => prev.filter(e => e.id !== entityId));
      }
    } catch (err) {
      console.error('Error deleting entity:', err);
    }
  };

  const logWordCount = async (count: number, dateStr?: string) => {
    if (!activeProject) return;
    const date = dateStr || localDate();
    try {
      const updatedLog = await databaseService.logWordCount(activeProject.id, count, date);
      setWordCountLogs(prev => {
        const index = prev.findIndex(l => l.date === date);
        if (index !== -1) {
          const next = [...prev];
          next[index] = updatedLog;
          return next;
        } else {
          return [...prev, updatedLog].sort((a, b) => a.date.localeCompare(b.date));
        }
      });
    } catch (err) {
      console.error('Error logging word count:', err);
    }
  };

  /** Make the sample project and open it. Returns null if it could not be made. */
  const createSampleProject = async (): Promise<Project | null> => {
    if (!user) return null;
    try {
      const sample = await buildSampleProject(user.id);
      setProjects(prev => [sample, ...prev]);
      setActiveProjectState(sample);
      setActiveChapter(null);
      return sample;
    } catch (err) {
      console.error('Error creating the sample project:', err);
      return null;
    }
  };

  /** Remove a whole project. The app only offers this for the sample project. */
  const deleteProject = async (projectId: string) => {
    if (!user) return;
    await databaseService.deleteProject(projectId);
    forgetProject(user.id, projectId);
    forgetSample(projectId);
    const rest = projects.filter(p => p.id !== projectId);
    setProjects(rest);
    if (activeProject?.id === projectId) {
      setActiveProjectState(rest[0] || null);
      setActiveChapter(null);
    }
    loadPublicProjects();
  };

  /**
   * Save an imported manuscript: into a new project, or after the last chapter of the open one. Either all of it is
   * saved or none of it. The words that came with the file already existed, so none count as written today.
   */
  const importManuscript = async (input: ImportInput): Promise<ImportResult> => {
    if (!user || isGuest) return { error: 'Please sign in to import a manuscript.' };
    const items = input.chapters.map((c) => ({ title: c.title.trim(), content: c.html }));
    if (items.length === 0) return { error: 'There are no chapters to import.' };
    const { target } = input;
    if (target.kind === 'new' && !target.title.trim()) return { error: 'Give the new project a title.' };

    let project: Project | null = null;
    let projectId: string;
    let created: Chapter[];
    try {
      if (target.kind === 'new') {
        project = await databaseService.createProject(user.id, target.title.trim(), target.description.trim());
        if (target.authorName?.trim()) project = await databaseService.updateProjectSettings(project.id, { author_name: target.authorName.trim() });
        projectId = project.id;
      } else {
        if (!activeProject) return { error: 'Open a project first, then import into it.' };
        projectId = activeProject.id;
      }
      created = await databaseService.createChaptersBulk(projectId, items);
    } catch (err) {
      console.error('Error importing a manuscript:', err);
      // The new project was made first; take it away again so a failed import leaves nothing behind
      if (project) {
        try {
          await databaseService.deleteProject(project.id);
        } catch (cleanup) {
          console.error('Could not remove the project of a failed import:', cleanup);
        }
      }
      return { error: importFailure(err) };
    }

    const words = created.map((c) => countWords(c.content));
    if (project) {
      // A new project starts its day with the whole manuscript already in it
      startDay(projectId, Object.fromEntries(created.map((c, i) => [c.id, words[i]])));
    }
    created.forEach((c, i) => markExisting(projectId, c.id, words[i]));

    if (project) {
      const made = project;
      setProjects(prev => [made, ...prev]);
      setActiveProjectState(made);
      setActiveChapter(null);
      setChapters(created);
    } else if (activeProjectRef.current?.id === projectId) {
      // The chapter being written stays open; the new ones join the end
      setChapters(prev => [...prev, ...created]);
    }
    return { error: null, kind: target.kind, projectId, chapterIds: created.map((c) => c.id), words: words.reduce((a, b) => a + b, 0) };
  };

  /** Take an import back. A new project goes whole; chapters added to an existing one go, without a copy in Recently deleted. */
  const undoImport = async (result: ImportResult): Promise<{ error: string | null }> => {
    const { projectId } = result;
    if (!user || result.error || !projectId) return { error: null };
    try {
      if (result.kind === 'new') {
        await databaseService.deleteProject(projectId);
        forgetProject(user.id, projectId);
        const rest = projectsRef.current.filter(p => p.id !== projectId);
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (activeProjectRef.current?.id === projectId) {
          setActiveProjectState(rest[0] || null);
          setActiveChapter(null);
        }
        return { error: null };
      }

      const ids = new Set(result.chapterIds ?? []);
      if (ids.size === 0) return { error: null };
      await databaseService.deleteChaptersBulk([...ids]);
      ids.forEach(id => forgetChapter(projectId, id));
      if (activeProjectRef.current?.id === projectId) {
        setChapters(prev => prev.filter(c => !ids.has(c.id)));
        setActiveChapter(cur => (cur && ids.has(cur.id) ? null : cur));
        if (Object.keys(chapterMetaRef.current).some(id => ids.has(id))) {
          const rest = { ...chapterMetaRef.current };
          ids.forEach(id => delete rest[id]);
          chapterMetaRef.current = rest;
          setChapterMeta(rest);
          saveChapterMeta(projectId, rest);
        }
        // Chapters written or moved since the import could leave a gap; close it so positions stay in a row
        const remaining = chaptersRef.current.filter(c => !ids.has(c.id)).sort((a, b) => a.position - b.position);
        if (remaining.some((c, i) => c.position !== i)) {
          const renumbered = await Promise.all(
            remaining.map((c, i) => (c.position === i ? Promise.resolve(c) : databaseService.updateChapter(c.id, { position: i })))
          );
          setChapters(renumbered);
        }
      }
      return { error: null };
    } catch (err) {
      console.error('Error undoing an import:', err);
      return { error: 'The import could not be undone just now. Nothing more was changed; you can delete what it added yourself.' };
    }
  };

  /** Called after a chapter saves: logs how many words the manuscript has grown by today. */
  const recordWriting = async (chapterId: string, words: number) => {
    if (!activeProject) return;
    const total = noteWords(activeProject.id, chapterId, words);
    if (total !== null) await logWordCount(total);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        profile,
        projects,
        activeProject,
        chapters,
        activeChapter,
        publicProjects: visiblePublicProjects,
        activePublicProject,
        entities,
        wordCountLogs,
        chapterMeta,
        projectGoal,
        sharedProjects,
        projectRole,
        projectIsShared,
        sharedProjectIds: sharedIds,
        refreshShared,
        applyRemoteChapter,
        activeView,
        loading,
        isGuest,
        mode,
        setMode,
        space,
        isSupabase: isSupabaseConfigured,
        zenMode,
        setZenMode,
        recentlyRead,
        setRecentlyRead,
        login,
        loginAsGuest,
        signup,
        logout,
        recovering,
        // A reset link that signed nobody in (expired, or already used) is explained on the sign-in screen
        recoveryNotice: recoveryNotice ?? (recovering && !loading && !user ? 'That reset link has expired or was already used. Enter your email to get a new one.' : null),
        changePassword,
        finishRecovery,
        deleteAccount,
        blockedIds,
        blockUser,
        unblockUser,
        setActiveView,
        setActiveProject,
        setActivePublicProject,
        setActiveChapter,
        loadProjects,
        loadPublicProjects,
        loadProjectData,
        createProject,
        createExternalProject,
        publishProject,
        updateProjectSettings,
        toggleLikeProject,
        trackProjectView,
        updateProfile,
        toggleFollow,
        createChapter,
        deleteChapter,
        restoreDeletedChapter,
        importManuscript,
        undoImport,
        createSampleProject,
        deleteProject,
        reorderChapters,
        updateChapterMeta,
        setProjectGoal,
        recordWriting,
        updateChapter,
        createEntity,
        updateEntity,
        deleteEntity,
        logWordCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
