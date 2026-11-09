import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Project } from '../../services/types';
import { EmptyState } from '../ui/EmptyState';
import { PageHead } from '../ui/PageHead';
import { isBundledNovel } from '../../lib/bundledLibrary';
import { GenreFilter, GenreTag } from './GenreChips';
import { fmtDate, tp, useT } from '../../i18n';
import { languageLabel, languagesIn } from '../../lib/novelLanguage';
import { LanguageTag } from '../ui/LanguageSelect';

type SortBy = 'newest' | 'liked' | 'az';

/** One novel in the library grids: cover, author, genre, blurb, like and read. */
export const NovelCard: React.FC<{ project: Project; index: number }> = ({ project, index }) => {
  const t = useT();
  const { user, toggleLikeProject, setActivePublicProject } = useApp();
  const navigate = useNavigate();
  const liked = !!user && !!project.likes?.includes(user.id);

  const handleRead = () => {
    setActivePublicProject(project);
    navigate(`/library/novel/${project.id}`);
  };

  return (
    <article className="novel-card">
      <div
        className={`novel-cover c${(index % 6) + 1}`}
        style={project.cover_url ? { backgroundImage: `url(${project.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {!project.cover_url && project.title}
      </div>
      <div className="novel-body">
        <h3>{project.title}</h3>
        <Link className="by" to={`/library/author/${project.user_id}`}>
          {project.author_name || t('Anonymous')}
        </Link>
        {(project.genre || project.language || isBundledNovel(project.id)) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {project.genre && <GenreTag genre={project.genre} />}
            <LanguageTag code={project.language} />
            {isBundledNovel(project.id) && (
              <span className="badge" title={t('Part of the sample library that comes with the site')}>
                {t('Sample')}
              </span>
            )}
          </div>
        )}
        <p>{project.description || t('No description provided for this novel.')}</p>
        <div className="novel-foot">
          <span>{t('Updated {date}', { date: fmtDate(project.updated_at) })}</span>
          <span>
            <button className="like-btn" aria-pressed={liked} aria-label={liked ? t('Unlike') : t('Like')} onClick={() => toggleLikeProject(project.id)}>
              <Heart />
              <span>{project.likes?.length || 0}</span>
            </button>{' '}
            <button className="link-accent" onClick={handleRead}>{t('Read')}</button>
          </span>
        </div>
      </div>
    </article>
  );
};

/** The Public Library and Your Library are two tabs of one screen. */
export const LibraryScreen: React.FC<{ mode: 'public' | 'saved' }> = ({ mode }) => {
  const t = useT();
  const { user, publicProjects, loadPublicProjects } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState('All');
  const [filterLanguage, setFilterLanguage] = useState('All');
  const [sortBy, setSortBy] = useState<SortBy>('newest');

  useEffect(() => {
    loadPublicProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const source = mode === 'saved' ? publicProjects.filter((p) => user && p.likes?.includes(user.id)) : publicProjects;

  // The language filter is offered once the library holds novels in more than one language, and only for the languages it holds
  const languages = languagesIn(source);
  const languageFilter = languages.includes(filterLanguage) ? filterLanguage : 'All';

  const projects = source
    .filter((p) => filterGenre === 'All' || p.genre === filterGenre)
    .filter((p) => languageFilter === 'All' || p.language === languageFilter)
    .filter(
      (p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.author_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sortBy === 'liked') return (b.likes?.length || 0) - (a.likes?.length || 0);
      return a.title.localeCompare(b.title);
    });

  return (
    <div className="studio-view">
      <div className="page page-wide">
        <PageHead
          eyebrow={t('THE COMMONS')}
          title={
            <>
              {t('Stories from')} <em>{t('other rooms.')}</em>
            </>
          }
          lead={t('Read novels published by other authors in the Novelist Workspace community.')}
        />

        <div className="tabs" role="tablist" aria-label={t('Library')}>
          <Link role="tab" to="/library" aria-selected={mode === 'public'} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {t('Public Library')}
          </Link>
          <Link role="tab" to="/saved" aria-selected={mode === 'saved'} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {t('Your Library')}
          </Link>
        </div>

        <div className="filter-bar">
          <div className="filter-top">
            <label className="search">
              <span className="sr-only">{mode === 'saved' ? t('Search your saved novels') : t('Search by title or author')}</span>
              <Search />
              <input
                className="input"
                type="search"
                placeholder={mode === 'saved' ? t('Search your saved novels') : t('Search by title or author')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            {languages.length > 1 && (
              <label>
                <span className="sr-only">{t('Filter by language')}</span>
                <select className="select" value={languageFilter} onChange={(e) => setFilterLanguage(e.target.value)} data-testid="language-filter">
                  <option value="All">{t('All languages')}</option>
                  {languages.map((code) => (
                    <option key={code} value={code} lang={code}>{languageLabel(code)}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span className="sr-only">{t('Sort')}</span>
              <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                <option value="newest">{t('Newest first')}</option>
                <option value="liked">{t('Most liked')}</option>
                <option value="az">{t('A–Z')}</option>
              </select>
            </label>
          </div>
          <GenreFilter value={filterGenre} onChange={setFilterGenre} />
          <p className="meta" role="status">
            {tp(projects.length, '{n} result', '{n} results')}
          </p>
        </div>

        {projects.length === 0 ? (
          mode === 'saved' ? (
            <EmptyState icon="bookmark" title={t('Nothing saved yet')} text={t('Like a novel in the Public Library and it will wait for you here.')}>
              <Link className="small-btn is-primary" to="/library">{t('Browse the Public Library')}</Link>
            </EmptyState>
          ) : (
            <EmptyState
              icon="book"
              title={t('No novels found')}
              text={
                publicProjects.length === 0
                  ? t('No one has published a novel yet. Be the first to share yours.')
                  : t('Try a different search or genre.')
              }
            />
          )
        ) : (
          <div className="novel-grid">
            {projects.map((project, i) => (
              <NovelCard key={project.id} project={project} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const LibraryView: React.FC = () => <LibraryScreen mode="public" />;
