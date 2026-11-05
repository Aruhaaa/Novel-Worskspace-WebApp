import React, { useCallback, useEffect, useState } from 'react';
import { clearErrors, listErrorGroups, type ErrorGroup } from '../../lib/errorReporter';
import { timeAgo } from '../../lib/relativeTime';

/** What has gone wrong on people's screens, newest first, grouped so one bug is one line. */
export const ErrorsPanel: React.FC = () => {
  const [groups, setGroups] = useState<ErrorGroup[] | null>(null);
  const [source, setSource] = useState<'cloud' | 'local' | 'setup'>('local');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listErrorGroups();
    setGroups(result.groups);
    setSource(result.source);
    setError(result.error);
  }, []);

  useEffect(() => {
    // Loaded after the first paint, so the page does not wait on it
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const clear = async (fingerprint?: string) => {
    await clearErrors(fingerprint);
    await load();
  };

  return (
    <section className="card" aria-labelledby="err-h">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h3 id="err-h">Errors</h3>
        <span style={{ display: 'flex', gap: 8 }}>
          <button className="small-btn" onClick={() => void load()}>Refresh</button>
          <button className="small-btn" onClick={() => void clear()} disabled={!groups || groups.length === 0}>Clear all</button>
        </span>
      </div>
      <p className="meta" style={{ marginTop: 8 }}>
        {source === 'cloud' && 'What went wrong on people’s screens in the last 14 days, from the website, the desktop app and the phone app. No writing and no names are sent.'}
        {source === 'local' && 'This device only: with no cloud database, errors are kept here. No writing and no names are sent anywhere.'}
        {source === 'setup' && 'The error log is not switched on yet. Run supabase/setup_scripts/20261105_next_features.sql in the Supabase SQL Editor.'}
      </p>
      {error && <p className="mock-note" role="alert" style={{ marginTop: 10 }}>{error}</p>}
      {groups === null ? (
        <p className="meta" style={{ marginTop: 12 }} role="status">Loading…</p>
      ) : groups.length === 0 ? (
        source !== 'setup' && <p className="meta" style={{ marginTop: 12 }}>Nothing has gone wrong. That is good news.</p>
      ) : (
        <div style={{ marginTop: 12 }}>
          {groups.map((g) => (
            <details key={g.fingerprint} className="error-row">
              <summary>
                <span className="error-count" title="How many times">{g.occurrences}×</span>
                <span className="error-message">{g.message}</span>
                <small>
                  {g.source} · {g.app_version || 'unknown build'} · {timeAgo(g.last_seen)}
                </small>
              </summary>
              <div className="error-detail">
                <p>
                  First seen {new Date(g.first_seen).toLocaleString()}, last seen {new Date(g.last_seen).toLocaleString()}. Open at: <code>{g.sample_url || 'unknown'}</code>
                </p>
                {g.sample_stack && <pre>{g.sample_stack}</pre>}
                <button className="small-btn" onClick={() => void clear(g.fingerprint)}>Clear this one</button>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
};
