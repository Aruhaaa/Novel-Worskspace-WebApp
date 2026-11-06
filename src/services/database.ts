import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { readThrough, isNetworkFailure } from '../lib/offlineCache';
import { tryCloud, unwrap } from '../lib/cloud';
import { pushLocalNotification } from '../lib/notifications';
import {
  isBundledAuthor,
  isBundledNovel,
  getBundledAuthor,
  getBundledAuthors,
  getBundledChapters,
  getBundledProjects,
  toggleBundledLike,
  trackBundledView,
  forgetBundledUser,
} from '../lib/bundledLibrary';
import { isMissingColumn, isMissingFunction } from '../lib/chapterPublishing';
import type { Project, Chapter, WikiEntity, WordCountLog, UserProfile, Review, Comment, ChatMessage } from './types';

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

const INITIAL_REVIEWS: Review[] = [
  {
    id: 'r1-mock',
    project_id: MOCK_PROJECT_ID,
    user_id: 'user-mock-2',
    rating: 5,
    content: 'Absolutely incredible world-building! I could not put it down.',
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }
];

const INITIAL_COMMENTS: Comment[] = [
  {
    id: 'cm1-mock',
    project_id: MOCK_PROJECT_ID,
    chapter_id: 'c1-mock',
    user_id: 'user-mock-2',
    content: 'The imagery in this first chapter is stunning!',
    created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString()
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

// Local mode has no server to tell people things, so the app notes down, for the other account, what happened
const localName = (userId: string): string => {
  const profile = getLocalData<UserProfile[]>('novel_profiles', []).find((p) => p.id === userId);
  return profile?.display_name || userId.replace(/^mock-user-/, '').split('@')[0] || '';
};
const localProject = (projectId: string): { owner: string; title: string } | null => {
  const found = getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS).find((p) => p.id === projectId);
  return found && !isBundledAuthor(found.user_id) ? { owner: found.user_id, title: found.title } : null;
};

// Bulk writes (import) go to the cloud in chunks: at most this many rows, and about this many bytes, per request
const BULK_ROWS = 100;
const BULK_BYTES = 1.5 * 1024 * 1024;

/** Size of a string once written as UTF-8, close enough to keep a request near its target size. */
const byteLength = (s: string): number => {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
};

/** Delete chapters by id, a few dozen per request so the address stays short. With `strict`, a failure is thrown. */
const removeChapters = async (client: SupabaseClient, ids: string[], strict = false): Promise<void> => {
  for (let i = 0; i < ids.length; i += 50) {
    const { error } = await client.from('chapters').delete().in('id', ids.slice(i, i + 50));
    if (error && strict) throw error;
  }
};

/**
 * The cloud client, except for the sample library's novels: their reviews and comments are kept on the device,
 * because there is no row in the database for them to belong to.
 */
const cloudFor = (projectId: string): SupabaseClient | null => (isSupabaseConfigured && supabase && !isBundledNovel(projectId) ? supabase : null);

const newestFirst = (a: Project, b: Project): number => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

export const databaseService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    if (isBundledAuthor(userId)) return getBundledAuthor(userId);
    if (isSupabaseConfigured && supabase) {
      const client = supabase;
      return readThrough<UserProfile | null>(`profile_${userId}`, async () => {
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (error && error.code !== 'PGRST116') {
          // Not being able to reach the server is not "no profile", or a default one would be created over the real one
          if (isNetworkFailure(error)) throw error;
          console.error('Error fetching profile:', error);
        }
        return data || null;
      });
    } else {
      const profiles = getLocalData<UserProfile[]>('novel_profiles', []);
      return profiles.find(p => p.id === userId) || null;
    }
  },

  async updateProfile(userId: string, fields: Partial<UserProfile>): Promise<UserProfile> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...fields })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const profiles = getLocalData<UserProfile[]>('novel_profiles', []);
      const index = profiles.findIndex(p => p.id === userId);
      let updated: UserProfile;
      if (index === -1) {
        updated = { id: userId, display_name: '', bio: '', daily_word_goal: 1000, ...fields };
        profiles.push(updated);
      } else {
        updated = { ...profiles[index], ...fields };
        profiles[index] = updated;
      }
      setLocalData('novel_profiles', profiles);
      return updated;
    }
  },

  // --- PROJECTS ---
  async getProjects(userId: string): Promise<Project[]> {
    if (isSupabaseConfigured && supabase) {
      const client = supabase;
      return readThrough(`projects_${userId}`, async () => {
        const { data, error } = await client.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      });
    } else {
      const allProjects = getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS);
      return allProjects.filter(p => p.user_id === userId);
    }
  },

  /** Projects by id: the ones other people have shared with you. */
  async getProjectsByIds(ids: string[]): Promise<Project[]> {
    if (ids.length === 0) return [];
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('projects').select('*').in('id', ids);
      if (error) throw error;
      return data || [];
    }
    return getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS).filter((p) => ids.includes(p.id));
  },

  async createProject(userId: string, title: string, description: string): Promise<Project> {
    if (isSupabaseConfigured && supabase) {
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
        user_id: userId,
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

  async createExternalProject(userId: string, title: string, authorName: string, description: string, genre: string, coverUrl: string): Promise<Project> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('projects')
        .insert([{ 
          title, 
          description, 
          user_id: userId,
          is_published: true,
          author_name: authorName,
          genre,
          cover_url: coverUrl
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const projects = getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS);
      const newProj: Project = {
        id: `p-ext-${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        title,
        description,
        is_published: true,
        author_name: authorName,
        genre,
        cover_url: coverUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      projects.unshift(newProj);
      setLocalData('novel_projects', projects);
      return newProj;
    }
  },

  async getPublicProjects(): Promise<Project[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('projects').select('*').eq('is_published', true).order('updated_at', { ascending: false });
      if (error) throw error;
      return [...(data || []), ...getBundledProjects()].sort(newestFirst);
    } else {
      const allProjects = getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS);
      return [...allProjects.filter(p => p.is_published === true), ...getBundledProjects()].sort(newestFirst);
    }
  },

  async publishProject(projectId: string, isPublished: boolean, authorName: string): Promise<Project> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('projects')
        .update({ is_published: isPublished, author_name: authorName, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const projects = getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS);
      const index = projects.findIndex(p => p.id === projectId);
      if (index === -1) throw new Error('Project not found');
      
      const updated = {
        ...projects[index],
        is_published: isPublished,
        author_name: authorName,
        updated_at: new Date().toISOString()
      };
      projects[index] = updated;
      setLocalData('novel_projects', projects);
      // Turning a whole novel on with no chapter published publishes them all (the database does the same in a trigger)
      if (isPublished) {
        const chapters = getLocalData<Chapter[]>('novel_chapters', INITIAL_CHAPTERS);
        const mine = chapters.filter((c) => c.project_id === projectId);
        if (mine.length > 0 && mine.every((c) => c.published_at === null)) {
          const stamp = new Date().toISOString();
          setLocalData('novel_chapters', chapters.map((c) => (c.project_id === projectId ? { ...c, published_at: stamp } : c)));
        }
      }
      return updated;
    }
  },

  /**
   * Publish or unpublish chapters of one novel (draft = `published_at` null). A novel is listed in the library while at least one
   * of its chapters is published, so the first chapter published lists it and the last one unpublished takes it out. Only the
   * owner or a co-author may do this (the database refuses anyone else). Returns the chapters as they are now and the project.
   */
  async setChaptersPublished(projectId: string, chapterIds: string[], published: boolean): Promise<{ chapters: Chapter[]; project: Project }> {
    const stamp = published ? new Date().toISOString() : null;
    if (isSupabaseConfigured && supabase) {
      const client = supabase;
      if (chapterIds.length > 0) {
        const { error } = await client.from('chapters').update({ published_at: stamp }).eq('project_id', projectId).in('id', chapterIds);
        if (error) {
          if (isMissingColumn(error)) throw new Error('Publishing chapter by chapter needs a database update first. Ask the person who runs the database to run the chapter publishing setup.');
          throw error;
        }
      }
      const { data: project, error: projectError } = await client.from('projects').select('*').eq('id', projectId).single();
      if (projectError) throw projectError;
      const { data: chapters, error: chaptersError } = await client.from('chapters').select('*').eq('project_id', projectId).order('position', { ascending: true });
      if (chaptersError) throw chaptersError;
      return { chapters: (chapters || []) as Chapter[], project: project as Project };
    }
    const all = getLocalData<Chapter[]>('novel_chapters', INITIAL_CHAPTERS);
    const ids = new Set(chapterIds);
    const next = all.map((c) => (c.project_id === projectId && ids.has(c.id) ? { ...c, published_at: stamp } : c));
    setLocalData('novel_chapters', next);
    const mine = next.filter((c) => c.project_id === projectId).sort((a, b) => a.position - b.position);
    const listed = mine.some((c) => c.published_at !== null);
    const projects = getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS);
    const index = projects.findIndex((p) => p.id === projectId);
    if (index === -1) throw new Error('Project not found');
    const project: Project = { ...projects[index], is_published: listed, updated_at: new Date().toISOString() };
    projects[index] = project;
    setLocalData('novel_projects', projects);
    return { chapters: mine, project };
  },
  async updateProjectSettings(projectId: string, fields: Partial<Pick<Project, 'title' | 'description' | 'cover_url' | 'genre' | 'author_name'>>): Promise<Project> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('projects')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const projects = getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS);
      const index = projects.findIndex(p => p.id === projectId);
      if (index === -1) throw new Error('Project not found');
      
      const updated = {
        ...projects[index],
        ...fields,
        updated_at: new Date().toISOString()
      };
      projects[index] = updated;
      setLocalData('novel_projects', projects);
      return updated;
    }
  },

  /** Remove a project and everything inside it. */
  async deleteProject(projectId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      // Children first, in case the database does not cascade
      for (const table of ['word_count_logs', 'comments', 'reviews', 'entities', 'chapters']) {
        const { error } = await supabase.from(table).delete().eq('project_id', projectId);
        if (error) throw error;
      }
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
    } else {
      const drop = <T extends { project_id: string }>(key: string, fallback: T[]) =>
        setLocalData(key, getLocalData<T[]>(key, fallback).filter(item => item.project_id !== projectId));
      drop<Chapter>('novel_chapters', INITIAL_CHAPTERS);
      drop<WikiEntity>('novel_entities', INITIAL_ENTITIES);
      drop<WordCountLog>('novel_word_logs', getInitialWordCountLogs());
      drop<Review>('novel_reviews', []);
      drop<Comment>('novel_comments', []);
      setLocalData('novel_projects', getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS).filter(p => p.id !== projectId));
    }
  },

  /**
   * Remove a person's account and everything they made. With the cloud database this is one server function that
   * also removes the sign-in; the caller then signs out. Needs supabase/setup_scripts/20261008_account_safety.sql.
   */
  async deleteAccount(userId: string): Promise<{ error: string | null }> {
    if (isSupabaseConfigured && supabase) {
      const res = await tryCloud('account', async (c) => unwrap(await c.rpc('delete_my_account')));
      if (res.ok) {
        // What this person left on the sample novels lives on this device only
        forgetBundledUser(userId);
        setLocalData('novel_comments', getLocalData<Comment[]>('novel_comments', INITIAL_COMMENTS).filter(c => c.user_id !== userId));
        setLocalData('novel_reviews', getLocalData<Review[]>('novel_reviews', INITIAL_REVIEWS).filter(r => r.user_id !== userId));
        return { error: null };
      }
      if (res.reason === 'setup') return { error: 'Deleting accounts is not switched on for this site yet. Please tell the site owner.' };
      if (res.reason === 'network') return { error: 'Could not reach the server. Check your connection and try again.' };
      const message = (res.error as { message?: unknown } | undefined)?.message;
      return { error: typeof message === 'string' && message ? message : 'The account could not be deleted. Nothing was removed.' };
    }

    // Local mode: everything lives in this browser
    const mine = getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS).filter(p => p.user_id === userId);
    for (const project of mine) await this.deleteProject(project.id);
    setLocalData('novel_profiles', getLocalData<UserProfile[]>('novel_profiles', []).map(p => ({
      ...p,
      followers: (p.followers || []).filter(id => id !== userId),
      following: (p.following || []).filter(id => id !== userId),
    })).filter(p => p.id !== userId));
    setLocalData('novel_projects', getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS).map(p => ({
      ...p,
      likes: (p.likes || []).filter(id => id !== userId),
      views: (p.views || []).filter(id => id !== userId),
    })));
    forgetBundledUser(userId);
    setLocalData('novel_comments', getLocalData<Comment[]>('novel_comments', INITIAL_COMMENTS).filter(c => c.user_id !== userId));
    setLocalData('novel_reviews', getLocalData<Review[]>('novel_reviews', INITIAL_REVIEWS).filter(r => r.user_id !== userId));
    setLocalData('novel_chats', getLocalData<ChatMessage[]>('novel_chats', []).filter(m => m.sender_id !== userId && m.receiver_id !== userId));
    try {
      localStorage.removeItem(`novelist_blocks_${userId}`);
    } catch {
      // ignore
    }
    return { error: null };
  },

  async toggleLikeProject(projectId: string, userId: string): Promise<Project> {
    if (isBundledNovel(projectId)) return toggleBundledLike(projectId, userId);
    if (isSupabaseConfigured && supabase) {
      // Once the chapter publishing setup has run, only this function may change likes. Before that, the old way still works.
      const viaFunction = await supabase.rpc('toggle_project_like', { p_project: projectId });
      if (!viaFunction.error) return viaFunction.data as Project;
      if (!isMissingFunction(viaFunction.error)) throw viaFunction.error;
      // Fetch current likes
      const { data: proj, error: fetchErr } = await supabase.from('projects').select('likes').eq('id', projectId).single();
      if (fetchErr) throw fetchErr;
      
      let currentLikes = proj?.likes || [];
      if (currentLikes.includes(userId)) {
        currentLikes = currentLikes.filter((id: string) => id !== userId);
      } else {
        currentLikes = [...currentLikes, userId];
      }

      const { data, error } = await supabase
        .from('projects')
        .update({ likes: currentLikes })
        .eq('id', projectId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const projects = getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS);
      const index = projects.findIndex(p => p.id === projectId);
      if (index === -1) throw new Error('Project not found');
      
      let currentLikes = projects[index].likes || [];
      if (currentLikes.includes(userId)) {
        currentLikes = currentLikes.filter(id => id !== userId);
      } else {
        currentLikes = [...currentLikes, userId];
      }

      const updated = { ...projects[index], likes: currentLikes };
      projects[index] = updated;
      setLocalData('novel_projects', projects);
      return updated;
    }
  },
  // --- CHAPTERS ---
  async getChapters(projectId: string): Promise<Chapter[]> {
    if (isBundledNovel(projectId)) return getBundledChapters(projectId);
    if (isSupabaseConfigured && supabase) {
      const client = supabase;
      return readThrough(`chapters_${projectId}`, async () => {
        const { data, error } = await client
          .from('chapters')
          .select('*')
          .eq('project_id', projectId)
          .order('position', { ascending: true });
        if (error) throw error;
        return data || [];
      });
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
        published_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      chapters.push(newChapter);
      setLocalData('novel_chapters', chapters);
      return newChapter;
    }
  },

  /**
   * Add many chapters after the ones a project already has, in as few requests as possible (used by import).
   * The cloud database gets them in chunks of about 1.5 MB. If a later chunk fails, the chunks already saved are
   * removed again and the error is thrown, so a failed import leaves nothing behind. The local database is written once.
   */
  async createChaptersBulk(projectId: string, items: { title: string; content: string }[]): Promise<Chapter[]> {
    if (items.length === 0) return [];
    if (isSupabaseConfigured && supabase) {
      const client = supabase;
      const { data: tail, error: tailError } = await client
        .from('chapters')
        .select('position')
        .eq('project_id', projectId)
        .order('position', { ascending: false })
        .limit(1);
      if (tailError) throw tailError;
      const first = tail && tail.length ? Number(tail[0].position) + 1 : 0;

      const chunks: { project_id: string; title: string; content: string; position: number }[][] = [];
      let current: (typeof chunks)[number] = [];
      let size = 0;
      items.forEach((item, i) => {
        const bytes = byteLength(item.title) + byteLength(item.content) + 120;
        if (current.length > 0 && (current.length >= BULK_ROWS || size + bytes > BULK_BYTES)) {
          chunks.push(current);
          current = [];
          size = 0;
        }
        current.push({ project_id: projectId, title: item.title, content: item.content, position: first + i });
        size += bytes;
      });
      if (current.length > 0) chunks.push(current);

      const saved: Chapter[] = [];
      let inFlight: { from: number; to: number } | null = null;
      try {
        for (const chunk of chunks) {
          inFlight = { from: chunk[0].position, to: chunk[chunk.length - 1].position };
          const { data, error } = await client.from('chapters').insert(chunk).select();
          if (error) throw error;
          saved.push(...(data as Chapter[]));
          inFlight = null;
        }
      } catch (err) {
        // Best effort: take back what was saved. The chunk that was in flight may have arrived even though its answer did not.
        try {
          await removeChapters(client, saved.map((c) => c.id));
          if (inFlight) await client.from('chapters').delete().eq('project_id', projectId).gte('position', inFlight.from).lte('position', inFlight.to);
        } catch {
          // nothing more can be done from here
        }
        throw err;
      }
      return saved.sort((a, b) => a.position - b.position);
    } else {
      const chapters = getLocalData<Chapter[]>('novel_chapters', INITIAL_CHAPTERS);
      const first = chapters.reduce((next, c) => (c.project_id === projectId ? Math.max(next, c.position + 1) : next), 0);
      const taken = new Set(chapters.map((c) => c.id));
      const now = new Date().toISOString();
      const created: Chapter[] = items.map((item, i) => {
        let id: string;
        do {
          id = `c-${Math.random().toString(36).slice(2, 11)}`;
        } while (taken.has(id));
        taken.add(id);
        return { id, project_id: projectId, title: item.title, content: item.content, position: first + i, published_at: null, created_at: now, updated_at: now };
      });
      setLocalData('novel_chapters', [...chapters, ...created]);
      return created;
    }
  },

  /** Remove several chapters at once, without keeping a copy (used to undo an import). */
  async deleteChaptersBulk(chapterIds: string[]): Promise<void> {
    if (chapterIds.length === 0) return;
    if (isSupabaseConfigured && supabase) {
      await removeChapters(supabase, chapterIds, true);
    } else {
      const drop = new Set(chapterIds);
      setLocalData('novel_chapters', getLocalData<Chapter[]>('novel_chapters', INITIAL_CHAPTERS).filter((c) => !drop.has(c.id)));
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
      const client = supabase;
      return readThrough(`entities_${projectId}`, async () => {
        const { data, error } = await client
          .from('entities')
          .select('*')
          .eq('project_id', projectId)
          .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
      });
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

  async deleteChapter(chapterId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
      if (error) throw error;
    } else {
      const chapters = getLocalData<Chapter[]>('novel_chapters', INITIAL_CHAPTERS);
      setLocalData('novel_chapters', chapters.filter(c => c.id !== chapterId));
    }
  },

  // --- WORD COUNT LOGS (TRACKER) ---
  async getWordCountLogs(projectId: string): Promise<WordCountLog[]> {
    if (isSupabaseConfigured && supabase) {
      const client = supabase;
      return readThrough(`logs_${projectId}`, async () => {
        const { data, error } = await client
          .from('word_count_logs')
          .select('*')
          .eq('project_id', projectId)
          .order('date', { ascending: true });
        if (error) throw error;
        return data || [];
      });
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
  },

  // --- ENGAGEMENT & COMMUNITY ---
  async getProfilesByIds(userIds: string[]): Promise<UserProfile[]> {
    if (!userIds || userIds.length === 0) return [];
    // The sample library's pen names are not in the database
    const pennames = getBundledAuthors(userIds.filter(isBundledAuthor));
    const ids = userIds.filter(id => !isBundledAuthor(id));
    if (ids.length === 0) return pennames;
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
      if (error) throw error;
      return [...(data || []), ...pennames];
    } else {
      const profiles = getLocalData<UserProfile[]>('novel_profiles', []);
      return [...profiles.filter(p => ids.includes(p.id)), ...pennames];
    }
  },

  async trackProjectView(projectId: string, userId: string): Promise<Project> {
    if (isBundledNovel(projectId)) return trackBundledView(projectId, userId);
    if (isSupabaseConfigured && supabase) {
      const viaFunction = await supabase.rpc('record_project_view', { p_project: projectId });
      if (!viaFunction.error) return viaFunction.data as Project;
      if (!isMissingFunction(viaFunction.error)) throw viaFunction.error;
      const { data: proj, error: fetchErr } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (fetchErr) throw fetchErr;

      let currentViews = proj?.views || [];
      if (!currentViews.includes(userId)) {
        currentViews = [...currentViews, userId];
        const { data, error } = await supabase.from('projects').update({ views: currentViews }).eq('id', projectId).select().single();
        if (error) throw error;
        return data;
      }
      return proj as Project;
    } else {
      const projects = getLocalData<Project[]>('novel_projects', INITIAL_PROJECTS);
      const index = projects.findIndex(p => p.id === projectId);
      if (index === -1) throw new Error('Project not found');
      
      let currentViews = projects[index].views || [];
      if (!currentViews.includes(userId)) {
        currentViews = [...currentViews, userId];
        const updated = { ...projects[index], views: currentViews };
        projects[index] = updated;
        setLocalData('novel_projects', projects);
        return updated;
      }
      return projects[index];
    }
  },

  async getReviews(projectId: string): Promise<Review[]> {
    const client = cloudFor(projectId);
    if (client) {
      const { data, error } = await client.from('reviews').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      const reviews = getLocalData<Review[]>('novel_reviews', INITIAL_REVIEWS);
      return reviews.filter(r => r.project_id === projectId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  async createReview(projectId: string, userId: string, rating: number, content: string): Promise<Review> {
    const client = cloudFor(projectId);
    if (client) {
      const { data, error } = await client.from('reviews').insert([{ project_id: projectId, user_id: userId, rating, content }]).select().single();
      if (error) throw error;
      return data;
    } else {
      const reviews = getLocalData<Review[]>('novel_reviews', INITIAL_REVIEWS);
      const newReview: Review = {
        id: `r-${Math.random().toString(36).substr(2, 9)}`,
        project_id: projectId,
        user_id: userId,
        rating,
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      reviews.unshift(newReview);
      setLocalData('novel_reviews', reviews);
      const target = localProject(projectId);
      if (target) {
        pushLocalNotification(target.owner, { actor_id: userId, actor_name: localName(userId), kind: 'review', project_id: projectId, ref_id: newReview.id, snippet: content, meta: { project_title: target.title, rating } });
      }
      return newReview;
    }
  },

  async getComments(projectId: string, chapterId?: string): Promise<Comment[]> {
    const client = cloudFor(projectId);
    if (client) {
      let query = client.from('comments').select('*').eq('project_id', projectId);
      if (chapterId) {
        query = query.eq('chapter_id', chapterId);
      } else {
        query = query.is('chapter_id', null);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      const comments = getLocalData<Comment[]>('novel_comments', INITIAL_COMMENTS);
      let filtered = comments.filter(c => c.project_id === projectId);
      if (chapterId) {
        filtered = filtered.filter(c => c.chapter_id === chapterId);
      } else {
        filtered = filtered.filter(c => !c.chapter_id);
      }
      return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  async createComment(projectId: string, userId: string, content: string, chapterId?: string): Promise<Comment> {
    const client = cloudFor(projectId);
    if (client) {
      const { data, error } = await client.from('comments').insert([{ project_id: projectId, user_id: userId, content, chapter_id: chapterId }]).select().single();
      if (error) throw error;
      return data;
    } else {
      const comments = getLocalData<Comment[]>('novel_comments', INITIAL_COMMENTS);
      const newComment: Comment = {
        id: `cm-${Math.random().toString(36).substr(2, 9)}`,
        project_id: projectId,
        user_id: userId,
        content,
        chapter_id: chapterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      comments.unshift(newComment);
      setLocalData('novel_comments', comments);
      const target = localProject(projectId);
      if (target) {
        pushLocalNotification(target.owner, { actor_id: userId, actor_name: localName(userId), kind: 'comment', project_id: projectId, chapter_id: chapterId ?? null, ref_id: newComment.id, snippet: content, meta: { project_title: target.title } });
      }
      return newComment;
    }
  },

  // --- FOLLOWERS & CHAT ---
  async toggleFollowUser(currentUserId: string, targetUserId: string): Promise<boolean> {
    // A pen name in the sample library is not a person with an account, so there is nothing to follow
    if (isBundledAuthor(targetUserId)) return false;
    // With the cloud set up, the server does the whole thing: both profiles, and the notification
    const viaServer = await tryCloud('social', async (c) => Boolean(unwrap(await c.rpc('follow_user', { p_target: targetUserId }))));
    if (viaServer.ok) return viaServer.value;
    if (viaServer.reason === 'error' || viaServer.reason === 'network') throw viaServer.error;
    const pCurrent = await this.getProfile(currentUserId) || { id: currentUserId, display_name: '', bio: '', daily_word_goal: 1000, following: [], followers: [] };
    const pTarget = await this.getProfile(targetUserId) || { id: targetUserId, display_name: '', bio: '', daily_word_goal: 1000, following: [], followers: [] };
    
    let currentFollowing = pCurrent.following || [];
    let targetFollowers = pTarget.followers || [];

    const isFollowing = currentFollowing.includes(targetUserId);

    if (isFollowing) {
      currentFollowing = currentFollowing.filter(id => id !== targetUserId);
      targetFollowers = targetFollowers.filter(id => id !== currentUserId);
    } else {
      currentFollowing.push(targetUserId);
      targetFollowers.push(currentUserId);
    }

    await this.updateProfile(currentUserId, { following: currentFollowing });
    await this.updateProfile(targetUserId, { followers: targetFollowers });
    if (!isFollowing && !(isSupabaseConfigured && supabase)) {
      pushLocalNotification(targetUserId, { actor_id: currentUserId, actor_name: pCurrent.display_name || localName(currentUserId), kind: 'follow' });
    }

    return !isFollowing; // returns true if now following
  },

  async deleteExpiredMessages(): Promise<void> {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('chat_messages').delete().lt('created_at', twoWeeksAgo.toISOString());
    } else {
      let messages = getLocalData<ChatMessage[]>('novel_chats', []);
      messages = messages.filter(m => new Date(m.created_at) >= twoWeeksAgo);
      setLocalData('novel_chats', messages);
    }
  },

  async getChatMessages(userId1: string, userId2: string): Promise<ChatMessage[]> {
    await this.deleteExpiredMessages(); // Clean up on read
    
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } else {
      const messages = getLocalData<ChatMessage[]>('novel_chats', []);
      return messages.filter(m => 
        (m.sender_id === userId1 && m.receiver_id === userId2) ||
        (m.sender_id === userId2 && m.receiver_id === userId1)
      ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
  },

  async sendChatMessage(senderId: string, receiverId: string, content: string): Promise<ChatMessage> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{ sender_id: senderId, receiver_id: receiverId, content }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const messages = getLocalData<ChatMessage[]>('novel_chats', []);
      const newMsg: ChatMessage = {
        id: `msg-${Math.random().toString(36).substr(2, 9)}`,
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        created_at: new Date().toISOString()
      };
      messages.push(newMsg);
      setLocalData('novel_chats', messages);
      pushLocalNotification(receiverId, { actor_id: senderId, actor_name: localName(senderId), kind: 'message', ref_id: newMsg.id, snippet: content });
      return newMsg;
    }
  }
};
