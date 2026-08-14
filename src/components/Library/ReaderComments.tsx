import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { databaseService } from '../../services/database';
import { useApp } from '../../context/AppContext';
import type { Comment, UserProfile } from '../../services/types';

interface Props {
  projectId: string;
  chapterId: string;
}

export const ReaderComments: React.FC<Props> = ({ projectId, chapterId }) => {
  const { user } = useApp();
  const [comments, setComments] = useState<(Comment & { profile?: UserProfile })[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [newContent, setNewContent] = useState('');

  const fetchComments = async () => {
    setLoading(true);
    try {
      const data = await databaseService.getComments(projectId, chapterId);
      
      const userIds = Array.from(new Set(data.map(c => c.user_id)));
      const profiles = await databaseService.getProfilesByIds(userIds);
      const profileMap = new Map(profiles.map(p => [p.id, p]));
      
      setComments(data.map(c => ({ ...c, profile: profileMap.get(c.user_id) })));
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && comments.length === 0) {
      fetchComments();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newContent.trim()) return;

    try {
      const comment = await databaseService.createComment(projectId, user.id, newContent.trim(), chapterId);
      const profiles = await databaseService.getProfilesByIds([user.id]);
      const newCommentWithProfile = { ...comment, profile: profiles[0] };
      
      setComments(prev => [newCommentWithProfile, ...prev]);
      setNewContent('');
    } catch (err) {
      console.error('Error submitting comment:', err);
    }
  };

  return (
    <div className="mt-12 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden font-sans">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          Chapter Comments
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <span className="text-sm">{isOpen ? 'Hide' : 'Show'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-6 pb-6 border-t border-slate-200 dark:border-slate-800 pt-6">
          {/* Comment Form */}
          {user ? (
            <form onSubmit={handleSubmit} className="mb-8 flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0 mt-1">
                {(user.email || 'A')[0].toUpperCase()}
              </div>
              <div className="flex-1 relative">
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Share your thoughts on this chapter..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2.5 px-4 pr-12 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-[42px] min-h-[42px] max-h-[120px] leading-relaxed transition-all"
                  style={{ height: Math.max(42, newContent.split('\n').length * 24 + 18) + 'px' }}
                />
                <button
                  type="submit"
                  disabled={!newContent.trim()}
                  className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-md transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          ) : (
            <div className="mb-8 text-sm text-center text-slate-500 bg-white dark:bg-slate-950 py-3 rounded-lg border border-slate-200 dark:border-slate-800">
              Sign in to join the discussion.
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-5">
            {loading ? (
              <div className="text-center text-slate-500 animate-pulse text-sm">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center text-slate-500 text-sm italic">No comments yet. Be the first to share your thoughts!</div>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold shrink-0 text-xs">
                    {(comment.profile?.display_name || 'A')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{comment.profile?.display_name || 'Anonymous Reader'}</span>
                      <span className="text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
