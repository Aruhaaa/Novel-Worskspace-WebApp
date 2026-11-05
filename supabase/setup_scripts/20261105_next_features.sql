-- Novelist Workspace: notifications, live messages, shared projects and the error log.
--
-- Paste the whole file into the Supabase SQL Editor and press Run. It is safe to run twice, and it only ADDS things:
-- six new tables, some functions and triggers. It does not change the policies or columns of projects, chapters,
-- entities or any other table that already exists. `supabase/rollback_next_features.sql` takes it all away again.
--
-- What it switches on:
--   * notifications ........ a bell for follows, comments, reviews, messages, reading-link comments and new collaborators
--   * live messages ........ unread counts and "Seen" marks, and realtime delivery for chat_messages
--   * shared projects ...... co-authors, editors and viewers, invited by a link
--   * error log ............ crash reports from the website and the phone app, for the admin to read
--
-- Until it has been run, every one of these quietly keeps working in a reduced way (see supabase/README.md).

-- ---------------------------------------------------------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------------------------------------------------------

create or replace function public._uuid_or_null(p text)
  returns uuid
  language sql
  immutable
  as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid else null end
$$;

create or replace function public._display_name(p_user uuid)
  returns text
  language sql
  stable
  security definer
  set search_path to 'public'
  as $$
  select coalesce((select nullif(trim(pr.display_name), '') from public.profiles pr where pr.id = p_user), 'Someone')
$$;

revoke all on function public._uuid_or_null(text) from public, anon, authenticated;
revoke all on function public._display_name(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------------------------------------------------

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  actor_id   uuid references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('follow', 'comment', 'review', 'message', 'share_comment', 'collab')),
  project_id uuid references public.projects (id) on delete cascade,
  chapter_id text,
  ref_id     text,
  snippet    text not null default '' check (char_length(snippet) <= 300),
  actor_name text not null default '' check (char_length(actor_name) <= 120),
  meta       jsonb not null default '{}'::jsonb,
  count      integer not null default 1,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
-- One open "new messages" notification per sender, so a busy chat is one line that counts up
create unique index if not exists notifications_unread_message_uq on public.notifications (user_id, actor_id)
  where kind = 'message' and read_at is null;

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
grant select, delete on table public.notifications to authenticated;
-- A person can only mark their own as read; everything else about a notification is written by the server
grant update (read_at) on table public.notifications to authenticated;

drop policy if exists "owner_read" on public.notifications;
create policy "owner_read" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "owner_update" on public.notifications;
create policy "owner_update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "owner_delete" on public.notifications;
create policy "owner_delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

create table if not exists public.notification_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  -- Kinds this person does not want in the app at all
  muted_kinds text[] not null default '{}'
    check (muted_kinds <@ array['follow', 'comment', 'review', 'message', 'share_comment', 'collab']::text[]),
  -- Kinds that are also sent by email (needs the notify-email function, see supabase/README.md)
  email_kinds text[] not null default '{}'
    check (email_kinds <@ array['follow', 'comment', 'review', 'message', 'share_comment', 'collab']::text[]),
  updated_at  timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
revoke all on table public.notification_settings from anon, authenticated;
grant select, insert, update, delete on table public.notification_settings to authenticated;

