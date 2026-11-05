import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import type { Project } from '../../services/types';
import { EmptyState } from '../ui/EmptyState';
import { PageHead } from '../ui/PageHead';
import { NovelCard } from './LibraryView';
import { getReadingPlace } from '../../lib/readingPlace';
import { useT } from '../../i18n';

const COVER_TONES = ['', 'alt', 'alt2'];

/** Where readers open: pick up a novel, see what you saved, find something new. */
export const ReaderHomeView: React.FC = () => {
  const t = useT();
  const { user, profile, isGuest, publicProjects, loadPublicProjects, recentlyRead, setActivePublicProject, logout } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    loadPublicProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueReading = recentlyRead
    .map((id) => publicProjects.find((p) => p.id === id))
    .filter((p): p is Project => p !== undefined);

  // The chapter each of those novels was left on, kept on this device
  const places = useMemo(() => {
    const map = new Map<string, number>();
    if (user) for (const id of recentlyRead) {
      const place = getReadingPlace(user.id, id);
      if (place) map.set(id, place.index);
    }
    return map;
  }, [user, recentlyRead]);

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
                {t('Something to')} <em>{t('read.')}</em>
              </>
            )
          }
          lead={`${publicProjects.length} ${publicProjects.length === 1 ? 'novel' : 'novels'} in the library, written by people here.`}
          actions={
            <>
              <Link className="small-btn" to="/library">{t('Browse the library')}</Link>
              {!isGuest && <Link className="small-btn" to="/saved">{t('Your Library')}</Link>}
            </>
          }
        />

        {isGuest && (
          <section className="continue-card" aria-labelledby="reader-account-h">
            <div>
              <span className="eyebrow" id="reader-account-h">{t('READING AS A GUEST')}</span>
              <h3>{t('Keep a library of your own.')}</h3>
              <p className="meta">{t('A free account saves the novels you like and lets you write your own.')}</p>
            </div>
            <button className="small-btn is-primary" onClick={makeAccount}>{t('Make an account')}</button>
          </section>
        )}

        {continueReading.length > 0 && (
          <section aria-labelledby="reader-continue-h" style={{ marginBottom: 34 }}>
            <h2 className="section-title" id="reader-continue-h">{t('Continue reading')}</h2>
            <p className="section-note">{t('The novels you opened most recently. Each one opens on the chapter you were reading.')}</p>
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
                    <small>
                      {t('By {author}', { author: proj.author_name || t('Unknown') })}
                      {places.has(proj.id) && places.get(proj.id)! > 0 ? ` · ${t('You were on chapter {n}', { n: places.get(proj.id)! + 1 })}` : ''}
                    </small>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {saved.length > 0 && (
          <section aria-labelledby="reader-saved-h" style={{ marginBottom: 34 }}>
            <h2 className="section-title" id="reader-saved-h">{t('Saved for later')}</h2>
            <p className="section-note">
              {t('Novels you liked.')} <Link className="link-accent" to="/saved">{t('See them all')}</Link>
            </p>
            <div className="novel-grid">
              {saved.slice(0, 3).map((p, i) => (
                <NovelCard key={p.id} project={p} index={i} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="reader-new-h">
          <h2 className="section-title" id="reader-new-h">{t('New in the library')}</h2>
          <p className="section-note">
            {t('Recently published or updated.')} <Link className="link-accent" to="/library">{t('Search by title, author or genre')}</Link>
          </p>
          {newest.length === 0 ? (
            <EmptyState icon="book" title={t('No novels yet')} text={t('No one has published a novel yet. Be the first: write one and publish it.')}>
              <Link className="small-btn is-primary" to="/write">{t('Open the studio')}</Link>
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
