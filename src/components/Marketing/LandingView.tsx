import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Sparkles, Columns, Target, PenTool, LayoutTemplate } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const LandingView: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsGuest } = useApp();

  return (
    <div className="min-h-screen bg-white text-slate-300 font-sans selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">N</div>
            <span className="font-bold text-slate-100 tracking-wide text-lg">Novelist Workspace</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={loginAsGuest}
              className="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors hidden sm:block"
            >
              Explore as Guest
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors ml-2"
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-16 px-6 sm:px-12 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium border border-indigo-500/20 mb-8">
          <Sparkles className="w-4 h-4" />
          The Ultimate Tool for Modern Authors
        </div>
        
        <h1 className="text-5xl sm:text-7xl font-extrabold text-slate-100 tracking-tight mb-8 leading-[1.1] font-serif">
          Write your next novel <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            without the clutter.
          </span>
        </h1>
        
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mb-12 leading-relaxed">
          Novelist Workspace is a distraction-free writing environment built for serious storytellers. From drafting chapters in Zen Mode to outlining plot points on a visual Kanban board, everything you need is in one beautiful place.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-md">
          <button 
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
          >
            <PenTool className="w-5 h-5" />
            Start Writing Now
          </button>
          
          <button 
            onClick={loginAsGuest}
            className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 shadow-xl shadow-slate-900/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
          >
            Explore as Guest
          </button>
        </div>

        {/* Feature Grid */}
        <div className="mt-32 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
          <FeatureCard 
            icon={<Columns className="w-6 h-6 text-indigo-400" />}
            title="Distraction-Free Editor"
            description="Toggle Zen Mode to hide the interface and focus entirely on your prose. The editor supports rich formatting and auto-saves your progress."
          />
          <FeatureCard 
            icon={<LayoutTemplate className="w-6 h-6 text-purple-400" />}
            title="Visual Storyboarding"
            description="Plan your chapters with an intuitive Kanban board. Drag and drop scenes, track statuses, and organize your plot effortlessly."
          />
          <FeatureCard 
            icon={<BookOpen className="w-6 h-6 text-emerald-400" />}
            title="World Planner Wiki"
            description="Build a comprehensive encyclopedia for your universe. Keep track of characters, items, locations, and lore all in one searchable database."
          />
          <FeatureCard 
            icon={<Target className="w-6 h-6 text-rose-400" />}
            title="Goal Tracking"
            description="Set daily word count goals and watch your progress ring fill up as you write. Stay motivated and track your writing habits."
          />
          <FeatureCard 
            icon={<Sparkles className="w-6 h-6 text-amber-400" />}
            title="Rich Exporting"
            description="Export your entire manuscript into a clean, formatted HTML document when you are ready to publish or share with beta readers."
          />
          <FeatureCard 
            icon={<div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">N</div>}
            title="Cross-Platform"
            description="Whether you are on Windows, Android, or using the Web App, your novels are securely synced and accessible everywhere."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-12 mt-20 text-center">
        <p className="text-slate-500 text-sm">
          © {new Date().getFullYear()} Novelist Workspace. Crafted for writers, by writers.
        </p>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors group">
    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-lg font-bold text-slate-200 mb-3">{title}</h3>
    <p className="text-sm text-slate-400 leading-relaxed">
      {description}
    </p>
  </div>
);
