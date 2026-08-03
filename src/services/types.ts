export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  project_id: string;
  title: string;
  content: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface WikiEntity {
  id: string;
  project_id: string;
  name: string;
  type: 'character' | 'location' | 'item' | 'lore';
  description: string;
  content: Record<string, string>;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface WordCountLog {
  id: string;
  project_id: string;
  date: string; // YYYY-MM-DD
  word_count: number;
  created_at: string;
  updated_at: string;
}
