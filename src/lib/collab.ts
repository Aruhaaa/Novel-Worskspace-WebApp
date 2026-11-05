import type { SupabaseClient } from '@supabase/supabase-js';
import { tryCloud, unwrap } from './cloud';
import { pushLocalNotification } from './notifications';
import { appBaseUrl } from './share';
import { databaseService } from '../services/database';
import type { Project } from '../services/types';

/**
 * Writing with other people. A project has one owner and any number of members, each a co-author, an editor or a viewer.
 *
 *   owner      everything, including sharing, publishing and deleting the project
 *   co-author  everything in the manuscript: write, add, remove and reorder chapters, outline and notebook
 *   editor     write in the chapters, and comment; cannot change the structure
 *   viewer     read only
 *
 * People join by an invitation link. With the cloud database set up (supabase/setup_scripts/20261105_next_features.sql)
 * everything here is stored there. Without it (local mode) it is kept in this browser, so two accounts on one computer
 * can try it out.
 *
 * What the roles are checked by: the screens. The database's own rules for projects and chapters are still open to
 * everyone (see limit.md), so a determined person with the website's public key could ignore a role. The invitations,
 * memberships and live editing channels themselves are protected by the database.
 */
export type MemberRole = 'coauthor' | 'editor' | 'viewer';
export type Role = 'owner' | MemberRole;

export const MEMBER_ROLES: MemberRole[] = ['coauthor', 'editor', 'viewer'];

export const can = {
  /** Write in chapters */
  editText: (role: Role): boolean => role !== 'viewer',
  /** Add, remove and reorder chapters; edit the outline and notebook */
  editStructure: (role: Role): boolean => role === 'owner' || role === 'coauthor',
  /** Share, publish, rename and delete the project */
  manage: (role: Role): boolean => role === 'owner',
};

export interface Member {
  user_id: string;
  role: MemberRole;
  name: string;
  created_at: string;
}

export interface Invite {
  id: string;
  token: string;
  role: MemberRole;
  label: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  max_uses: number;
  uses: number;
}

/** What an invitation is for, shown before anyone joins */
export interface InvitePreview {
  project_id: string;
  title: string;
  role: MemberRole;
  inviter: string;
}

export interface SharedProject extends Project {
  role: MemberRole;
  ownerName: string;
}

/** The cloud database is there, but the setup script has not been run yet */
export class CollabSetupError extends Error {
  constructor() {
    super('Sharing is not switched on for this site yet.');
  }
}

const messageOf = (error: unknown, fallback: string): string => {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message ? message : fallback;
};

/** Run against the cloud database, or against this browser's own copy when there is none. */
const run = async <T>(cloudFn: (client: SupabaseClient) => Promise<T>, localFn: () => T | Promise<T>): Promise<T> => {
  const res = await tryCloud('collab', cloudFn);
  if (res.ok) return res.value;
  if (res.reason === 'none') return localFn();
  if (res.reason === 'setup') throw new CollabSetupError();
  throw new Error(res.reason === 'network' ? 'Could not reach the server. Check your connection and try again.' : messageOf(res.error, 'That did not work. Please try again.'));
};

// ---- This browser's own copy (local mode) ----

interface LocalMember {
  project_id: string;
  user_id: string;
  role: MemberRole;
  added_by: string | null;
  created_at: string;
}
interface LocalInvite extends Invite {
  project_id: string;
  created_by: string;
}

const MEMBERS_KEY = 'novel_project_members';
const INVITES_KEY = 'novel_project_invites';

const read = <T,>(key: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[];
  } catch {
    return [];
  }
};
const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

