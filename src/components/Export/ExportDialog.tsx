import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { databaseService } from '../../services/database';
import type { Chapter, Project, WikiEntity, WordCountLog } from '../../services/types';
import { exportNovelToHTML } from '../../utils/exportUtils';
import { exportBetaCopy } from '../../utils/betaCopy';
import { exportBackup, exportDocx, exportEpub, exportText, manuscriptWords } from '../../utils/exportFormats';
import { Dialog } from '../ui/Dialog';

interface ExportDialogProps {
  project: Project | null;
  onClose: () => void;
}

interface Option {
  id: string;
  title: string;
  text: string;
}

const OPTIONS: Option[] = [
  { id: 'docx', title: 'Word document (.docx)', text: 'For editors, agents and submissions. Keeps headings, bold, italics and alignment.' },
  { id: 'epub', title: 'E-book (.epub)', text: 'Read it on a Kindle app, Kobo, Apple Books or any e-reader.' },
  { id: 'pdf', title: 'PDF', text: 'Opens the print view. Choose "Save as PDF" as the printer.' },
  { id: 'txt', title: 'Plain text (.txt)', text: 'Just the words, with no formatting. Opens anywhere.' },
  { id: 'html', title: 'Web page (.html)', text: 'A single readable page you can share or open in a browser.' },
  { id: 'beta', title: 'Beta-reader copy (.html)', text: 'One page you can email. Readers select passages and comment, then send you a small feedback file to import. Nothing is uploaded.' },
  { id: 'backup', title: 'Full backup (.json)', text: 'Everything in this project: chapters, notebook, outline and word log. Keep a copy somewhere safe.' },
];

export const ExportDialog: React.FC<ExportDialogProps> = ({ project, onClose }) => {
  const { setActiveProject } = useApp();
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setChapters(null);
    setMessage(null);
    if (!project) return;
    let cancelled = false;
    databaseService
      .getChapters(project.id)
      .then((c) => !cancelled && setChapters(c))
      .catch(() => !cancelled && setMessage('Could not load the chapters. Check your connection and try again.'));
    return () => {
      cancelled = true;
    };
  }, [project]);

  const run = async (option: Option) => {
    if (!project || !chapters) return;
    setBusy(option.id);
    setMessage(null);
    try {
      if (option.id === 'pdf') {
        setActiveProject(project);
        onClose();
        navigate('/print');
        return;
      }
      if (option.id === 'docx') await exportDocx(project, chapters);
      if (option.id === 'epub') await exportEpub(project, chapters);
      if (option.id === 'txt') exportText(project, chapters);
      if (option.id === 'html') exportNovelToHTML(project, chapters);
      if (option.id === 'beta') exportBetaCopy(project, chapters);
      if (option.id === 'backup') {
        const [entities, logs]: [WikiEntity[], WordCountLog[]] = await Promise.all([
          databaseService.getEntities(project.id),
          databaseService.getWordCountLogs(project.id),
        ]);
        exportBackup(project, chapters, entities, logs);
      }
      setMessage(`${option.title} saved to your downloads.`);
    } catch (err) {
      console.error('Export failed:', err);
      setMessage('That export did not work. Try again, or pick another format.');
    } finally {
      setBusy(null);
    }
  };

  const words = chapters ? manuscriptWords(chapters) : 0;

  return (
    <Dialog open={!!project} onClose={onClose} labelledBy="ex-h" className="dialog-wide">
      <p className="eyebrow">EXPORT</p>
      <h2 id="ex-h">{project?.title}</h2>
      <p>
        {chapters
          ? `${chapters.length} ${chapters.length === 1 ? 'chapter' : 'chapters'} · ${words.toLocaleString()} words. Choose a format.`
          : 'Loading chapters…'}
      </p>

      <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            className="small-btn"
            disabled={!chapters || busy !== null}
            onClick={() => run(option)}
            style={{ justifyContent: 'space-between', textAlign: 'left', padding: '12px 14px', height: 'auto', alignItems: 'flex-start', flexDirection: 'column', gap: 2 }}
          >
            <strong style={{ fontSize: 13 }}>{busy === option.id ? 'Preparing…' : option.title}</strong>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400, lineHeight: 1.5 }}>{option.text}</span>
          </button>
        ))}
      </div>

      {message && (
        <p className="mock-note" role="status" style={{ marginTop: 14 }}>
          {message}
        </p>
      )}

      <div className="dialog-actions">
        <button className="button button-outline button-small" onClick={onClose}>Close</button>
      </div>
    </Dialog>
  );
};