drop policy if exists "owner_all" on public.notification_settings;
create policy "owner_all" on public.notification_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The one place a notification is written. It never tells someone about their own action, respects what they have
-- switched off, and stays quiet about people they have blocked.
create or replace function public._notify(
  p_user       uuid,
  p_actor      uuid,
  p_kind       text,
  p_project    uuid,
  p_chapter    text,
  p_ref        text,
  p_snippet    text,
  p_actor_name text,
  p_meta       jsonb default '{}'::jsonb
)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  blocked boolean := false;
begin
  if p_user is null or p_user is not distinct from p_actor then
    return;
  end if;
  if exists (select 1 from public.notification_settings s where s.user_id = p_user and p_kind = any (s.muted_kinds)) then
    return;
  end if;
  if p_actor is not null and to_regclass('public.user_blocks') is not null then
    execute 'select exists (select 1 from public.user_blocks b where b.blocker_id = $1 and b.blocked_id = $2)'
      into blocked using p_user::text, p_actor::text;
    if blocked then
      return;
    end if;
  end if;

  if p_kind = 'message' and p_actor is not null then
    insert into public.notifications (user_id, actor_id, kind, project_id, chapter_id, ref_id, snippet, actor_name, meta)
    values (p_user, p_actor, p_kind, p_project, p_chapter, p_ref, left(coalesce(p_snippet, ''), 300), left(coalesce(p_actor_name, ''), 120), coalesce(p_meta, '{}'::jsonb))
    on conflict (user_id, actor_id) where kind = 'message' and read_at is null
    do update set count = public.notifications.count + 1,
                  snippet = excluded.snippet,
                  ref_id = excluded.ref_id,
                  actor_name = excluded.actor_name,
                  created_at = now();
  else
    insert into public.notifications (user_id, actor_id, kind, project_id, chapter_id, ref_id, snippet, actor_name, meta)
    values (p_user, p_actor, p_kind, p_project, p_chapter, p_ref, left(coalesce(p_snippet, ''), 300), left(coalesce(p_actor_name, ''), 120), coalesce(p_meta, '{}'::jsonb));
  end if;

  -- Old, already-read notifications are tidied away now and then
  if random() < 0.02 then
    delete from public.notifications where created_at < now() - interval '90 days' and read_at is not null;
  end if;
end
$function$;

