import React, { useEffect, useState } from 'react';
import { X, Users, Heart, Eye } from 'lucide-react';
import { databaseService } from '../../services/database';
import type { Project, UserProfile } from '../../services/types';

interface Props {
  project: Project;
  onClose: () => void;
}

export const AudienceAnalyticsModal: React.FC<Props> = ({ project, onClose }) => {
  const [viewers, setViewers] = useState<UserProfile[]>([]);
  const [likers, setLikers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudience = async () => {
      setLoading(true);
      try {
        const viewIds = project.views || [];
        const likeIds = project.likes || [];
        
        // Fetch all unique profiles needed
        const uniqueIds = Array.from(new Set([...viewIds, ...likeIds]));
        if (uniqueIds.length > 0) {
          const profiles = await databaseService.getProfilesByIds(uniqueIds);
          
          // Map them back to the respective lists
          setViewers(profiles.filter(p => viewIds.includes(p.id)));
          setLikers(profiles.filter(p => likeIds.includes(p.id)));
        }
      } catch (err) {
        console.error('Error fetching audience:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAudience();
  }, [project]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl p-6 shadow-2xl animate-in scale-in duration-200 flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Audience Analytics
            </h3>
            <p className="text-xs text-slate-400 mt-1">{project.title}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
          
          {/* Viewers Column */}
          <div className="bg-slate-950/50 rounded-xl border border-slate-800 p-4 flex flex-col">
            <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
              <Eye className="w-4 h-4 text-emerald-400" />
              Readers ({viewers.length})
            </h4>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {loading ? (
                <div className="text-xs text-slate-500 animate-pulse">Loading readers...</div>
              ) : viewers.length === 0 ? (
                <div className="text-xs text-slate-500 italic">No one has read this yet.</div>
              ) : (
                viewers.map(profile => (
                  <div key={profile.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900 border border-slate-800/60">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                      {(profile.display_name || 'A')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">{profile.display_name || 'Anonymous Reader'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Likers Column */}
          <div className="bg-slate-950/50 rounded-xl border border-slate-800 p-4 flex flex-col">
            <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
              <Heart className="w-4 h-4 text-rose-400" />
              Likes ({likers.length})
            </h4>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {loading ? (
                <div className="text-xs text-slate-500 animate-pulse">Loading likes...</div>
              ) : likers.length === 0 ? (
                <div className="text-xs text-slate-500 italic">No likes yet.</div>
              ) : (
                likers.map(profile => (
                  <div key={profile.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900 border border-slate-800/60">
                    <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 font-bold text-xs shrink-0">
                      {(profile.display_name || 'A')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">{profile.display_name || 'Anonymous Reader'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
};
