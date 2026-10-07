-- Undoes 20261003_cloud_sync.sql: removes the six tables and the reading-link functions it added.
-- Your projects, chapters and notebook are not touched. Everything stored in the new tables
-- (chapter notes, goals, version history, deleted-chapter copies, reading links and reader comments) is deleted.
-- Run it only if you want to remove the feature. The app falls back to keeping this data on the device.

begin;
drop function if exists public.delete_share_comment(text, text, uuid);
drop function if exists public.add_share_comment(text, text, text, text, text, text);
drop function if exists public.list_share_comments(text, text);
drop function if exists public.get_shared_manuscript(text);
drop function if exists public._live_share_link(text);
drop table if exists public.share_comments;
drop table if exists public.share_links;
drop table if exists public.deleted_chapters;
drop table if exists public.chapter_snapshots;
drop table if exists public.project_settings;
drop table if exists public.chapter_notes;
commit;