revoke all on function public._notify(uuid, uuid, text, uuid, text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public._notify_on_follow()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  t text;
begin
  for t in select x from unnest(coalesce(new.following, '{}'::text[])) x where not (x = any (coalesce(old.following, '{}'::text[]))) loop
    perform public._notify(public._uuid_or_null(t), new.id, 'follow', null, null, null, '', public._display_name(new.id));
  end loop;
  return new;
end
$function$;

create or replace function public._notify_on_comment()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  owner uuid;
  title text;
begin
  select public._uuid_or_null(p.user_id), p.title into owner, title from public.projects p where p.id = new.project_id;
  perform public._notify(owner, new.user_id, 'comment', new.project_id, new.chapter_id::text, new.id::text, left(new.content, 140),
                         public._display_name(new.user_id), jsonb_build_object('project_title', coalesce(title, '')));
  return new;
end
$function$;

create or replace function public._notify_on_review()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  owner uuid;
  title text;
begin
  select public._uuid_or_null(p.user_id), p.title into owner, title from public.projects p where p.id = new.project_id;
  perform public._notify(owner, new.user_id, 'review', new.project_id, null, new.id::text, left(new.content, 140),
                         public._display_name(new.user_id), jsonb_build_object('project_title', coalesce(title, ''), 'rating', new.rating));
  return new;
end
$function$;

create or replace function public._notify_on_share_comment()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  owner uuid;
  title text;
begin
  select public._uuid_or_null(p.user_id), p.title into owner, title from public.projects p where p.id = new.project_id;
  perform public._notify(owner, null, 'share_comment', new.project_id, new.chapter_id, new.id::text, left(new.note, 140), new.reader_name,
                         jsonb_build_object('project_title', coalesce(title, ''), 'chapter_title', new.chapter_title));
  return new;
end
$function$;

create or replace function public._notify_on_message()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
begin
  perform public._notify(new.receiver_id, new.sender_id, 'message', null, null, new.id::text, left(new.content, 140), public._display_name(new.sender_id));
  return new;
end
$function$;

revoke all on function public._notify_on_follow() from public, anon, authenticated;
revoke all on function public._notify_on_comment() from public, anon, authenticated;
revoke all on function public._notify_on_review() from public, anon, authenticated;
revoke all on function public._notify_on_share_comment() from public, anon, authenticated;
revoke all on function public._notify_on_message() from public, anon, authenticated;

-- Attach the triggers to whichever of these tables exist
do $$
begin
  if to_regclass('public.profiles') is not null then
    drop trigger if exists notify_on_follow on public.profiles;
    create trigger notify_on_follow after update of following on public.profiles
      for each row when (new.following is distinct from old.following) execute function public._notify_on_follow();
  end if;
  if to_regclass('public.comments') is not null then
    drop trigger if exists notify_on_comment on public.comments;
    create trigger notify_on_comment after insert on public.comments for each row execute function public._notify_on_comment();
  end if;
  if to_regclass('public.reviews') is not null then
    drop trigger if exists notify_on_review on public.reviews;
    create trigger notify_on_review after insert on public.reviews for each row execute function public._notify_on_review();
  end if;
  if to_regclass('public.share_comments') is not null then
    drop trigger if exists notify_on_share_comment on public.share_comments;
    create trigger notify_on_share_comment after insert on public.share_comments for each row execute function public._notify_on_share_comment();
  end if;
  if to_regclass('public.chat_messages') is not null then
    drop trigger if exists notify_on_message on public.chat_messages;
    create trigger notify_on_message after insert on public.chat_messages for each row execute function public._notify_on_message();
  end if;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Following, done properly. The old way wrote to the other person's profile, which the profile policy does not allow.
-- ---------------------------------------------------------------------------------------------------------------------

create or replace function public.follow_user(p_target uuid)
  returns boolean
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  uid uuid := auth.uid();
  now_following boolean;
  refused boolean := false;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;
  if p_target is null or p_target = uid then
    raise exception 'You can''t follow yourself.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'That author was not found.' using errcode = 'P0001';
  end if;
  if to_regclass('public.user_blocks') is not null then
    execute 'select exists (select 1 from public.user_blocks b where (b.blocker_id = $1 and b.blocked_id = $2) or (b.blocker_id = $2 and b.blocked_id = $1))'
      into refused using uid::text, p_target::text;
    if refused then
      raise exception 'You can''t follow this person.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id) values (uid) on conflict (id) do nothing;
  select not (p_target::text = any (coalesce(following, '{}'::text[]))) into now_following from public.profiles where id = uid;

  if now_following then
    update public.profiles set following = array_append(coalesce(following, '{}'::text[]), p_target::text) where id = uid;
    update public.profiles set followers = array_append(coalesce(followers, '{}'::text[]), uid::text)
     where id = p_target and not (uid::text = any (coalesce(followers, '{}'::text[])));
  else
    update public.profiles set following = array_remove(coalesce(following, '{}'::text[]), p_target::text) where id = uid;
    update public.profiles set followers = array_remove(coalesce(followers, '{}'::text[]), uid::text) where id = p_target;
  end if;
  return now_following;
end
$function$;

revoke all on function public.follow_user(uuid) from public, anon;
grant execute on function public.follow_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Live messages: what has been read, and how many are waiting
-- ---------------------------------------------------------------------------------------------------------------------

create table if not exists public.message_reads (
  user_id    uuid not null references auth.users (id) on delete cascade,
  peer_id    uuid not null references auth.users (id) on delete cascade,
  read_until timestamptz not null default now(),
  primary key (user_id, peer_id),
  check (user_id <> peer_id)
);

alter table public.message_reads enable row level security;
revoke all on table public.message_reads from anon, authenticated;
grant select, insert, update, delete on table public.message_reads to authenticated;

-- You can see your own marks, and the other person's, so a sender can see that a message was read
drop policy if exists "read_marks_select" on public.message_reads;
create policy "read_marks_select" on public.message_reads for select to authenticated using (user_id = auth.uid() or peer_id = auth.uid());
drop policy if exists "read_marks_write" on public.message_reads;
create policy "read_marks_write" on public.message_reads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.mark_chat_read(p_peer uuid, p_until timestamptz default now())
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  uid uuid := auth.uid();
  until_ts timestamptz := least(coalesce(p_until, now()), now());
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;
  if p_peer is null or p_peer = uid then
    return;
  end if;
  insert into public.message_reads (user_id, peer_id, read_until) values (uid, p_peer, until_ts)
  on conflict (user_id, peer_id) do update set read_until = greatest(public.message_reads.read_until, excluded.read_until);
  update public.notifications set read_at = now() where user_id = uid and kind = 'message' and actor_id = p_peer and read_at is null;
end
$function$;

create or replace function public.unread_message_counts()
  returns table (sender_id uuid, unread bigint)
  language sql
  stable
  as $$
  select m.sender_id, count(*)::bigint
    from public.chat_messages m
    left join public.message_reads r on r.user_id = auth.uid() and r.peer_id = m.sender_id
   where m.receiver_id = auth.uid() and (r.read_until is null or m.created_at > r.read_until)
   group by m.sender_id
$$;

revoke all on function public.mark_chat_read(uuid, timestamptz) from public, anon;
grant execute on function public.mark_chat_read(uuid, timestamptz) to authenticated;
revoke all on function public.unread_message_counts() from public, anon;
grant execute on function public.unread_message_counts() to authenticated;

-- Realtime: the app is told the moment something is inserted
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['notifications', 'message_reads', 'chat_messages'] loop
      if to_regclass('public.' || t) is not null
         and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Shared projects: co-authors, editors and viewers
-- ---------------------------------------------------------------------------------------------------------------------

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('coauthor', 'editor', 'viewer')),
  added_by   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user_idx on public.project_members (user_id);

