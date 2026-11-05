import React, { useState } from 'react';
import { useLive } from '../../context/LiveContext';
import { KIND_HINT, KIND_LABEL, NOTIFICATION_KINDS, type NotificationKind, type NotificationSettings } from '../../lib/notifications';
import { useT } from '../../i18n';

/** Choose what to hear about. Each kind can be switched off; email is offered once the site has the email function set up. */
export const NotificationSettingsSection: React.FC = () => {
  const t = useT();
  const { settings, saveSettings, notificationSource } = useLive();
  const [status, setStatus] = useState('');
  const emailAvailable = import.meta.env.VITE_NOTIFY_EMAIL === 'on';

  const change = async (next: NotificationSettings) => {
    setStatus('');
    const { saved } = await saveSettings(next);
    setStatus(saved === 'saved' ? t('Saved to your account.') : t('Saved on this device.'));
  };

  const toggleInApp = (kind: NotificationKind, on: boolean) =>
    change({ ...settings, muted_kinds: on ? settings.muted_kinds.filter((k) => k !== kind) : [...settings.muted_kinds, kind] });
  const toggleEmail = (kind: NotificationKind, on: boolean) =>
    change({ ...settings, email_kinds: on ? [...settings.email_kinds, kind] : settings.email_kinds.filter((k) => k !== kind) });

  return (
    <section aria-labelledby="notify-h" id="notifications">
      <h2 className="section-title" id="notify-h">{t('Notifications')}</h2>
      <p className="section-note">
        {t('Choose what the bell tells you about. Switching a kind off means it is not recorded at all.')}
        {notificationSource === 'setup' && ` ${t('Notifications are not switched on for this site yet, so these choices apply once they are.')}`}
      </p>
      <div className="notify-settings">
        {NOTIFICATION_KINDS.map((kind) => (
          <div className="notify-row" key={kind}>
            <div>
              <strong>{KIND_LABEL[kind]()}</strong>
              <small>{KIND_HINT[kind]()}</small>
            </div>
            <label className="notify-check">
              <input type="checkbox" checked={!settings.muted_kinds.includes(kind)} onChange={(e) => void toggleInApp(kind, e.target.checked)} aria-label={`${KIND_LABEL[kind]()}: ${t('in the app')}`} />
              {t('In the app')}
            </label>
            {emailAvailable && (
              <label className="notify-check">
                <input type="checkbox" checked={settings.email_kinds.includes(kind)} onChange={(e) => void toggleEmail(kind, e.target.checked)} aria-label={`${KIND_LABEL[kind]()}: ${t('by email')}`} />
                {t('By email')}
              </label>
            )}
          </div>
        ))}
      </div>
      <p className="section-note" role="status" aria-live="polite" style={{ marginTop: 10 }}>
        {status}
      </p>
    </section>
  );
};
