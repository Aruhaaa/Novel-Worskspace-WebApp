import React, { useEffect, useState } from 'react';
import { databaseService } from '../../services/database';
import type { Project, UserProfile } from '../../services/types';
import { Dialog } from '../ui/Dialog';
import { t, useT } from '../../i18n';

interface Props {
  project: Project;
  onClose: () => void;
}

const PersonRow: React.FC<{ profile: UserProfile }> = ({ profile }) => (
  <div className="read-row">
    <span className="avatar">{(profile.display_name || 'A')[0].toUpperCase()}</span>
    <div>
      <strong>{profile.display_name || t('Anonymous reader')}</strong>
    </div>
  </div>
);

export const AudienceAnalyticsModal: React.FC<Props> = ({ project, onClose }) => {
  const t = useT();
  const [viewers, setViewers] = useState<UserProfile[]>([]);
  const [likers, setLikers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'readers' | 'likes'>('readers');

  useEffect(() => {
    const fetchAudience = async () => {
      setLoading(true);
      try {
        const viewIds = project.views || [];
        const likeIds = project.likes || [];
        const uniqueIds = Array.from(new Set([...viewIds, ...likeIds]));
        if (uniqueIds.length > 0) {
          const profiles = await databaseService.getProfilesByIds(uniqueIds);
          setViewers(profiles.filter((p) => viewIds.includes(p.id)));
          setLikers(profiles.filter((p) => likeIds.includes(p.id)));
        }
      } catch (err) {
        console.error('Error fetching audience:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAudience();
  }, [project]);

  const list = tab === 'readers' ? viewers : likers;

  return (
    <Dialog open onClose={onClose} labelledBy="aud-h">
      <p className="eyebrow">{t('AUDIENCE')}</p>
      <h2 id="aud-h">{t('Who is reading')}</h2>
      <p style={{ marginTop: 6 }}>{project.title}</p>
      <div className="tabs" role="tablist" style={{ margin: '18px 0 8px' }}>
        <button role="tab" aria-selected={tab === 'readers'} onClick={() => setTab('readers')}>
          {t('Readers · {n}', { n: viewers.length })}
        </button>
        <button role="tab" aria-selected={tab === 'likes'} onClick={() => setTab('likes')}>
          {t('Likes · {n}', { n: likers.length })}
        </button>
      </div>
      <div role="tabpanel" style={{ minHeight: 120, maxHeight: 280, overflowY: 'auto' }}>
        {loading ? (
          <p style={{ margin: 0 }}>{tab === 'readers' ? t('Loading readers…') : t('Loading likes…')}</p>
        ) : list.length === 0 ? (
          <p style={{ margin: 0 }}>{tab === 'readers' ? t('No one has read this yet.') : t('No likes yet.')}</p>
        ) : (
          list.map((p) => <PersonRow key={p.id} profile={p} />)
        )}
      </div>
      <div className="dialog-actions">
        <button className="button button-outline button-small" onClick={onClose}>{t('Close')}</button>
      </div>
    </Dialog>
  );
};