create table if not exists public.project_invites (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  role       text not null check (role in ('coauthor', 'editor', 'viewer')),
  label      text not null default '' check (char_length(label) <= 80),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  max_uses   integer not null default 1 check (max_uses between 1 and 50),
  uses       integer not null default 0 check (uses >= 0),
  check (expires_at <= created_at + interval '31 days')
);
create index if not exists project_invites_project_idx on public.project_invites (project_id);

-- These look at the projects and members tables without going through their policies, so a policy can ask
-- "is this person on the project?" without asking itself.
create or replace function public.is_project_owner(p_project uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
  as $$
  select exists (select 1 from public.projects p where p.id = p_project and p.user_id = auth.uid()::text)
$$;

create or replace function public.project_role(p_project uuid)
  returns text
  language sql
  stable
  security definer
  set search_path to 'public'
  as $$
  select case
           when exists (select 1 from public.projects p where p.id = p_project and p.user_id = auth.uid()::text) then 'owner'
           else (select m.role from public.project_members m where m.project_id = p_project and m.user_id = auth.uid())
         end
$$;

revoke all on function public.is_project_owner(uuid) from public, anon;
revoke all on function public.project_role(uuid) from public, anon;
grant execute on function public.is_project_owner(uuid) to authenticated;
grant execute on function public.project_role(uuid) to authenticated;

alter table public.project_members enable row level security;
revoke all on table public.project_members from anon, authenticated;
grant select, update, delete on table public.project_members to authenticated;

drop policy if exists "members_select" on public.project_members;
create policy "members_select" on public.project_members for select to authenticated
  using (user_id = auth.uid() or public.project_role(project_id) is not null);
drop policy if exists "members_update" on public.project_members;
create policy "members_update" on public.project_members for update to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
-- The owner can remove anyone; anyone can leave
drop policy if exists "members_delete" on public.project_members;
create policy "members_delete" on public.project_members for delete to authenticated
  using (user_id = auth.uid() or public.is_project_owner(project_id));

alter table public.project_invites enable row level security;
revoke all on table public.project_invites from anon, authenticated;
grant select, insert, update, delete on table public.project_invites to authenticated;

drop policy if exists "owner_all" on public.project_invites;
create policy "owner_all" on public.project_invites for all to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id) and created_by = auth.uid());

-- What an invitation is for, shown before anyone joins. The token is the secret; nothing else is revealed.
create or replace function public.preview_project_invite(p_token text)
  returns json
  language plpgsql
  stable
  security definer
  set search_path to 'public'
  as $function$
declare
  i public.project_invites;
  p public.projects;
begin
  select * into i from public.project_invites
   where token = p_token and revoked_at is null and expires_at > now() and uses < max_uses;
  if not found then
    return null;
  end if;
  select * into p from public.projects where id = i.project_id;
  if not found then
    return null;
  end if;
  return json_build_object('project_id', p.id::text, 'title', p.title, 'role', i.role, 'inviter', public._display_name(i.created_by));
end
$function$;

create or replace function public.accept_project_invite(p_token text)
  returns json
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  uid uuid := auth.uid();
  i public.project_invites;
  p public.projects;
  existing text;
  final_role text;
