import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLive } from '../../context/LiveContext';
import { describeNotification, type AppNotification } from '../../lib/notifications';
import { timeAgo } from '../../lib/relativeTime';
import { useT } from '../../i18n';
import { KindIcon } from './KindIcon';

/** The bell in the header: a count of what is new, and the latest few things in a small panel. */
export const NotificationBell: React.FC = () => {
  const t = useT();
  const { user, isGuest } = useApp();
  const { notifications, unreadNotifications, markRead, notificationSource } = useLive();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Guests have no account to notify
  if (!user || isGuest) return null;

  const go = (n: AppNotification) => {
    setOpen(false);
    if (!n.read_at) void markRead([n.id]);
    navigate(describeNotification(n).href);
  };

  const latest = notifications.slice(0, 7);
  const label = unreadNotifications > 0 ? t('Notifications, {n} new', { n: unreadNotifications }) : t('Notifications');

  return (
    <div ref={wrapperRef} className="header-menu-wrap">
      <button type="button" className="bell-button" onClick={() => setOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={t('Notifications')}>
        <Bell />
        {unreadNotifications > 0 && (
          <span className="bell-badge" aria-hidden="true">
            {unreadNotifications > 99 ? '99+' : unreadNotifications}
          </span>
        )}
      </button>

      {open && (
        <div className="menu-pop notif-pop" role="dialog" aria-label={t('Notifications')}>
          <div className="notif-head">
            <strong>{t('Notifications')}</strong>
            {unreadNotifications > 0 && (
              <button type="button" className="link-accent" onClick={() => void markRead('all')}>
                {t('Mark all as read')}
              </button>
            )}
          </div>

          {latest.length === 0 ? (
            <p className="notif-empty">
              {notificationSource === 'setup' ? t('Notifications are not switched on for this site yet.') : t('Nothing new yet. Follows, comments, reviews and messages will show up here.')}
            </p>
          ) : (
            <ul className="notif-list">
              {latest.map((n) => {
                const d = describeNotification(n);
                return (
                  <li key={n.id}>
                    <button type="button" className={`notif-item${n.read_at ? '' : ' is-unread'}`} onClick={() => go(n)}>
                      <KindIcon kind={n.kind} />
                      <span className="notif-text">
                        <span className="notif-title">{d.title}</span>
                        {d.detail && <span className="notif-detail">{d.detail}</span>}
                        <small>{timeAgo(n.created_at)}</small>
                      </span>
                      {!n.read_at && <span className="notif-dot" aria-label={t('New')} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="notif-foot">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              {t('See everything')}
            </Link>
            <Link to="/preferences#notifications" onClick={() => setOpen(false)}>
              {t('Settings')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
