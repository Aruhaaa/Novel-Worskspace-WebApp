import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import { PageHead } from '../ui/PageHead';
import { GuestGateModal } from '../Auth/GuestGateModal';

export const ProfileView: React.FC = () => {
  const { user, profile, updateProfile, isGuest } = useApp();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [dailyGoal, setDailyGoal] = useState(1000);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showGuestModal, setShowGuestModal] = useState(false);

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
    
    if (isGuest) {
      setShowGuestModal(true);
      return;
    }

    setIsSaving(true);
    setMessage('');
    
    const result = await updateProfile({
      display_name: displayName,
      bio,
      daily_word_goal: dailyGoal,
    });
    
    setIsSaving(false);
    
    if (result?.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (!user) return null;

  return (
    <div className="studio-view">
      <div className="page" style={{ maxWidth: 780 }}>
        <PageHead
          eyebrow="ACCOUNT"
          title={
            <>
              Your author <em>persona.</em>
            </>
          }
          lead="Manage how you appear in the Public Library, and your writing goal."
        />
        <form className="stack" onSubmit={handleSave}>
          <div className="card">
            <h3>Public profile</h3>
            <p style={{ margin: '6px 0 22px' }}>This is how you will appear to other users in the Public Library.</p>
            <label className="field">
              <span>Author name</span>
              <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="J.R.R. Tolkien" />
            </label>
            <label className="field">
              <span>Author bio</span>
              <textarea className="textarea" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell your readers a bit about yourself…" />
            </label>
          </div>
          <div className="card">
            <h3>Daily word goal</h3>
            <p style={{ margin: '6px 0 22px' }}>A target for your writing sessions. The tracker will help you stay on course.</p>
            <label className="field">
              <span>Words per day</span>
              <input className="input" type="number" min="0" style={{ maxWidth: 200 }} value={dailyGoal} onChange={(e) => setDailyGoal(parseInt(e.target.value) || 0)} />
            </label>
          </div>
          <div className="page-actions">
            <button className="small-btn is-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
            <Link className="small-btn" to="/preferences">Open preferences</Link>
          </div>
          {message && (
            <p className="mock-note" role="status">{message}</p>
          )}
        </form>
      </div>

      <GuestGateModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        message="You need a free account to create an author profile and set your daily goal."
      />
    </div>
  );
};
