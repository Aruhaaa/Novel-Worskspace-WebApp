import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authService } from '../../services/auth';
import { databaseService } from '../../services/database';
import { useToast } from '../ui/toastContext';
import { Dialog } from '../ui/Dialog';
import type { UserProfile } from '../../services/types';
import { useT } from '../../i18n';

const CONFIRM_WORD = 'DELETE';

/** Everything about the account itself: password, who is blocked, and leaving for good. */
export const AccountSection: React.FC = () => {
  const t = useT();
  const { user, isSupabase, changePassword, deleteAccount, blockedIds, unblockUser } = useApp();
  const { toast } = useToast();

  // --- password
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (next.length < 6) return setPwError(t('Use at least 6 characters.'));
    if (next !== again) return setPwError(t('The two new passwords do not match.'));
    if (!user) return;
    setPwSaving(true);
    if (!(await authService.confirmPassword(user.email, current))) {
      setPwSaving(false);
      return setPwError(t('Your current password is not right.'));
    }
    const { error } = await changePassword(next);
    setPwSaving(false);
    if (error) return setPwError(error);
    setCurrent('');
    setNext('');
    setAgain('');
    toast({ message: t('Password changed.') });
  };

  // --- blocked people
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  useEffect(() => {
    if (blockedIds.length === 0) return;
    let live = true;
    databaseService
      .getProfilesByIds(blockedIds)
      .then((found) => {
        if (live) setProfiles(found);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [blockedIds]);
  // A person whose profile is gone, or not loaded yet, still has to be unblockable
  const blocked: UserProfile[] = blockedIds.map((id) => profiles.find((p) => p.id === id) ?? { id, display_name: '', bio: '', daily_word_goal: 0 });

  const unblock = async (person: UserProfile) => {
    const { saved } = await unblockUser(person.id);
    toast({ message: saved === 'saved' ? t('{name} can now see and message you again.', { name: person.display_name || t('They') }) : t('Unblocked on this device. It could not be saved to your account right now.') });
  };

  // --- delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setTyped('');
    setDeletePassword('');
    setDeleteError(null);
  };

  const confirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    const { error } = await deleteAccount(deletePassword);
    setDeleting(false);
    if (error) setDeleteError(error);
    // On success the app signs out and returns to the front page, so there is nothing more to do here
  };

  const canDelete = typed.trim() === CONFIRM_WORD && (!isSupabase || deletePassword.length > 0);

  return (
    <>
      <section aria-labelledby="account-h">
        <h2 className="section-title" id="account-h">{t('Account')}</h2>
        <p className="section-note">{t('Signed in as {email}.', { email: user?.email ?? '' })}</p>

        {isSupabase ? (
          <form onSubmit={savePassword} style={{ maxWidth: 320 }}>
            <strong style={{ fontSize: 13 }}>{t('Change password')}</strong>
            <label className="field" style={{ marginTop: 10 }}>
              <span>{t('Current password')}</span>
              <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </label>
            <label className="field">
              <span>{t('New password')}</span>
              <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
            </label>
            <label className="field">
              <span>{t('Type the new password again')}</span>
              <input className="input" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
            </label>
            {pwError && <p className="mock-note" role="alert" style={{ marginBottom: 12, color: 'var(--danger)' }}>{pwError}</p>}
            <button className="small-btn" disabled={pwSaving || !current || !next || !again}>{pwSaving ? t('Saving…') : t('Change password')}</button>
          </form>
        ) : (
          <p className="section-note">{t('Passwords are only used when the app is connected to the cloud database. In local mode your account lives in this browser.')}</p>
        )}
      </section>

      <hr className="divider" />

      <section aria-labelledby="blocked-h">
        <h2 className="section-title" id="blocked-h">{t('Blocked people')}</h2>
        <p className="section-note">
          {t('You do not see what they write or the novels they publish, and neither of you can message the other. They are not told.')}{' '}
          {t('Block someone from their profile, a comment, a review or a conversation.')}
        </p>
        {blocked.length === 0 ? (
          <p className="meta">{t('You have not blocked anyone.')}</p>
        ) : (
          <ul className="blocked-list" style={{ listStyle: 'none', padding: 0, margin: 0, maxWidth: 420 }}>
            {blocked.map((person) => (
              <li key={person.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="avatar" aria-hidden="true">{(person.display_name || 'A')[0].toUpperCase()}</span>
                <span style={{ flex: 1 }}>{person.display_name || t('Anonymous')}</span>
                <button className="small-btn" onClick={() => unblock(person)}>{t('Unblock')}</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <hr className="divider" />

      <section aria-labelledby="delete-h">
        <h2 className="section-title" id="delete-h">{t('Delete account')}</h2>
        <p className="section-note">
          {t('Permanently removes your account and everything in it: every novel and chapter, your notebook, notes, goals, version history, reading links, reviews, comments, messages and profile. This cannot be undone. Export anything you want to keep first, from Manuscripts.')}
        </p>
        <button className="small-btn is-danger" onClick={() => setDeleteOpen(true)}>{t('Delete my account…')}</button>
      </section>

      <Dialog open={deleteOpen} onClose={closeDelete} labelledBy="delete-dialog-h">
        <form onSubmit={confirmDelete}>
          <p className="eyebrow">{t('THIS CANNOT BE UNDONE')}</p>
          <h2 id="delete-dialog-h">{t('Delete your account?')}</h2>
          <p>
            {t('Your novels, notes and messages will be gone for good, and your published novels will leave the library.')}
            {isSupabase ? ` ${t('Enter your password and type DELETE to confirm.')}` : ` ${t('Type DELETE to confirm.')}`}
          </p>
          {isSupabase && (
            <label>
              {t('Password')}
              <input type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
            </label>
          )}
          <label>
            {t('Type {word}', { word: CONFIRM_WORD })}
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          </label>
          {deleteError && <p role="alert" style={{ color: 'var(--danger)' }}>{deleteError}</p>}
          <div className="dialog-actions">
            <button type="button" className="small-btn" onClick={closeDelete} disabled={deleting}>{t('Keep my account')}</button>
            <button className="small-btn is-danger" disabled={!canDelete || deleting}>{deleting ? t('Deleting…') : t('Delete everything')}</button>
          </div>
        </form>
      </Dialog>
    </>
  );
};
