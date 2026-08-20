export interface User {
  id: string;
  email: string;
}

export interface UserProfile {
  id: string;
  display_name: string;
  bio: string;
  daily_word_goal: number;
  followers?: string[];
  following?: string[];
  tutorial_completed?: boolean;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string;
  is_published?: boolean;
  author_name?: string;
  genre?: string;
  cover_url?: string;
  likes?: string[]; // Array of user IDs who liked it
  views?: string[]; // Array of user IDs who viewed/read it
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  project_id: string;
  user_id: string;
  rating: number; // 1-5
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  project_id: string;
  chapter_id?: string;
  user_id: string;
  content: string;
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
  type: 'character' | 'location' | 'item' | 'lore' | 'scene';
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

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}
