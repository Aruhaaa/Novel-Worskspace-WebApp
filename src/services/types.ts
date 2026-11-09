export interface User {
  id: string;
  email: string;
  /** What the person said they came for, kept on their account so it follows them to another device */
  mode?: 'read' | 'write' | 'both';
}

export interface UserProfile {
  id: string;
  display_name: string;
  bio: string;
  daily_word_goal: number;
  followers?: string[];
  following?: string[];
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
  /** The language this novel is written in: a two or three letter code. Missing when never chosen, or on a database without the setup. */
  language?: string | null;
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
  /**
   * When the chapter was published to readers. `null` is a draft. Missing (older data, or a database that has not had
   * supabase/setup_scripts/20261106_chapter_publishing.sql run yet) counts as published whenever the novel is public:
   * see src/lib/chapterPublishing.ts.
   */
  published_at?: string | null;
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

export type ReportTarget = 'novel' | 'comment' | 'review' | 'message' | 'author';
export type ReportReason = 'spam' | 'harassment' | 'sexual' | 'violence' | 'copyright' | 'other';

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  /** Who wrote the reported thing, when known */
  target_user_id?: string | null;
  project_id?: string | null;
  reason: ReportReason;
  details: string;
  /** What the reported content said when it was reported, kept in case it is later edited or removed */
  excerpt: string;
  status: 'open' | 'actioned' | 'dismissed';
  created_at: string;
  resolved_at?: string | null;
}

/** What an import is asked to bring in: into a new project, or after the last chapter of the open one. */
export interface ImportInput {
  target: { kind: 'new'; title: string; description: string; authorName?: string } | { kind: 'append' };
  chapters: { title: string; html: string }[];
}

/** What an import reports back. Keep it to undo the import. */
export interface ImportResult {
  error: string | null;
  kind?: 'new' | 'append';
  projectId?: string;
  chapterIds?: string[];
  words?: number;
}
