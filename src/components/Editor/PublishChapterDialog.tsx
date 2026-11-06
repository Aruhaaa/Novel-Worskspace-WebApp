import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/toastContext';
import { tp, useT } from '../../i18n';

interface Props {
  /** The chapters to publish. Closed when empty or missing. */
  chapterIds: string[] | null;
  onClose: () => void;
}

/** Asks before chapters go to readers. Publishing is outward-facing, so it is never one click. */
export const PublishChapterDialog: React.FC<Props> = ({ chapterIds, onClose }) => {
  const t = useT();
  const { activeProject, chapters, publishChapters } = useApp();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = chapterIds ?? [];
  const open = ids.length > 0;
  const picked = chapters.filter((c) => ids.includes(c.id)).sort((a, b) => a.position - b.position);
  const alreadyListed = !!activeProject?.is_published;
  const firstNumber = picked.length ? chapters.findIndex((c) => c.id === picked[0].id) + 1 : 0;

  const confirm = async () => {
    if (!activeProject) return;
    setBusy(true);
    setError(null);
    const { error: failed } = await publishChapters(ids, true);
    setBusy(false);
    if (failed) {
      setError(failed);
      return;
    }
    onClose();
    toast({
      message:
        picked.length === 1
          ? t('Chapter {n} is now public.', { n: String(firstNumber) })
          : tp(picked.length, '{n} chapter is now public.', '{n} chapters are now public.'),
      actionLabel: t('Undo'),
      onAction: () => {
        void publishChapters(ids, false);
      },
    });
  };

  return (
    <Dialog open={open} onClose={() => { setError(null); onClose(); }} labelledBy="pc-h">
      <div>
        <p className="eyebrow">{t('FOR READERS')}</p>
        <h2 id="pc-h">
          {picked.length === 1 ? t('Publish chapter {n}?', { n: String(firstNumber) }) : tp(picked.length, 'Publish {n} chapter?', 'Publish {n} chapters?')}
        </h2>
        {picked.length > 0 && (
          <ul style={{ margin: '0 0 12px', paddingLeft: 20, maxHeight: 140, overflow: 'auto' }}>
            {picked.map((c) => (
              <li key={c.id}>{c.title || t('Untitled chapter')}</li>
            ))}
          </ul>
        )}
        <p>
          {t('Readers can see it as soon as you publish. Changes you make to a published chapter show to readers straight away. You can unpublish it again.')}
        </p>
        {!alreadyListed && activeProject && (
          <p>{t('This also puts “{title}” in the Public Library.', { title: activeProject.title })}</p>
        )}
        {error && (
          <p className="mock-note" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button button-outline button-small" onClick={onClose} disabled={busy}>
            {t('Cancel')}
          </button>
          <button type="button" className="button button-primary button-small" onClick={confirm} disabled={busy}>
            {busy ? t('Publishing…') : picked.length === 1 ? t('Publish chapter') : t('Publish chapters')}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
