-- Novelist Workspace: account safety. Reporting, blocking people, and deleting your own account.
--
-- HOW TO RUN: open your Supabase project, go to SQL Editor, paste this whole file and press Run.
-- It is safe to run more than once.
--
-- WHAT IT ADDS
--   * reports       a queue of things people have reported (a novel, comment, review, message or author)
--   * user_blocks   who has blocked whom
--   * submit_report(), admin_resolve_report(), delete_my_account()   the only ways in
--   * one trigger on chat_messages that refuses a message between two people when one has blocked the other
--
-- WHAT IT DOES NOT TOUCH: no existing table, column or policy is changed or removed. The one trigger is
-- the only thing attached to an existing table, and supabase/rollback_account_safety.sql removes it.
--
-- ADMIN: the admin is the account whose email is set in _is_admin() below. It matches the check the app
-- already uses on the Admin screen. Change the address in both places if yours is different.

begin;

-- ---------------------------------------------------------------------------------------------
-- Tables. ids are stored as text so they match whatever type your own tables use.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    text not null,
  target_type    text not null check (target_type in ('novel', 'comment', 'review', 'message', 'author')),
  target_id      text not null,
  target_user_id text,
  project_id     text,
  reason         text not null check (reason in ('spam', 'harassment', 'sexual', 'violence', 'copyright', 'other')),
  details        text not null default '' check (char_length(details) <= 2000),
  excerpt        text not null default '',
  status         text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  unique (reporter_id, target_type, target_id)
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);

