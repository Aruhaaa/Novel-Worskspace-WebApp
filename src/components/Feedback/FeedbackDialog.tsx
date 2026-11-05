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
import { fmtDate, tp, useT } from '../../i18n';

interface FeedbackDialogProps {
  project: Project | null;
  onClose: () => void;
}

const FeedbackBody: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
  const t = useT();
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
    if (added) parts.push(tp(added, '{n} new comment added.', '{n} new comments added.'));
    if (skipped) parts.push(t('{n} already imported.', { n: skipped }));
    setMessage({ text: [...parts, ...problems].join(' ') || t('Nothing to import.'), bad: problems.length > 0 && added === 0 });
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

  return (
    <div className="peek">
      <div className="peek-head">
        <div>
          <p className="eyebrow">{t('READER FEEDBACK')}</p>
          <h2 id="fb-h">{t('What your readers said')}</h2>
        </div>
        <button className="small-btn" onClick={onClose} aria-label={t('Close reader feedback')}>{t('Close')}</button>
      </div>
      <p>
        {t('Readers can comment through a private link (live, below), or you can send a')} <strong>{t('Beta-reader copy')}</strong> {t('from Export and import the feedback file they send back. Either way the comments appear against the right chapters.')}
      </p>

      <ShareLinksPanel project={project} />

      <h3 className="feedback-chapter">{t('From feedback files')}</h3>

      <div style={{ margin: '16px 0' }}>
        <label className="small-btn" style={{ cursor: 'pointer' }}>
          {t('Import feedback files')}
          <input type="file" accept=".json,application/json" multiple style={{ display: 'none' }} onChange={(e) => { void readFiles(e.target.files); e.target.value = ''; }} />
        </label>
        {message && (
          <p className="mock-note" role="status" style={{ marginTop: 12, color: message.bad ? 'var(--danger)' : undefined }}>
            {message.text}
          </p>
        )}
      </div>

      {feedback.length === 0 ? (
        <p className="meta">{t('No feedback imported yet.')}</p>
      ) : (
        <>
          <label className="check-row" style={{ marginBottom: 8 }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            <span>{t('Show resolved ({n})', { n: doneCount })}</span>
          </label>
          {visible.length === 0 && <p className="meta">{t('Everything is resolved. Nice work.')}</p>}
          {visible.map((c, i) => {
            const chapterIndex = order.get(c.chapterId);
            const heading =
              chapterIndex === undefined ? t('{title} (no longer in the manuscript)', { title: c.chapterTitle || t('A chapter') }) : `${String(chapterIndex + 1).padStart(2, '0')} · ${chapters[chapterIndex].title || t('Untitled chapter')}`;
            const showHeading = i === 0 || visible[i - 1].chapterId !== c.chapterId;
            return (
              <React.Fragment key={`${c.reader}-${c.id}`}>
                {showHeading && <h3 className="feedback-chapter">{heading}</h3>}
                <article className={`feedback-item${c.status === 'done' ? ' is-done' : ''}`}>
                  <p className="meta">
                    {c.reader} · {fmtDate(c.createdAt)}{c.source === 'link' ? ` · ${t('via link')}` : ''}
                  </p>
                  {c.quote && <blockquote>{c.quote}</blockquote>}
                  <p style={{ whiteSpace: 'pre-wrap' }}>{c.note}</p>
                  <div className="page-actions" style={{ marginTop: 8 }}>
                    {chapterIndex !== undefined && (
                      <button className="small-btn" onClick={() => show(c)}>
                        {c.quote ? t('Show the passage') : t('Open the chapter')}
                      </button>
                    )}
                    <button className="small-btn" onClick={() => setFeedbackStatus(project.id, c, c.status === 'open' ? 'done' : 'open')}>
                      {c.status === 'open' ? t('Mark done') : t('Reopen')}
                    </button>
                    <button className="small-btn is-danger" onClick={() => removeFeedback(project.id, c)}>
                      {t('Remove')}
                    </button>
                  </div>
                </article>
              </React.Fragment>
            );
          })}
        </>
      )}

      <p className="meta" style={{ marginTop: 16 }}>{t('Comments from reading links are stored in the cloud. Imported feedback files are kept on this device.')}</p>
      <div className="dialog-actions">
        <button className="button button-primary button-small" onClick={onClose}>{t('Close')}</button>
      </div>
    </div>
  );
};

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ project, onClose }) => (
  <Dialog open={!!project} onClose={onClose} labelledBy="fb-h" className="dialog-wide">
    {project && <FeedbackBody project={project} onClose={onClose} />}
  </Dialog>
);
