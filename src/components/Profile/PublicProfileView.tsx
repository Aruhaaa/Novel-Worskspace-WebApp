import React, { useEffect, useState } from 'react';
import { GenreTag } from '../Library/GenreChips';
import { LanguageTag } from '../ui/LanguageSelect';
import { EmptyState } from '../ui/EmptyState';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { databaseService } from '../../services/database';
import type { UserProfile, Project } from '../../services/types';
import { MessageSquare, ArrowLeft, Ban } from 'lucide-react';
import { ReportButton } from '../Safety/ReportDialog';
import { useToast } from '../ui/toastContext';
import { isBundledAuthor } from '../../lib/bundledLibrary';
import { useT } from '../../i18n';

export const PublicProfileView: React.FC = () => {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { user, isGuest, profile, toggleFollow, setActivePublicProject, blockedIds, blockUser, unblockUser } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [authorProfile, setAuthorProfile] = useState<UserProfile | null>(null);
  const [authorProjects, setAuthorProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const p = await databaseService.getProfile(id);
        setAuthorProfile(p);

        // Fetch their public projects
        const allPubs = await databaseService.getPublicProjects();
        setAuthorProjects(allPubs.filter(proj => proj.user_id === id));
      } catch (err) {
        console.error('Failed to fetch public profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfileData();
  }, [id]);

  if (loading) {
    return (
      <div className="studio-view">
        <div className="page"><p className="meta" role="status">{t('Loading profile…')}</p></div>
      </div>
    );
  }

  if (!authorProfile) {
    return (
      <div className="studio-view">
        <div className="page">
          <EmptyState icon="users" title={t('Author not found')} text={t('We couldn\'t find that author. They may have removed their profile.')}>
            <button className="small-btn is-primary" onClick={() => navigate('/library')}>{t('Return to Library')}</button>
          </EmptyState>
        </div>
      </div>
    );
  }

  const isMe = user?.id === authorProfile.id;
  const sampleAuthor = isBundledAuthor(authorProfile.id);
  const isBlocked = blockedIds.includes(authorProfile.id);
  const isFollowing = profile?.following?.includes(authorProfile.id);

  const handleFollow = async () => {
    if (!user) return;
    
    const isCurrentlyFollowing = profile?.following?.includes(authorProfile.id);
    const nowFollowing = !isCurrentlyFollowing;

    // Optimistically update local state for the follower count immediately
    setAuthorProfile(prev => {
      if (!prev) return prev;
      let newFollowers = prev.followers ? [...prev.followers] : [];
      if (nowFollowing) {
        if (!newFollowers.includes(user.id)) newFollowers.push(user.id);
      } else {
        newFollowers = newFollowers.filter(fid => fid !== user.id);
      }
      return { ...prev, followers: newFollowers };
    });

    // The context will optimistically update the button state, while the DB call runs in the background
    await toggleFollow(authorProfile.id);
  };

  const handleMessage = () => {
    navigate(`/messages/${authorProfile.id}`);
  };

  const handleReadNovel = (project: Project) => {
    setActivePublicProject(project);
    navigate(`/library/novel/${project.id}`);
  };

  const name = authorProfile.display_name || t('Anonymous author');

  const handleBlock = async () => {
    if (!window.confirm(t('Block {name}? You will not see what they write or publish, and neither of you can message the other. You can unblock them in Preferences.', { name }))) return;
    const { saved } = await blockUser(authorProfile.id);
    toast({ message: saved === 'saved' ? t('{name} is blocked.', { name }) : t('{name} is blocked on this device. It could not be saved to your account right now.', { name }) });
  };

  const handleUnblock = async () => {
    await unblockUser(authorProfile.id);
    toast({ message: `${name} is unblocked.` });
  };

  return (
    <div className="studio-view">
      <div className="page">
        <button className="small-btn" onClick={() => navigate('/library')} style={{ marginBottom: 26 }}>
          <ArrowLeft /> {t('Back to Library')}
        </button>

        <section className="profile-hero">
          <span className="avatar lg" aria-hidden="true">{name[0].toUpperCase()}</span>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1>{name}</h1>
            {authorProfile.bio && <p className="bio">{authorProfile.bio}</p>}
            {sampleAuthor && <p className="meta">{t('A pen name from the sample library that comes with the site. There is no one to follow or message.')}</p>}
            <div className="profile-stats">
              <div><strong>{authorProjects.length}</strong>{t('Published works')}</div>
              <div><strong>{authorProfile.followers?.length || 0}</strong>{t('Followers')}</div>
              <div><strong>{authorProfile.following?.length || 0}</strong>{t('Following')}</div>
            </div>
          </div>
          {!isMe && !sampleAuthor && (
            <div className="page-actions">
              {isBlocked ? (
                <button className="small-btn" onClick={handleUnblock}>
                  <Ban /> {t('Blocked · Unblock')}
                </button>
              ) : (
                <>
                  <button className={`small-btn${isFollowing ? '' : ' is-primary'}`} onClick={handleFollow} aria-pressed={!!isFollowing}>
                    {isFollowing ? t('Following') : t('Follow')}
                  </button>
                  <button className="small-btn" onClick={handleMessage}>
                    <MessageSquare /> {t('Message')}
                  </button>
                </>
              )}
              {user && !isGuest && (
                <>
                  {!isBlocked && (
                    <button className="small-btn" onClick={handleBlock}>
                      <Ban /> {t('Block')}
                    </button>
                  )}
                  <ReportButton
                    className="small-btn"
                    label={t('Report')}
                    subject={{ type: 'author', targetId: authorProfile.id, authorId: authorProfile.id, authorName: name, excerpt: `${authorProfile.display_name || ''} - ${authorProfile.bio || ''}` }}
                  />
                </>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="works-h">
          <h2 className="section-title" id="works-h">{t('Published works')}</h2>
          <p className="section-note">{t('Everything {name} has shared with the library.', { name })}</p>
          {authorProjects.length === 0 ? (
            <EmptyState icon="book" title={t('No published novels')} text={t('This author hasn\'t published any novels yet.')} />
          ) : (
            <div className="grid-2">
              {authorProjects.map((project) => (
                <article className="card" key={project.id}>
                  {project.genre ? <GenreTag genre={project.genre} /> : <span className="badge">{t('Uncategorized')}</span>}{' '}
                  <LanguageTag code={project.language} />
                  <h3 style={{ marginTop: 12 }}>{project.title}</h3>
                  <p style={{ margin: '8px 0 14px' }}>{project.description || t('No description provided.')}</p>
                  <p className="meta">
                    {(project.likes || []).length} likes · {(project.views || []).length} views ·{' '}
                    <button className="link-accent" onClick={() => handleReadNovel(project)}>{t('Read')}</button>
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
