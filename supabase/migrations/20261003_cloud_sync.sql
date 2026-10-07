-- Novelist Workspace: cloud sync for chapter notes, goals, version history, the deleted-chapters bin
-- and private reading links for beta readers.
--
-- HOW TO RUN: open your Supabase project, go to SQL Editor, paste this whole file and press Run.
-- It is safe to run more than once. It only ADDS new tables and functions. It does not change, move
-- or delete anything in your existing tables (projects, chapters, entities, ...), so the app keeps
-- working exactly as before until you use the new features.
--
-- WHY NEW TABLES, NOT NEW COLUMNS: chapters and projects of published novels can be read by anyone.
-- Private notes, goals and deleted drafts must not sit in those tables, so each lives in its own table
-- that only the project's owner can read.

begin;

-- The id columns of projects and chapters may be uuid or text depending on how they were created.
-- The new tables copy whatever type yours use, so the foreign keys always match.
do $mig$
declare
  pid text;
  cid text;
begin
  select format_type(a.atttypid, a.atttypmod) into pid
    from pg_attribute a
   where a.attrelid = 'public.projects'::regclass and a.attname = 'id' and not a.attisdropped;
  select format_type(a.atttypid, a.atttypmod) into cid
    from pg_attribute a
   where a.attrelid = 'public.chapters'::regclass and a.attname = 'id' and not a.attisdropped;
  if pid is null or cid is null then
    raise exception 'Could not find projects.id or chapters.id. Is this the right database?';
  end if;

  -- 1. Per-chapter status, synopsis and private notes
  execute format($f$
    create table if not exists public.chapter_notes (
      chapter_id %2$s primary key references public.chapters(id) on delete cascade,
      project_id %1$s not null references public.projects(id) on delete cascade,
      status     text not null default 'draft' check (status in ('draft', 'revising', 'done')),
      synopsis   text not null default '',
      notes      text not null default '',
      updated_at timestamptz not null default now()
    )$f$, pid, cid);

  -- 2. The manuscript goal (target length and finish date)
  execute format($f$
    create table if not exists public.project_settings (
      project_id    %1$s primary key references public.projects(id) on delete cascade,
      goal_words    integer check (goal_words is null or goal_words > 0),
      goal_deadline date,
      updated_at    timestamptz not null default now()
    )$f$, pid);

  -- 3. Version history of a chapter
  execute format($f$
    create table if not exists public.chapter_snapshots (
      id         bigint generated always as identity primary key,
      chapter_id %2$s not null references public.chapters(id) on delete cascade,
      project_id %1$s not null references public.projects(id) on delete cascade,
      title      text not null default '',
      content    text not null default '',
      words      integer not null default 0,
      reason     text not null default 'auto' check (reason in ('session', 'auto', 'manual', 'before-restore', 'deleted')),
      created_at timestamptz not null default now()
    )$f$, pid, cid);

  -- 4. Recently deleted chapters (a copy is kept here so a delete can be undone)
  execute format($f$
    create table if not exists public.deleted_chapters (
      id         uuid primary key default gen_random_uuid(),
      project_id %1$s not null references public.projects(id) on delete cascade,
      title      text not null default '',
      content    text not null default '',
      position   integer not null default 0,
      meta       jsonb,
      deleted_at timestamptz not null default now()
    )$f$, pid);

  -- 5. Private reading links for beta readers
  execute format($f$
    create table if not exists public.share_links (
      id         uuid primary key default gen_random_uuid(),
      project_id %1$s not null references public.projects(id) on delete cascade,
      token      text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      label      text not null default '',
      created_at timestamptz not null default now(),
      expires_at timestamptz,
      revoked_at timestamptz
    )$f$, pid);

  execute format($f$
    create table if not exists public.share_comments (
      id            uuid primary key default gen_random_uuid(),
      link_id       uuid not null references public.share_links(id) on delete cascade,
      project_id    %1$s not null references public.projects(id) on delete cascade,
      chapter_id    text not null,
      chapter_title text not null default '',
      reader_key    text not null,
      reader_name   text not null,
      quote         text not null default '' check (char_length(quote) <= 1000),
      note          text not null check (char_length(note) between 1 and 5000),
      status        text not null default 'open' check (status in ('open', 'done')),
      created_at    timestamptz not null default now()
    )$f$, pid);
end
$mig$;

