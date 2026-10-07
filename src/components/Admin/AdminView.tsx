import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { GENRES } from '../../lib/genres';
import { EmptyState } from '../ui/EmptyState';
import { PageHead } from '../ui/PageHead';

export const AdminView: React.FC = () => {
  const { user, publicProjects, createExternalProject } = useApp();

  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('Fantasy');
  const [coverUrl, setCoverUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

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

  // Protect route just in case
  if (user?.email !== 'aruhaadmin@novelist.com') {
    return (
      <div className="studio-view">
        <div className="page">
          <EmptyState icon="users" title="You don't have permission to view this page" text="Only the admin account can see the admin dashboard.">
            <Link className="small-btn" to="/">Back to Home</Link>
          </EmptyState>
        </div>
      </div>
    );
  }

  const maxGenre = Math.max(1, ...stats.genres.map(([, n]) => n));

  return (
    <div className="studio-view">
      <div className="page page-wide">
        <PageHead
          eyebrow="ADMIN ONLY"
          title={
            <>
              The library, <em>at a glance.</em>
            </>
          }
          lead="Platform analytics and management tools."
        />
        <div className="split">
          <div className="stack">
            <div className="grid-2">
              <div className="stat">
                <span className="eyebrow">TOTAL NOVELS</span>
                <strong>{stats.total}</strong>
                <span>published</span>
              </div>
              <section className="card" aria-labelledby="gd-h">
                <h3 id="gd-h" style={{ fontSize: 22 }}>Genre distribution</h3>
                <div style={{ marginTop: 14 }}>
                  {stats.genres.length === 0 ? (
                    <p className="meta">No genres found.</p>
                  ) : (
                    stats.genres.map(([g, count]) => (
                      <div className="bar-row" key={g}>
                        <span>{g}</span>
                        <i style={{ width: `${(count / maxGenre) * 100}%` }} />
                        <b>{count}</b>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
            <section className="card" aria-labelledby="ra-h">
              <h3 id="ra-h">Recent additions</h3>
              {stats.recent.length === 0 ? (
                <p className="meta" style={{ marginTop: 12 }}>No novels published yet.</p>
              ) : (
                <table className="log-table" style={{ marginTop: 12 }}>
                  <thead>
                    <tr><th>TITLE</th><th>AUTHOR</th></tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((p) => (
                      <tr key={p.id}><td>{p.title}</td><td>{p.author_name || 'Unknown'}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <section className="card" aria-labelledby="inj-h">
            <h3 id="inj-h">Inject external novel</h3>
            <p style={{ margin: '6px 0 20px' }}>Publish a novel to the library directly, without going through the editor.</p>
            <form onSubmit={handleAddExternal}>
              <label className="field"><span>Novel title</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
              <label className="field"><span>Author name</span><input className="input" value={authorName} onChange={(e) => setAuthorName(e.target.value)} required /></label>
              <label className="field">
                <span>Genre</span>
                <select className="select" value={genre} onChange={(e) => setGenre(e.target.value)}>
                  {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <label className="field"><span>Cover image URL</span><input className="input" type="url" placeholder="https://…" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} /></label>
              <label className="field"><span>Description / synopsis</span><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
              <button className="small-btn is-primary" disabled={isSubmitting}>{isSubmitting ? 'Publishing…' : 'Publish to library'}</button>
              {message && <p className="mock-note" role="status" style={{ marginTop: 14 }}>{message}</p>}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
