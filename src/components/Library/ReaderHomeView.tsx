import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import type { Project } from '../../services/types';
import { EmptyState } from '../ui/EmptyState';
import { PageHead } from '../ui/PageHead';
import { NovelCard } from './LibraryView';

const COVER_TONES = ['', 'alt', 'alt2'];

/** Where readers open: pick up a novel, see what you saved, find something new. */
export const ReaderHomeView: React.FC = () => {
  const { user, profile, isGuest, publicProjects, loadPublicProjects, recentlyRead, setActivePublicProject, logout } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    loadPublicProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueReading = recentlyRead
    .map((id) => publicProjects.find((p) => p.id === id))
    .filter((p): p is Project => p !== undefined);

  const saved = user && !isGuest ? publicProjects.filter((p) => p.likes?.includes(user.id)) : [];
  const newest = [...publicProjects].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 6);

  const name = profile?.display_name || (user?.email && !isGuest ? user.email.split('@')[0] : '');

  const open = (project: Project) => {
    setActivePublicProject(project);
    navigate(`/library/novel/${project.id}`);
  };

  const makeAccount = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="studio-view">
      <div className="page page-wide">
        <PageHead
          eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()}
          title={
            name ? (
              <>
                Good to see you, <em>{name}.</em>
              </>
            ) : (
              <>
                Something to <em>read.</em>
              </>
            )
          }
          lead={`${publicProjects.length} ${publicProjects.length === 1 ? 'novel' : 'novels'} in the library, written by people here.`}
          actions={
            <>
              <Link className="small-btn" to="/library">Browse the library</Link>
              {!isGuest && <Link className="small-btn" to="/saved">Your Library</Link>}
            </>
          }
        />

        {isGuest && (
          <section className="continue-card" aria-labelledby="reader-account-h">
            <div>
              <span className="eyebrow" id="reader-account-h">READING AS A GUEST</span>
              <h3>Keep a library of your own.</h3>
              <p className="meta">A free account saves the novels you like and lets you write your own.</p>
            </div>
            <button className="small-btn is-primary" onClick={makeAccount}>Make an account</button>
          </section>
        )}

        {continueReading.length > 0 && (
          <section aria-labelledby="reader-continue-h" style={{ marginBottom: 34 }}>
            <h2 className="section-title" id="reader-continue-h">Continue reading</h2>
            <p className="section-note">The novels you opened most recently.</p>
            <div className="card">
              {continueReading.map((proj, i) => (
                <button key={proj.id} className="read-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => open(proj)}>
                  {proj.cover_url ? (
                    <img src={proj.cover_url} alt="" className="cover-mini" style={{ objectFit: 'cover', padding: 0, width: 38, height: 54 }} />
                  ) : (
                    <div className={`cover-mini ${COVER_TONES[i % COVER_TONES.length]}`} aria-hidden="true">
                      {proj.title}
                    </div>
                  )}
                  <div>
                    <strong>{proj.title}</strong>
                    <small>By {proj.author_name || 'Unknown'}</small>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {saved.length > 0 && (
          <section aria-labelledby="reader-saved-h" style={{ marginBottom: 34 }}>
            <h2 className="section-title" id="reader-saved-h">Saved for later</h2>
            <p className="section-note">
              Novels you liked. <Link className="link-accent" to="/saved">See them all</Link>
            </p>
            <div className="novel-grid">
              {saved.slice(0, 3).map((p, i) => (
                <NovelCard key={p.id} project={p} index={i} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="reader-new-h">
          <h2 className="section-title" id="reader-new-h">New in the library</h2>
          <p className="section-note">
            Recently published or updated. <Link className="link-accent" to="/library">Search by title, author or genre</Link>
          </p>
          {newest.length === 0 ? (
            <EmptyState icon="book" title="No novels yet" text="No one has published a novel yet. Be the first: write one and publish it.">
              <Link className="small-btn is-primary" to="/write">Open the studio</Link>
            </EmptyState>
          ) : (
            <div className="novel-grid">
              {newest.map((p, i) => (
                <NovelCard key={p.id} project={p} index={i} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
