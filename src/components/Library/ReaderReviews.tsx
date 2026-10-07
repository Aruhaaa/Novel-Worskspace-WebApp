import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { databaseService } from '../../services/database';
import { useApp } from '../../context/AppContext';
import type { Review, UserProfile } from '../../services/types';

interface Props {
  projectId: string;
}

const Stars: React.FC<{ value: number; onPick?: (n: number) => void }> = ({ value, onPick }) => (
  <div className="stars" role={onPick ? 'radiogroup' : 'img'} aria-label={onPick ? 'Rating' : `${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((n) =>
      onPick ? (
        <button key={n} type="button" className={n <= value ? 'on' : ''} role="radio" aria-checked={n === value} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onPick(n)}>
          <Star />
        </button>
      ) : (
        <span key={n} className={n <= value ? 'on' : ''}>
          <Star />
        </span>
      )
    )}
  </div>
);

export const ReaderReviews: React.FC<Props> = ({ projectId }) => {
  const { user } = useApp();
  const [reviews, setReviews] = useState<(Review & { profile?: UserProfile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRating, setNewRating] = useState(5);
  const [newContent, setNewContent] = useState('');

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      try {
        const data = await databaseService.getReviews(projectId);
        const userIds = Array.from(new Set(data.map((r) => r.user_id)));
        const profiles = await databaseService.getProfilesByIds(userIds);
        const profileMap = new Map(profiles.map((p) => [p.id, p]));
        setReviews(data.map((r) => ({ ...r, profile: profileMap.get(r.user_id) })));
      } catch (err) {
        console.error('Error fetching reviews:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newContent.trim()) return;
    try {
      const review = await databaseService.createReview(projectId, user.id, newRating, newContent.trim());
      const profiles = await databaseService.getProfilesByIds([user.id]);
      setReviews((prev) => [{ ...review, profile: profiles[0] }, ...prev]);
      setNewContent('');
      setNewRating(5);
    } catch (err) {
      console.error('Error submitting review:', err);
    }
  };

  const avg = reviews.length > 0 ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <section aria-label="Reviews" style={{ marginTop: 44 }}>
      <h2 className="section-title">
        Reviews {avg && <span className="meta" style={{ fontFamily: 'var(--sans)', fontSize: 13 }}>· {avg} average · {reviews.length}</span>}
      </h2>

      {user ? (
        <form className="review-box" onSubmit={handleSubmit}>
          <strong style={{ fontSize: 13 }}>Leave a review</strong>
          <div style={{ margin: '10px 0 12px' }}>
            <Stars value={newRating} onPick={setNewRating} />
          </div>
          <textarea className="textarea" style={{ minHeight: 84 }} value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="What did you think of this novel?" />
          <button className="small-btn is-primary" style={{ marginTop: 12 }} disabled={!newContent.trim()}>
            Post review
          </button>
        </form>
      ) : (
        <p className="meta">Sign in to leave a review.</p>
      )}

      {loading ? (
        <p className="meta" style={{ marginTop: 14 }}>Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="meta" style={{ marginTop: 14 }}>No reviews yet. Be the first!</p>
      ) : (
        reviews.map((r) => (
          <div className="review" key={r.id}>
            <span className="avatar">{(r.profile?.display_name || 'A')[0].toUpperCase()}</span>
            <div>
              <strong>{r.profile?.display_name || 'Anonymous reader'}</strong>
              <small>{new Date(r.created_at).toLocaleDateString()}</small>
              <Stars value={r.rating} />
              <p>{r.content}</p>
            </div>
          </div>
        ))
      )}
    </section>
  );
};
