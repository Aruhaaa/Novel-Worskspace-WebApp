import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User, Project, Chapter, WikiEntity, WordCountLog, UserProfile } from '../services/types';
import { databaseService } from '../services/database';
import { isSupabaseConfigured } from '../lib/supabase';
import { authService } from '../services/auth';

interface AppContextType {
  user: User | null;
  profile: UserProfile | null;
  projects: Project[];
  activeProject: Project | null;
  chapters: Chapter[];
  activeChapter: Chapter | null;
  entities: WikiEntity[];
  wordCountLogs: WordCountLog[];
  publicProjects: Project[];
  activePublicProject: Project | null;
  activeView: 'home' | 'editor' | 'planner' | 'tracker' | 'library' | 'saved_library' | 'reader' | 'profile' | 'print' | 'admin';
  loading: boolean;
  isSupabase: boolean;
  zenMode: boolean;
  setZenMode: (val: boolean) => void;
  recentlyRead: string[];
  setRecentlyRead: (val: string[]) => void;
  login: (email: string, password: string) => Promise<{error: string | null}>;
  signup: (email: string, password: string) => Promise<{error: string | null, message?: string | null}>;
  logout: () => Promise<void>;
  setActiveView: (view: 'home' | 'editor' | 'planner' | 'tracker' | 'library' | 'saved_library' | 'reader' | 'profile' | 'print' | 'admin') => void;
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
  createChapter: (title: string) => Promise<void>;
  updateChapter: (chapterId: string, fields: Partial<Pick<Chapter, 'title' | 'content' | 'position'>>) => Promise<void>;
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
  const [publicProjects, setPublicProjects] = useState<Project[]>([]);
  const [activePublicProject, setActivePublicProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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

  type ViewType = 'home' | 'editor' | 'planner' | 'tracker' | 'library' | 'saved_library' | 'reader' | 'profile' | 'print' | 'admin';

  const getActiveView = (): ViewType => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/library/novel/')) return 'reader';
    if (path === '/library') return 'library';
    if (path === '/saved') return 'saved_library';
    if (path === '/editor') return 'editor';
    if (path === '/planner') return 'planner';
    if (path === '/tracker') return 'tracker';
    if (path === '/profile') return 'profile';
    if (path === '/print') return 'print';
    if (path === '/admin') return 'admin';
    return 'home';
  };

  const activeView = getActiveView();

  const setActiveView = (view: string) => {
    switch (view) {
      case 'home': navigate('/'); break;
      case 'library': navigate('/library'); break;
      case 'saved_library': navigate('/saved'); break;
      case 'editor': navigate('/editor'); break;
      case 'planner': navigate('/planner'); break;
      case 'tracker': navigate('/tracker'); break;
      case 'profile': navigate('/profile'); break;
      case 'print': navigate('/print'); break;
      case 'admin': navigate('/admin'); break;
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
        setActiveProjectState(data[0]);
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
      
      // Auto select first chapter if none active
      if (chaps.length > 0) {
        setActiveChapter(chaps[0]);
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
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeProject, user]);

  const login = async (email: string, password: string) => {
    const { user, error } = await authService.login(email, password);
    if (user) {
      setUser(user);
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

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setProfile(null);
    setProjects([]);
    setActiveProjectState(null);
    setChapters([]);
    setActiveChapter(null);
    setEntities([]);
    setWordCountLogs([]);
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
      setActiveProjectState(prev => prev?.id === projectId ? updated : prev);
      loadPublicProjects(); // Refresh library
    } catch (err) {
      console.error('Error publishing project:', err);
    }
  };

  const updateProjectSettings = async (projectId: string, fields: Partial<Pick<Project, 'title' | 'description' | 'cover_url' | 'genre' | 'author_name'>>) => {
    try {
      const updated = await databaseService.updateProjectSettings(projectId, fields);
      setProjects(prev => prev.map(p => (p.id === projectId ? updated : p)));
      setActiveProjectState(prev => prev?.id === projectId ? updated : prev);
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
      setActivePublicProject(prev => prev?.id === projectId ? updated : prev);
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
      setActivePublicProject(prev => prev?.id === projectId ? updated : prev);
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
        setActiveProjectState(prev => {
          const synced = updatedProjects.find(p => p.id === prev?.id);
          return synced || prev;
        });
      }

      return { error: null };
    } catch (err: any) {
      console.error('Error updating profile:', err);
      return { error: err.message || 'Failed to update profile' };
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
      setActiveChapter(prev => prev?.id === chapterId ? updated : prev);
    } catch (err) {
      console.error('Error updating chapter:', err);
    }
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
    const date = dateStr || new Date().toISOString().split('T')[0];
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
        activeView,
        loading,
        isSupabase: isSupabaseConfigured,
        zenMode,
        setZenMode,
        recentlyRead,
        setRecentlyRead,
        login,
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
        createChapter,
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
