import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe, Plus, Users, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDailyGoal } from '../../lib/dailyGoal';
import { usePublishProject } from '../../lib/publish';
import type { Project } from '../../services/types';
import { AudienceAnalyticsModal } from './AudienceAnalyticsModal';
import { ExportDialog } from '../Export/ExportDialog';
import { ContinueCard } from './ContinueCard';
import { RemoveSampleDialog, SampleButton } from './SampleProject';
import { isSampleProject } from '../../lib/sample';
import { GuestGateModal } from '../Auth/GuestGateModal';
import { Dialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { PageHead } from '../ui/PageHead';

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

  const greetingName = profile?.display_name || (user?.email ? user.email.split('@')[0] : 'Author');

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
          eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()}
          title={
            <>
              Welcome back, <em>{greetingName}.</em>
            </>
          }
          lead={`${projects.length} ${projects.length === 1 ? 'project' : 'projects'} · ${daily.written.toLocaleString()} words written today. Pick up where you left off.`}
          actions={
            <>
              <Link className="small-btn" to="/library">
                <Globe /> Public Library
              </Link>
              <button className="small-btn is-primary" onClick={startNewProject}>
                <Plus /> New project
              </button>
            </>
          }
        />

        <ContinueCard />

        <div className="split">
          <section aria-labelledby="projects-h">
            <h2 className="section-title" id="projects-h">Your projects</h2>
            <p className="section-note">Open a project to write, or see who is reading it.</p>

            {projects.length === 0 ? (
              <EmptyState icon="book" title="No projects yet" text="You haven't started a novel. Give it a title and a few lines of description, and the rest can wait.">
                <button className="small-btn is-primary" onClick={startNewProject}>Create your first project</button>
                <SampleButton onNeedAccount={() => setShowGuestModal(true)} />
              </EmptyState>
            ) : (
              projects.map((project, i) => (
                <article className="project-card" key={project.id}>
                  <Cover project={project} index={i} />
                  <div>
                    <h3>{project.title}</h3>
                    <p>{project.description || 'No description yet.'}</p>
                    <p className="meta" style={{ marginTop: 10 }}>
                      <span className={`badge${project.is_published ? ' is-accent' : ''}`}>
                        <span className="small-dot" /> {project.is_published ? 'Published' : 'Draft'}
                      </span>{' '}
                      {isSampleProject(project.id) && <span className="badge">Sample</span>}{' '}
                      &nbsp; Updated {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="project-actions">
                    {project.is_published && (
                      <button className="small-btn" onClick={() => setAnalyticsProject(project)}>
                        <Users /> Audience
                      </button>
                    )}
                    <button className="small-btn" onClick={() => togglePublish(project)} aria-pressed={!!project.is_published}>
                      {project.is_published ? 'Unpublish' : 'Publish'}
                    </button>
                    {isSampleProject(project.id) && (
                      <button className="small-btn" onClick={() => setRemoveSample(project)}>Remove sample</button>
                    )}
                    <button className="small-btn" onClick={() => setExportProject(project)}>
                      <Download /> Export
                    </button>
                    <button className="small-btn is-primary" onClick={() => handleOpenProject(project)}>
                      Open
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>

          <aside className="stack" aria-label="Today">
            <div className="card" style={{ textAlign: 'center' }}>
              <span className="eyebrow">TODAY'S GOAL</span>
              <div
                className="goal-ring"
                style={{ ['--pct' as string]: daily.percent } as React.CSSProperties}
                role="img"
                aria-label={`${daily.written} of ${daily.goal} words, ${daily.percent} percent`}
              >
                <div>
                  <strong>{daily.percent}%</strong>
                  <span>
                    {daily.written.toLocaleString()} / {daily.goal.toLocaleString()} words
                  </span>
                </div>
              </div>
              <Link className="link-accent" to="/tracker">View tracker details</Link>
              {goalMet && <p className="meta" style={{ marginTop: 14 }}><em>Goal met. Rest well.</em></p>}
            </div>

            {recentlyReadProjects.length > 0 && (
              <div className="card">
                <span className="eyebrow">CONTINUE READING</span>
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
                      <small>By {proj.author_name || 'Unknown'}</small>
                    </div>
                  </button>
                ))}
                <Link className="link-accent" to="/saved">Go to Your Library</Link>
              </div>
            )}

            {projects.length > 0 && (
              <p className="meta" style={{ lineHeight: 1.7 }}>
                A practice, not a performance. A few good words count, too.
              </p>
            )}
          </aside>
        </div>
      </div>

      <Dialog open={showNewProject} onClose={() => setShowNewProject(false)} labelledBy="home-np-h">
        <form onSubmit={handleCreateProject}>
          <p className="eyebrow">A NEW BOOK</p>
          <h2 id="home-np-h">Start a project</h2>
          <label htmlFor="home-np-title">Project title</label>
          <input id="home-np-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Whispers of the Starward" required autoFocus />
          <label htmlFor="home-np-desc">Description</label>
          <input id="home-np-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="A short summary of the theme, setting or plot" />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowNewProject(false)}>Cancel</button>
            <button className="button button-primary button-small">Create project</button>
          </div>
        </form>
      </Dialog>

      <ExportDialog project={exportProject} onClose={() => setExportProject(null)} />
      <RemoveSampleDialog project={removeSample} onClose={() => setRemoveSample(null)} />

      {analyticsProject && <AudienceAnalyticsModal project={analyticsProject} onClose={() => setAnalyticsProject(null)} />}

      <GuestGateModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        message="You need a free account to start writing and saving your own novels. It takes about ten seconds. Guests can still browse and read everything in the Public Library."
      />
    </div>
  );
};
