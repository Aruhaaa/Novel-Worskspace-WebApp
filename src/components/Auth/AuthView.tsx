import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Info } from 'lucide-react';
import { Brand } from '../Brand';
import landscape from '../../assets/quiet-landscape.svg';

export const AuthView: React.FC = () => {
  const { login, signup, isSupabase, loginAsGuest } = useApp();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    let resError = null;
    let resMessage = null;

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
          <h1>{isLogin ? 'Welcome back.' : 'Make a space.'}</h1>
          <p className="lead">
            {isLogin ? 'Sign in to pick up where you left off.' : 'Create a free account to read, keep a library, and write your own novels.'}
          </p>

          {!isSupabase && (
            <div className="fallback-note" role="note">
              <Info />
              <span>
                <strong>Running in local fallback mode.</strong> No cloud database is connected, so your work is saved in this browser only.
              </span>
            </div>
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
          <button className="button button-outline" style={{ width: '100%' }} onClick={loginAsGuest} type="button">
            Just browse the library
          </button>
        </div>
      </section>
    </div>
  );
};
