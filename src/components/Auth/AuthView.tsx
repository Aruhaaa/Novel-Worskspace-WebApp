import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Feather, Lock, Mail, AlertCircle, Loader2, Check } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { login, signup, isSupabase } = useApp();
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
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 relative z-10">
        
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-500/10 p-4 rounded-full border border-indigo-500/20 mb-4">
            <Feather className="w-8 h-8 text-indigo-400 stroke-[1.5]" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">
            {isLogin ? 'Welcome back' : 'Create your workspace'}
          </h2>
          <p className="text-sm text-slate-400 text-center">
            {isLogin 
              ? 'Enter your credentials to access your novelist workspace.' 
              : 'Sign up to start planning and writing your next masterpiece.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-300">{error}</p>
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-300">{message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                placeholder="author@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-200 flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800/60 text-center">
          <p className="text-sm text-slate-400">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
      
      {!isSupabase && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800 backdrop-blur-sm">
          Running in Local Fallback Mode
        </div>
      )}
    </div>
  );
};
