-- Takes away everything that supabase/setup_scripts/20261105_next_features.sql added.
-- Nothing that existed before it (projects, chapters, profiles, messages and the rest) is changed. Notifications, read marks,
-- shared-project memberships and invitations, and the error log are deleted with their tables.
-- After running this the app carries on as it did before the setup: no bell, no unread counts, no shared projects.

do $$
begin
  if to_regclass('public.profiles') is not null then
    drop trigger if exists notify_on_follow on public.profiles;
  end if;
  if to_regclass('public.comments') is not null then
    drop trigger if exists notify_on_comment on public.comments;
  end if;
  if to_regclass('public.reviews') is not null then
    drop trigger if exists notify_on_review on public.reviews;
  end if;
  if to_regclass('public.share_comments') is not null then
    drop trigger if exists notify_on_share_comment on public.share_comments;
  end if;
  if to_regclass('public.chat_messages') is not null then
    drop trigger if exists notify_on_message on public.chat_messages;
  end if;
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "project members receive" on realtime.messages';
    execute 'drop policy if exists "project editors send" on realtime.messages';
  end if;
end
$$;

drop function if exists public.admin_clear_errors(text);
drop function if exists public.admin_error_groups(integer);
drop function if exists public.report_client_error(text, text, text, text, text, text, text, jsonb);
drop function if exists public.can_use_project_channel(text, boolean);
drop function if exists public.accept_project_invite(text);
drop function if exists public.preview_project_invite(text);
drop function if exists public.unread_message_counts();
drop function if exists public.mark_chat_read(uuid, timestamptz);
drop function if exists public.follow_user(uuid);
drop function if exists public._notify_on_message();
drop function if exists public._notify_on_share_comment();
drop function if exists public._notify_on_review();
drop function if exists public._notify_on_comment();
drop function if exists public._notify_on_follow();
drop function if exists public._notify(uuid, uuid, text, uuid, text, text, text, text, jsonb);

drop table if exists public.notification_emails;
drop table if exists public.client_errors;
drop table if exists public.project_invites;
drop table if exists public.project_members;
drop table if exists public.message_reads;
drop table if exists public.notification_settings;
drop table if exists public.notifications;

drop function if exists public.project_role(uuid);
drop function if exists public.is_project_owner(uuid);
drop function if exists public._display_name(uuid);
drop function if exists public._uuid_or_null(text);
