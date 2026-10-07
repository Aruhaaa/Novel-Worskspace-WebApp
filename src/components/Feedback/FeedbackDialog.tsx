import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Project } from '../../services/types';
import {
  importFeedback,
  parseFeedbackFile,
  quoteTerm,
  refreshLinkFeedback,
  removeFeedback,
  setFeedbackStatus,
  useFeedback,
  type FeedbackComment,
} from '../../lib/feedback';
import { useOpenChapter } from '../../lib/useOpenChapter';
import { Dialog } from '../ui/Dialog';
import { ShareLinksPanel } from './ShareLinksPanel';

interface FeedbackDialogProps {
  project: Project | null;
  onClose: () => void;
}

const FeedbackBody: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
  const { chapters } = useApp();
  const openChapter = useOpenChapter();
  const feedback = useFeedback(project.id);
  const [showDone, setShowDone] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  // Comments arrive through reading links while this is open, so check for new ones now and then
  useEffect(() => {
    void refreshLinkFeedback(project.id, true);
    const timer = window.setInterval(() => void refreshLinkFeedback(project.id, true), 30000);
    return () => window.clearInterval(timer);
  }, [project.id]);

  const readFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let added = 0;
    let skipped = 0;
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      const parsed = parseFeedbackFile(await file.text(), project.id, project.title);
      if (!parsed.ok) {
        problems.push(`${file.name}: ${parsed.error}`);
        continue;
      }
      const result = importFeedback(project.id, parsed);
      added += result.added;
      skipped += result.skipped;
    }
    const parts: string[] = [];
    if (added) parts.push(`${added} new ${added === 1 ? 'comment' : 'comments'} added.`);
    if (skipped) parts.push(`${skipped} already imported.`);
    setMessage({ text: [...parts, ...problems].join(' ') || 'Nothing to import.', bad: problems.length > 0 && added === 0 });
  };

  const order = new Map(chapters.map((c, i) => [c.id, i]));
  const visible = feedback
    .filter((c) => showDone || c.status === 'open')
    .sort((a, b) => (order.get(a.chapterId) ?? 999) - (order.get(b.chapterId) ?? 999) || a.createdAt.localeCompare(b.createdAt));
  const doneCount = feedback.filter((c) => c.status === 'done').length;

  const show = (c: FeedbackComment) => {
    const chapter = chapters.find((ch) => ch.id === c.chapterId);
    if (!chapter) return;
    onClose();
    openChapter(chapter, c.quote ? quoteTerm(c.quote) : undefined);
  };

  let lastChapter = '';
  return (
    <div className="peek">
      <div className="peek-head">
        <div>
          <p className="eyebrow">READER FEEDBACK</p>
          <h2 id="fb-h">What your readers said</h2>
        </div>
        <button className="small-btn" onClick={onClose} aria-label="Close reader feedback">Close</button>
      </div>
      <p>
        Readers can comment through a private link (live, below), or you can send a <strong>Beta-reader copy</strong> from Export and import the feedback file they send back. Either way the comments appear against the right chapters.
      </p>

      <ShareLinksPanel project={project} />

      <h3 className="feedback-chapter">From feedback files</h3>

      <div style={{ margin: '16px 0' }}>
        <label className="small-btn" style={{ cursor: 'pointer' }}>
          Import feedback files
          <input type="file" accept=".json,application/json" multiple style={{ display: 'none' }} onChange={(e) => { void readFiles(e.target.files); e.target.value = ''; }} />
        </label>
        {message && (
          <p className="mock-note" role="status" style={{ marginTop: 12, color: message.bad ? 'var(--danger)' : undefined }}>
            {message.text}
          </p>
        )}
      </div>

      {feedback.length === 0 ? (
        <p className="meta">No feedback imported yet.</p>
      ) : (
        <>
          <label className="check-row" style={{ marginBottom: 8 }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            <span>Show resolved ({doneCount})</span>
          </label>
          {visible.length === 0 && <p className="meta">Everything is resolved. Nice work.</p>}
          {visible.map((c) => {
            const chapterIndex = order.get(c.chapterId);
            const heading =
              chapterIndex === undefined ? `${c.chapterTitle || 'A chapter'} (no longer in the manuscript)` : `${String(chapterIndex + 1).padStart(2, '0')} · ${chapters[chapterIndex].title || 'Untitled chapter'}`;
            const showHeading = c.chapterId !== lastChapter;
            lastChapter = c.chapterId;
            return (
              <React.Fragment key={`${c.reader}-${c.id}`}>
                {showHeading && <h3 className="feedback-chapter">{heading}</h3>}
                <article className={`feedback-item${c.status === 'done' ? ' is-done' : ''}`}>
                  <p className="meta">
                    {c.reader} · {new Date(c.createdAt).toLocaleDateString()}{c.source === 'link' ? ' · via link' : ''}
                  </p>
                  {c.quote && <blockquote>{c.quote}</blockquote>}
                  <p style={{ whiteSpace: 'pre-wrap' }}>{c.note}</p>
                  <div className="page-actions" style={{ marginTop: 8 }}>
                    {chapterIndex !== undefined && (
                      <button className="small-btn" onClick={() => show(c)}>
                        {c.quote ? 'Show the passage' : 'Open the chapter'}
                      </button>
                    )}
                    <button className="small-btn" onClick={() => setFeedbackStatus(project.id, c, c.status === 'open' ? 'done' : 'open')}>
                      {c.status === 'open' ? 'Mark done' : 'Reopen'}
                    </button>
                    <button className="small-btn is-danger" onClick={() => removeFeedback(project.id, c)}>
                      Remove
                    </button>
                  </div>
                </article>
              </React.Fragment>
            );
          })}
        </>
      )}

      <p className="meta" style={{ marginTop: 16 }}>Comments from reading links are stored in the cloud. Imported feedback files are kept on this device.</p>
      <div className="dialog-actions">
        <button className="button button-primary button-small" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ project, onClose }) => (
  <Dialog open={!!project} onClose={onClose} labelledBy="fb-h" className="dialog-wide">
    {project && <FeedbackBody project={project} onClose={onClose} />}
  </Dialog>
);
