import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import type { Project } from '../../services/types';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/toastContext';

/** A button that makes the sample project and opens it, for someone who wants to look around first. */
export const SampleButton: React.FC<{ onNeedAccount: () => void }> = ({ onNeedAccount }) => {
  const { createSampleProject, isGuest } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <button
      className="small-btn"
      disabled={busy}
      onClick={async () => {
        if (isGuest) {
          onNeedAccount();
          return;
        }
        setBusy(true);
        const sample = await createSampleProject();
        setBusy(false);
        if (sample) navigate('/editor');
        else toast({ message: 'The sample project could not be made. Check your connection and try again.' });
      }}
    >
      {busy ? 'Setting it up…' : 'Explore a sample project'}
    </button>
  );
};

/** Confirms, then removes the sample project and everything inside it. */
export const RemoveSampleDialog: React.FC<{ project: Project | null; onClose: () => void }> = ({ project, onClose }) => {
  const { deleteProject } = useApp();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={!!project} onClose={onClose} labelledBy="rs-h">
      <p className="eyebrow">SAMPLE PROJECT</p>
      <h2 id="rs-h">Remove “{project?.title}”?</h2>
      <p>This deletes the sample's chapters, notebook and outline. Your own projects are not touched. You can make the sample again any time.</p>
      <div className="dialog-actions">
        <button className="button button-outline button-small" onClick={onClose}>Keep it</button>
        <button
          className="button button-primary button-small"
          disabled={busy}
          onClick={async () => {
            if (!project) return;
            setBusy(true);
            try {
              await deleteProject(project.id);
              toast({ message: 'Sample project removed.' });
            } catch {
              toast({ message: 'Could not remove the sample. Try again.' });
            }
            setBusy(false);
            onClose();
          }}
        >
          {busy ? 'Removing…' : 'Remove sample'}
        </button>
      </div>
    </Dialog>
  );
};
