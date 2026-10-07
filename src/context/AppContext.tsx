import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User, Project, Chapter, WikiEntity, WordCountLog, UserProfile } from '../services/types';
import { databaseService } from '../services/database';
import { isSupabaseConfigured } from '../lib/supabase';
import { authService } from '../services/auth';
import { addToBin } from '../lib/bin';
import { localDate } from '../lib/dates';
import { countWords } from '../lib/text';
import { loadChapterMeta, saveChapterMeta, EMPTY_META, type ChapterMeta, type ChapterMetaMap } from '../lib/chapterMeta';
import { loadProjectGoal, saveProjectGoal, type ProjectGoal } from '../lib/projectGoal';
import { pushChapterNote, pushProjectGoal, syncChapterNotes, syncProjectGoal } from '../lib/cloudSync';
import { startDay, noteWords, markExisting, forgetChapter } from '../lib/dailyWords';
import { clearOfflineCache } from '../lib/offlineCache';
import { getLastChapter, getLastProject, setLastChapter, setLastProject, forgetProject } from '../lib/lastOpened';
import { createSampleProject as buildSampleProject, forgetSample } from '../lib/sample';
import { loadMode, saveMode, spaceOfView, openingSpace, type UseMode, type Space } from '../lib/mode';

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
  publicProjects: Project[];
  activePublicProject: Project | null;
  activeView: 'home' | 'manuscripts' | 'editor' | 'notebook' | 'outline' | 'tracker' | 'library' | 'saved_library' | 'reader' | 'profile' | 'messages' | 'print' | 'admin' | 'preferences' | 'read_home';
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
  loginAsGuest: () => void;
  signup: (email: string, password: string) => Promise<{error: string | null, message?: string | null}>;
  logout: () => Promise<void>;
  setActiveView: (view: 'home' | 'manuscripts' | 'editor' | 'notebook' | 'outline' | 'tracker' | 'library' | 'saved_library' | 'reader' | 'profile' | 'messages' | 'print' | 'admin' | 'preferences' | 'read_home') => void;
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

const AppContext = createContext<AppContextType | undefined>(undefined);

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
  const [projectGoal, setProjectGoalState] = useState<ProjectGoal | null>(null);
  const [publicProjects, setPublicProjects] = useState<Project[]>([]);
  const [activePublicProject, setActivePublicProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [modeVersion, setModeVersion] = useState(0);
  const [lastSpace, setLastSpace] = useState<Space | null>(null);
  const [zenMode, setZenMode] = useState<boolean>(false);
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

  type ViewType = 'home' | 'manuscripts' | 'editor' | 'notebook' | 'outline' | 'tracker' | 'library' | 'saved_library' | 'reader' | 'profile' | 'messages' | 'print' | 'admin' | 'preferences' | 'read_home';

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
    if (path === '/profile') return 'profile';
    if (path === '/print') return 'print';
    if (path === '/admin') return 'admin';
    if (path === '/preferences') return 'preferences';
    return 'home';
  };

  const activeView = getActiveView();

  // The saved choice is read straight from this device so there is no flash of the question for people who already answered
  const mode = useMemo<UseMode | null>(
    () => (!user ? null : isGuest ? 'read' : loadMode(user.id)),
    // modeVersion changes when the choice is saved, so the saved value is read again
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, isGuest, modeVersion]
  );
  const setMode = (next: UseMode) => {
    if (user && !isGuest) saveMode(user.id, next);
    setModeVersion((v) => v + 1);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const loginAsGuest = () => {
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
    navigate('/');
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
    setActiveProjectState(null);
    setChapters([]);
    setActiveChapter(null);
    setEntities([]);
    setWordCountLogs([]);
    window.location.hash = '#/';
  };

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
    } catch (err: any) {
      console.error('Error creating external project:', err);
      return { error: err.message || 'Failed to create external project' };
    }
  };

  const publishProject = async (projectId: string, isPublished: boolean, authorName: string) => {
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
    } catch (err: any) {
      console.error('Error updating profile:', err);
      return { error: err.message || 'Failed to update profile' };
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
    if (!activeProject) return;
    try {
      const newChap = await databaseService.createChapter(activeProject.id, title);
      setChapters(prev => [...prev, newChap]);
      setActiveChapter(newChap);
    } catch (err) {
      console.error('Error creating chapter:', err);
    }
  };

  const updateChapter = async (chapterId: string, fields: Partial<Pick<Chapter, 'title' | 'content' | 'position'>>) => {
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
    if (!chapter || !activeProject) return undefined;
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
    if (!activeProject) return;
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
    if (!activeProject) return;
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
    if (!activeProject) return;
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
    try {
      const updated = await databaseService.updateEntity(entityId, fields);
      setEntities(prev => prev.map(e => e.id === entityId ? updated : e).sort((a, b) => a.name.localeCompare(b.name)));
      return updated;
    } catch (err) {
      console.error('Error updating entity:', err);
    }
  };

  const deleteEntity = async (entityId: string) => {
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
        publicProjects,
        activePublicProject,
        entities,
        wordCountLogs,
        chapterMeta,
        projectGoal,
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
