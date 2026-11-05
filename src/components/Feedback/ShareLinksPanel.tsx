import React, { useCallback, useEffect, useState } from 'react';
import type { Project } from '../../services/types';
import { cloud } from '../../lib/cloud';
import { createShareLink, linkUrl, listShareLinks, revokeShareLink, type ShareLink } from '../../lib/share';
import { useToast } from '../ui/toastContext';
import { fmtDate, useT } from '../../i18n';

type State = { kind: 'loading' } | { kind: 'ready'; links: ShareLink[] } | { kind: 'setup' } | { kind: 'offline' } | { kind: 'none' };

/** Create, copy and turn off private reading links for a project. */
export const ShareLinksPanel: React.FC<{ project: Project }> = ({ project }) => {
  const t = useT();
  const { toast } = useToast();
  const [state, setState] = useState<State>(() => (cloud() ? { kind: 'loading' } : { kind: 'none' }));
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await listShareLinks(project.id);
    if (res.ok) setState({ kind: 'ready', links: res.value });
    else setState({ kind: res.reason === 'setup' ? 'setup' : res.reason === 'none' ? 'none' : 'offline' });
  }, [project.id]);

  useEffect(() => {
    if (cloud()) {
      let alive = true;
      listShareLinks(project.id).then((res) => {
        if (!alive) return;
        if (res.ok) setState({ kind: 'ready', links: res.value });
        else setState({ kind: res.reason === 'setup' ? 'setup' : res.reason === 'none' ? 'none' : 'offline' });
      });
      return () => {
        alive = false;
      };
    }
  }, [project.id]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await createShareLink(project.id, label);
    setBusy(false);
    if (!res.ok) {
      toast({ message: res.reason === 'network' ? t('Could not reach the server. Try again when you are online.') : t('Could not make the link.') });
      return;
    }
    setLabel('');
    await refresh();
    try {
      await navigator.clipboard.writeText(linkUrl(res.value.token));
      toast({ message: t('Link made and copied. Send it to your reader.') });
    } catch {
      toast({ message: t('Link made. Use Copy link to send it.') });
    }
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkUrl(token));
      toast({ message: t('Link copied.') });
    } catch {
      window.prompt(t('Copy this link:'), linkUrl(token));
    }
  };

  const revoke = async (link: ShareLink) => {
    if (!window.confirm(link.label ? t('Turn off the link for {label}? Anyone using it will lose access. Their comments stay.', { label: link.label }) : t('Turn off the link? Anyone using it will lose access. Their comments stay.'))) return;
    const res = await revokeShareLink(link.id);
    if (res.ok) {
      toast({ message: t('Link turned off.') });
      await refresh();
    } else {
      toast({ message: t('Could not turn the link off. Try again.') });
    }
  };

  return (
    <section className="share-panel" aria-labelledby="share-h">
      <h3 id="share-h" className="feedback-chapter" style={{ marginTop: 0 }}>{t('Private reading links')}</h3>
      {state.kind === 'loading' && <p className="meta">{t('Checking…')}</p>}
      {state.kind === 'none' && (
        <p className="meta">{t('Reading links need the cloud database. This copy of the app is running on this device only, so use the Beta-reader copy file below instead.')}</p>
      )}
      {state.kind === 'offline' && <p className="meta">{t('Could not reach the server. Check your connection.')}</p>}
      {state.kind === 'setup' && (
        <p className="mock-note">
          {t('Reading links need a one-time database setup. Open')} <strong>supabase/setup_scripts/20261003_cloud_sync.sql</strong> {t("from the project, paste it into your Supabase project's SQL Editor and press Run. Then reopen this window.")}
        </p>
      )}
      {state.kind === 'ready' && (
        <>
          <p className="meta">
            {t('Send a reader a link. They read the manuscript in their browser and comment, with no account. You see their comments here as they arrive. Anyone who has the link can read it, so share it only with people you trust.')}
          </p>
          <form onSubmit={create} style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
            <label className="sr-only" htmlFor="share-label">{t('Who is it for')}</label>
            <input id="share-label" className="input" style={{ flex: 1, minWidth: 180 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('Who is it for? (e.g. Sam)')} maxLength={80} />
            <button className="small-btn is-primary" disabled={busy}>{busy ? t('Making…') : t('Make a link')}</button>
          </form>
          {state.links.length === 0 && <p className="meta">{t('No links yet.')}</p>}
          {state.links.map((link) => (
            <div className="share-row" key={link.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{link.label || t('Untitled link')}</strong>
                <small>
                  {link.revokedAt ? t('Turned off') : t('Active')} · {t('made {date}', { date: fmtDate(link.createdAt) })}
                </small>
              </div>
              {!link.revokedAt && (
                <>
                  <button className="small-btn" onClick={() => copy(link.token)}>{t('Copy link')}</button>
                  <button className="small-btn is-danger" onClick={() => revoke(link)}>{t('Turn off')}</button>
                </>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  );
};
