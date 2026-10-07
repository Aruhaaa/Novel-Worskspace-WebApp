import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Plus } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { PageHead } from '../ui/PageHead';
import { localDate } from '../../lib/dates';
import { countWords } from '../../lib/text';
import { planGoal } from '../../lib/projectGoal';
import { useToast } from '../ui/toastContext';

export const TrackerView: React.FC = () => {
  const { wordCountLogs, logWordCount, profile, chapters, projectGoal, setProjectGoal } = useApp();
  const { toast } = useToast();
  const [showGoal, setShowGoal] = useState(false);
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [showLogInput, setShowLogInput] = useState(false);
  const [logCount, setLogCount] = useState('');
  const [logDate, setLogDate] = useState(() => localDate());
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
      const today = localDate();
      const yesterday = localDate(new Date(Date.now() - 24 * 3600 * 1000));

      // Check if wrote today or yesterday to continue streak
      const latestDate = sortedLogs[0].date;
      if (latestDate !== today && latestDate !== yesterday) {
        setStreak(0);
        return;
      }

      const expectedDate = new Date(latestDate + 'T00:00:00');
      for (let i = 0; i < sortedLogs.length; i++) {
        const log = sortedLogs[i];
        const logDateStr = log.date;
        const expectedStr = localDate(expectedDate);

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

  const dailyGoal = profile?.daily_word_goal || 1000;
  
  // Find today's log for the circular progress
  const todayStr = localDate();
  const todayLog = wordCountLogs.find(l => l.date === todayStr);
  const todaysWordCount = todayLog ? todayLog.word_count : 0;
  
  const progressPercent = Math.min(100, Math.round((todaysWordCount / dailyGoal) * 100));

  const manuscriptWords = chapters.reduce((sum, ch) => sum + countWords(ch.content), 0);
  const plan = projectGoal ? planGoal(projectGoal, manuscriptWords) : null;

  const openGoal = () => {
    setGoalTarget(projectGoal ? String(projectGoal.target) : '');
    setGoalDeadline(projectGoal?.deadline || '');
    setShowGoal(true);
  };

  const recentLogs = [...wordCountLogs].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="studio-view">
      <div className="page page-wide">
        <PageHead
          eyebrow="A PRACTICE, NOT A PERFORMANCE"
          title={
            <>
              Your writing, <em>over time.</em>
            </>
          }
          lead="Real totals from your daily log. A few good words count, too."
          actions={
            <button className="small-btn is-primary" onClick={() => setShowLogInput(true)}>
              <Plus /> Log word count
            </button>
          }
        />

        <div className="grid-4">
          <div className="stat">
            <span className="eyebrow">TOTAL WRITTEN</span>
            <strong>{totalWords.toLocaleString()}</strong>
            <span>words accumulated</span>
          </div>
          <div className="stat">
            <span className="eyebrow">WRITING STREAK</span>
            <strong>{streak}</strong>
            <span>{streak === 1 ? 'day in a row' : 'days in a row'}</span>
          </div>
          <div className="stat">
            <span className="eyebrow">DAILY AVERAGE</span>
            <strong>{dailyAverage.toLocaleString()}</strong>
            <span>words per day</span>
          </div>
          <div className="stat" style={{ textAlign: 'center' }}>
            <span className="eyebrow">TODAY'S GOAL</span>
            <div className="goal-ring" style={{ ['--pct' as string]: progressPercent, width: 96, height: 96, margin: '10px auto 4px' } as React.CSSProperties}>
              <div style={{ width: 76, height: 76 }}>
                <strong style={{ fontSize: 26, margin: 0 }}>{progressPercent}%</strong>
              </div>
            </div>
            <span>
              {todaysWordCount.toLocaleString()} / {dailyGoal.toLocaleString()} words
            </span>
          </div>
        </div>

        <section className="card" aria-labelledby="goal-h" style={{ marginTop: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <h3 id="goal-h">Manuscript goal</h3>
              <p style={{ margin: '6px 0 0' }}>
                {plan
                  ? `${manuscriptWords.toLocaleString()} of ${plan.target.toLocaleString()} words (${plan.percent}%)`
                  : 'Set a length for this book and a date to finish it. We will work out the pace.'}
              </p>
            </div>
            <button className="small-btn" onClick={openGoal}>{projectGoal ? 'Change goal' : 'Set a goal'}</button>
          </div>
          {plan && projectGoal && (
            <>
              <progress max={plan.target} value={Math.min(plan.written, plan.target)} aria-label="Progress toward the manuscript goal" style={{ width: '100%', marginTop: 14 }} />
              <p className="meta" style={{ marginTop: 10 }} role="status">
                {plan.state === 'reached' && 'You have reached your target length.'}
                {plan.state === 'no-deadline' && `${plan.remaining.toLocaleString()} words to go. Add a finish date to see a daily pace.`}
                {plan.state === 'on-track' &&
                  `${plan.remaining.toLocaleString()} words to go by ${new Date(projectGoal.deadline + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}: about ${plan.perDay?.toLocaleString()} words a day for ${plan.daysLeft} ${plan.daysLeft === 1 ? 'day' : 'days'}.`}
                {plan.state === 'overdue' && `${plan.remaining.toLocaleString()} words to go, and the finish date has passed. Pick a new one when you are ready.`}
              </p>
            </>
          )}
        </section>

        <div className="split" style={{ marginTop: 30 }}>
          <section className="card" aria-labelledby="trend-h">
            <h3 id="trend-h">Daily word count trend</h3>
            <p style={{ margin: '6px 0 14px' }}>Words logged each day</p>
            {chartData.length === 0 ? (
              <p className="meta">No log entries yet. Log some word counts to see your trend.</p>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWord" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="formattedDate" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--sheet)', borderColor: 'var(--line)', borderRadius: 3, fontSize: 12, color: 'var(--ink)' }}
                      labelStyle={{ fontWeight: 'bold', color: 'var(--ink)' }}
                    />
                    <Area type="monotone" dataKey="word_count" stroke="var(--accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorWord)" name="Words written" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="hist-h">
            <h3 id="hist-h">Log history</h3>
            {recentLogs.length === 0 ? (
              <p className="meta" style={{ marginTop: 14 }}>No log history yet.</p>
            ) : (
              <table className="log-table" style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>WORDS</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.slice(0, 14).map((log) => (
                    <tr key={log.id || log.date}>
                      <td>{new Date(log.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td>{log.word_count.toLocaleString()} words</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>

      <Dialog open={showGoal} onClose={() => setShowGoal(false)} labelledBy="gl-h">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const target = parseInt(goalTarget, 10);
            const previous = projectGoal;
            setProjectGoal(target > 0 ? { target, deadline: goalDeadline || null } : null);
            setShowGoal(false);
            toast({ message: target > 0 ? 'Goal saved.' : 'Goal cleared.', actionLabel: 'Undo', onAction: () => setProjectGoal(previous) });
          }}
        >
          <p className="eyebrow">THE WHOLE BOOK</p>
          <h2 id="gl-h">Manuscript goal</h2>
          <label htmlFor="gl-target">Target length (words)</label>
          <input id="gl-target" type="number" min="1" step="1" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="80000" autoFocus />
          <label htmlFor="gl-date">Finish by (optional)</label>
          <input id="gl-date" type="date" min={localDate()} value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} />
          <p className="meta" style={{ marginTop: 10 }}>Saved on this device for this project. Leave the length empty to clear the goal.</p>
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowGoal(false)}>Cancel</button>
            <button className="button button-primary button-small">Save goal</button>
          </div>
        </form>
      </Dialog>

      <Dialog open={showLogInput} onClose={() => setShowLogInput(false)} labelledBy="lg-h">
        <form onSubmit={handleLogCount}>
          <p className="eyebrow">LOG</p>
          <h2 id="lg-h">Log your progress</h2>
          <label htmlFor="log-date">Date</label>
          <input id="log-date" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
          <label htmlFor="log-words">Total words logged</label>
          <input id="log-words" type="number" min="0" value={logCount} onChange={(e) => setLogCount(e.target.value)} placeholder="1500" required autoFocus />
          <div className="dialog-actions">
            <button type="button" className="button button-outline button-small" onClick={() => setShowLogInput(false)}>Cancel</button>
            <button className="button button-primary button-small">Save log</button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
