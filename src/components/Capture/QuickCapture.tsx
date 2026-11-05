import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Dialog } from '../ui/Dialog';
import { useT } from '../../i18n';

interface QuickCaptureProps {
  open: boolean;
  initial: string;
  onClose: () => void;
}

const CaptureForm: React.FC<{ initial: string; onClose: () => void }> = ({ initial, onClose }) => {
  const t = useT();
  const { createEntity, activeProject } = useApp();
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(0);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || !activeProject) return;
    setSaving(true);
    // The first line is the card's name; anything after it becomes the description
    const [first, ...rest] = value.split('\n');
    const name = first.length > 70 ? `${first.slice(0, 67)}…` : first;
    const description = (first.length > 70 ? first : '') + (rest.length ? `${first.length > 70 ? '\n' : ''}${rest.join('\n').trim()}` : '');
    await createEntity(name, 'scene', description, { status: 'idea', order: '999' });
    setSaving(false);
    setSaved((n) => n + 1);
    setText('');
  };

  return (
    <form onSubmit={save}>
      <p className="eyebrow">{t('JOT AN IDEA')}</p>
      <h2 id="qc-h">{t('Catch it before it goes')}</h2>
      <p>{t('It lands in the Ideas column of your Story outline, ready to be sorted later.')}</p>
      <label htmlFor="qc-text">{t('Idea')}</label>
      <textarea
        id="qc-text"
        className="textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save(e);
        }}
        placeholder={t('What if the lighthouse keeper was never alone?')}
        autoFocus
        style={{ minHeight: 120 }}
      />
      {saved > 0 && (
        <p className="mock-note" role="status" style={{ marginTop: 12 }}>
          {saved === 1 ? t('Saved to your Ideas.') : t('Saved. {n} ideas caught this time.', { n: saved })} {t('Add another, or close.')}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" className="button button-outline button-small" onClick={onClose}>
          {saved > 0 ? t('Done') : t('Cancel')}
        </button>
        <button className="button button-primary button-small" disabled={!text.trim() || saving}>
          {saving ? t('Saving…') : t('Save idea')}
        </button>
      </div>
    </form>
  );
};

export const QuickCapture: React.FC<QuickCaptureProps> = ({ open, initial, onClose }) => (
  <Dialog open={open} onClose={onClose} labelledBy="qc-h">
    <CaptureForm initial={initial} onClose={onClose} />
  </Dialog>
);
