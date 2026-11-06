-- Novelist Workspace: publish a novel one chapter at a time, and close the open access to projects and chapters
--
-- Run this AFTER 20261105_next_features.sql (it uses the project_role() function and the project_members table from it).
-- Safe to run more than once. Steps are in supabase/README.md ("Publish chapter by chapter").
--
-- WHAT IT DOES
--   1. chapters.published_at: empty means a draft. Chapters of novels that are already public are filled in on the FIRST run,
--      so nothing that readers can see today disappears.
--   2. A novel is listed in the library while at least one of its chapters is published (projects.is_published follows the chapters).
--      Turning a novel on from an older copy of the app (is_published = true with no chapter published) publishes all its chapters.
--   3. Only the owner can publish or unpublish a chapter (as in the app: publishing is the owner's). Co-authors and editors can still write in them.
--   4. The "Allow public read / insert / update / delete" policies on projects and chapters are REPLACED:
--        projects   anyone can read a listed novel; the owner and the people it is shared with can read it too;
--                   only the owner or a co-author can change it (but only the owner can publish); only the owner can delete it.
--        chapters   anyone can read a PUBLISHED chapter of a listed novel; the owner and the people it is shared with can read all;
--                   the owner, co-authors and editors can edit; the owner and co-authors can add and delete.
--   5. Likes and views are saved by two functions (toggle_project_like, record_project_view), because other people's likes and
--      views are no longer allowed to change a novel directly.
--
-- RUN IT ONLY AFTER the new version of the website is live. The new website works with or without this script; an old copy of the
-- website would stop saving likes and views, and could no longer change a project it does not own, once it has run.
-- supabase/rollback_chapter_publishing.sql puts the old open access back.
--
-- NOT CHANGED: entities, word_count_logs and the other tables still have their old open policies (see limit.md).

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. The column, and what is public today stays public
-- ---------------------------------------------------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chapters' and column_name = 'published_at') then
    alter table public.chapters add column published_at timestamptz;
    update public.chapters c
       set published_at = coalesce(c.created_at, now())
     where exists (select 1 from public.projects p where p.id = c.project_id and p.is_published = true);
  end if;
end
$$;

create index if not exists chapters_published_idx on public.chapters (project_id) where published_at is not null;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Who may publish, and keeping the library listing in step with the chapters
-- ---------------------------------------------------------------------------------------------------------------------

-- Anyone allowed to write in a chapter can save it; only the owner can change whether it is published.
-- (auth.uid() is empty for the dashboard and for the server's own functions, which are not held to this.)
create or replace function public._chapter_publish_guard()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  changing boolean;
begin
  if tg_op = 'INSERT' then
    changing := new.published_at is not null;
  else
    changing := new.published_at is distinct from old.published_at;
  end if;
  if changing and auth.uid() is not null and coalesce(public.project_role(new.project_id), '') <> 'owner' then
    raise exception 'Only the owner can publish or unpublish a chapter' using errcode = '42501';
  end if;
  return new;
end
$function$;

-- A novel is listed while at least one chapter is published
create or replace function public._chapter_sync_listing()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  pid uuid := coalesce(new.project_id, old.project_id);
  listed boolean;
begin
  -- Skip when this change came from the project's own trigger (it is already setting the project)
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  listed := exists (select 1 from public.chapters c where c.project_id = pid and c.published_at is not null);
  update public.projects set is_published = listed, updated_at = now() where id = pid and is_published is distinct from listed;
  return null;
end
$function$;

-- Turning a whole novel on (the "Publish novel" button, or an older copy of the app) publishes its chapters when none are
create or replace function public._project_publish_all()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
begin
  if new.is_published is true and old.is_published is not true
     and not exists (select 1 from public.chapters c where c.project_id = new.id and c.published_at is not null) then
    update public.chapters set published_at = now() where project_id = new.id and published_at is null;
  end if;
  return new;
end
$function$;

revoke all on function public._chapter_publish_guard() from public, anon, authenticated;
revoke all on function public._chapter_sync_listing() from public, anon, authenticated;
revoke all on function public._project_publish_all() from public, anon, authenticated;

drop trigger if exists chapter_publish_guard on public.chapters;
create trigger chapter_publish_guard before insert or update of published_at on public.chapters
  for each row execute function public._chapter_publish_guard();

drop trigger if exists chapter_sync_listing_ins on public.chapters;
create trigger chapter_sync_listing_ins after insert on public.chapters
  for each row when (new.published_at is not null) execute function public._chapter_sync_listing();

drop trigger if exists chapter_sync_listing_upd on public.chapters;
create trigger chapter_sync_listing_upd after update of published_at on public.chapters
  for each row when (new.published_at is distinct from old.published_at) execute function public._chapter_sync_listing();

drop trigger if exists chapter_sync_listing_del on public.chapters;
create trigger chapter_sync_listing_del after delete on public.chapters
  for each row when (old.published_at is not null) execute function public._chapter_sync_listing();

drop trigger if exists project_publish_all on public.projects;
create trigger project_publish_all before update of is_published on public.projects
  for each row execute function public._project_publish_all();

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Likes and views, saved by a function
-- ---------------------------------------------------------------------------------------------------------------------

create or replace function public.toggle_project_like(p_project uuid)
  returns public.projects
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  me text := auth.uid()::text;
  p public.projects;
begin
  if me is null then
    raise exception 'Sign in to like a novel' using errcode = '28000';
  end if;
  update public.projects
     set likes = case when me = any (coalesce(likes, '{}'::text[])) then array_remove(likes, me) else array_append(coalesce(likes, '{}'::text[]), me) end
   where id = p_project and (is_published = true or public.project_role(id) is not null)
   returning * into p;
  if not found then
    raise exception 'Novel not found' using errcode = 'P0002';
  end if;
  return p;
end
$function$;

create or replace function public.record_project_view(p_project uuid)
  returns public.projects
  language plpgsql
  security definer
  set search_path to 'public'
  as $function$
declare
  me text := auth.uid()::text;
  p public.projects;
begin
  if me is not null then
    update public.projects
       set views = array_append(coalesce(views, '{}'::text[]), me)
     where id = p_project and (is_published = true or public.project_role(id) is not null) and not (me = any (coalesce(views, '{}'::text[])))
     returning * into p;
  end if;
  if p.id is null then
    select * into p from public.projects where id = p_project and (is_published = true or (me is not null and public.project_role(id) is not null));
  end if;
  if p.id is null then
    raise exception 'Novel not found' using errcode = 'P0002';
  end if;
  return p;
end
$function$;

revoke all on function public.toggle_project_like(uuid) from public, anon;
revoke all on function public.record_project_view(uuid) from public;
grant execute on function public.toggle_project_like(uuid) to authenticated;
grant execute on function public.record_project_view(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Access to projects and chapters
-- ---------------------------------------------------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.chapters enable row level security;

drop policy if exists "Allow public delete" on public.projects;
drop policy if exists "Allow public insert" on public.projects;
drop policy if exists "Allow public read" on public.projects;
drop policy if exists "Allow public update" on public.projects;
drop policy if exists "Allow public delete" on public.chapters;
drop policy if exists "Allow public insert" on public.chapters;
drop policy if exists "Allow public read" on public.chapters;
drop policy if exists "Allow public update" on public.chapters;

drop policy if exists "projects_read_listed" on public.projects;
create policy "projects_read_listed" on public.projects for select to anon, authenticated
  using (is_published = true);
drop policy if exists "projects_read_mine" on public.projects;
create policy "projects_read_mine" on public.projects for select to authenticated
  using (user_id = auth.uid()::text or public.project_role(id) is not null);
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects for insert to authenticated
  with check (user_id = auth.uid()::text);
drop policy if exists "projects_update_authors" on public.projects;
create policy "projects_update_authors" on public.projects for update to authenticated
  using (public.project_role(id) in ('owner', 'coauthor'))
  with check (public.project_role(id) in ('owner', 'coauthor'));
drop policy if exists "projects_delete_owner" on public.projects;
create policy "projects_delete_owner" on public.projects for delete to authenticated
  using (user_id = auth.uid()::text);

drop policy if exists "chapters_read_published" on public.chapters;
create policy "chapters_read_published" on public.chapters for select to anon, authenticated
  using (published_at is not null and exists (select 1 from public.projects p where p.id = chapters.project_id and p.is_published = true));
drop policy if exists "chapters_read_members" on public.chapters;
create policy "chapters_read_members" on public.chapters for select to authenticated
  using (public.project_role(project_id) is not null);
drop policy if exists "chapters_insert_authors" on public.chapters;
create policy "chapters_insert_authors" on public.chapters for insert to authenticated
  with check (public.project_role(project_id) in ('owner', 'coauthor'));
drop policy if exists "chapters_update_writers" on public.chapters;
create policy "chapters_update_writers" on public.chapters for update to authenticated
  using (public.project_role(project_id) in ('owner', 'coauthor', 'editor'))
  with check (public.project_role(project_id) in ('owner', 'coauthor', 'editor'));
drop policy if exists "chapters_delete_authors" on public.chapters;
create policy "chapters_delete_authors" on public.chapters for delete to authenticated
  using (public.project_role(project_id) in ('owner', 'coauthor'));

-- Privileges: anyone may read; only signed-in people write. Likes, views and who owns a project are not written directly.
revoke all on table public.projects from anon, authenticated;
grant select on table public.projects to anon, authenticated;
grant insert on table public.projects to authenticated;
grant update (title, description, is_published, author_name, cover_url, genre, updated_at) on table public.projects to authenticated;
grant delete on table public.projects to authenticated;

revoke all on table public.chapters from anon, authenticated;
grant select on table public.chapters to anon, authenticated;
grant insert, update, delete on table public.chapters to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- To check what you have (read only):
--   select polname from pg_policy where polrelid in ('public.projects'::regclass, 'public.chapters'::regclass);
--   select count(*) filter (where published_at is not null) as published, count(*) as all_chapters from public.chapters;
-- ---------------------------------------------------------------------------------------------------------------------