const randomToken = (): string => `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
const rank = (role: string): number => (role === 'coauthor' ? 3 : role === 'editor' ? 2 : 1);

const nameOf = (id: string, profiles: { id: string; display_name: string }[]): string =>
  profiles.find((p) => p.id === id)?.display_name || id.replace(/^mock-user-/, '').split('@')[0] || 'Someone';

const namesFor = async (ids: string[]): Promise<{ id: string; display_name: string }[]> => {
  try {
    return await databaseService.getProfilesByIds([...new Set(ids)]);
  } catch {
    return [];
  }
};

// ---- Members ----

export const listMembers = (projectId: string): Promise<Member[]> =>
  run(
    async (c) => {
      const rows = unwrap(await c.from('project_members').select('user_id, role, created_at').eq('project_id', projectId).order('created_at')) as Omit<Member, 'name'>[];
      const profiles = await namesFor(rows.map((r) => r.user_id));
      return rows.map((r) => ({ ...r, name: nameOf(r.user_id, profiles) }));
    },
    async () => {
      const rows = read<LocalMember>(MEMBERS_KEY).filter((m) => m.project_id === projectId);
      const profiles = await namesFor(rows.map((r) => r.user_id));
      return rows.map((r) => ({ user_id: r.user_id, role: r.role, created_at: r.created_at, name: nameOf(r.user_id, profiles) }));
    }
  );

/** Which of these projects have other people on them. One question for all of them, so opening the app costs one request. */
export const sharedProjectIds = async (projectIds: string[]): Promise<string[]> => {
  if (projectIds.length === 0) return [];
  try {
    return await run(
      async (c) => [...new Set((unwrap(await c.from('project_members').select('project_id').in('project_id', projectIds)) as { project_id: string }[]).map((r) => r.project_id))],
      () => [...new Set(read<LocalMember>(MEMBERS_KEY).filter((m) => projectIds.includes(m.project_id)).map((m) => m.project_id))]
    );
  } catch {
    // Not knowing is the same as not shared: the project simply behaves as a solo one
    return [];
  }
};

export const setMemberRole = (projectId: string, userId: string, role: MemberRole): Promise<void> =>
  run(
    async (c) => {
      unwrap(await c.from('project_members').update({ role }).eq('project_id', projectId).eq('user_id', userId));
    },
    () => write(MEMBERS_KEY, read<LocalMember>(MEMBERS_KEY).map((m) => (m.project_id === projectId && m.user_id === userId ? { ...m, role } : m)))
  );

/** The owner removes someone, or a member leaves (their own id) */
export const removeMember = (projectId: string, userId: string): Promise<void> =>
  run(
    async (c) => {
      unwrap(await c.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId));
    },
    () => write(MEMBERS_KEY, read<LocalMember>(MEMBERS_KEY).filter((m) => !(m.project_id === projectId && m.user_id === userId)))
  );

/** The projects other people have shared with this person, and what they may do in each */
export const listSharedProjects = async (userId: string): Promise<SharedProject[]> => {
  try {
    const rows = await run(
      async (c) => unwrap(await c.from('project_members').select('project_id, role').eq('user_id', userId)) as { project_id: string; role: MemberRole }[],
      () => read<LocalMember>(MEMBERS_KEY).filter((m) => m.user_id === userId).map((m) => ({ project_id: m.project_id, role: m.role }))
    );
    if (rows.length === 0) return [];
    const projects = await databaseService.getProjectsByIds(rows.map((r) => r.project_id));
    const owners = await namesFor(projects.map((p) => p.user_id));
    return projects.map((p) => ({ ...p, role: rows.find((r) => r.project_id === p.id)?.role ?? 'viewer', ownerName: nameOf(p.user_id, owners) }));
  } catch {
    return [];
  }
};

// ---- Invitations ----

export const inviteLink = (token: string): string => `${appBaseUrl()}#/join/${token}`;

export const inviteIsOpen = (i: Invite, now = Date.now()): boolean => !i.revoked_at && new Date(i.expires_at).getTime() > now && i.uses < i.max_uses;

export const listInvites = (projectId: string): Promise<Invite[]> =>
  run(
    async (c) => unwrap(await c.from('project_invites').select('id, token, role, label, created_at, expires_at, revoked_at, max_uses, uses').eq('project_id', projectId).order('created_at', { ascending: false })) as Invite[],
    () => read<LocalInvite>(INVITES_KEY).filter((i) => i.project_id === projectId).sort((a, b) => b.created_at.localeCompare(a.created_at))
  );