create index if not exists chapter_notes_project_idx     on public.chapter_notes (project_id);
create index if not exists chapter_snapshots_chapter_idx on public.chapter_snapshots (chapter_id, created_at desc);
create index if not exists chapter_snapshots_project_idx on public.chapter_snapshots (project_id);
create index if not exists deleted_chapters_project_idx  on public.deleted_chapters (project_id, deleted_at desc);
create index if not exists share_links_project_idx       on public.share_links (project_id);
create index if not exists share_comments_project_idx    on public.share_comments (project_id, created_at);
create index if not exists share_comments_link_idx       on public.share_comments (link_id, reader_key);

-- Row level security: only the owner of a project can touch its rows in these tables.
alter table public.chapter_notes    enable row level security;
alter table public.project_settings enable row level security;
alter table public.chapter_snapshots enable row level security;
alter table public.deleted_chapters enable row level security;
alter table public.share_links      enable row level security;
alter table public.share_comments   enable row level security;

drop policy if exists owner_all on public.chapter_notes;
create policy owner_all on public.chapter_notes for all to authenticated
  using      (exists (select 1 from public.projects p where p.id = chapter_notes.project_id and p.user_id::text = auth.uid()::text))
  with check (exists (select 1 from public.projects p where p.id = chapter_notes.project_id and p.user_id::text = auth.uid()::text));

drop policy if exists owner_all on public.project_settings;
create policy owner_all on public.project_settings for all to authenticated
  using      (exists (select 1 from public.projects p where p.id = project_settings.project_id and p.user_id::text = auth.uid()::text))
  with check (exists (select 1 from public.projects p where p.id = project_settings.project_id and p.user_id::text = auth.uid()::text));

drop policy if exists owner_all on public.chapter_snapshots;
create policy owner_all on public.chapter_snapshots for all to authenticated
  using      (exists (select 1 from public.projects p where p.id = chapter_snapshots.project_id and p.user_id::text = auth.uid()::text))
  with check (exists (select 1 from public.projects p where p.id = chapter_snapshots.project_id and p.user_id::text = auth.uid()::text));

drop policy if exists owner_all on public.deleted_chapters;
create policy owner_all on public.deleted_chapters for all to authenticated
  using      (exists (select 1 from public.projects p where p.id = deleted_chapters.project_id and p.user_id::text = auth.uid()::text))
  with check (exists (select 1 from public.projects p where p.id = deleted_chapters.project_id and p.user_id::text = auth.uid()::text));

drop policy if exists owner_all on public.share_links;
create policy owner_all on public.share_links for all to authenticated
  using      (exists (select 1 from public.projects p where p.id = share_links.project_id and p.user_id::text = auth.uid()::text))
  with check (exists (select 1 from public.projects p where p.id = share_links.project_id and p.user_id::text = auth.uid()::text));

-- The owner can read, resolve and remove reader comments. Nobody can insert them directly:
-- readers go through the functions below, which check the link first.
drop policy if exists owner_read on public.share_comments;
create policy owner_read on public.share_comments for select to authenticated
  using (exists (select 1 from public.projects p where p.id = share_comments.project_id and p.user_id::text = auth.uid()::text));
drop policy if exists owner_update on public.share_comments;
create policy owner_update on public.share_comments for update to authenticated
  using      (exists (select 1 from public.projects p where p.id = share_comments.project_id and p.user_id::text = auth.uid()::text))
  with check (exists (select 1 from public.projects p where p.id = share_comments.project_id and p.user_id::text = auth.uid()::text));
drop policy if exists owner_delete on public.share_comments;
create policy owner_delete on public.share_comments for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = share_comments.project_id and p.user_id::text = auth.uid()::text));

revoke all on public.chapter_notes, public.project_settings, public.chapter_snapshots, public.deleted_chapters,
              public.share_links, public.share_comments from anon;
grant select, insert, update, delete on public.chapter_notes, public.project_settings, public.chapter_snapshots,
              public.deleted_chapters, public.share_links to authenticated;
grant select, update, delete on public.share_comments to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Reading links. A reader needs no account: the secret token in the link is their key.
-- These functions run with the owner's rights, but only ever return what the link allows.
-- ---------------------------------------------------------------------------------------------

create or replace function public._live_share_link(p_token text)
returns public.share_links
language sql stable security definer set search_path = public as $$
  select l.* from public.share_links l
   where l.token = p_token and l.revoked_at is null and (l.expires_at is null or l.expires_at > now())
$$;

-- The manuscript as the link's owner shares it: the title, the author's name and every chapter, in order.
create or replace function public.get_shared_manuscript(p_token text)
returns json
language plpgsql stable security definer set search_path = public as $$
declare
  l public.share_links;
