import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import { PageHead } from '../ui/PageHead';
import { GuestGateModal } from '../Auth/GuestGateModal';
import { useT } from '../../i18n';

export const ProfileView: React.FC = () => {
  const { user, profile } = useApp();
  if (!user) return null;
  // The form starts from the saved profile, so it is built again once the profile has arrived
  return <ProfileForm key={profile?.id ?? 'unsaved'} />;
};

const ProfileForm: React.FC = () => {
  const t = useT();
  const { user, profile, updateProfile, isGuest } = useApp();
  const [displayName, setDisplayName] = useState(profile ? profile.display_name || '' : user?.email ? user.email.split('@')[0] : '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [dailyGoal, setDailyGoal] = useState(profile?.daily_word_goal || 1000);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showGuestModal, setShowGuestModal] = useState(false);

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
      setMessage(t('Error: {error}', { error: String(result.error) }));
    } else {
      setMessage(t('Profile updated successfully!'));
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="studio-view">
      <div className="page" style={{ maxWidth: 780 }}>
        <PageHead
          eyebrow={t('ACCOUNT')}
          title={
            <>
              {t('Your author')} <em>{t('persona.')}</em>
            </>
          }
          lead={t('Manage how you appear in the Public Library, and your writing goal.')}
        />
        <form className="stack" onSubmit={handleSave}>
          <div className="card">
            <h3>{t('Public profile')}</h3>
            <p style={{ margin: '6px 0 22px' }}>{t('This is how you will appear to other users in the Public Library.')}</p>
            <label className="field">
              <span>{t('Author name')}</span>
              <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('J.R.R. Tolkien')} />
            </label>
            <label className="field">
              <span>{t('Author bio')}</span>
              <textarea className="textarea" value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t('Tell your readers a bit about yourself…')} />
            </label>
          </div>
          <div className="card">
            <h3>{t('Daily word goal')}</h3>
            <p style={{ margin: '6px 0 22px' }}>{t('A target for your writing sessions. The tracker will help you stay on course.')}</p>
            <label className="field">
              <span>{t('Words per day')}</span>
              <input className="input" type="number" min="0" style={{ maxWidth: 200 }} value={dailyGoal} onChange={(e) => setDailyGoal(parseInt(e.target.value) || 0)} />
            </label>
          </div>
          <div className="page-actions">
            <button className="small-btn is-primary" disabled={isSaving}>
              {isSaving ? t('Saving…') : t('Save changes')}
            </button>
            <Link className="small-btn" to="/preferences">{t('Open preferences')}</Link>
          </div>
          {message && (
            <p className="mock-note" role="status">{message}</p>
          )}
        </form>
      </div>

      <GuestGateModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        message={t('You need a free account to create an author profile and set your daily goal.')}
      />
    </div>
  );
};
