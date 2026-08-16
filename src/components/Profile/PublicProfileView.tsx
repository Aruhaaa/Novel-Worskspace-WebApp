import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { databaseService } from '../../services/database';
import type { UserProfile, Project } from '../../services/types';
import { User as UserIcon, BookOpen, Users, MessageSquare, Loader2, ArrowLeft } from 'lucide-react';

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
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-400 h-full">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!authorProfile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-400 h-full">
        <UserIcon className="w-16 h-16 text-slate-700 mb-4" />
        <h3 className="text-xl font-bold mb-2">Author Not Found</h3>
        <button onClick={() => navigate('/library')} className="text-indigo-400 hover:underline">
          Return to Library
        </button>
      </div>
    );
  }

  const isMe = user?.id === authorProfile.id;
  const isFollowing = profile?.following?.includes(authorProfile.id);

  const handleFollow = async () => {
    if (!user) return;
    const nowFollowing = await toggleFollow(authorProfile.id);
    // Optimistically update local state for the follower count
    setAuthorProfile(prev => {
      if (!prev) return prev;
      let newFollowers = prev.followers || [];
      if (nowFollowing) {
        newFollowers.push(user.id);
      } else {
        newFollowers = newFollowers.filter(fid => fid !== user.id);
      }
      return { ...prev, followers: newFollowers };
    });
  };

  const handleMessage = () => {
    navigate(`/messages/${authorProfile.id}`);
  };

  const handleReadNovel = (project: Project) => {
    setActivePublicProject(project);
    navigate(`/library/novel/${project.id}`);
  };

  return (
    <div className="flex-1 bg-slate-950 overflow-y-auto relative text-slate-200">
      {/* Background Banner */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-indigo-900/30 to-slate-950 pointer-events-none" />
      
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-16 relative z-10">
        <button 
          onClick={() => navigate('/library')}
          className="flex items-center gap-2 text-sm font-semibold mb-8 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </button>

        {/* Profile Header */}
        <div className="flex flex-col md:flex-row items-start md:items-end gap-6 mb-12 pb-8 border-b border-slate-800">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-950 flex items-center justify-center text-4xl text-indigo-400 font-bold shadow-xl">
            {authorProfile.display_name?.charAt(0).toUpperCase() || <UserIcon className="w-10 h-10" />}
          </div>
          
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold text-white mb-2">{authorProfile.display_name || 'Anonymous Author'}</h1>
            <div className="flex items-center gap-4 text-sm font-medium text-slate-400">
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {(authorProfile.followers || []).length} Followers</span>
              <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {authorProjects.length} Published Works</span>
            </div>
          </div>

          {!isMe && user && (
            <div className="flex gap-3 mt-4 md:mt-0 w-full md:w-auto">
              <button 
                onClick={handleFollow}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg font-bold transition-all shadow-lg ${isFollowing ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/20'}`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button 
                onClick={handleMessage}
                className="px-4 py-2 rounded-lg font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors flex items-center justify-center"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Bio */}
        {authorProfile.bio && (
          <div className="mb-12">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">About the Author</h3>
            <p className="text-slate-300 leading-relaxed font-sans">{authorProfile.bio}</p>
          </div>
        )}

        {/* Published Works */}
        <div>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6">Published Works</h3>
          {authorProjects.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800/50">
              <BookOpen className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">This author hasn't published any novels yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {authorProjects.map(project => (
                <div 
                  key={project.id}
                  onClick={() => handleReadNovel(project)}
                  className="bg-slate-900 border border-slate-800 p-5 rounded-2xl cursor-pointer hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all group shadow-xl shadow-black/20"
                >
                  <h4 className="text-lg font-bold text-slate-200 mb-2 group-hover:text-indigo-400 transition-colors line-clamp-1">{project.title}</h4>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-4 h-10 font-sans">{project.description}</p>
                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                    <span>{project.genre || 'Uncategorized'}</span>
                    <span>{(project.likes || []).length} Likes</span>
                    <span>{(project.views || []).length} Views</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