export const createInvite = (projectId: string, userId: string, role: MemberRole, options: { days?: number; maxUses?: number; label?: string } = {}): Promise<Invite> => {
  const days = Math.min(30, Math.max(1, options.days ?? 7));
  const maxUses = Math.min(50, Math.max(1, options.maxUses ?? 1));
  const label = (options.label ?? '').trim().slice(0, 80);
  return run(
    async (c) =>
      unwrap(
        await c
          .from('project_invites')
          .insert({ project_id: projectId, role, label, max_uses: maxUses, expires_at: new Date(Date.now() + days * 86_400_000).toISOString() })
          .select('id, token, role, label, created_at, expires_at, revoked_at, max_uses, uses')
          .single()
      ) as Invite,
    () => {
      const now = new Date();
      const invite: LocalInvite = {
        id: `inv-${Math.random().toString(36).slice(2, 10)}`,
        project_id: projectId,
        created_by: userId,
        token: randomToken(),
        role,
        label,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + days * 86_400_000).toISOString(),
        revoked_at: null,
        max_uses: maxUses,
        uses: 0,
      };
      write(INVITES_KEY, [invite, ...read<LocalInvite>(INVITES_KEY)]);
      return invite;
    }
  );
};

export const revokeInvite = (inviteId: string): Promise<void> =>
  run(
    async (c) => {
      unwrap(await c.from('project_invites').update({ revoked_at: new Date().toISOString() }).eq('id', inviteId));
    },
    () => write(INVITES_KEY, read<LocalInvite>(INVITES_KEY).map((i) => (i.id === inviteId ? { ...i, revoked_at: new Date().toISOString() } : i)))
  );

/** What an invitation is for. Null when it does not exist, has been switched off, has run out or is past its date. */
export const previewInvite = async (token: string): Promise<InvitePreview | null> => {
  const clean = token.replace(/[^0-9a-zA-Z]/g, '');
  if (!clean) return null;
  return run(
    async (c) => (unwrap(await c.rpc('preview_project_invite', { p_token: clean })) as InvitePreview | null) ?? null,
    async () => {
      const invite = read<LocalInvite>(INVITES_KEY).find((i) => i.token === clean && inviteIsOpen(i));
      if (!invite) return null;
      const project = (await databaseService.getProjectsByIds([invite.project_id]))[0];
      if (!project) return null;
      const profiles = await namesFor([invite.created_by]);
      return { project_id: project.id, title: project.title, role: invite.role, inviter: nameOf(invite.created_by, profiles) };
    }
  );
};

/** Join a project from an invitation. Someone already on it can be raised by an invitation, never lowered. */
export const acceptInvite = async (token: string, userId: string, userName: string): Promise<{ project_id: string; title: string; role: MemberRole }> => {
  const clean = token.replace(/[^0-9a-zA-Z]/g, '');
  return run(
    async (c) => unwrap(await c.rpc('accept_project_invite', { p_token: clean })) as { project_id: string; title: string; role: MemberRole },
    async () => {
      const invites = read<LocalInvite>(INVITES_KEY);
      const invite = invites.find((i) => i.token === clean && inviteIsOpen(i));
      if (!invite) throw new Error('This invitation is no longer active.');
      const project = (await databaseService.getProjectsByIds([invite.project_id]))[0];
      if (!project) throw new Error('This project no longer exists.');
      if (project.user_id === userId) throw new Error('This is your own project.');
      const members = read<LocalMember>(MEMBERS_KEY);
      const existing = members.find((m) => m.project_id === project.id && m.user_id === userId);
      let role: MemberRole = invite.role;
      if (!existing) {
        write(MEMBERS_KEY, [...members, { project_id: project.id, user_id: userId, role, added_by: invite.created_by, created_at: new Date().toISOString() }]);
        write(INVITES_KEY, invites.map((i) => (i.id === invite.id ? { ...i, uses: i.uses + 1 } : i)));
        pushLocalNotification(project.user_id, { actor_id: userId, actor_name: userName, kind: 'collab', project_id: project.id, meta: { project_title: project.title, role } });
      } else {
        role = rank(invite.role) > rank(existing.role) ? invite.role : existing.role;
        if (role !== existing.role) write(MEMBERS_KEY, members.map((m) => (m === existing ? { ...m, role } : m)));
      }
      return { project_id: project.id, title: project.title, role };
    }
  );
};
