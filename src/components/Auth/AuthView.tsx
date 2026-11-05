import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authService } from '../../services/auth';
import { Info } from 'lucide-react';
import { Brand } from '../Brand';
import landscape from '../../assets/quiet-landscape.svg';
import { enabledProviders, PROVIDER_LABEL, type AuthProvider } from '../../lib/authProviders';
import { signInProblem } from '../../lib/recovery';
import { useT } from '../../i18n';

/** The marks of the two providers, drawn here so nothing is fetched from them just to show a button */
const ProviderMark: React.FC<{ provider: AuthProvider }> = ({ provider }) =>
  provider === 'google' ? (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );

export const AuthView: React.FC = () => {
  const t = useT();
  const { login, signup, isSupabase, loginAsGuest, recoveryNotice } = useApp();
  // "Continue with Google / Apple", when the site has them switched on
  const [providers] = useState(enabledProviders);
  const [isLogin, setIsLogin] = useState(true);
  // "Forgot password" swaps the form for a single email box; a dead reset link lands here too
  const [forgot, setForgot] = useState(!!recoveryNotice);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // A dead reset link, or a sign-in with Google or Apple that did not finish, is told once, here
  const [error, setError] = useState<string | null>(recoveryNotice ?? signInProblem);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const { error: resetError } = await authService.requestPasswordReset(email);
    setLoading(false);
    if (resetError) {
      setError(resetError);
      return;
    }
    // The same wording whether or not that address has an account
    setMessage('If there is an account for that address, a link to choose a new password is on its way. It may take a minute, and it can land in spam.');
  };

  const handleProvider = async (provider: AuthProvider) => {
    setError(null);
    setMessage(null);
    setLoading(true);
    const { error: providerError } = await authService.signInWithProvider(provider);
    // On success the browser is already on its way to the provider, so there is nothing more to do here
    if (providerError) {
      setError(providerError);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    let resError: string | null;
    let resMessage: string | null | undefined = null;

    if (isLogin) {
      const result = await login(email, password);
      resError = result.error;
    } else {
      const result = await signup(email, password);
      resError = result.error;
      resMessage = result.message;
    }

    if (resError) {
      setError(resError);
    }
    if (resMessage) {
      setMessage(resMessage);
    }
    setLoading(false);
  };

  const leaveForgot = (e: React.MouseEvent) => {
    e.preventDefault();
    setForgot(false);
    setIsLogin(true);
    setError(null);
    setMessage(null);
  };

  return (
    <div className="auth-wrap">
      <section className="auth-art" aria-hidden="true">
        <Brand to="#/" />
        <h2>
          A little room.
          <br />A whole <em>world.</em>
        </h2>
        <p>Your manuscript, your notes and your world in one quiet place.</p>
        <img src={landscape} alt="" width="380" height="430" />
      </section>

      <section className="auth-form">
        <div className="auth-card">
          <h1>{forgot ? 'Forgot it?' : isLogin ? 'Welcome back.' : 'Make a space.'}</h1>
          <p className="lead">
            {forgot
              ? 'Enter the email you signed up with and we will send a link to choose a new password.'
              : isLogin
                ? 'Sign in to pick up where you left off.'
                : 'Create a free account to read, keep a library, and write your own novels.'}
          </p>

          {!isSupabase && (
            <div className="fallback-note" role="note">
              <Info />
              <span>
                <strong>Running in local fallback mode.</strong> No cloud database is connected, so your work is saved in this browser only.
              </span>
            </div>
          )}

          {forgot ? (
            <form onSubmit={handleReset}>
              <label className="field">
                <span>Email address</span>
                <input className="input" type="email" placeholder="author@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </label>
              {error && <p className="mock-note" role="alert" style={{ marginBottom: 14, color: 'var(--danger)' }}>{error}</p>}
              {message && <p className="mock-note" role="status" style={{ marginBottom: 14 }}>{message}</p>}
              <button className="button button-primary" style={{ width: '100%' }} disabled={loading || !email.trim()}>
                {loading ? 'One moment…' : 'Send reset link'}
              </button>
              <p className="auth-switch">
                <a href="#" onClick={leaveForgot}>Back to sign in</a>
              </p>
            </form>
          ) : (
            <>
              {providers.length > 0 && (
                <>
                  <div className="oauth-buttons">
                    {providers.map((provider) => (
                      <button key={provider} type="button" className="button button-outline oauth-button" disabled={loading} onClick={() => void handleProvider(provider)}>
                        <ProviderMark provider={provider} />
                        {t('Continue with {provider}', { provider: PROVIDER_LABEL[provider] })}
                      </button>
                    ))}
                  </div>
                  <p className="oauth-or" aria-hidden="true"><span>{t('or')}</span></p>
                </>
              )}
              <form onSubmit={handleSubmit}>
                <label className="field">
                  <span>Email address</span>
                  <input className="input" type="email" placeholder="author@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input className="input" type="password" placeholder="••••••••" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
                </label>
                {isLogin && (
                  <p className="auth-switch" style={{ marginTop: -6, marginBottom: 14, textAlign: 'right' }}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setForgot(true);
                        setError(null);
                        setMessage(null);
                      }}
                    >
                      Forgot password?
                    </a>
                  </p>
                )}
                {error && <p className="mock-note" role="alert" style={{ marginBottom: 14, color: 'var(--danger)' }}>{error}</p>}
                {message && <p className="mock-note" role="status" style={{ marginBottom: 14 }}>{message}</p>}
                <button className="button button-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'One moment…' : isLogin ? 'Sign in' : 'Create account'}
                </button>
              </form>

              <p className="auth-switch">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsLogin(!isLogin);
                    setError(null);
                    setMessage(null);
                  }}
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </a>
              </p>
              <hr className="divider" />
              <button className="button button-outline" style={{ width: '100%' }} onClick={() => loginAsGuest()} type="button">
                Just browse the library
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
