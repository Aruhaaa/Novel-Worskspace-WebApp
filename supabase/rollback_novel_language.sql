-- Takes back what 20261107_novel_language.sql added: the language can no longer be changed and is no longer checked.
--
-- It keeps the column and every language already chosen, so nothing is lost and the script can be run again later. The website treats a
-- novel with a language but no way to change it as it always did, apart from showing the language. To remove the column too:
--   alter table public.projects drop column language;

alter table public.projects drop constraint if exists projects_language_format;
revoke update (language) on table public.projects from authenticated;
