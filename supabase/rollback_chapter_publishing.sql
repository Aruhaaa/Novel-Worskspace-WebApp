-- Undoes supabase/setup_scripts/20261106_chapter_publishing.sql
--
-- WARNING: this puts the OLD open access back: anyone with the website's public key can read, add, change and delete every project
-- and chapter, drafts included. Only do it if the new access rules stop something the app needs.
-- The column chapters.published_at is left in place (it holds which chapters were published). Nothing here deletes any of your writing.
-- Safe to run more than once.

drop trigger if exists chapter_publish_guard on public.chapters;
drop trigger if exists chapter_sync_listing_ins on public.chapters;
drop trigger if exists chapter_sync_listing_upd on public.chapters;
drop trigger if exists chapter_sync_listing_del on public.chapters;
drop trigger if exists project_publish_all on public.projects;

drop function if exists public._chapter_publish_guard();
drop function if exists public._chapter_sync_listing();
drop function if exists public._project_publish_all();
drop function if exists public.toggle_project_like(uuid);
drop function if exists public.record_project_view(uuid);

drop policy if exists "projects_read_listed" on public.projects;
drop policy if exists "projects_read_mine" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_authors" on public.projects;
drop policy if exists "projects_delete_owner" on public.projects;
drop policy if exists "chapters_read_published" on public.chapters;
drop policy if exists "chapters_read_members" on public.chapters;
drop policy if exists "chapters_insert_authors" on public.chapters;
drop policy if exists "chapters_update_writers" on public.chapters;
drop policy if exists "chapters_delete_authors" on public.chapters;

drop policy if exists "Allow public delete" on public.projects;
create policy "Allow public delete" on public.projects for delete to public using (true);
drop policy if exists "Allow public insert" on public.projects;
create policy "Allow public insert" on public.projects for insert to public with check (true);
drop policy if exists "Allow public read" on public.projects;
create policy "Allow public read" on public.projects for select to public using (true);
drop policy if exists "Allow public update" on public.projects;
create policy "Allow public update" on public.projects for update to public using (true);

drop policy if exists "Allow public delete" on public.chapters;
create policy "Allow public delete" on public.chapters for delete to public using (true);
drop policy if exists "Allow public insert" on public.chapters;
create policy "Allow public insert" on public.chapters for insert to public with check (true);
drop policy if exists "Allow public read" on public.chapters;
create policy "Allow public read" on public.chapters for select to public using (true);
drop policy if exists "Allow public update" on public.chapters;
create policy "Allow public update" on public.chapters for update to public using (true);

grant all on table public.projects to anon, authenticated;
grant all on table public.chapters to anon, authenticated;

-- To remove the column as well (this forgets which chapters were published; every chapter of a listed novel then shows again):
--   alter table public.chapters drop column if exists published_at;
