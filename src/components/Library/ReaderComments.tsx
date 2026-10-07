import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');

  useEffect(() => {
    const fetchComments = async () => {
      setLoading(true);
      try {
        const data = await databaseService.getComments(projectId, chapterId);
        const userIds = Array.from(new Set(data.map((c) => c.user_id)));
        const profiles = await databaseService.getProfilesByIds(userIds);
        const profileMap = new Map(profiles.map((p) => [p.id, p]));
        setComments(data.map((c) => ({ ...c, profile: profileMap.get(c.user_id) })));
      } catch (err) {
        console.error('Error fetching comments:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, [projectId, chapterId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newContent.trim()) return;
    try {
      const comment = await databaseService.createComment(projectId, user.id, newContent.trim(), chapterId);
      const profiles = await databaseService.getProfilesByIds([user.id]);
      setComments((prev) => [{ ...comment, profile: profiles[0] }, ...prev]);
      setNewContent('');
    } catch (err) {
      console.error('Error submitting comment:', err);
    }
  };

  return (
    <section aria-label="Chapter comments" style={{ marginTop: 40 }}>
      <h2 className="section-title">Chapter comments</h2>
      {user ? (
        <form onSubmit={handleSubmit}>
          <label className="field" style={{ marginBottom: 10 }}>
            <span className="sr-only">Comment</span>
            <textarea
              className="textarea"
              style={{ minHeight: 84 }}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Share your thoughts on this chapter…"
            />
          </label>
          <button className="small-btn is-primary" disabled={!newContent.trim()}>
            <Send /> Post comment
          </button>
        </form>
      ) : (
        <p className="meta">Sign in to join the discussion.</p>
      )}

      <div style={{ marginTop: 20 }}>
        {loading ? (
          <p className="meta">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="meta">No comments yet. Be the first to share your thoughts.</p>
        ) : (
          comments.map((c) => (
            <div className="comment" key={c.id}>
              <span className="avatar">{(c.profile?.display_name || 'A')[0].toUpperCase()}</span>
              <div>
                <strong>{c.profile?.display_name || 'Anonymous reader'}</strong>
                <small>{new Date(c.created_at).toLocaleDateString()}</small>
                <p>{c.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
