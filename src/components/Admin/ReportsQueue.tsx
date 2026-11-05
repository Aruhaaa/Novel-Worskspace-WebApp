import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listReports, resolveReport, REPORT_REASONS } from '../../lib/safety';
import { timeAgo } from '../../lib/relativeTime';
import type { Report, ReportTarget } from '../../services/types';

const REMOVE_LABEL: Record<ReportTarget, string | null> = {
  novel: 'Unpublish novel',
  comment: 'Remove comment',
  review: 'Remove review',
  message: 'Delete message',
  author: null,
};

const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

/** What people have reported, newest first. The admin dismisses a report or removes what it points at. */
export const ReportsQueue: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listReports();
    setReports(res.reports);
    setSetupNeeded(res.setupNeeded);
    setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Loaded after the first paint, so the page does not wait on it
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const act = async (report: Report, action: 'remove' | 'dismiss') => {
    if (action === 'remove' && !window.confirm(`${REMOVE_LABEL[report.target_type]}? This cannot be undone.`)) return;
    setBusy(report.id);
    const { error: actError } = await resolveReport(report, action);
    setBusy(null);
    if (actError) setError(actError);
    else await load();
  };

  const open = reports.filter((r) => r.status === 'open');
  const closed = reports.filter((r) => r.status !== 'open');
  const shown = showClosed ? closed : open;

  return (
    <section className="card" aria-labelledby="rq-h">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 id="rq-h">Reports {open.length > 0 && <span className="badge is-accent">{open.length} open</span>}</h3>
        <span style={{ display: 'flex', gap: 8 }}>
          <button className="small-btn" aria-pressed={!showClosed} onClick={() => setShowClosed(false)}>Open</button>
          <button className="small-btn" aria-pressed={showClosed} onClick={() => setShowClosed(true)}>Closed ({closed.length})</button>
        </span>
      </div>

      {loading ? (
        <p className="meta" style={{ marginTop: 12 }}>Loading reports…</p>
      ) : setupNeeded ? (
        <p className="meta" style={{ marginTop: 12 }}>
          Reports are not switched on yet. Run <code>supabase/setup_scripts/20261008_account_safety.sql</code> in the Supabase SQL Editor and reload.
        </p>
      ) : error ? (
        <p className="mock-note" role="alert" style={{ marginTop: 12, color: 'var(--danger)' }}>{error}</p>
      ) : shown.length === 0 ? (
        <p className="meta" style={{ marginTop: 12 }}>{showClosed ? 'Nothing closed yet.' : 'No open reports. All clear.'}</p>
      ) : (
        shown.map((r) => (
          <article key={r.id} style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 14 }}>
            <p className="meta" style={{ margin: 0 }}>
              <span className="badge">{r.target_type}</span> <span className="badge is-accent">{reasonLabel(r.reason)}</span> · {timeAgo(r.created_at)}
              {r.status !== 'open' && <> · {r.status}</>}
            </p>
            {r.excerpt && <blockquote style={{ margin: '10px 0', paddingLeft: 12, borderLeft: '2px solid var(--line)' }}>{r.excerpt}</blockquote>}
            {r.details && <p style={{ margin: '6px 0' }}><strong>Reporter says:</strong> {r.details}</p>}
            <p className="meta" style={{ margin: '6px 0' }}>
              {r.target_user_id && <Link className="link-accent" to={`/library/author/${r.target_user_id}`}>View the author</Link>}
              {r.target_type === 'novel' && <> · <Link className="link-accent" to={`/library/novel/${r.target_id}`}>Open the novel</Link></>}
            </p>
            {r.status === 'open' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {REMOVE_LABEL[r.target_type] && (
                  <button className="small-btn is-danger" disabled={busy === r.id} onClick={() => act(r, 'remove')}>{REMOVE_LABEL[r.target_type]}</button>
                )}
                <button className="small-btn" disabled={busy === r.id} onClick={() => act(r, 'dismiss')}>Dismiss</button>
              </div>
            )}
          </article>
        ))
      )}
    </section>
  );
};
