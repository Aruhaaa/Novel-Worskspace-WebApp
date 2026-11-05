import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { acceptInvite, CollabSetupError, previewInvite, type InvitePreview } from '../../lib/collab';
import { ROLE_LABEL } from '../../lib/notifications';
import { databaseService } from '../../services/database';
import { PENDING_JOIN_KEY } from '../../lib/pendingJoin';
import { useT } from '../../i18n';

/**
 * Where an invitation link leads. It says what the invitation is for, and joining is one button. Someone who is not
 * signed in is sent to sign in first, and brought back here.
 */
export const JoinProjectView: React.FC = () => {
  const t = useT();
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, profile, isGuest, logout, refreshShared, setActiveProject } = useApp();
  // undefined: still looking. null: no such invitation (or it has run out)
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    previewInvite(token)
      .then((p) => {
        if (live) setPreview(p);
      })
      .catch((e) => {
        if (!live) return;
        setPreview(null);
        setError(e instanceof CollabSetupError ? t('Sharing is not switched on for this site yet.') : e instanceof Error ? e.message : t('That did not work. Please try again.'));
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const signedIn = !!user && !isGuest;

  const needAccount = async () => {
    try {
      sessionStorage.setItem(PENDING_JOIN_KEY, token);
    } catch {
      // Without it the person simply opens the link again after signing in
    }
    // A guest has to leave guest mode to make or use an account
    if (user) await logout();
    navigate('/login');
  };

  const join = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const name = profile?.display_name || user.email.split('@')[0];
      const joined = await acceptInvite(token, user.id, name);
      await refreshShared();
      const project = (await databaseService.getProjectsByIds([joined.project_id]))[0];
      if (project) {
        setActiveProject(project);
        navigate('/chapters');
      } else {
        navigate('/manuscripts');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('That did not work. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <div className="studio-view">
      <div className="page" style={{ maxWidth: 560 }}>
        <p className="eyebrow">{t('AN INVITATION')}</p>
        {preview === undefined && <p className="meta" role="status">{t('Looking at the invitation…')}</p>}

        {preview === null && (
          <>
            <h1 className="section-title">{t('This invitation is no longer active')}</h1>
            <p className="section-note">{error ?? t('It may have been switched off, used up or gone out of date. Ask the person who sent it for a new one.')}</p>
            <button className="small-btn" onClick={() => navigate(signedIn ? '/manuscripts' : '/')}>{t('Back')}</button>
          </>
        )}

        {preview && (
          <>
            <h1 className="section-title">{t('{inviter} invited you to write “{title}” with them', { inviter: preview.inviter, title: preview.title })}</h1>
            <p className="section-note">
              {t('Your role would be {role}.', { role: ROLE_LABEL[preview.role]() })}{' '}
              {preview.role === 'viewer'
                ? t('You can read it, and see changes as they are made.')
                : preview.role === 'editor'
                  ? t('You can write in the chapters.')
                  : t('You can write and arrange everything except sharing and publishing.')}
            </p>
            {error && <p className="mock-note" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
            {signedIn ? (
              <button className="button button-primary" disabled={busy} onClick={() => void join()}>
                {busy ? t('Joining…') : t('Join “{title}”', { title: preview.title })}
              </button>
            ) : (
              <>
                <p className="section-note">{t('You need an account to join. Sign in or make one, and you will come straight back here.')}</p>
                <button className="button button-primary" onClick={() => void needAccount()}>{t('Sign in or make an account')}</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
