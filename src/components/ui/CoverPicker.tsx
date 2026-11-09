import React, { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { checkCoverFile, coverProblemText, isPastedLink, prepareCover, type CoverChoice } from '../../lib/coverImage';

interface CoverPickerProps {
  value: CoverChoice;
  onChange: (next: CoverChoice) => void;
  /** Switched off while the form saves */
  disabled?: boolean;
  /** Told when a picture is being shrunk, so the form can hold its Save button until it is ready */
  onBusy?: (busy: boolean) => void;
  /** The id of the text that names this field, so it is read out with the buttons */
  labelId?: string;
}

/**
 * Choose a novel's cover: upload a picture (shrunk here, sent when the form is saved), or paste a link. A picture chosen here is
 * only held in the form, so closing the form without saving sends nothing and leaves nothing behind.
 */
export const CoverPicker: React.FC<CoverPickerProps> = ({ value, onChange, disabled, labelId, onBusy }) => {
  const t = useT();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const previewRef = useRef('');
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState('');
  // A pasted link is shown straight away; a stored picture's long address is not worth showing
  const [linkOpen] = useState(() => isPastedLink(value.url));

  const keepPreview = (next: string) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next;
    setPreview(next);
  };
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const bad = checkCoverFile(file);
    if (bad) return setProblem(coverProblemText(bad));
    setProblem('');
    setPreparing(true);
    onBusy?.(true);
    try {
      const picture = await prepareCover(file);
      keepPreview(URL.createObjectURL(picture));
      onChange({ url: value.url, picture });
    } catch {
      setProblem(t('That file could not be read as a picture.'));
    } finally {
      setPreparing(false);
      onBusy?.(false);
    }
  };

  const shown = preview || value.url;
  const has = !!shown;

  return (
    <div className="cover-picker" role="group" aria-labelledby={labelId}>
      <div className="cover-picker-preview">{shown ? <img src={shown} alt="" /> : <span>{t('No cover yet')}</span>}</div>
      <div className="cover-picker-side">
        <div className="cover-picker-buttons">
          <input
            ref={fileInput}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            aria-label={t('Cover picture')}
            data-testid="cover-file"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button type="button" className="small-btn" disabled={disabled || preparing} onClick={() => fileInput.current?.click()}>
            {preparing ? t('Preparing…') : has ? t('Replace picture') : t('Upload a picture')}
          </button>
          {has && !preparing && (
            <button
              type="button"
              className="small-btn"
              disabled={disabled}
              onClick={() => {
                keepPreview('');
                setProblem('');
                onChange({ url: '', picture: null });
              }}
            >
              {t('Remove picture')}
            </button>
          )}
        </div>
        <small>{t('JPEG, PNG or WebP. A portrait picture works best, and it is shrunk to fit, so any size is fine.')}</small>
        {problem && <small className="cover-picker-problem" role="alert">{problem}</small>}
        <details open={linkOpen || undefined}>
          <summary>{t('Use a link to a picture instead')}</summary>
          <input
            className="input"
            type="url"
            aria-label={t('Cover image URL')}
            placeholder={t('https://…')}
            disabled={disabled}
            value={value.picture ? '' : isPastedLink(value.url) ? value.url : ''}
            onChange={(e) => {
              keepPreview('');
              onChange({ url: e.target.value, picture: null });
            }}
          />
        </details>
      </div>
    </div>
  );
};