create table if not exists public.user_blocks (
  blocker_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.reports     enable row level security;
alter table public.user_blocks enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Who is the admin
-- ---------------------------------------------------------------------------------------------

create or replace function public._is_admin()
returns boolean
language sql stable set search_path = public as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'aruhaadmin@novelist.com'
$$;

-- ---------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------

-- Reports: only the admin can read them. People file reports through submit_report(), never directly.
drop policy if exists admin_read on public.reports;
create policy admin_read on public.reports for select to authenticated using (public._is_admin());

-- Blocks: you see and change only your own list.
drop policy if exists owner_all on public.user_blocks;
create policy owner_all on public.user_blocks for all to authenticated
  using      (blocker_id = auth.uid()::text)
  with check (blocker_id = auth.uid()::text);

revoke all on public.reports, public.user_blocks from anon;
revoke all on public.reports from authenticated;
grant select on public.reports to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Filing a report. The server looks the content up itself, so the admin sees what was really
-- reported and nobody can file a report with made-up text.
-- ---------------------------------------------------------------------------------------------

create or replace function public.submit_report(p_type text, p_target_id text, p_reason text, p_details text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid       text := auth.uid()::text;
  v_user    text;
  v_project text;
  v_excerpt text := '';
begin
  if uid is null then
    raise exception 'Sign in to send a report.' using errcode = 'P0001';
  end if;
  if p_reason not in ('spam', 'harassment', 'sexual', 'violence', 'copyright', 'other') then
    raise exception 'Choose a reason for the report.' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_details, '')) > 2000 then
    raise exception 'Please keep the details under 2000 characters.' using errcode = 'P0001';
  end if;
  -- A ceiling per person per day, so reporting cannot be used to flood the admin
  if (select count(*) from public.reports where reporter_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'You have sent a lot of reports today. Please try again tomorrow.' using errcode = 'P0001';
  end if;

  if p_type = 'comment' then
    select c.user_id::text, c.project_id::text, left(c.content, 500) into v_user, v_project, v_excerpt
      from public.comments c where c.id::text = p_target_id;
  elsif p_type = 'review' then
    select r.user_id::text, r.project_id::text, left(r.content, 500) into v_user, v_project, v_excerpt
      from public.reviews r where r.id::text = p_target_id;
  elsif p_type = 'message' then
    -- Only someone in the conversation can report a message from it
    select m.sender_id::text, left(m.content, 500) into v_user, v_excerpt
      from public.chat_messages m
     where m.id::text = p_target_id and (m.sender_id::text = uid or m.receiver_id::text = uid);
  elsif p_type = 'novel' then
    select p.user_id::text, p.id::text, left(coalesce(p.title, '') || ' - ' || coalesce(p.description, ''), 500) into v_user, v_project, v_excerpt
      from public.projects p where p.id::text = p_target_id and p.is_published = true;
  elsif p_type = 'author' then
    select a.id::text, left(coalesce(a.display_name, '') || ' - ' || coalesce(a.bio, ''), 500) into v_user, v_excerpt
      from public.profiles a where a.id::text = p_target_id;
  else
    raise exception 'That cannot be reported.' using errcode = 'P0001';
  end if;

  if not found then
    raise exception 'That is no longer there to report.' using errcode = 'P0001';
  end if;
  if v_user = uid then
    raise exception 'You cannot report your own work.' using errcode = 'P0001';
  end if;

  -- Reporting the same thing twice is quietly ignored
  insert into public.reports (reporter_id, target_type, target_id, target_user_id, project_id, reason, details, excerpt)
  values (uid, p_type, p_target_id, v_user, v_project, p_reason, trim(coalesce(p_details, '')), coalesce(v_excerpt, ''))
  on conflict (reporter_id, target_type, target_id) do nothing;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- The admin closes a report: dismiss it, or remove what was reported.
-- A reported novel is taken out of the library (unpublished), not deleted.
-- ---------------------------------------------------------------------------------------------

create or replace function public.admin_resolve_report(p_report_id uuid, p_action text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.reports;
begin
  if not public._is_admin() then
    raise exception 'Only the admin can do this.' using errcode = 'P0001';
  end if;
  select * into r from public.reports where id = p_report_id;
  if not found then
    raise exception 'That report was not found.' using errcode = 'P0001';
  end if;

  if p_action = 'remove' then
    if r.target_type = 'comment' then
      delete from public.comments where id::text = r.target_id;
    elsif r.target_type = 'review' then
      delete from public.reviews where id::text = r.target_id;
    elsif r.target_type = 'message' then
      delete from public.chat_messages where id::text = r.target_id;
    elsif r.target_type = 'novel' then
      update public.projects set is_published = false where id::text = r.target_id;
    end if;
    update public.reports set status = 'actioned', resolved_at = now() where id = p_report_id;
  elsif p_action = 'dismiss' then
    update public.reports set status = 'dismissed', resolved_at = now() where id = p_report_id;
  else
    raise exception 'Unknown action.' using errcode = 'P0001';
  end if;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Deleting your own account. Removes everything the person made, then the sign-in itself.
-- It always acts on the signed-in person, never on an id passed in.
-- ---------------------------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  uid text := auth.uid()::text;
  t   text;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;

  -- Their novels, and everything inside them
  foreach t in array array['word_count_logs', 'comments', 'reviews', 'entities', 'chapters'] loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I where project_id in (select id from public.projects where user_id::text = $1)', t) using uid;
    end if;
  end loop;
  delete from public.projects where user_id::text = uid;   -- notes, goals, history and reading links go with it

  -- What they wrote on other people's novels, and their messages
  if to_regclass('public.comments') is not null then
    execute 'delete from public.comments where user_id::text = $1' using uid;
  end if;
  if to_regclass('public.reviews') is not null then
    execute 'delete from public.reviews where user_id::text = $1' using uid;
  end if;
  if to_regclass('public.chat_messages') is not null then
    execute 'delete from public.chat_messages where sender_id::text = $1 or receiver_id::text = $1' using uid;
  end if;

  -- Likes, views and follows other people's rows hold on to. A failure here must not stop the deletion.
  begin
    execute 'update public.projects set likes = array(select x from unnest(likes) x where x::text <> $1) where $1 = any(likes::text[])' using uid;
    execute 'update public.projects set views = array(select x from unnest(views) x where x::text <> $1) where $1 = any(views::text[])' using uid;
  exception when others then
    null;
  end;
  begin
    execute 'update public.profiles set followers = array(select x from unnest(followers) x where x::text <> $1) where $1 = any(followers::text[])' using uid;
    execute 'update public.profiles set following = array(select x from unnest(following) x where x::text <> $1) where $1 = any(following::text[])' using uid;
  exception when others then
    null;
  end;

  delete from public.user_blocks where blocker_id = uid or blocked_id = uid;
  -- Reports they filed are kept: they are the admin's record, and the id no longer points to anyone
  if to_regclass('public.profiles') is not null then
    execute 'delete from public.profiles where id::text = $1' using uid;
  end if;

  delete from auth.users where id = auth.uid();
end
$$;

-- ---------------------------------------------------------------------------------------------
-- A blocked person cannot message you, and you cannot message them. Enforced here, so it holds even
-- if someone talks to the database directly.
-- ---------------------------------------------------------------------------------------------

create or replace function public._refuse_blocked_message()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.user_blocks b
     where (b.blocker_id = new.receiver_id::text and b.blocked_id = new.sender_id::text)
        or (b.blocker_id = new.sender_id::text   and b.blocked_id = new.receiver_id::text)
  ) then
    raise exception 'You can''t message this person.' using errcode = 'P0001';
  end if;
  return new;
end
$$;

do $trg$
begin
  if to_regclass('public.chat_messages') is not null then
    drop trigger if exists refuse_blocked_message on public.chat_messages;
    create trigger refuse_blocked_message before insert on public.chat_messages
      for each row execute function public._refuse_blocked_message();
  end if;
end
$trg$;

-- Only the signed-in functions are open; the helpers stay private.
revoke all on function public._is_admin()                              from public, anon;
revoke all on function public._refuse_blocked_message()                from public, anon, authenticated;
revoke all on function public.submit_report(text, text, text, text)    from public, anon;
revoke all on function public.admin_resolve_report(uuid, text)         from public, anon;
revoke all on function public.delete_my_account()                      from public, anon;
grant execute on function public._is_admin()                           to authenticated;
grant execute on function public.submit_report(text, text, text, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text)      to authenticated;
grant execute on function public.delete_my_account()                   to authenticated;

commit;

-- Check it worked: this should list two tables and three functions.
-- select table_name from information_schema.tables where table_schema = 'public' and table_name in ('reports', 'user_blocks');
-- select routine_name from information_schema.routines where routine_schema = 'public' and routine_name in ('submit_report', 'admin_resolve_report', 'delete_my_account');
