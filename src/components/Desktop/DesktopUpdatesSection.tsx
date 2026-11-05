import React from 'react';
import { useDesktopUpdates } from '../../lib/desktop';
import { useT } from '../../i18n';

/** Preferences, desktop app only: which version this is, and a way to look for a newer one now */
export const DesktopUpdatesSection: React.FC = () => {
  const t = useT();
  const { isDesktop, version, state, check, install } = useDesktopUpdates();

  if (!isDesktop) return null;

  const busy = state.status === 'checking' || state.status === 'downloading';
  const line = (() => {
    switch (state.status) {
      case 'unavailable':
        return t('This copy is running from source, so it does not update itself.');
      case 'checking':
        return t('Looking for a newer version…');
      case 'downloading':
        return t('Downloading version {version}… {percent}%', { version: state.version ?? '', percent: state.percent ?? 0 });
      case 'ready':
        return t('Version {version} is ready. It is installed when you close the app, or now.', { version: state.version ?? '' });
      case 'current':
        return t('You have the newest version.');
      case 'error':
        return t('Could not check for updates right now ({message}). The app tries again later.', { message: state.message ?? '' });
      default:
        return t('The app looks for a newer version a few seconds after it opens, and again every few hours.');
    }
  })();

  return (
    <section aria-labelledby="updates-h" id="updates">
      <h2 className="section-title" id="updates-h">{t('App updates')}</h2>
      <p className="section-note">{t('You are using version {version}.', { version: version || '…' })}</p>
      <p className="section-note" role="status" aria-live="polite">{line}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="small-btn"
          disabled={busy || state.status === 'unavailable' || state.status === 'ready'}
          onClick={() => void check()}
        >
          {t('Check for updates')}
        </button>
        {state.status === 'ready' && (
          <button className="small-btn is-primary" onClick={() => void install()}>{t('Restart now')}</button>
        )}
      </div>
    </section>
  );
};
