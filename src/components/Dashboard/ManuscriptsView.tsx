import React, { useState } from 'react';
import { Download, Plus, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import type { Project } from '../../services/types';
import { GENRES } from '../../lib/genres';
import { GuestGateModal } from '../Auth/GuestGateModal';
import { ExportDialog } from '../Export/ExportDialog';
import { RemoveSampleDialog, SampleButton } from './SampleProject';
import { isSampleProject } from '../../lib/sample';
import { Dialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { PageHead } from '../ui/PageHead';

const COVER_TONES = ['', 'alt', 'alt2'];

/** Every project, so the author can choose which manuscript to open. */
export const ManuscriptsView: React.FC = () => {
  const { projects, activeProject, setActiveProject, createProject, updateProjectSettings, isGuest } = useApp();
  const navigate = useNavigate();
  const [showNew, setShowNew] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [exportProject, setExportProject] = useState<Project | null>(null);
  const [removeSample, setRemoveSample] = useState<Project | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const [editing, setEditing] = useState<Project | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eGenre, setEGenre] = useState('');
  const [eCover, setECover] = useState('');

  const openSettings = (project: Project) => {
    setEditing(project);
    setETitle(project.title || '');
    setEDesc(project.description || '');
    setEGenre(project.genre || '');
    setECover(project.cover_url || '');
  };

  const open = (project: Project) => {
    setActiveProject(project);
    navigate('/editor');
  };

  const startNew = () => (isGuest ? setShowGate(true) : setShowNew(true));

  return (
    <div className="studio-view">
      <div className="page page-wide">
        <PageHead
          eyebrow="YOUR MANUSCRIPTS"
          title={
            <>
              Which story <em>today?</em>
            </>
          }
          lead="Choose a novel to open its workspace: manuscript, story outline and world notebook."
          actions={
            <button className="small-btn is-primary" onClick={startNew}>
              <Plus /> New project
            </button>
          }
        />

        {projects.length === 0 ? (
          <EmptyState icon="book" title="No projects yet" text="Give your first novel a title and a few lines of description, and the rest can wait.">
            <button className="small-btn is-primary" onClick={startNew}>Create your first project</button>
            <SampleButton onNeedAccount={() => setShowGate(true)} />
          </EmptyState>
        ) : (
          projects.map((project, i) => (
            <article className="project-card" key={project.id}>
              {project.cover_url ? (
                <img src={project.cover_url} alt="" className="cover-mini" style={{ objectFit: 'cover', padding: 0 }} />
              ) : (
                <div className={`cover-mini ${COVER_TONES[i % COVER_TONES.length]}`} aria-hidden="true">
                  {project.title}
                </div>
              )}
              <div>
                <h3>{project.title}</h3>
                <p>{project.description || 'No description yet.'}</p>
                <p className="meta" style={{ marginTop: 10 }}>
                  <span className={`badge${project.is_published ? ' is-accent' : ''}`}>
                    <span className="small-dot" /> {project.is_published ? 'Published' : 'Draft'}
                  </span>
                  {isSampleProject(project.id) && <span className="badge" style={{ marginLeft: 8 }}>Sample</span>}
                  {activeProject?.id === project.id && (
                    <span className="badge" style={{ marginLeft: 8 }}>Last opened</span>
                  )}{' '}
                  &nbsp; Updated {new Date(project.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="project-actions">
                {isSampleProject(project.id) && (
                  <button className="small-btn" onClick={() => setRemoveSample(project)}>Remove sample</button>
                )}
                <button className="small-btn" onClick={() => setExportProject(project)}>
                  <Download /> Export
                </button>
                <button className="small-btn" onClick={() => openSettings(project)}>
                  <Settings /> Edit details
                </button>
                <button className="small-btn is-primary" onClick={() => open(project)}>
                  Open
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <Dialog open={showNew} onClose={() => setShowNew(false)} labelledBy="ms-np-h">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            await createProject(title, desc);
            setTitle('');
            setDesc('');
            setShowNew(false);
          }}
        >
          <p className="eyebrow">A NEW BOOK</p>
          <h2 id="ms-np-h">Start a project</h2>
          <label htmlFor="ms-np-title">Project title</label>
          <input id="ms-np-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Whispers of the Starward" required autoFocus />
          <label htmlFor="ms-np-desc">Description</label>
          <input id="ms-np-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="A short summary of the theme, setting or plot" />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="button button-primary button-small">Create project</button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} labelledBy="ps-h">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editing) return;
            await updateProjectSettings(editing.id, { title: eTitle, description: eDesc, genre: eGenre, cover_url: eCover });
            setEditing(null);
          }}
        >
          <p className="eyebrow">PROJECT DETAILS</p>
          <h2 id="ps-h">{editing?.title}</h2>
          <label htmlFor="ps-title">Novel title</label>
          <input id="ps-title" value={eTitle} onChange={(e) => setETitle(e.target.value)} required />
          <label htmlFor="ps-syn">Synopsis</label>
          <input id="ps-syn" value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
          <label htmlFor="ps-genre">Genre</label>
          <select id="ps-genre" className="select" style={{ marginTop: 8 }} value={eGenre} onChange={(e) => setEGenre(e.target.value)}>
            <option value="">Select a genre</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <label htmlFor="ps-cover">Cover image URL</label>
          <input id="ps-cover" type="url" value={eCover} onChange={(e) => setECover(e.target.value)} placeholder="https://…" />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setEditing(null)}>Cancel</button>
            <button className="button button-primary button-small">Save changes</button>
          </div>
        </form>
      </Dialog>

      <ExportDialog project={exportProject} onClose={() => setExportProject(null)} />
      <RemoveSampleDialog project={removeSample} onClose={() => setRemoveSample(null)} />

      <GuestGateModal
        isOpen={showGate}
        onClose={() => setShowGate(false)}
        message="You need a free account to start writing and saving your own novels. It takes about ten seconds. Guests can still browse and read everything in the Public Library."
      />
    </div>
  );
};
