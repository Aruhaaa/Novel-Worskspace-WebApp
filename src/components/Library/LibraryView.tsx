import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BookOpen, User as UserIcon, Clock, ChevronRight, Heart, Search, Filter, Hash } from 'lucide-react';

export const LibraryView: React.FC = () => {
  const { user, publicProjects, loadPublicProjects, setActivePublicProject, setActiveView, toggleLikeProject } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'liked' | 'az'>('newest');

  useEffect(() => {
    loadPublicProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReadNovel = (project: any) => {
    setActivePublicProject(project);
    setActiveView('reader');
  };

  return (
    <div className="flex-1 bg-slate-950 overflow-y-auto relative">
      {/* Background aesthetics */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none" />
      
      <div className="max-w-6xl mx-auto px-8 py-12 relative z-10">
        <header className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-4 border border-indigo-500/20">
            <BookOpen className="w-8 h-8 text-indigo-400 stroke-[1.5]" />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">Public Novel Library</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Discover and read stories published by other authors in the Novelist Workspace community.
          </p>
        </header>

        {/* Search and Filter Bar */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-4 mb-10 flex flex-col md:flex-row items-center gap-4 shadow-xl">
          <div className="flex-1 relative w-full">
            <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search by title or author..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-48">
              <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select 
                value={filterGenre}
                onChange={(e) => setFilterGenre(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
              >
                <option value="All">All Genres</option>
                <option value="Fantasy">Fantasy</option>
                <option value="Sci-Fi">Sci-Fi</option>
                <option value="Romance">Romance</option>
                <option value="Mystery">Mystery</option>
                <option value="Horror">Horror</option>
                <option value="Thriller">Thriller</option>
                <option value="Historical">Historical</option>
                <option value="Contemporary">Contemporary</option>
              </select>
            </div>

            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="liked">Most Liked</option>
              <option value="az">A-Z</option>
            </select>
          </div>
        </div>

        {(() => {
          const filteredProjects = publicProjects
            .filter(p => filterGenre === 'All' || p.genre === filterGenre)
            .filter(p => 
              p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
              (p.author_name || '').toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => {
              if (sortBy === 'newest') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
              if (sortBy === 'liked') return (b.likes?.length || 0) - (a.likes?.length || 0);
              if (sortBy === 'az') return a.title.localeCompare(b.title);
              return 0;
            });

          if (filteredProjects.length === 0) {
            return (
              <div className="text-center py-24 bg-slate-900/30 rounded-3xl border border-slate-800/50 backdrop-blur-sm">
                <BookOpen className="w-16 h-16 text-slate-700 mx-auto mb-6 stroke-[1]" />
                <h3 className="text-xl font-semibold text-slate-300 mb-2">No novels found</h3>
                <p className="text-slate-500 max-w-md mx-auto">
                  {publicProjects.length === 0 
                    ? "No one has published a novel yet. Be the first to share your masterpiece with the world!"
                    : "Try adjusting your search or filters."}
                </p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <div 
                key={project.id}
                className="group relative bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:bg-slate-800/80 hover:border-indigo-500/50 transition-all duration-300 flex flex-col h-full cursor-pointer overflow-hidden"
                onClick={() => handleReadNovel(project)}
              >
                {/* Hover Glow */}
                <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />
                
                {/* Cover Image */}
                {project.cover_url && (
                  <div className="w-full h-40 mb-4 rounded-xl overflow-hidden shrink-0 border border-slate-800/50">
                    <img 
                      src={project.cover_url} 
                      alt={project.title} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1000&auto=format&fit=crop';
                      }}
                    />
                  </div>
                )}
                
                <h3 className="text-xl font-bold text-slate-100 mb-2 group-hover:text-indigo-300 transition-colors line-clamp-2">
                  {project.title}
                </h3>
                
                <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-indigo-400/80 mb-4 font-medium">
                  <div className="flex items-center gap-1.5">
                    <UserIcon className="w-4 h-4" />
                    <span>{project.author_name || 'Anonymous'}</span>
                  </div>
                  {project.genre && (
                    <div className="flex items-center gap-1 text-slate-400 bg-slate-950/50 px-2 py-0.5 rounded-full border border-slate-800">
                      <Hash className="w-3.5 h-3.5" />
                      <span className="text-xs">{project.genre}</span>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-slate-400 flex-1 line-clamp-4 leading-relaxed mb-6">
                  {project.description || 'No description provided for this novel.'}
                </p>
                
                <div className="mt-auto pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleLikeProject(project.id); }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
                        project.likes?.includes(user?.id || '') 
                          ? 'text-rose-400 bg-rose-500/10' 
                          : 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/10'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${project.likes?.includes(user?.id || '') ? 'fill-rose-400' : ''}`} />
                      <span className="font-medium">{project.likes?.length || 0}</span>
                    </button>
                    
                    <div className="flex items-center gap-1 text-indigo-400 font-semibold opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                      Read <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
      </div>
    </div>
  );
};
