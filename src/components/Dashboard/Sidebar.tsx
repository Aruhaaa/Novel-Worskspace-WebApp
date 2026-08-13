import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  BookOpen, 
  Compass, 
  BarChart2, 
  Plus, 
  Database, 
  ChevronDown, 
  FileText, 
  BookOpenCheck,
  LogOut,
  Globe,
  User,
  Printer,
  Home,
  Settings,
  X,
  Bookmark,
  Shield
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    projects,
    activeProject,
    chapters,
    activeChapter,
    activeView,
    isSupabase,
    setActiveView,
    setActiveProject,
    setActiveChapter,
    updateProjectSettings,
    createProject,
    createChapter,
    publishProject,
    logout,
    user,
    profile
  } = useApp();

  const [showProjDropdown, setShowProjDropdown] = useState(false);
  const [showNewProjModal, setShowNewProjModal] = useState(false);
  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [showNewChapterInput, setShowNewChapterInput] = useState(false);
  
  const [settingsTitle, setSettingsTitle] = useState('');
  const [settingsDesc, setSettingsDesc] = useState('');
  const [settingsGenre, setSettingsGenre] = useState('');
  const [settingsCoverUrl, setSettingsCoverUrl] = useState('');

  // Sync state when opening modal
  useEffect(() => {
    if (activeProject && showProjectSettingsModal) {
      setSettingsTitle(activeProject.title || '');
      setSettingsDesc(activeProject.description || '');
      setSettingsGenre(activeProject.genre || '');
      setSettingsCoverUrl(activeProject.cover_url || '');
    }
  }, [showProjectSettingsModal, activeProject]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjTitle.trim()) return;
    await createProject(newProjTitle, newProjDesc);
    setNewProjTitle('');
    setNewProjDesc('');
    setShowNewProjModal(false);
  };

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim()) return;
    await createChapter(newChapterTitle);
    setNewChapterTitle('');
    setShowNewChapterInput(false);
  };

  const handleTogglePublish = async () => {
    if (!activeProject || !user) return;
    const authorName = profile?.display_name || (user.email ? user.email.split('@')[0] : 'Anonymous');
    await publishProject(activeProject.id, !activeProject.is_published, authorName);
  };

  return (
    <aside className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col h-screen text-slate-300 select-none">
      {/* App Header & Project Selector */}
      <div className="p-5 border-b border-slate-900 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
              N
            </div>
            <span className="font-semibold text-slate-100 tracking-wide text-md">Novelist Workspace</span>
          </div>
          
          {/* Connection Status Badge */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-help bg-slate-900 border border-slate-800"
            title={isSupabase ? 'Connected to Supabase cloud database' : 'Using LocalStorage offline fallback'}
          >
            <span className={`w-2 h-2 rounded-full ${isSupabase ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <Database className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

      </div>

      {/* Main Module Nav */}
      <nav className="p-4 flex flex-col gap-1.5">
        <button
          onClick={() => setActiveView('home')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeView === 'home'
              ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500 pl-3.5'
              : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home Dashboard</span>
        </button>

        <button
          onClick={() => setActiveView('library')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeView === 'library'
              ? 'bg-emerald-600/10 text-emerald-400 border-l-2 border-emerald-500 pl-3.5'
              : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Public Library</span>
        </button>

        <button
          onClick={() => setActiveView('saved_library')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 mb-2 ${
            activeView === 'saved_library'
              ? 'bg-rose-600/10 text-rose-400 border-l-2 border-rose-500 pl-3.5'
              : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>Your Library</span>
        </button>

        {user?.email === 'aruhaadmin@novelist.com' && (
          <button
            onClick={() => setActiveView('admin')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 mb-2 ${
              activeView === 'admin'
                ? 'bg-amber-600/10 text-amber-500 border-l-2 border-amber-500 pl-3.5'
                : 'hover:bg-slate-900 text-amber-500/70 hover:text-amber-500'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin Dashboard</span>
          </button>
        )}

        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-3 mt-4">
          Workspace
        </div>
        
        {/* Project Selector dropdown */}
        <div className="relative px-4 mb-2 flex gap-2">
          <button 
            onClick={() => setShowProjDropdown(!showProjDropdown)}
            className="flex-1 flex items-center justify-between bg-slate-900 hover:bg-slate-800/80 border border-slate-800/60 px-4 py-2.5 rounded-lg text-left text-sm font-medium transition-all duration-200 overflow-hidden shadow-sm"
          >
            <span className="truncate text-slate-200 font-bold">
              {activeProject ? activeProject.title : 'No Project Selected'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          </button>

          {activeProject && (
            <button
              onClick={() => setShowProjectSettingsModal(true)}
              className="px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center justify-center transition-colors shadow-sm"
              title="Project Settings"
            >
              <Settings className="w-4 h-4 text-slate-400 hover:text-indigo-400" />
            </button>
          )}

          {showProjDropdown && (
            <div className="absolute left-4 right-4 mt-12 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              {projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => {
                    setActiveProject(proj);
                    setShowProjDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs hover:bg-indigo-600 hover:text-white transition-colors duration-150 ${activeProject?.id === proj.id ? 'text-indigo-400 bg-indigo-500/5 font-semibold' : 'text-slate-300'}`}
                >
                  <div className="truncate font-semibold">{proj.title}</div>
                  <div className="truncate text-[10px] opacity-70 mt-0.5">{proj.description || 'No description'}</div>
                </button>
              ))}
              <div className="border-t border-slate-800/60 my-1"></div>
              <button
                onClick={() => {
                  setShowProjDropdown(false);
                  setShowNewProjModal(true);
                }}
                className="w-full text-left px-4 py-2 text-xs text-indigo-400 hover:bg-indigo-600 hover:text-white font-medium flex items-center gap-1.5 transition-colors duration-150"
              >
                <Plus className="w-3.5 h-3.5" />
                New Project...
              </button>
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => {
              setActiveView('editor');
              setActiveChapter(null);
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeView === 'editor'
                ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500 pl-3.5'
                : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4" />
              <span>Editor</span>
            </div>
            {activeView === 'editor' && (
              <ChevronDown className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          {/* Chapters Accordion */}
          {activeView === 'editor' && activeProject && (
            <div className="mt-1 ml-4 pl-3 border-l-2 border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2">
                <span>Chapters</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNewChapterInput(!showNewChapterInput);
                  }}
                  className="hover:text-indigo-400 transition-colors"
                  title="Add Chapter"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {showNewChapterInput && (
                <form onSubmit={handleCreateChapter} className="px-1 py-1">
                  <input
                    type="text"
                    placeholder="Chapter title..."
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-600"
                    autoFocus
                  />
                </form>
              )}

              {chapters.length === 0 ? (
                <div className="text-[10px] text-slate-500 italic px-2 py-2">
                  No chapters yet.
                </div>
              ) : (
                chapters.map((chap) => (
                  <button
                    key={chap.id}
                    onClick={() => setActiveChapter(chap)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-left transition-all duration-150 group ${
                      activeChapter?.id === chap.id
                        ? 'bg-slate-900/80 text-slate-100 font-medium'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                  >
                    <FileText className={`w-3.5 h-3.5 shrink-0 ${activeChapter?.id === chap.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                    <span className="truncate flex-1">{chap.title}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setActiveView('planner')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeView === 'planner'
              ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500 pl-3.5'
              : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Planner (Wiki)</span>
        </button>

        <button
          onClick={() => setActiveView('tracker')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeView === 'tracker'
              ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500 pl-3.5'
              : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Tracker</span>
        </button>

        {activeProject && (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={handleTogglePublish}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 border ${
                activeProject.is_published
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Globe className={`w-4 h-4 ${activeProject.is_published ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{activeProject.is_published ? 'Published' : 'Publish Novel'}</span>
              </div>
              <div className={`w-8 h-4 rounded-full flex items-center transition-colors ${activeProject.is_published ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                <div className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform ${activeProject.is_published ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>
        )}
      </nav>


      {/* Export to PDF Button (Only show if active project exists) */}
      {activeProject && (
        <div className="p-4 border-t border-slate-900 shrink-0">
          <button
            onClick={() => setActiveView('print')}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-slate-100 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all duration-200"
          >
            <Printer className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      )}

      {/* User Settings & Logout */}
      <div className="p-4 border-t border-slate-900 shrink-0 space-y-2">
        <button
          onClick={() => setActiveView('profile')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeView === 'profile'
              ? 'bg-indigo-600/10 text-indigo-400'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>My Profile</span>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
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
                  className="w-full bg-slate-955 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
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
                  className="w-full bg-slate-955 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-none"
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

      {/* Project Settings Modal */}
      {showProjectSettingsModal && activeProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl animate-in scale-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" />
                Project Settings
              </h3>
              <button 
                onClick={() => setShowProjectSettingsModal(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Novel Title</label>
                <input
                  type="text"
                  value={settingsTitle}
                  onChange={(e) => setSettingsTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description (Synopsis)</label>
                <textarea
                  value={settingsDesc}
                  onChange={(e) => setSettingsDesc(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Genre</label>
                  <select
                    value={settingsGenre}
                    onChange={(e) => setSettingsGenre(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 appearance-none"
                  >
                    <option value="">Select Genre...</option>
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
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Cover Image URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={settingsCoverUrl}
                    onChange={(e) => setSettingsCoverUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProjectSettingsModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await updateProjectSettings(activeProject.id, {
                      title: settingsTitle,
                      description: settingsDesc,
                      genre: settingsGenre,
                      cover_url: settingsCoverUrl
                    });
                    setShowProjectSettingsModal(false);
                  }}
                  className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
