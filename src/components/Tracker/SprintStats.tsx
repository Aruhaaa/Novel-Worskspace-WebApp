import React from 'react';
import { useApp } from '../../context/AppContext';
import { localDate } from '../../lib/dates';
import { formatSpan, summarise, useSprintHistory } from '../../lib/sprint';
import '../Editor/sprint.css';

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const shortTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Sprints on the tracker page. Read only: the words themselves are already in the daily log. */
export const SprintStats: React.FC = () => {
  const { activeProject } = useApp();
  const history = useSprintHistory(activeProject?.id);
  const { thisWeek, best, averageWpm, last } = summarise(history, new Date().getTime(), localDate);

  return (
    <section className="card" aria-labelledby="sprint-h" style={{ marginTop: 30 }}>
      <h3 id="sprint-h">Writing sprints</h3>
      <p style={{ margin: '6px 0 14px' }}>Timed bursts from the editor, for this novel. Their words are already part of your daily count.</p>
      {history.length === 0 ? (
        <p className="meta">
          No sprints yet. Open a chapter, choose Sprint in the toolbar, pick a length and write until the time is up.
        </p>
      ) : (
        <>
          <div className="sprint-figures">
            <div className="sprint-figure">
              <span className="eyebrow">SPRINTS</span>
              <strong>{thisWeek.count.toLocaleString()}</strong>
              <span className="meta">this week</span>
            </div>
            <div className="sprint-figure">
              <span className="eyebrow">MINUTES SPRINTED</span>
              <strong>{thisWeek.minutes.toLocaleString()}</strong>
              <span className="meta">this week</span>
            </div>
            <div className="sprint-figure">
              <span className="eyebrow">WORDS IN SPRINTS</span>
              <strong>{thisWeek.words.toLocaleString()}</strong>
              <span className="meta">this week</span>
            </div>
            <div className="sprint-figure">
              <span className="eyebrow">AVERAGE PACE</span>
              <strong>{averageWpm > 0 ? averageWpm.toLocaleString() : '–'}</strong>
              <span className="meta">words a minute, all sprints</span>
            </div>
            <div className="sprint-figure">
              <span className="eyebrow">BEST SPRINT</span>
              <strong>{best ? best.words.toLocaleString() : '–'}</strong>
              <span className="meta">{best ? `words, ${shortDate(best.startedAt)}, ${formatSpan(best.activeMs)}` : 'words in one sprint'}</span>
            </div>
          </div>

          <table className="log-table">
            <caption className="sr-only">The last five sprints</caption>
            <thead>
              <tr>
                <th>DATE</th>
                <th>TIME</th>
                <th>WORDS</th>
                <th>PER MIN</th>
              </tr>
            </thead>
            <tbody>
              {last.map((r) => (
                <tr key={r.id}>
                  <td>
                    {shortDate(r.startedAt)}
                    <span className="sprint-tag">{shortTime(r.startedAt)}</span>
                  </td>
                  <td>
                    {formatSpan(r.activeMs)}
                    {!r.completed && <span className="sprint-tag">ended early</span>}
                  </td>
                  <td>
                    {r.words.toLocaleString()}
                    {r.goalWords !== null && (
                      <span className="sprint-tag">
                        goal {r.goalWords.toLocaleString()}
                        {r.words >= r.goalWords ? ', reached' : ''}
                      </span>
                    )}
                  </td>
                  <td>{r.wpm > 0 ? r.wpm.toLocaleString() : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
};
