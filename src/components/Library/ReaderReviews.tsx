import React, { useEffect, useState } from 'react';
import { Star, Send } from 'lucide-react';
import { databaseService } from '../../services/database';
import { useApp } from '../../context/AppContext';
import type { Review, UserProfile } from '../../services/types';

interface Props {
  projectId: string;
}

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
        
        // Fetch profiles for the reviewers
        const userIds = Array.from(new Set(data.map(r => r.user_id)));
        const profiles = await databaseService.getProfilesByIds(userIds);
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        
        setReviews(data.map(r => ({ ...r, profile: profileMap.get(r.user_id) })));
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
      const newReviewWithProfile = { ...review, profile: profiles[0] };
      
      setReviews(prev => [newReviewWithProfile, ...prev]);
      setNewContent('');
      setNewRating(5);
    } catch (err) {
      console.error('Error submitting review:', err);
    }
  };

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
    : 'New';

  return (
    <div className="mt-16 pt-12 border-t border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold font-sans">Reviews</h3>
        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-full">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          <span className="font-bold text-lg">{avgRating}</span>
          <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">({reviews.length})</span>
        </div>
      </div>

      {/* Review Form */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-10 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h4 className="font-sans font-semibold mb-3 text-sm uppercase tracking-wider text-slate-500">Leave a Review</h4>
          
          <div className="flex items-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setNewRating(star)}
                className={`transition-colors ${star <= newRating ? 'text-amber-500' : 'text-slate-300 dark:text-slate-700'}`}
              >
                <Star className={`w-6 h-6 ${star <= newRating ? 'fill-amber-500' : ''}`} />
              </button>
            ))}
          </div>

          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="What did you think of this novel?"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 font-sans text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none min-h-[100px]"
          />
          
          <div className="flex justify-end mt-3">
            <button
              type="submit"
              disabled={!newContent.trim()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-sans font-semibold text-sm transition-colors"
            >
              <Send className="w-4 h-4" />
              Post Review
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-10 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <p className="font-sans text-sm text-slate-500">Sign in to leave a review.</p>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center text-slate-500 animate-pulse font-sans text-sm">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center text-slate-500 italic font-sans">No reviews yet. Be the first!</div>
        ) : (
          reviews.map(review => (
            <div key={review.id} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0 font-sans">
                {(review.profile?.display_name || 'A')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold font-sans text-sm">{review.profile?.display_name || 'Anonymous Reader'}</span>
                  <span className="text-xs text-slate-400 font-sans">{new Date(review.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-0.5 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-700'}`} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-sans">
                  {review.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
