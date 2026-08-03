import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Project, Chapter, WikiEntity, WordCountLog } from './types';

// Mock Data Initializer for Local Storage fallback
const MOCK_PROJECT_ID = 'p1-mock-project';

const INITIAL_PROJECTS: Project[] = [
  {
    id: MOCK_PROJECT_ID,
    user_id: 'user-mock',
    title: 'The Chronicles of Aetheria',
    description: 'An epic high-fantasy novel featuring floating islands, airship wars, and an ancient magic long thought dead.',
    created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const INITIAL_CHAPTERS: Chapter[] = [
  {
    id: 'c1-mock',
    project_id: MOCK_PROJECT_ID,
    title: 'Chapter 1: The Whispering Wind',
    content: 'The wind did not merely blow through the canyons of Aetheria; it whispered. It carried the voices of a thousand forgotten sorcerers, chanting spells that had long lost their names.\n\nLyra pulled her leather flight goggles down, feeling the vibration of the sky-skiff beneath her boots. "Hold steady," she yelled to her navigator. The storm clouds ahead were not natural—they bled violet lightning, crackling with pure, raw Aether.',
    position: 0,
    created_at: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c2-mock',
    project_id: MOCK_PROJECT_ID,
    title: 'Chapter 2: Echoes of the Spire',
    content: 'The Spire of Whispers loomed ahead, a colossal pillar of black obsidian that seemed to pin the sky to the earth. No one had entered the Spire since the Great Cataclysm, and yet, a single, warm light flickered from the highest window.\n\n"It is a trap," Kaelen muttered, rubbing his sore shoulder. "Or a beacon," Lyra replied, steering the skiff closer into the swirling mist.',
    position: 1,
    created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const INITIAL_ENTITIES: WikiEntity[] = [
  {
    id: 'e1-mock',
    project_id: MOCK_PROJECT_ID,
    name: 'Lyra Vance',
    type: 'character',
    description: 'A daring sky-skiff pilot and treasure hunter with a hidden past.',
    content: {
      Role: 'Protagonist',
      Age: '22',
      Weapon: 'Aether-charged Cutlass',
      Traits: 'Daring, resourcefulness, fiercely independent, haunted by the loss of her airship crew.',
    },
    created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'e2-mock',
    project_id: MOCK_PROJECT_ID,
    name: 'Kaelen Vane',
    type: 'character',
    description: 'An aging scholar and former Grand Magus who knows the danger of ancient runes.',
    content: {
      Role: 'Mentor / Deuteragonist',
      Age: '64',
      Magic: 'Runic warding & Fire-weaving',
      Traits: 'Cynical, cautious, deeply knowledgeable, carries a heavy burden of guilt.',
    },
    created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'e3-mock',
    project_id: MOCK_PROJECT_ID,
    name: 'The Spire of Whispers',
    type: 'location',
    description: 'An ancient obsidian tower floating in the Stormpeaks.',
    content: {
      Region: 'Stormpeaks',
      Origin: 'Pre-Cataclysm (First Age)',
      DangerLevel: 'Extreme (Aether storm nexus)',
      Secrets: 'Contains the Library of Echoes and the legendary Windstone artifact.',
    },
    created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
];

// Generate last 7 days of word count logs
const getInitialWordCountLogs = (): WordCountLog[] => {
  const logs: WordCountLog[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    // random word counts for demo
    const counts = [450, 890, 1200, 750, 1400, 1850, 950];
    logs.push({
      id: `l${i}-mock`,
      project_id: MOCK_PROJECT_ID,
      date: dateStr,
      word_count: counts[6 - i],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  return logs;
};

// Initialize localStorage helper
const getLocalData = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
};

const setLocalData = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const databaseService = {
  // --- PROJECTS ---
  async getProjects(): Promise<Project[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      return getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS);
    }
  },

  async createProject(title: string, description: string): Promise<Project> {
    if (isSupabaseConfigured && supabase) {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || 'anonymous';
      const { data, error } = await supabase
        .from('projects')
        .insert([{ title, description, user_id: userId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const projects = getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS);
      const newProj: Project = {
        id: `p-${Math.random().toString(36).substr(2, 9)}`,
        user_id: 'user-mock',
        title,
        description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      projects.unshift(newProj);
      setLocalData('novel_projects', projects);
      return newProj;
    }
  },

  // --- CHAPTERS ---
  async getChapters(projectId: string): Promise<Chapter[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true });
      if (error) throw error;
      return data || [];
    } else {
      const chapters = getLocalData<Chapter[]>('novel_chapters', INITIAL_CHAPTERS);
      return chapters.filter(c => c.project_id === projectId).sort((a, b) => a.position - b.position);
    }
  },

  async createChapter(projectId: string, title: string): Promise<Chapter> {
    if (isSupabaseConfigured && supabase) {
      // Find current chapters to calculate next position
      const current = await this.getChapters(projectId);
      const nextPosition = current.length;
      
      const { data, error } = await supabase
        .from('chapters')
        .insert([{ project_id: projectId, title, content: '', position: nextPosition }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const chapters = getLocalData<Chapter[]>('novel_chapters', INITIAL_CHAPTERS);
      const projectChapters = chapters.filter(c => c.project_id === projectId);
      const newChapter: Chapter = {
        id: `c-${Math.random().toString(36).substr(2, 9)}`,
        project_id: projectId,
        title,
        content: '',
        position: projectChapters.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      chapters.push(newChapter);
      setLocalData('novel_chapters', chapters);
      return newChapter;
    }
  },

  async updateChapter(chapterId: string, fields: Partial<Pick<Chapter, 'title' | 'content' | 'position'>>): Promise<Chapter> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('chapters')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', chapterId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const chapters = getLocalData<Chapter[]>('novel_chapters', INITIAL_CHAPTERS);
      const index = chapters.findIndex(c => c.id === chapterId);
      if (index === -1) throw new Error('Chapter not found');
      
      const updated = {
        ...chapters[index],
        ...fields,
        updated_at: new Date().toISOString()
      };
      chapters[index] = updated;
      setLocalData('novel_chapters', chapters);
      return updated;
    }
  },

  // --- ENTITIES (WIKI PLANNER) ---
  async getEntities(projectId: string): Promise<WikiEntity[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    } else {
      const entities = getLocalData<WikiEntity[]>('novel_entities', INITIAL_ENTITIES);
      return entities.filter(e => e.project_id === projectId).sort((a, b) => a.name.localeCompare(b.name));
    }
  },

  async createEntity(
    projectId: string,
    name: string,
    type: WikiEntity['type'],
    description: string,
    content: Record<string, string>,
    imageUrl?: string
  ): Promise<WikiEntity> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('entities')
        .insert([{ project_id: projectId, name, type, description, content, image_url: imageUrl }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const entities = getLocalData<WikiEntity[]>('novel_entities', INITIAL_ENTITIES);
      const newEntity: WikiEntity = {
        id: `e-${Math.random().toString(36).substr(2, 9)}`,
        project_id: projectId,
        name,
        type,
        description,
        content,
        image_url: imageUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      entities.push(newEntity);
      setLocalData('novel_entities', entities);
      return newEntity;
    }
  },

  async updateEntity(
    entityId: string,
    fields: Partial<Pick<WikiEntity, 'name' | 'type' | 'description' | 'content' | 'image_url'>>
  ): Promise<WikiEntity> {
    if (isSupabaseConfigured && supabase) {
      const updateData: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
      if (fields.image_url !== undefined) {
        updateData.image_url = fields.image_url;
      }
      const { data, error } = await supabase
        .from('entities')
        .update(updateData)
        .eq('id', entityId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const entities = getLocalData<WikiEntity[]>('novel_entities', INITIAL_ENTITIES);
      const index = entities.findIndex(e => e.id === entityId);
      if (index === -1) throw new Error('Entity not found');

      const updated = {
        ...entities[index],
        ...fields,
        updated_at: new Date().toISOString()
      };
      entities[index] = updated;
      setLocalData('novel_entities', entities);
      return updated;
    }
  },

  async deleteEntity(entityId: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('entities')
        .delete()
        .eq('id', entityId);
      if (error) throw error;
      return true;
    } else {
      const entities = getLocalData<WikiEntity[]>('novel_entities', INITIAL_ENTITIES);
      const filtered = entities.filter(e => e.id !== entityId);
      setLocalData('novel_entities', filtered);
      return true;
    }
  },

  // --- WORD COUNT LOGS (TRACKER) ---
  async getWordCountLogs(projectId: string): Promise<WordCountLog[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('word_count_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('date', { ascending: true });
      if (error) throw error;
      return data || [];
    } else {
      return getLocalData<WordCountLog[]>('novel_word_logs', getInitialWordCountLogs()).filter(l => l.project_id === projectId);
    }
  },

  async logWordCount(projectId: string, count: number, dateStr: string): Promise<WordCountLog> {
    if (isSupabaseConfigured && supabase) {
      // Upsert word count log for that date
      const { data, error } = await supabase
        .from('word_count_logs')
        .upsert(
          { project_id: projectId, date: dateStr, word_count: count, updated_at: new Date().toISOString() },
          { onConflict: 'project_id,date' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const logs = getLocalData<WordCountLog[]>('novel_word_logs', getInitialWordCountLogs());
      const index = logs.findIndex(l => l.project_id === projectId && l.date === dateStr);
      
      if (index !== -1) {
        logs[index].word_count = count;
        logs[index].updated_at = new Date().toISOString();
        setLocalData('novel_word_logs', logs);
        return logs[index];
      } else {
        const newLog: WordCountLog = {
          id: `l-${Math.random().toString(36).substr(2, 9)}`,
          project_id: projectId,
          date: dateStr,
          word_count: count,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        logs.push(newLog);
        setLocalData('novel_word_logs', logs);
        return newLog;
      }
    }
  }
};
