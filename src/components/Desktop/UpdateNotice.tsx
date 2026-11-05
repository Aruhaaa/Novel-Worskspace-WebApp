import React, { useState } from 'react';
import { useDesktopUpdates } from '../../lib/desktop';
import { useT } from '../../i18n';

/**
 * In the desktop app, once a newer version has been downloaded: say so, once, with a way to put it in place now.
 * Otherwise it is installed the next time the app is closed. Nothing here in a browser.
 */
export const UpdateNotice: React.FC = () => {
  const t = useT();
  const { isDesktop, state, install } = useDesktopUpdates();
  // Which version the person said "Later" to, so a still newer one is announced again
  const [later, setLater] = useState<string | null>(null);

  if (!isDesktop || state.status !== 'ready' || later === (state.version ?? '')) return null;

  return (
    <div className="update-notice" role="status">
      <span>{t('Version {version} is ready. Restart to finish updating.', { version: state.version ?? '' })}</span>
      <button className="small-btn is-primary" onClick={() => void install()}>{t('Restart now')}</button>
      <button className="small-btn" onClick={() => setLater(state.version ?? '')}>{t('Later')}</button>
    </div>
  );
};
