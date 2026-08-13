import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { User as UserIcon, Save, Loader2 } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { user, profile, updateProfile } = useApp();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [dailyGoal, setDailyGoal] = useState(1000);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setDailyGoal(profile.daily_word_goal || 1000);
    } else if (user) {
      // Default fallback
      setDisplayName(user.email ? user.email.split('@')[0] : '');
    }
  }, [profile, user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    
    await updateProfile({
      display_name: displayName,
      bio,
      daily_word_goal: dailyGoal,
    });
    
    setIsSaving(false);
    setMessage('Profile updated successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  if (!user) return null;

  return (
    <div className="flex-1 bg-slate-950 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-12">
        <header className="mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-4 border border-indigo-500/20">
            <UserIcon className="w-8 h-8 text-indigo-400 stroke-[1.5]" />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">My Profile</h1>
          <p className="text-slate-400">
            Manage your public author persona and writing goals.
          </p>
        </header>

        <form onSubmit={handleSave} className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 space-y-6">
          
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Author Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. J.R.R. Tolkien"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-2">
              This is how you will appear to other users in the Public Library.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Author Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your readers a bit about yourself..."
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
            />
          </div>

          <div className="border-t border-slate-800/60 pt-6">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Daily Word Count Goal
            </label>
            <input
              type="number"
              min={100}
              step={100}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
              className="w-full max-w-[200px] bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-2">
              Set a target for your writing sessions. The Tracker will help you stay on course.
            </p>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
            {message && (
              <span className="text-sm font-medium text-emerald-400 animate-in fade-in slide-in-from-left-2">
                {message}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