begin
  select * into l from public._live_share_link(p_token);
  if l.id is null then
    return null;
  end if;
  return json_build_object(
    'label', l.label,
    'project', (select json_build_object('id', p.id::text, 'title', p.title, 'author_name', coalesce(p.author_name, ''), 'description', coalesce(p.description, ''))
                  from public.projects p where p.id = l.project_id),
    'chapters', coalesce((select json_agg(json_build_object('id', c.id::text, 'title', coalesce(c.title, ''), 'content', coalesce(c.content, ''), 'position', c.position) order by c.position)
                            from public.chapters c where c.project_id = l.project_id), '[]'::json)
  );
end
$$;

-- A reader's own comments, so they can come back to the link and find them.
create or replace function public.list_share_comments(p_token text, p_reader_key text)
returns json
language plpgsql stable security definer set search_path = public as $$
declare
  l public.share_links;
begin
  select * into l from public._live_share_link(p_token);
  if l.id is null then
    return '[]'::json;
  end if;
  return coalesce((select json_agg(json_build_object('id', c.id::text, 'chapter_id', c.chapter_id, 'chapter_title', c.chapter_title,
                                                      'quote', c.quote, 'note', c.note, 'reader_name', c.reader_name, 'created_at', c.created_at)
                                     order by c.created_at)
                     from public.share_comments c where c.link_id = l.id and c.reader_key = p_reader_key), '[]'::json);
end
$$;

create or replace function public.add_share_comment(p_token text, p_reader_key text, p_reader_name text, p_chapter_id text, p_quote text, p_note text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  l public.share_links;
  chapter_title text;
  new_row public.share_comments;
begin
  select * into l from public._live_share_link(p_token);
  if l.id is null then
    raise exception 'This reading link is no longer active.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_note), '') = '' or char_length(p_note) > 5000 then
    raise exception 'A comment needs some text, up to 5000 characters.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_reader_name), '') = '' or char_length(p_reader_name) > 80 or coalesce(trim(p_reader_key), '') = '' or char_length(p_reader_key) > 80 then
    raise exception 'Please add your name first.' using errcode = 'P0001';
  end if;
  select c.title into chapter_title from public.chapters c where c.id::text = p_chapter_id and c.project_id = l.project_id;
  if not found then
    raise exception 'That chapter is not part of this manuscript.' using errcode = 'P0001';
  end if;
  -- A generous ceiling per link, so a leaked link cannot be used to flood the author
  if (select count(*) from public.share_comments where link_id = l.id) >= 2000 then
    raise exception 'This link has reached its comment limit.' using errcode = 'P0001';
  end if;
  insert into public.share_comments (link_id, project_id, chapter_id, chapter_title, reader_key, reader_name, quote, note)
  values (l.id, l.project_id, p_chapter_id, coalesce(chapter_title, ''), p_reader_key, trim(p_reader_name), left(coalesce(p_quote, ''), 1000), trim(p_note))
  returning * into new_row;
  return json_build_object('id', new_row.id::text, 'chapter_id', new_row.chapter_id, 'chapter_title', new_row.chapter_title, 'quote', new_row.quote,
                           'note', new_row.note, 'reader_name', new_row.reader_name, 'created_at', new_row.created_at);
end
$$;

create or replace function public.delete_share_comment(p_token text, p_reader_key text, p_comment_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  l public.share_links;
  n integer;
begin
  select * into l from public._live_share_link(p_token);
  if l.id is null then
    return false;
  end if;
  delete from public.share_comments where id = p_comment_id and link_id = l.id and reader_key = p_reader_key;
  get diagnostics n = row_count;
  return n > 0;
end
$$;

-- Only the three reader-facing functions are open to the public; the helper stays private.
revoke all on function public._live_share_link(text) from public, anon, authenticated;
revoke all on function public.get_shared_manuscript(text) from public;
revoke all on function public.list_share_comments(text, text) from public;
revoke all on function public.add_share_comment(text, text, text, text, text, text) from public;
revoke all on function public.delete_share_comment(text, text, uuid) from public;
grant execute on function public.get_shared_manuscript(text) to anon, authenticated;
grant execute on function public.list_share_comments(text, text) to anon, authenticated;
grant execute on function public.add_share_comment(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.delete_share_comment(text, text, uuid) to anon, authenticated;

commit;

-- Check it worked: this should list six tables.
-- select table_name from information_schema.tables
--  where table_schema = 'public'
--    and table_name in ('chapter_notes','project_settings','chapter_snapshots','deleted_chapters','share_links','share_comments');
