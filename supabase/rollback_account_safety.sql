-- Removes everything supabase/migrations/20261008_account_safety.sql added.
-- Reports and blocks are deleted. Nothing in your original tables is changed.

begin;

do $trg$
begin
  if to_regclass('public.chat_messages') is not null then
    drop trigger if exists refuse_blocked_message on public.chat_messages;
  end if;
end
$trg$;

drop function if exists public._refuse_blocked_message();
drop function if exists public.delete_my_account();
drop function if exists public.admin_resolve_report(uuid, text);
drop function if exists public.submit_report(text, text, text, text);
drop function if exists public._is_admin();

drop table if exists public.user_blocks;
drop table if exists public.reports;

commit;
