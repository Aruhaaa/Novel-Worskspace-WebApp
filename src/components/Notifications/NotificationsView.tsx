import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useLive } from '../../context/LiveContext';
import { describeNotification, type AppNotification } from '../../lib/notifications';
import { timeAgo } from '../../lib/relativeTime';
import { useT } from '../../i18n';
import { EmptyState } from '../ui/EmptyState';
import { PageHead } from '../ui/PageHead';
import { KindIcon } from './KindIcon';

type Filter = 'all' | 'unread';

/** Everything that happened while you were away, newest first. */
export const NotificationsView: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const { notifications, unreadNotifications, markRead, removeNotification, notificationSource, refreshNotifications } = useLive();
  const [filter, setFilter] = useState<Filter>('all');

  const shown = filter === 'unread' ? notifications.filter((n) => !n.read_at) : notifications;

  const open = (n: AppNotification) => {
    if (!n.read_at) void markRead([n.id]);
    navigate(describeNotification(n).href);
  };

  return (
    <div className="studio-view">
      <div className="page">
        <PageHead
          eyebrow={t('NOTIFICATIONS')}
          title={
            <>
              {t("What's")} <em>{t('new.')}</em>
            </>
          }
          lead={t('Follows, comments, reviews, messages and reading-link notes, newest first.')}
          actions={
            <>
              <Link className="small-btn" to="/preferences#notifications">
                {t('Choose what to hear about')}
              </Link>
              <button className="small-btn is-primary" onClick={() => void markRead('all')} disabled={unreadNotifications === 0}>
                {t('Mark all as read')}
              </button>
            </>
          }
        />

        <div className="tabs" role="tablist" aria-label={t('Show')}>
          <button role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>
            {t('All')}
          </button>
          <button role="tab" aria-selected={filter === 'unread'} onClick={() => setFilter('unread')}>
            {t('Unread')}
            {unreadNotifications > 0 && <b className="tab-count">{unreadNotifications}</b>}
          </button>
        </div>

        {notificationSource === 'setup' ? (
          <EmptyState icon="users" title={t('Notifications are not switched on yet')} text={t('The site owner has one setup step left (see supabase/README.md). Until then nothing is recorded here.')} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon="bookmark"
            title={filter === 'unread' ? t('You are all caught up') : t('Nothing yet')}
            text={filter === 'unread' ? t('Nothing new since you last looked.') : t('When someone follows you, comments, reviews or writes to you, it will show up here.')}
          >
            <button className="small-btn" onClick={() => void refreshNotifications()}>
              {t('Check again')}
            </button>
          </EmptyState>
        ) : (
          <ul className="notif-page-list">
            {shown.map((n) => {
              const d = describeNotification(n);
              return (
                <li key={n.id} className={n.read_at ? '' : 'is-unread'}>
                  <button type="button" className="notif-row" onClick={() => open(n)}>
                    <KindIcon kind={n.kind} />
                    <span className="notif-text">
                      <span className="notif-title">{d.title}</span>
                      {d.detail && <span className="notif-detail">{d.detail}</span>}
                      <small>{timeAgo(n.created_at)}</small>
                    </span>
                    {!n.read_at && <span className="notif-dot" aria-label={t('New')} />}
                  </button>
                  <button type="button" className="icon-button" aria-label={t('Remove this notification')} title={t('Remove')} onClick={() => void removeNotification(n.id)}>
                    <Trash2 />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
