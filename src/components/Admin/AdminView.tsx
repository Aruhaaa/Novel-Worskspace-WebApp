import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Shield, BarChart2, Plus, Database, Hash, Check } from 'lucide-react';

export const AdminView: React.FC = () => {
  const { user, publicProjects, createExternalProject } = useApp();

  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('Fantasy');
  const [coverUrl, setCoverUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // Protect route just in case
  if (user?.email !== 'aruhaadmin@novelist.com') {
    return (
      <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8">
        <Shield className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-200">Access Denied</h2>
        <p className="text-slate-500 mt-2">You do not have permission to view this page.</p>
      </div>
    );
  }

  // Calculate Stats
  const stats = useMemo(() => {
    const genreCounts: Record<string, number> = {};
    publicProjects.forEach(p => {
      const g = p.genre || 'Uncategorized';
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });

    const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);

    return {
      total: publicProjects.length,
      genres: sortedGenres,
      recent: [...publicProjects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
    };
  }, [publicProjects]);

  const handleAddExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !authorName) return;
    
    setIsSubmitting(true);
    setMessage('');
    
    const { error } = await createExternalProject(title, authorName, description, genre, coverUrl);
    
    setIsSubmitting(false);
    if (error) {
      setMessage(`Error: ${error}`);
    } else {
      setMessage('Success: External novel published to the library!');
      setTitle('');
      setAuthorName('');
      setDescription('');
      setCoverUrl('');
      setTimeout(() => setMessage(''), 4000);
    }
  };

  return (
    <div className="flex-1 bg-slate-950 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <header className="mb-10 flex items-center gap-4">
          <div className="inline-flex items-center justify-center p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
            <Shield className="w-8 h-8 text-amber-500 stroke-[1.5]" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">Admin Dashboard</h1>
            <p className="text-slate-400 mt-1">Platform analytics and management tools</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Analytics */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800/60">
                <BarChart2 className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-200">Library Stats</h2>
              </div>
              
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Novels</p>
                <p className="text-4xl font-extrabold text-white">{stats.total}</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Genre Distribution</p>
                <div className="space-y-3">
                  {stats.genres.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No genres found.</p>
                  ) : (
                    stats.genres.map(([g, count]) => (
                      <div key={g} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-slate-500" />
                          {g}
                        </span>
                        <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-bold">
                          {count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-800/60">
                <Database className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-slate-200">Recent Additions</h2>
              </div>
              <div className="space-y-4">
                {stats.recent.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No novels published yet.</p>
                ) : (
                  stats.recent.map(p => (
                    <div key={p.id} className="text-sm">
                      <p className="font-semibold text-slate-300 truncate">{p.title}</p>
                      <p className="text-slate-500 text-xs">by {p.author_name}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Ingestion Tool */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800/60">
                <Plus className="w-6 h-6 text-amber-500" />
                <div>
                  <h2 className="text-xl font-bold text-slate-200">Inject External Novel</h2>
                  <p className="text-sm text-slate-500 mt-1">Directly publish a novel to the library without going through the editor.</p>
                </div>
              </div>

              {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${
                  message.startsWith('Error') 
                    ? 'bg-rose-500/10 border-rose-500/20' 
                    : 'bg-emerald-500/10 border-emerald-500/20'
                }`}>
                  <Check className={`w-5 h-5 shrink-0 mt-0.5 ${
                    message.startsWith('Error') ? 'text-rose-400' : 'text-emerald-400'
                  }`} />
                  <p className={`text-sm ${
                    message.startsWith('Error') ? 'text-rose-300' : 'text-emerald-300'
                  }`}>{message}</p>
                </div>
              )}

              <form onSubmit={handleAddExternal} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Novel Title <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Author Name <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Genre</label>
                  <select 
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Fantasy">Fantasy</option>
                    <option value="Sci-Fi">Sci-Fi</option>
                    <option value="Romance">Romance</option>
                    <option value="Mystery">Mystery</option>
                    <option value="Horror">Horror</option>
                    <option value="Thriller">Thriller</option>
                    <option value="Historical">Historical</option>
                    <option value="Contemporary">Contemporary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Cover Image URL</label>
                  <input 
                    type="url" 
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Description / Synopsis</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={isSubmitting || !title || !authorName}
                    className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-amber-500/20 transition-all duration-200 w-full md:w-auto"
                  >
                    {isSubmitting ? 'Injecting Novel...' : 'Inject into Public Library'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
