import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Project, Chapter, WikiEntity, WordCountLog } from '../services/types';
import { databaseService } from '../services/database';
import { isSupabaseConfigured } from '../lib/supabase';

interface AppContextType {
  projects: Project[];
  activeProject: Project | null;
  chapters: Chapter[];
  activeChapter: Chapter | null;
  entities: WikiEntity[];
  wordCountLogs: WordCountLog[];
  activeView: 'editor' | 'planner' | 'tracker';
  loading: boolean;
  isSupabase: boolean;
  setActiveView: (view: 'editor' | 'planner' | 'tracker') => void;
  setActiveProject: (project: Project) => void;
  setActiveChapter: (chapter: Chapter | null) => void;
  loadProjects: () => Promise<void>;
  loadProjectData: (projectId: string) => Promise<void>;
  createProject: (title: string, description: string) => Promise<void>;
  createChapter: (title: string) => Promise<void>;
  updateChapter: (chapterId: string, fields: Partial<Pick<Chapter, 'title' | 'content' | 'position'>>) => Promise<void>;
  createEntity: (name: string, type: WikiEntity['type'], description: string, content: Record<string, string>, imageUrl?: string) => Promise<void>;
  updateEntity: (entityId: string, fields: Partial<Pick<WikiEntity, 'name' | 'type' | 'description' | 'content' | 'image_url'>>) => Promise<WikiEntity | undefined>;
  deleteEntity: (entityId: string) => Promise<void>;
  logWordCount: (count: number, dateStr?: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [entities, setEntities] = useState<WikiEntity[]>([]);
  const [wordCountLogs, setWordCountLogs] = useState<WordCountLog[]>([]);
  const [activeView, setActiveView] = useState<'editor' | 'planner' | 'tracker'>('editor');
  const [loading, setLoading] = useState<boolean>(true);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await databaseService.getProjects();
      setProjects(data);
      if (data.length > 0 && !activeProject) {
        setActiveProjectState(data[0]);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
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

  // Load projects on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProjects();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When active project changes, load its child data (chapters, entities, word logs)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeProject) {
        loadProjectData(activeProject.id);
      } else {
        setChapters([]);
        setActiveChapter(null);
        setEntities([]);
        setWordCountLogs([]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeProject]);

  const setActiveProject = (project: Project) => {
    setActiveProjectState(project);
    setActiveChapter(null);
  };

  const createProject = async (title: string, description: string) => {
    try {
      const newProj = await databaseService.createProject(title, description);
      setProjects(prev => [newProj, ...prev]);
      setActiveProjectState(newProj);
    } catch (err) {
      console.error('Error creating project:', err);
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
        projects,
        activeProject,
        chapters,
        activeChapter,
        entities,
        wordCountLogs,
        activeView,
        loading,
        isSupabase: isSupabaseConfigured,
        setActiveView,
        setActiveProject,
        setActiveChapter,
        loadProjects,
        loadProjectData,
        createProject,
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
