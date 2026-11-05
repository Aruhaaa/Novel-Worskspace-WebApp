import React, { useEffect, useState } from 'react';
import type { Project } from '../../services/types';
import { useApp } from '../../context/AppContext';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/toastContext';
import {
  CollabSetupError,
  MEMBER_ROLES,
  createInvite,
  inviteIsOpen,
  inviteLink,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
  setMemberRole,
  type Invite,
  type Member,
  type MemberRole,
} from '../../lib/collab';
import { ROLE_LABEL } from '../../lib/notifications';
import { t, useT } from '../../i18n';

const ROLE_HINT: Record<MemberRole, () => string> = {
  coauthor: () => t('Writes and arranges everything: chapters, outline and notebook.'),
  editor: () => t('Writes in the chapters. Cannot add, remove or reorder them.'),
  viewer: () => t('Reads, and sees changes as they are made.'),
};

const Body: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
  const t = useT();
  const { user, refreshShared } = useApp();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [setup, setSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<MemberRole>('editor');
  const [uses, setUses] = useState(1);
  const [days, setDays] = useState(7);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const [m, i] = await Promise.all([listMembers(project.id), listInvites(project.id)]);
      setMembers(m);
      setInvites(i);
      setSetup(false);
      setError(null);
    } catch (e) {
      if (e instanceof CollabSetupError) setSetup(true);
      else setError(e instanceof Error ? e.message : t('That did not work. Please try again.'));
      setMembers((prev) => prev ?? []);
      setInvites((prev) => prev ?? []);
    }
  };

  useEffect(() => {
    // Loaded after the first paint, so the dialog opens at once
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const attempt = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      await refresh();
      await refreshShared();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('That did not work. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      toast({ message: t('Link copied.') });
    } catch {
      window.prompt(t('Copy this link:'), inviteLink(token));
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    void attempt(async () => {
      const invite = await createInvite(project.id, user.id, role, { days, maxUses: uses, label });
      setLabel('');
      await copy(invite.token);
    });
  };

  const open = (invites ?? []).filter((i) => inviteIsOpen(i));

  return (
    <div className="share-dialog-body">
      <p className="eyebrow">{t('WRITE TOGETHER')}</p>
      <h2 id="sp-h">{t('Share “{title}”', { title: project.title })}</h2>

      {setup && (
        <p className="mock-note" role="alert">
          {t('Sharing needs a one-time database setup. Open supabase/setup_scripts/20261105_next_features.sql from the project, paste it into your Supabase project’s SQL Editor and press Run. Then reopen this window.')}
        </p>
      )}
      {error && <p className="mock-note" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}

      {!setup && (
        <>
          <p className="meta">
            {t('Invite someone to write in this project with you. They need an account. They join from a link you send them; nobody gets in without one.')}
          </p>
          <dl className="role-legend">
            {MEMBER_ROLES.map((r) => (
              <React.Fragment key={r}>
                <dt>{ROLE_LABEL[r]()}</dt>
                <dd>{t(ROLE_HINT[r]())}</dd>
              </React.Fragment>
            ))}
          </dl>

          <form className="invite-form" onSubmit={create}>
            <label>
              <span>{t('They can')}</span>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
                {MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]()}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('Link works for')}</span>
              <select className="select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[1, 7, 30].map((d) => (
                  <option key={d} value={d}>{d === 1 ? t('1 day') : t('{n} days', { n: d })}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('People it admits')}</span>
              <select className="select" value={uses} onChange={(e) => setUses(Number(e.target.value))}>
                {[1, 2, 5, 10, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="invite-label">
              <span>{t('Who is it for (optional)')}</span>
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder={t('e.g. Sam, my editor')} />
            </label>
            <button className="small-btn is-primary" disabled={busy}>{busy ? t('One moment…') : t('Make an invitation link')}</button>
          </form>

          <h3 className="feedback-chapter">{t('Invitation links')}</h3>
          {invites === null && <p className="meta" role="status">{t('Loading…')}</p>}
          {invites !== null && open.length === 0 && <p className="meta">{t('No open invitations.')}</p>}
          {open.map((invite) => (
            <div className="share-row" key={invite.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{invite.label || t('Untitled invitation')}</strong>
                <small>
                  {t('as {role}', { role: ROLE_LABEL[invite.role]() })} · {t('{used} of {max} used', { used: invite.uses, max: invite.max_uses })} · {t('until {date}', { date: new Date(invite.expires_at).toLocaleDateString() })}
                </small>
              </div>
              <button className="small-btn" onClick={() => void copy(invite.token)}>{t('Copy link')}</button>
              <button className="small-btn is-danger" disabled={busy} onClick={() => void attempt(() => revokeInvite(invite.id))}>{t('Switch off')}</button>
            </div>
          ))}

          <h3 className="feedback-chapter">{t('People on this project')}</h3>
          {members === null && <p className="meta" role="status">{t('Loading…')}</p>}
          {members !== null && members.length === 0 && <p className="meta">{t('Nobody yet. It is just you.')}</p>}
          {(members ?? []).map((member) => (
            <div className="share-row" key={member.user_id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{member.name}</strong>
                <small>{t('joined {date}', { date: new Date(member.created_at).toLocaleDateString() })}</small>
              </div>
              <label className="sr-only" htmlFor={`role-${member.user_id}`}>{t('Role of {name}', { name: member.name })}</label>
              <select
                id={`role-${member.user_id}`}
                className="select"
                value={member.role}
                disabled={busy}
                onChange={(e) => void attempt(() => setMemberRole(project.id, member.user_id, e.target.value as MemberRole))}
              >
                {MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]()}</option>
                ))}
              </select>
              <button
                className="small-btn is-danger"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t('Remove {name} from this project? They keep nothing they could not already read, and you can invite them again.', { name: member.name }))) {
                    void attempt(() => removeMember(project.id, member.user_id));
                  }
                }}
              >
                {t('Remove')}
              </button>
            </div>
          ))}

          <p className="meta" style={{ marginTop: 14 }}>
            {t('When two or more people have a chapter open, they write in it together and see each other’s changes as they type.')}
          </p>
        </>
      )}

      <div className="dialog-actions">
        <button type="button" className="button button-outline button-small" onClick={onClose}>{t('Done')}</button>
      </div>
    </div>
  );
};

/** Invite co-authors, editors and viewers to a project, see who is on it, and change or end their access. */
export const ShareProjectDialog: React.FC<{ project: Project | null; onClose: () => void }> = ({ project, onClose }) => (
  <Dialog open={!!project} onClose={onClose} labelledBy="sp-h" className="share-dialog">
    {project && <Body project={project} onClose={onClose} />}
  </Dialog>
);
