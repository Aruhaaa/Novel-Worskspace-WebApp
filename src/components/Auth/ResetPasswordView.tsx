import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Brand } from '../Brand';
import landscape from '../../assets/quiet-landscape.svg';
import { useT } from '../../i18n';

/** Shown to someone who arrived through a password-reset email: choose a new password, then carry on signed in. */
export const ResetPasswordView: React.FC = () => {
  const t = useT();
  const { changePassword, finishRecovery, logout } = useApp();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError(t('Use at least 6 characters.'));
    if (password !== again) return setError(t('The two passwords do not match.'));
    setSaving(true);
    const { error: saveError } = await changePassword(password);
    setSaving(false);
    if (saveError) return setError(saveError);
    finishRecovery();
  };

  return (
    <div className="auth-wrap">
      <section className="auth-art" aria-hidden="true">
        <Brand to="#/" />
        <h2>
          {t('A fresh')} <em>{t('key.')}</em>
        </h2>
        <p>{t('Choose a new password and you are straight back to your work.')}</p>
        <img src={landscape} alt="" width="380" height="430" />
      </section>

      <section className="auth-form">
        <div className="auth-card">
          <h1>{t('New password.')}</h1>
          <p className="lead">{t('Pick something you have not used elsewhere.')}</p>
          <form onSubmit={submit}>
            <label className="field">
              <span>{t('New password')}</span>
              <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
            </label>
            <label className="field">
              <span>{t('Type it again')}</span>
              <input className="input" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
            </label>
            {error && <p className="mock-note" role="alert" style={{ marginBottom: 14, color: 'var(--danger)' }}>{error}</p>}
            <button className="button button-primary" style={{ width: '100%' }} disabled={saving}>
              {saving ? t('Saving…') : t('Save new password')}
            </button>
          </form>
          <p className="auth-switch">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                void logout();
              }}
            >
              {t('Cancel and sign out')}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
};
