import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/toastContext';
import { REPORT_REASONS, submitReport, TARGET_NAMES } from '../../lib/safety';
import type { ReportReason, ReportTarget } from '../../services/types';

export interface ReportSubject {
  type: ReportTarget;
  targetId: string;
  /** The person who wrote it, so the report can offer to block them too */
  authorId?: string;
  authorName?: string;
  projectId?: string;
  /** What it said, kept with the report when there is no server to look it up */
  excerpt: string;
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  subject: ReportSubject;
}

/** The form itself. It only exists while the dialog is open, so it starts empty every time. */
const ReportForm: React.FC<{ onClose: () => void; subject: ReportSubject }> = ({ onClose, subject }) => {
  const { user, blockedIds, blockUser } = useApp();
  const { toast } = useToast();
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const what = TARGET_NAMES[subject.type];
  const canBlock = !!subject.authorId && subject.authorId !== user?.id && !blockedIds.includes(subject.authorId);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !user) return;
    setSending(true);
    setError(null);
    const { error: sendError } = await submitReport({
      type: subject.type,
      targetId: subject.targetId,
      reason,
      details,
      local: { reporterId: user.id, targetUserId: subject.authorId, projectId: subject.projectId, excerpt: subject.excerpt },
    });
    if (sendError) {
      setSending(false);
      setError(sendError);
      return;
    }
    if (alsoBlock && canBlock && subject.authorId) await blockUser(subject.authorId);
    setSending(false);
    onClose();
    toast({ message: alsoBlock && canBlock ? 'Thank you. The report is sent and you will no longer see them.' : 'Thank you. The report is sent and will be looked at.' });
  };

  return (
      <form onSubmit={send}>
        <p className="eyebrow">REPORT</p>
        <h2 id="report-h">Report this {what}</h2>
        <p>Reports are private. The person is not told who sent it.</p>
        <fieldset style={{ border: 0, padding: 0, margin: '18px 0 0' }}>
          <legend className="sr-only">Why are you reporting it?</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r.id} className="check-row" style={{ alignItems: 'flex-start', marginTop: 10 }}>
              <input type="radio" name="report-reason" checked={reason === r.id} onChange={() => setReason(r.id)} style={{ width: 'auto', marginTop: 4 }} />
              <span>
                {r.label}
                <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>{r.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <label>
          Anything we should know? (optional)
          <textarea className="textarea" style={{ width: '100%', minHeight: 70, marginTop: 8 }} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
        </label>
        {canBlock && (
          <label className="check-row" style={{ marginTop: 16 }}>
            <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} style={{ width: 'auto' }} />
            <span>Also block {subject.authorName || 'this person'}</span>
          </label>
        )}
        {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="small-btn" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="small-btn is-primary" disabled={!reason || sending}>{sending ? 'Sending…' : 'Send report'}</button>
        </div>
      </form>
  );
};

export const ReportDialog: React.FC<DialogProps> = ({ open, onClose, subject }) => (
  <Dialog open={open} onClose={onClose} labelledBy="report-h" className="dialog-wide">
    <ReportForm onClose={onClose} subject={subject} />
  </Dialog>
);

/** A small "Report" button for a piece of someone else's content. Shows nothing for guests or for your own work. */
export const ReportButton: React.FC<{ subject: ReportSubject; label?: string; className?: string }> = ({ subject, label = 'Report', className = 'link-accent' }) => {
  const { user, isGuest } = useApp();
  const [open, setOpen] = useState(false);
  if (!user || isGuest || subject.authorId === user.id) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
        <Flag style={{ width: 11, height: 11 }} /> {label}
      </button>
      <ReportDialog open={open} onClose={() => setOpen(false)} subject={subject} />
    </>
  );
};
