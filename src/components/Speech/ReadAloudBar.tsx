import React from 'react';
import { Pause, Play, Square } from 'lucide-react';
import type { ReadAloud } from '../../lib/useReadAloud';
import { useT } from '../../i18n';

/** Play, pause and stop, with speed and voice. Shown while something is being read, and hidden otherwise. */
export const ReadAloudBar: React.FC<{ ra: ReadAloud }> = ({ ra }) => {
  const t = useT();
  if (!ra.supported || ra.state === 'idle') return null;
  const playing = ra.state === 'playing';
  return (
    <div className="listen-bar" role="region" aria-label={t('Read aloud')}>
      <button className="icon-button" onClick={playing ? ra.pause : ra.resume} aria-label={playing ? t('Pause reading') : t('Continue reading aloud')} title={playing ? t('Pause') : t('Continue')}>
        {playing ? <Pause /> : <Play />}
      </button>
      <button className="icon-button" onClick={ra.stop} aria-label={t('Stop reading aloud')} title={t('Stop')}>
        <Square />
      </button>
      <span className="listen-progress" role="status" aria-live="polite">
        {t('Paragraph {i} of {n}', { i: ra.index + 1, n: ra.total })}
      </span>
      <label className="listen-field">
        <span className="sr-only">{t('Speed')}</span>
        <select className="select" value={ra.rate} onChange={(e) => ra.setRate(Number(e.target.value))} aria-label={t('Speed')}>
          {[0.75, 1, 1.25, 1.5, 1.75].map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
      </label>
      {ra.voices.length > 1 && (
        <label className="listen-field">
          <span className="sr-only">{t('Voice')}</span>
          <select className="select" value={ra.voiceUri} onChange={(e) => ra.setVoiceUri(e.target.value)} aria-label={t('Voice')}>
            <option value="">{t('Automatic voice')}</option>
            {ra.voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};