begin
  if uid is null then
    raise exception 'Sign in to accept an invitation.' using errcode = 'P0001';
  end if;
  select * into i from public.project_invites
   where token = p_token and revoked_at is null and expires_at > now() and uses < max_uses
   for update;
  if not found then
    raise exception 'This invitation is no longer active.' using errcode = 'P0001';
  end if;
  select * into p from public.projects where id = i.project_id;
  if not found then
    raise exception 'This project no longer exists.' using errcode = 'P0001';
  end if;
  if p.user_id = uid::text then
    raise exception 'This is your own project.' using errcode = 'P0001';
  end if;

  select m.role into existing from public.project_members m where m.project_id = p.id and m.user_id = uid;
  if existing is null then
    insert into public.project_members (project_id, user_id, role, added_by) values (p.id, uid, i.role, i.created_by);
    update public.project_invites set uses = uses + 1 where id = i.id;
    final_role := i.role;
    perform public._notify(public._uuid_or_null(p.user_id), uid, 'collab', p.id, null, null, '', public._display_name(uid),
                           jsonb_build_object('project_title', p.title, 'role', i.role));
  else
    -- Already on the project: an invitation can raise a role but never lower it
    final_role := case
      when (case i.role when 'coauthor' then 3 when 'editor' then 2 else 1 end) > (case existing when 'coauthor' then 3 when 'editor' then 2 else 1 end) then i.role
      else existing
    end;
    if final_role <> existing then
      update public.project_members set role = final_role where project_id = p.id and user_id = uid;
    end if;
  end if;
  return json_build_object('project_id', p.id::text, 'title', p.title, 'role', final_role);
end
$function$;

revoke all on function public.preview_project_invite(text) from public;
grant execute on function public.preview_project_invite(text) to anon, authenticated;
revoke all on function public.accept_project_invite(text) from public, anon;
grant execute on function public.accept_project_invite(text) to authenticated;

-- Live editing and "who is here" travel over private realtime channels named project:<project id>:<what>.
-- Only people on the project may join them. (Skipped quietly where realtime authorisation is not available.)
create or replace function public.can_use_project_channel(p_topic text, p_write boolean default false)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path to 'public'
  as $function$
declare
  pid uuid := public._uuid_or_null(split_part(coalesce(p_topic, ''), ':', 2));
  r text;
begin
  if pid is null then
    return false;
  end if;
  r := public.project_role(pid);
  if r is null then
    return false;
  end if;
  if p_write then
    return r in ('owner', 'coauthor', 'editor');
  end if;
  return true;
end
$function$;

revoke all on function public.can_use_project_channel(text, boolean) from public, anon;
grant execute on function public.can_use_project_channel(text, boolean) to authenticated;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "project members receive" on realtime.messages';
    execute 'create policy "project members receive" on realtime.messages for select to authenticated using (realtime.topic() like ''project:%'' and public.can_use_project_channel(realtime.topic(), false))';
    execute 'drop policy if exists "project editors send" on realtime.messages';
    execute 'create policy "project editors send" on realtime.messages for insert to authenticated with check (realtime.topic() like ''project:%'' and public.can_use_project_channel(realtime.topic(), true))';
  end if;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Error log: what went wrong on people's screens, so it can be fixed. No writing and no personal details are sent.
-- ---------------------------------------------------------------------------------------------------------------------

