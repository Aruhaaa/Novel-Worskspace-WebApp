import React, { useEffect, useState } from 'react';
import { GenreTag } from '../Library/GenreChips';
import { EmptyState } from '../ui/EmptyState';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { databaseService } from '../../services/database';
import type { UserProfile, Project } from '../../services/types';
import { MessageSquare, ArrowLeft } from 'lucide-react';

export const PublicProfileView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile, toggleFollow, setActivePublicProject } = useApp();
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
        <div className="page"><p className="meta" role="status">Loading profile…</p></div>
      </div>
    );
  }

  if (!authorProfile) {
    return (
      <div className="studio-view">
        <div className="page">
          <EmptyState icon="users" title="Author not found" text="We couldn't find that author. They may have removed their profile.">
            <button className="small-btn is-primary" onClick={() => navigate('/library')}>Return to Library</button>
          </EmptyState>
        </div>
      </div>
    );
  }

  const isMe = user?.id === authorProfile.id;
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

  const name = authorProfile.display_name || 'Anonymous author';

  return (
    <div className="studio-view">
      <div className="page">
        <button className="small-btn" onClick={() => navigate('/library')} style={{ marginBottom: 26 }}>
          <ArrowLeft /> Back to Library
        </button>

        <section className="profile-hero">
          <span className="avatar lg" aria-hidden="true">{name[0].toUpperCase()}</span>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1>{name}</h1>
            {authorProfile.bio && <p className="bio">{authorProfile.bio}</p>}
            <div className="profile-stats">
              <div><strong>{authorProjects.length}</strong>Published works</div>
              <div><strong>{authorProfile.followers?.length || 0}</strong>Followers</div>
              <div><strong>{authorProfile.following?.length || 0}</strong>Following</div>
            </div>
          </div>
          {!isMe && (
            <div className="page-actions">
              <button className={`small-btn${isFollowing ? '' : ' is-primary'}`} onClick={handleFollow} aria-pressed={!!isFollowing}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button className="small-btn" onClick={handleMessage}>
                <MessageSquare /> Message
              </button>
            </div>
          )}
        </section>

        <section aria-labelledby="works-h">
          <h2 className="section-title" id="works-h">Published works</h2>
          <p className="section-note">Everything {name} has shared with the library.</p>
          {authorProjects.length === 0 ? (
            <EmptyState icon="book" title="No published novels" text="This author hasn't published any novels yet." />
          ) : (
            <div className="grid-2">
              {authorProjects.map((project) => (
                <article className="card" key={project.id}>
                  {project.genre ? <GenreTag genre={project.genre} /> : <span className="badge">Uncategorized</span>}
                  <h3 style={{ marginTop: 12 }}>{project.title}</h3>
                  <p style={{ margin: '8px 0 14px' }}>{project.description || 'No description provided.'}</p>
                  <p className="meta">
                    {(project.likes || []).length} likes · {(project.views || []).length} views ·{' '}
                    <button className="link-accent" onClick={() => handleReadNovel(project)}>Read</button>
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
