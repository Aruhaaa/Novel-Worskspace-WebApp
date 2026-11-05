import React, { useEffect, useState } from 'react';
import { REASON_LABEL, addSnapshot, listSnapshots, type Snapshot } from '../../lib/history';
import { htmlToText } from '../../lib/text';
import { Dialog } from '../ui/Dialog';
import { fmtDate, fmtTime, t, tp, useT } from '../../i18n';

interface VersionHistoryProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  chapterId: string;
  currentTitle: string;
  currentContent: string;
  currentWords: number;
  onRestore: (title: string, content: string) => void;
}

const formatWhen = (ms: number) => {
  const d = new Date(ms);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = fmtTime(d, { hour: '2-digit', minute: '2-digit' });
  return sameDay ? t('Today, {time}', { time }) : `${fmtDate(d, { day: 'numeric', month: 'short' })}, ${time}`;
};

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  open,
  onClose,
  projectId,
  chapterId,
  currentTitle,
  currentContent,
  currentWords,
  onRestore,
}) => {
  const t = useT();
  const [versions, setVersions] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<number | string | null>(null);
  const [confirming, setConfirming] = useState<Snapshot | null>(null);

  const reload = async () => setVersions(await listSnapshots(projectId, chapterId));

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listSnapshots(projectId, chapterId).then((list) => {
      if (!alive) return;
      setVersions(list);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [open, projectId, chapterId]);

  // A fresh start the next time it opens
  const close = () => {
    setPreview(null);
    setConfirming(null);
    setLoading(true);
    onClose();
  };

  const saveNow = async () => {
    await addSnapshot(projectId, chapterId, currentTitle, currentContent, 'manual');
    await reload();
  };

  const restore = async (version: Snapshot) => {
    // Keep what is on the page now, so a restore can itself be undone
    await addSnapshot(projectId, chapterId, currentTitle, currentContent, 'before-restore');
    onRestore(version.title, version.content);
    close();
  };

  return (
    <Dialog open={open} onClose={close} labelledBy="vh-h" className="dialog-wide">
      <p className="eyebrow">{t('THIS CHAPTER')}</p>
      <h2 id="vh-h">{t('Version history')}</h2>
      <p>
        {t('Restore points are taken when you open a chapter and every ten minutes of writing. Save one yourself before a big edit.')}
      </p>

      <div style={{ margin: '18px 0 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span className="meta">{tp(versions.length, '{n} saved version', '{n} saved versions')}</span>
        <button className="small-btn" onClick={saveNow}>{t('Save a version now')}</button>
      </div>

      <div style={{ maxHeight: '46vh', overflowY: 'auto', borderTop: '1px solid var(--line)' }}>
        {loading ? (
          <p style={{ margin: '14px 0' }}>{t('Loading versions…')}</p>
        ) : versions.length === 0 ? (
          <p style={{ margin: '14px 0' }}>{t('No versions yet. One is saved the next time you open this chapter.')}</p>
        ) : (
          versions.map((v) => {
            const delta = v.words - currentWords;
            const isOpen = preview === v.id;
            return (
              <div key={v.id} className="read-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <strong style={{ fontFamily: 'var(--sans)', fontSize: 13 }}>{formatWhen(v.createdAt)}</strong>
                  <small>
                    {t(REASON_LABEL[v.reason])} · {tp(v.words, '{n} word', '{n} words')}
                    {delta !== 0 && ` (${t('{delta} vs now', { delta: `${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString()}` })})`}
                  </small>
                </div>
                <button className="small-btn" onClick={() => setPreview(isOpen ? null : v.id ?? null)}>
                  {isOpen ? t('Hide') : t('Preview')}
                </button>
                <button className="small-btn" onClick={() => setConfirming(v)}>{t('Restore')}</button>
                {isOpen && (
                  <p style={{ flexBasis: '100%', margin: '8px 0 0', fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.7, maxHeight: 160, overflowY: 'auto' }}>
                    {htmlToText(v.content).slice(0, 1200) || t('This version was empty.')}
                    {htmlToText(v.content).length > 1200 && '…'}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {confirming && (
        <div className="mock-note" role="alertdialog" style={{ marginTop: 14 }}>
          <strong>{t('RESTORE THIS VERSION?')}</strong> {t('What is on the page now is saved as a version first, so you can come back to it.')}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="small-btn is-primary" onClick={() => restore(confirming)}>{t('Restore')}</button>
            <button className="small-btn" onClick={() => setConfirming(null)}>{t('Cancel')}</button>
          </div>
        </div>
      )}

      <div className="dialog-actions">
        <button className="button button-outline button-small" onClick={onClose}>{t('Close')}</button>
      </div>
    </Dialog>
  );
};