create table if not exists public.client_errors (
  id          bigint generated always as identity primary key,
  fingerprint text not null check (char_length(fingerprint) between 1 and 80),
  message     text not null check (char_length(message) <= 1000),
  stack       text not null default '' check (char_length(stack) <= 4000),
  source      text not null default 'web' check (source in ('web', 'phone', 'desktop')),
  app_version text not null default '' check (char_length(app_version) <= 40),
  url         text not null default '' check (char_length(url) <= 300),
  user_agent  text not null default '' check (char_length(user_agent) <= 300),
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists client_errors_group_idx on public.client_errors (fingerprint, created_at desc);
create index if not exists client_errors_time_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;
revoke all on table public.client_errors from anon, authenticated;

-- Reporting is a function, so the server can limit it and clean what comes in
create or replace function public.report_client_error(
  p_fingerprint text,
  p_message     text,
  p_stack       text default '',
  p_source      text default 'web',
  p_version     text default '',
  p_url         text default '',
  p_ua          text default '',
  p_extra       jsonb default '{}'::jsonb
)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  clean_url text := left(regexp_replace(coalesce(p_url, ''), '[0-9a-fA-F]{24,}', ':id', 'g'), 300);
begin
  if coalesce(trim(p_message), '') = '' or coalesce(trim(p_fingerprint), '') = '' then
    return;
  end if;
  -- Ceilings, so a loop in someone's browser cannot fill the table
  if (select count(*) from public.client_errors where fingerprint = left(p_fingerprint, 80) and created_at > now() - interval '1 day') >= 50 then
    return;
  end if;
  if (select count(*) from public.client_errors where created_at > now() - interval '1 hour') >= 3000 then
    return;
  end if;
  insert into public.client_errors (fingerprint, message, stack, source, app_version, url, user_agent, extra)
  values (left(p_fingerprint, 80), left(p_message, 1000), left(coalesce(p_stack, ''), 4000),
          case when p_source in ('web', 'phone', 'desktop') then p_source else 'web' end,
          left(coalesce(p_version, ''), 40), clean_url, left(coalesce(p_ua, ''), 300),
          case when jsonb_typeof(coalesce(p_extra, '{}'::jsonb)) = 'object' and length(coalesce(p_extra, '{}'::jsonb)::text) <= 2000 then coalesce(p_extra, '{}'::jsonb) else '{}'::jsonb end);
  if random() < 0.02 then
    delete from public.client_errors where created_at < now() - interval '30 days';
  end if;
end
$function$;

create or replace function public.admin_error_groups(p_days integer default 14)
  returns table (fingerprint text, message text, source text, occurrences bigint, first_seen timestamptz, last_seen timestamptz, sample_stack text, sample_url text, app_version text)
  language plpgsql
  stable
  security definer
  set search_path to 'public'
  as $function$
begin
  if not public._is_admin() then
    raise exception 'Only the admin can do this.' using errcode = 'P0001';
  end if;
  return query
    select e.fingerprint,
           (array_agg(e.message order by e.created_at desc))[1],
           (array_agg(e.source order by e.created_at desc))[1],
           count(*)::bigint,
           min(e.created_at),
           max(e.created_at),
           (array_agg(e.stack order by e.created_at desc))[1],
           (array_agg(e.url order by e.created_at desc))[1],
           (array_agg(e.app_version order by e.created_at desc))[1]
      from public.client_errors e
     where e.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 14), 90)))
     group by e.fingerprint
     order by max(e.created_at) desc
     limit 200;
end
$function$;

create or replace function public.admin_clear_errors(p_fingerprint text default null)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
begin
  if not public._is_admin() then
    raise exception 'Only the admin can do this.' using errcode = 'P0001';
  end if;
  if p_fingerprint is null then
    delete from public.client_errors;
  else
    delete from public.client_errors where fingerprint = p_fingerprint;
  end if;
end
$function$;

revoke all on function public.report_client_error(text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.report_client_error(text, text, text, text, text, text, text, jsonb) to anon, authenticated;
revoke all on function public.admin_error_groups(integer) from public, anon;
grant execute on function public.admin_error_groups(integer) to authenticated;
revoke all on function public.admin_clear_errors(text) from public, anon;
grant execute on function public.admin_clear_errors(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Email delivery log. Used by the notify-email function (supabase/functions/notify-email). One row for each notification
-- that was emailed, so a delivery that is tried twice never sends twice, and one person can be sent only so many a day.
-- Only the server's own service role can use it; nobody signed in to the app can read or write it.
-- ---------------------------------------------------------------------------------------------------------------------

create table if not exists public.notification_emails (
  notification_id uuid primary key references public.notifications (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  sent_at         timestamptz not null default now()
);
create index if not exists notification_emails_user_idx on public.notification_emails (user_id, sent_at desc);

alter table public.notification_emails enable row level security;
revoke all on table public.notification_emails from anon, authenticated;
grant select, insert, delete on table public.notification_emails to service_role;
