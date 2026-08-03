import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { 
  Flame, 
  TrendingUp, 
  Award, 
  Plus, 
  Calendar, 
  CheckCircle
} from 'lucide-react';

export const TrackerView: React.FC = () => {
  const { wordCountLogs, logWordCount } = useApp();
  const [showLogInput, setShowLogInput] = useState(false);
  const [logCount, setLogCount] = useState('');
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [streak, setStreak] = useState(0);

  // Simple streak calculation (non-zero word logs in continuous days) in an effect to preserve render purity
  useEffect(() => {
    const timer = setTimeout(() => {
      if (wordCountLogs.length === 0) {
        setStreak(0);
        return;
      }
      
      // Sort logs descending by date
      const sortedLogs = [...wordCountLogs].sort((a, b) => b.date.localeCompare(a.date));
      let calculatedStreak = 0;
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0];

      // Check if wrote today or yesterday to continue streak
      const latestDate = sortedLogs[0].date;
      if (latestDate !== today && latestDate !== yesterday) {
        setStreak(0);
        return;
      }

      const expectedDate = new Date(latestDate);
      for (let i = 0; i < sortedLogs.length; i++) {
        const log = sortedLogs[i];
        const logDateStr = log.date;
        const expectedStr = expectedDate.toISOString().split('T')[0];

        if (logDateStr === expectedStr && log.word_count > 0) {
          calculatedStreak++;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }
      setStreak(calculatedStreak);
    }, 0);
    return () => clearTimeout(timer);
  }, [wordCountLogs]);

  const handleLogCount = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(logCount);
    if (isNaN(count) || count < 0) return;

    await logWordCount(count, logDate);
    setLogCount('');
    setShowLogInput(false);
  };

  // Process data for charts
  const chartData = wordCountLogs.map(log => ({
    ...log,
    // Format date string for displaying in the chart axis (e.g. "May 22")
    formattedDate: new Date(log.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }));

  // Calculations
  const totalWords = wordCountLogs.reduce((acc, log) => acc + log.word_count, 0);
  const dailyAverage = wordCountLogs.length > 0 
    ? Math.round(totalWords / wordCountLogs.length) 
    : 0;

  const dailyGoal = 1000; // Mock daily goal
  const progressPercent = Math.min(100, Math.round(((wordCountLogs[wordCountLogs.length - 1]?.word_count || 0) / dailyGoal) * 100));

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-900 overflow-hidden text-slate-300">
      
      {/* Tracker Header */}
      <header className="h-16 border-b border-slate-800/80 px-8 flex items-center justify-between shrink-0 bg-slate-900/50 backdrop-blur-md">
        <h2 className="text-lg font-semibold text-slate-100">Writing Progress & Tracker</h2>
        
        <button
          onClick={() => setShowLogInput(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-3.5 py-2 rounded-lg shadow-lg shadow-indigo-600/15 transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Log Word Count
        </button>
      </header>

      {/* Tracker Body */}
      <main className="flex-1 overflow-y-auto px-8 py-8 space-y-6">
        
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Words */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 flex items-center gap-4 hover:border-slate-800 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/15 text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 block">Total Written</span>
              <strong className="text-slate-100 text-xl font-bold">{totalWords.toLocaleString()}</strong>
              <span className="text-[10px] text-slate-500 block mt-0.5">words accumulated</span>
            </div>
          </div>

          {/* Card 2: Streak */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 flex items-center gap-4 hover:border-slate-800 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-orange-600/15 text-orange-400 flex items-center justify-center">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 block">Writing Streak</span>
              <strong className="text-slate-100 text-xl font-bold">{streak} {streak === 1 ? 'day' : 'days'}</strong>
              <span className="text-[10px] text-slate-500 block mt-0.5">active write streak</span>
            </div>
          </div>

          {/* Card 3: Daily Average */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 flex items-center gap-4 hover:border-slate-800 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-emerald-600/15 text-emerald-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 block">Daily Average</span>
              <strong className="text-slate-100 text-xl font-bold">{dailyAverage.toLocaleString()}</strong>
              <span className="text-[10px] text-slate-500 block mt-0.5">words per day</span>
            </div>
          </div>

          {/* Card 4: Daily Goal */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 flex items-center gap-4 hover:border-slate-800 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-rose-600/15 text-rose-400 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 block">Today's Goal ({progressPercent}%)</span>
              <strong className="text-slate-100 text-xl font-bold">{wordCountLogs[wordCountLogs.length - 1]?.word_count || 0} / {dailyGoal}</strong>
              {/* Progress bar */}
              <div className="w-full bg-slate-900 rounded-full h-1.5 mt-1.5 overflow-hidden border border-slate-800/40">
                <div className="bg-rose-500 h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts & Details Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main word count chart */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-5">Daily Word Count Trend</h3>
            <div className="h-72 w-full">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No log entries. Please log some word counts.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWord" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b/40" />
                    <XAxis dataKey="formattedDate" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#f3f4f6' }}
                      labelStyle={{ fontWeight: 'bold', color: '#818cf8' }}
                    />
                    <Area type="monotone" dataKey="word_count" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorWord)" name="Words Written" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Daily Logs Table */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 flex flex-col overflow-hidden h-[345px]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Log History</h3>
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {[...wordCountLogs].sort((a, b) => b.date.localeCompare(a.date)).map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 transition-all duration-150 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-semibold text-slate-200">
                      {new Date(log.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <strong className="text-indigo-400 font-semibold">{log.word_count.toLocaleString()} words</strong>
                </div>
              ))}
              {wordCountLogs.length === 0 && (
                <div className="text-xs text-slate-500 text-center py-10 italic">
                  No log history available.
                </div>
              )}
            </div>
          </div>
        </div>

      </main>

      {/* Log Word Count Dialog */}
      {showLogInput && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm p-6 shadow-2xl animate-in scale-in duration-200">
            <h3 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Log Daily Writing Progress
            </h3>
            <form onSubmit={handleLogCount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Total Words Logged</label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  value={logCount}
                  onChange={(e) => setLogCount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogInput(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 transition-colors"
                >
                  Submit Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
