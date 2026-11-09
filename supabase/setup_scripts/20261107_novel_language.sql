-- The language a novel is written in.
--
-- Adds one column, projects.language: a two or three letter code such as 'en' or 'ms', or nothing for a novel whose language was never
-- chosen. A writer with the same story in two languages makes two novels, gives each its own language and publishes them one by one;
-- readers filter the library by language.
--
-- Nothing existing changes: every novel starts with no language, and the writer (or the app, when the novel is next published) sets it.
-- Who may change it is who may change the rest of a project's settings (the owner and co-authors; see 20261106_chapter_publishing.sql).
-- Needs none of the other setup scripts. Safe to run more than once, in any order with them.
-- supabase/rollback_novel_language.sql takes the permission away again and keeps the column and what is in it.

alter table public.projects add column if not exists language text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_language_format' and conrelid = 'public.projects'::regclass) then
    alter table public.projects add constraint projects_language_format check (language is null or language ~ '^[a-z]{2,3}$');
  end if;
end $$;

-- The chapter publishing script limits which columns can be written; this one is added to that list. (That script also adds it when it
-- is run after this one, so the order does not matter.)
grant update (language) on table public.projects to authenticated;
