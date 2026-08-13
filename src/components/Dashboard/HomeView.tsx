import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BookOpen, BookOpenCheck, Flame, Plus, ChevronRight, Compass } from 'lucide-react';

export const HomeView: React.FC = () => {
  const { user, profile, projects, wordCountLogs, setActiveProject, setActiveView, createProject } = useApp();
  
  const [showNewProjModal, setShowNewProjModal] = useState(false);
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

  // Daily Goal Calculations
  const dailyGoal = profile?.daily_word_goal || 1000;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLog = wordCountLogs.find(l => l.date === todayStr);
  const todaysWordCount = todayLog ? todayLog.word_count : 0;
  const progressPercent = Math.min(100, Math.round((todaysWordCount / dailyGoal) * 100));

  // Determine greeting name
  const greetingName = profile?.display_name || (user?.email ? user.email.split('@')[0] : 'Author');

  const handleOpenProject = (project: any) => {
    setActiveProject(project);
    setActiveView('editor');
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjTitle.trim()) return;
    
    await createProject(newProjTitle, newProjDesc);
    setNewProjTitle('');
    setNewProjDesc('');
    setShowNewProjModal(false);
  };

  return (
    <div className="flex-1 bg-slate-950 overflow-y-auto relative">
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />
      
      <div className="max-w-6xl mx-auto px-8 py-12 relative z-10 space-y-10">
        
        {/* Header / Greeting */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">
              Welcome back, {greetingName}
            </h1>
            <p className="text-slate-400 text-lg">
              Ready to write your next masterpiece?
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveView('library')}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2"
            >
              <Compass className="w-4 h-4" />
              Public Library
            </button>
            <button
              onClick={() => setShowNewProjModal(true)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Column: Recent Projects */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                Your Projects
              </h2>
            </div>
            
            {projects.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-12 text-center flex flex-col items-center">
                <BookOpenCheck className="w-12 h-12 text-slate-700 mb-4 stroke-[1]" />
                <h3 className="text-lg font-semibold text-slate-300 mb-2">No Projects Yet</h3>
                <p className="text-slate-500 mb-6 max-w-sm">
                  You haven't created any novels. Start your writing journey by creating your first project!
                </p>
                <button
                  onClick={() => setShowNewProjModal(true)}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
                >
                  Create New Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleOpenProject(project)}
                    className="group relative bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl p-5 hover:bg-slate-800/80 hover:border-indigo-500/50 transition-all duration-300 flex flex-col cursor-pointer overflow-hidden"
                  >
                    <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none" />
                    
                    <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {project.title}
                    </h3>
                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed mb-4 flex-1">
                      {project.description || 'No description.'}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-3">
                      <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                      <div className="flex items-center gap-1 text-indigo-400 font-semibold opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                        Open <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Widgets */}
          <div className="space-y-6">
            
            {/* Daily Goal Widget */}
            <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-6">
                <Flame className="w-4 h-4 text-orange-400" />
                Today's Goal
              </h3>
              
              <div className="flex items-center gap-6">
                <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="40" cy="40" r="36"
                      stroke="currentColor" strokeWidth="6" fill="transparent"
                      className="text-slate-800"
                    />
                    <circle
                      cx="40" cy="40" r="36"
                      stroke="currentColor" strokeWidth="6" fill="transparent"
                      strokeDasharray={2 * Math.PI * 36}
                      strokeDashoffset={2 * Math.PI * 36 - (progressPercent / 100) * (2 * Math.PI * 36)}
                      className="text-rose-500 transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-100">
                    {progressPercent}%
                  </div>
                </div>
                
                <div>
                  <div className="text-3xl font-extrabold text-white mb-1">
                    {todaysWordCount.toLocaleString()}
                  </div>
                  <div className="text-sm text-slate-400">
                    / {dailyGoal.toLocaleString()} words
                  </div>
                  {progressPercent >= 100 && (
                    <div className="text-xs font-semibold text-emerald-400 mt-2">
                      Goal crushed! 🎉
                    </div>
                  )}
                </div>
              </div>
              
              <button 
                onClick={() => setActiveView('tracker')}
                className="w-full mt-6 py-2 rounded-lg bg-slate-950 text-slate-400 text-xs font-semibold hover:bg-slate-800 hover:text-slate-200 transition-colors border border-slate-800"
              >
                View Tracker Details
              </button>
            </div>
            
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProjModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl animate-in scale-in duration-200">
            <h3 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5 text-indigo-500" />
              Create New Project
            </h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Project Title</label>
                <input
                  type="text"
                  placeholder="e.g. Whispers of the Starward"
                  value={newProjTitle}
                  onChange={(e) => setNewProjTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  placeholder="A short summary of your novel's theme, setting, or plot..."
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProjModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 transition-colors"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
