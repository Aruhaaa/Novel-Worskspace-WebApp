import React, { useState } from 'react';
import { Download, Plus, Settings, Upload, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import type { Project } from '../../services/types';
import { GENRES } from '../../lib/genres';
import { GuestGateModal } from '../Auth/GuestGateModal';
import { ExportDialog } from '../Export/ExportDialogLazy';
import { ImportDialog } from '../Import/ImportDialogLazy';
import { RemoveSampleDialog, SampleButton } from './SampleProject';
import { isSampleProject } from '../../lib/sample';
import { Dialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { PageHead } from '../ui/PageHead';
import { ShareProjectDialog } from '../Collab/ShareProjectDialog';
import { removeMember, type SharedProject } from '../../lib/collab';
import { ROLE_LABEL } from '../../lib/notifications';
import { fmtDate, useT } from '../../i18n';

const COVER_TONES = ['', 'alt', 'alt2'];

/** Every project, so the author can choose which manuscript to open. */
export const ManuscriptsView: React.FC = () => {
  const { projects, activeProject, setActiveProject, createProject, updateProjectSettings, isGuest, user, sharedProjects, sharedProjectIds, refreshShared } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [sharing, setSharing] = useState<Project | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [showImport, setShowImport] = useState(false);
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

  const leave = async (project: SharedProject) => {
    if (!user || !window.confirm(t('Leave “{title}”? You will no longer see it. The owner can invite you again.', { title: project.title }))) return;
    try {
      await removeMember(project.id, user.id);
      await refreshShared();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : t('That did not work. Please try again.'));
    }
  };

  const startNew = () => (isGuest ? setShowGate(true) : setShowNew(true));
  const startImport = () => (isGuest ? setShowGate(true) : setShowImport(true));

  return (
    <div className="studio-view">
      <div className="page page-wide">
        <PageHead
          eyebrow={t('YOUR MANUSCRIPTS')}
          title={
            <>
              {t('Which story')} <em>{t('today?')}</em>
            </>
          }
          lead={t('Choose a novel to open its workspace: manuscript, story outline and world notebook.')}
          actions={
            <>
              <button className="small-btn" onClick={startImport}>
                <Upload /> {t('Import')}
              </button>
              <button className="small-btn is-primary" onClick={startNew}>
                <Plus /> {t('New project')}
              </button>
            </>
          }
        />

        {projects.length === 0 ? (
          <EmptyState icon="book" title={t('No projects yet')} text={t('Give your first novel a title and a few lines of description, and the rest can wait.')}>
            <div className="imp-empty-actions">
              <button className="small-btn is-primary" onClick={startNew}>{t('Create your first project')}</button>
              <button className="small-btn" onClick={startImport}>{t('Import a manuscript')}</button>
              <SampleButton onNeedAccount={() => setShowGate(true)} />
            </div>
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
                <p>{project.description || t('No description yet.')}</p>
                <p className="meta" style={{ marginTop: 10 }}>
                  <span className={`badge${project.is_published ? ' is-accent' : ''}`}>
                    <span className="small-dot" /> {project.is_published ? t('Published') : t('Draft')}
                  </span>
                  {isSampleProject(project.id) && <span className="badge" style={{ marginLeft: 8 }}>{t('Sample')}</span>}
                  {sharedProjectIds.includes(project.id) && <span className="badge" style={{ marginLeft: 8 }}>{t('Shared')}</span>}
                  {activeProject?.id === project.id && (
                    <span className="badge" style={{ marginLeft: 8 }}>{t('Last opened')}</span>
                  )}{' '}
                  &nbsp; {t('Updated {date}', { date: fmtDate(project.updated_at) })}
                </p>
              </div>
              <div className="project-actions">
                {isSampleProject(project.id) && (
                  <button className="small-btn" onClick={() => setRemoveSample(project)}>{t('Remove sample')}</button>
                )}
                {!isGuest && !isSampleProject(project.id) && (
                  <button className="small-btn" onClick={() => setSharing(project)}>
                    <Users /> {t('Share')}
                  </button>
                )}
                <button className="small-btn" onClick={() => setExportProject(project)}>
                  <Download /> {t('Export')}
                </button>
                <button className="small-btn" onClick={() => openSettings(project)}>
                  <Settings /> {t('Edit details')}
                </button>
                <button className="small-btn is-primary" onClick={() => open(project)}>
                  {t('Open')}
                </button>
              </div>
            </article>
          ))
        )}

        {sharedProjects.length > 0 && (
          <section aria-labelledby="shared-with-you-h" style={{ marginTop: 40 }}>
            <h2 className="section-title" id="shared-with-you-h">{t('Shared with you')}</h2>
            <p className="section-note">{t('Projects other people have invited you to write in.')}</p>
            {sharedProjects.map((project, i) => (
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
                  <p>{project.description || t('No description yet.')}</p>
                  <p className="meta" style={{ marginTop: 10 }}>
                    <span className="badge is-accent">{ROLE_LABEL[project.role]()}</span>
                    <span style={{ marginLeft: 8 }}>{t('by {owner}', { owner: project.ownerName })}</span>
                    {activeProject?.id === project.id && <span className="badge" style={{ marginLeft: 8 }}>{t('Last opened')}</span>}
                  </p>
                </div>
                <div className="project-actions">
                  <button className="small-btn" onClick={() => void leave(project)}>{t('Leave')}</button>
                  <button className="small-btn is-primary" onClick={() => open(project)}>
                    {t('Open')}
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      <ShareProjectDialog project={sharing} onClose={() => setSharing(null)} />

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
          <p className="eyebrow">{t('A NEW BOOK')}</p>
          <h2 id="ms-np-h">{t('Start a project')}</h2>
          <label htmlFor="ms-np-title">{t('Project title')}</label>
          <input id="ms-np-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Whispers of the Starward')} required autoFocus />
          <label htmlFor="ms-np-desc">{t('Description')}</label>
          <input id="ms-np-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('A short summary of the theme, setting or plot')} />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowNew(false)}>{t('Cancel')}</button>
            <button className="button button-primary button-small">{t('Create project')}</button>
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
          <p className="eyebrow">{t('PROJECT DETAILS')}</p>
          <h2 id="ps-h">{editing?.title}</h2>
          <label htmlFor="ps-title">{t('Novel title')}</label>
          <input id="ps-title" value={eTitle} onChange={(e) => setETitle(e.target.value)} required />
          <label htmlFor="ps-syn">{t('Synopsis')}</label>
          <input id="ps-syn" value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
          <label htmlFor="ps-genre">{t('Genre')}</label>
          <select id="ps-genre" className="select" style={{ marginTop: 8 }} value={eGenre} onChange={(e) => setEGenre(e.target.value)}>
            <option value="">{t('Select a genre')}</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <label htmlFor="ps-cover">{t('Cover image URL')}</label>
          <input id="ps-cover" type="url" value={eCover} onChange={(e) => setECover(e.target.value)} placeholder={t('https://…')} />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setEditing(null)}>{t('Cancel')}</button>
            <button className="button button-primary button-small">{t('Save changes')}</button>
          </div>
        </form>
      </Dialog>

      <ExportDialog project={exportProject} onClose={() => setExportProject(null)} />
      <ImportDialog open={showImport} onClose={() => setShowImport(false)} target="new" />
      <RemoveSampleDialog project={removeSample} onClose={() => setRemoveSample(null)} />

      <GuestGateModal
        isOpen={showGate}
        onClose={() => setShowGate(false)}
        message={t('You need a free account to start writing and saving your own novels. It takes about ten seconds. Guests can still browse and read everything in the Public Library.')}
      />
    </div>
  );
};
