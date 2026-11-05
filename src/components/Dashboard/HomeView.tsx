import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe, Plus, Users, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDailyGoal } from '../../lib/dailyGoal';
import { usePublishProject } from '../../lib/publish';
import type { Project } from '../../services/types';
import { AudienceAnalyticsModal } from './AudienceAnalyticsModal';
import { ExportDialog } from '../Export/ExportDialogLazy';
import { ContinueCard } from './ContinueCard';
import { RemoveSampleDialog, SampleButton } from './SampleProject';
import { isSampleProject } from '../../lib/sample';
import { GuestGateModal } from '../Auth/GuestGateModal';
import { Dialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { PageHead } from '../ui/PageHead';
import { fmtDate, tp, useT } from '../../i18n';

const COVER_TONES = ['', 'alt', 'alt2'];

const Cover: React.FC<{ project: Project; index: number; small?: boolean }> = ({ project, index, small }) =>
  project.cover_url ? (
    <img
      src={project.cover_url}
      alt=""
      className="cover-mini"
      style={{ objectFit: 'cover', padding: 0, ...(small ? { width: 38, height: 54 } : {}) }}
    />
  ) : (
    <div className={`cover-mini ${COVER_TONES[index % COVER_TONES.length]}`} aria-hidden="true">
      {project.title}
    </div>
  );

export const HomeView: React.FC = () => {
  const t = useT();
  const {
    user,
    profile,
    projects,
    setActiveProject,
    setActiveView,
    createProject,
    recentlyRead,
    publicProjects,
    setActivePublicProject,
    isGuest,
  } = useApp();
  const navigate = useNavigate();
  const daily = useDailyGoal();
  const togglePublish = usePublishProject();

  const [showNewProject, setShowNewProject] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [analyticsProject, setAnalyticsProject] = useState<Project | null>(null);
  const [exportProject, setExportProject] = useState<Project | null>(null);
  const [removeSample, setRemoveSample] = useState<Project | null>(null);

  const recentlyReadProjects = recentlyRead
    .map((id) => publicProjects.find((p) => p.id === id))
    .filter((p): p is Project => p !== undefined);

  const greetingName = profile?.display_name || (user?.email ? user.email.split('@')[0] : t('Author'));

  const startNewProject = () => (isGuest ? setShowGuestModal(true) : setShowNewProject(true));

  const handleOpenProject = (project: Project) => {
    setActiveProject(project);
    setActiveView('editor');
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createProject(newTitle, newDesc);
    setNewTitle('');
    setNewDesc('');
    setShowNewProject(false);
  };

  const handleContinueReading = (project: Project) => {
    setActivePublicProject(project);
    navigate(`/library/novel/${project.id}`);
  };

  const goalMet = daily.percent >= 100;

  return (
    <div className="studio-view">
      <div className="page page-wide">
        <PageHead
          eyebrow={fmtDate(new Date(), { weekday: 'long' }).toUpperCase()}
          title={
            <>
              {t('Welcome back,')} <em>{greetingName}.</em>
            </>
          }
          lead={t('{projects} · {words} written today. Pick up where you left off.', { projects: tp(projects.length, '{n} project', '{n} projects'), words: tp(daily.written, '{n} word', '{n} words') })}
          actions={
            <>
              <Link className="small-btn" to="/library">
                <Globe /> {t('Public Library')}
              </Link>
              <button className="small-btn is-primary" onClick={startNewProject}>
                <Plus /> {t('New project')}
              </button>
            </>
          }
        />

        <ContinueCard />

        <div className="split">
          <section aria-labelledby="projects-h">
            <h2 className="section-title" id="projects-h">{t('Your projects')}</h2>
            <p className="section-note">{t('Open a project to write, or see who is reading it.')}</p>

            {projects.length === 0 ? (
              <EmptyState icon="book" title={t('No projects yet')} text={t('You haven\'t started a novel. Give it a title and a few lines of description, and the rest can wait.')}>
                <button className="small-btn is-primary" onClick={startNewProject}>{t('Create your first project')}</button>
                <SampleButton onNeedAccount={() => setShowGuestModal(true)} />
              </EmptyState>
            ) : (
              projects.map((project, i) => (
                <article className="project-card" key={project.id}>
                  <Cover project={project} index={i} />
                  <div>
                    <h3>{project.title}</h3>
                    <p>{project.description || t('No description yet.')}</p>
                    <p className="meta" style={{ marginTop: 10 }}>
                      <span className={`badge${project.is_published ? ' is-accent' : ''}`}>
                        <span className="small-dot" /> {project.is_published ? t('Published') : t('Draft')}
                      </span>{' '}
                      {isSampleProject(project.id) && <span className="badge">{t('Sample')}</span>}{' '}
                      &nbsp; {t('Updated {date}', { date: fmtDate(project.updated_at) })}
                    </p>
                  </div>
                  <div className="project-actions">
                    {project.is_published && (
                      <button className="small-btn" onClick={() => setAnalyticsProject(project)}>
                        <Users /> {t('Audience')}
                      </button>
                    )}
                    <button className="small-btn" onClick={() => togglePublish(project)} aria-pressed={!!project.is_published}>
                      {project.is_published ? t('Unpublish') : t('Publish')}
                    </button>
                    {isSampleProject(project.id) && (
                      <button className="small-btn" onClick={() => setRemoveSample(project)}>{t('Remove sample')}</button>
                    )}
                    <button className="small-btn" onClick={() => setExportProject(project)}>
                      <Download /> {t('Export')}
                    </button>
                    <button className="small-btn is-primary" onClick={() => handleOpenProject(project)}>
                      {t('Open')}
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>

          <aside className="stack" aria-label={t('Today')}>
            <div className="card" style={{ textAlign: 'center' }}>
              <span className="eyebrow">{t('TODAY\'S GOAL')}</span>
              <div
                className="goal-ring"
                style={{ ['--pct' as string]: daily.percent } as React.CSSProperties}
                role="img"
                aria-label={t('{written} of {goal} words, {percent} percent', { written: daily.written, goal: daily.goal, percent: daily.percent })}
              >
                <div>
                  <strong>{daily.percent}%</strong>
                  <span>
                    {t('{written} / {goal} words', { written: daily.written.toLocaleString(), goal: daily.goal.toLocaleString() })}
                  </span>
                </div>
              </div>
              <Link className="link-accent" to="/tracker">{t('View tracker details')}</Link>
              {goalMet && <p className="meta" style={{ marginTop: 14 }}><em>{t('Goal met. Rest well.')}</em></p>}
            </div>

            {recentlyReadProjects.length > 0 && (
              <div className="card">
                <span className="eyebrow">{t('CONTINUE READING')}</span>
                {recentlyReadProjects.map((proj, i) => (
                  <button
                    key={proj.id}
                    className="read-row"
                    style={{ width: '100%', textAlign: 'left' }}
                    onClick={() => handleContinueReading(proj)}
                  >
                    <Cover project={proj} index={i} small />
                    <div>
                      <strong>{proj.title}</strong>
                      <small>{t('By {name}', { name: proj.author_name || t('Unknown') })}</small>
                    </div>
                  </button>
                ))}
                <Link className="link-accent" to="/saved">{t('Go to Your Library')}</Link>
              </div>
            )}

            {projects.length > 0 && (
              <p className="meta" style={{ lineHeight: 1.7 }}>
                {t('A practice, not a performance. A few good words count, too.')}
              </p>
            )}
          </aside>
        </div>
      </div>

      <Dialog open={showNewProject} onClose={() => setShowNewProject(false)} labelledBy="home-np-h">
        <form onSubmit={handleCreateProject}>
          <p className="eyebrow">{t('A NEW BOOK')}</p>
          <h2 id="home-np-h">{t('Start a project')}</h2>
          <label htmlFor="home-np-title">{t('Project title')}</label>
          <input id="home-np-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('Whispers of the Starward')} required autoFocus />
          <label htmlFor="home-np-desc">{t('Description')}</label>
          <input id="home-np-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('A short summary of the theme, setting or plot')} />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowNewProject(false)}>{t('Cancel')}</button>
            <button className="button button-primary button-small">{t('Create project')}</button>
          </div>
        </form>
      </Dialog>

      <ExportDialog project={exportProject} onClose={() => setExportProject(null)} />
      <RemoveSampleDialog project={removeSample} onClose={() => setRemoveSample(null)} />

      {analyticsProject && <AudienceAnalyticsModal project={analyticsProject} onClose={() => setAnalyticsProject(null)} />}

      <GuestGateModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        message={t('You need a free account to start writing and saving your own novels. It takes about ten seconds. Guests can still browse and read everything in the Public Library.')}
      />
    </div>
  );
};
