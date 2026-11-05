SET local check_function_bodies = off;

CREATE TABLE "public"."chapter_notes" (
  "chapter_id" uuid                     NOT NULL,
  "project_id" uuid                     NOT NULL,
  "status"     text                     NOT NULL DEFAULT 'draft'::text,
  "synopsis"   text                     NOT NULL DEFAULT ''::text,
  "notes"      text                     NOT NULL DEFAULT ''::text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chapter_notes_pkey" PRIMARY KEY (chapter_id),
  CONSTRAINT "chapter_notes_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'revising'::text, 'done'::text])))
);

ALTER TABLE "public"."chapter_notes"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."chapter_notes" FROM "anon";

CREATE TABLE "public"."chapter_snapshots" (
  "id"         bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "chapter_id" uuid                     NOT NULL,
  "project_id" uuid                     NOT NULL,
  "title"      text                     NOT NULL DEFAULT ''::text,
  "content"    text                     NOT NULL DEFAULT ''::text,
  "words"      integer                  NOT NULL DEFAULT 0,
  "reason"     text                     NOT NULL DEFAULT 'auto'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chapter_snapshots_pkey" PRIMARY KEY (id),
  CONSTRAINT "chapter_snapshots_reason_check" CHECK ((reason = ANY (ARRAY['session'::text, 'auto'::text, 'manual'::text, 'before-restore'::text, 'deleted'::text])))
);

ALTER TABLE "public"."chapter_snapshots"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."chapter_snapshots" FROM "anon";

CREATE TABLE "public"."chapters" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id" uuid                     NOT NULL,
  "title"      text                     NOT NULL,
  "content"    text                     NOT NULL DEFAULT ''::text,
  "position"   integer                  NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chapters_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."chapters"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."chat_messages" (
  "id"          uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "sender_id"   uuid,
  "receiver_id" uuid,
  "content"     text                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."chat_messages"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."comments" (
  "id"         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "project_id" uuid,
  "chapter_id" uuid,
  "user_id"    uuid,
  "content"    text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "comments_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."comments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."deleted_chapters" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id" uuid                     NOT NULL,
  "title"      text                     NOT NULL DEFAULT ''::text,
  "content"    text                     NOT NULL DEFAULT ''::text,
  "position"   integer                  NOT NULL DEFAULT 0,
  "meta"       jsonb,
  "deleted_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "deleted_chapters_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."deleted_chapters"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."deleted_chapters" FROM "anon";

CREATE TABLE "public"."entities" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id"  uuid                     NOT NULL,
  "name"        text                     NOT NULL,
  "type"        text                     NOT NULL,
  "description" text,
  "content"     jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "image_url"   text,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "entities_pkey" PRIMARY KEY (id),
  CONSTRAINT "entities_type_check" CHECK ((type = ANY (ARRAY['character'::text, 'location'::text, 'item'::text, 'lore'::text, 'scene'::text])))
);

ALTER TABLE "public"."entities"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"                 uuid    NOT NULL,
  "display_name"       text,
  "bio"                text,
  "daily_word_goal"    integer DEFAULT 1000,
  "followers"          text[]  DEFAULT '{}'::text[],
  "following"          text[]  DEFAULT '{}'::text[],
  "tutorial_completed" boolean DEFAULT false,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."project_settings" (
  "project_id"    uuid                     NOT NULL,
  "goal_words"    integer,
  "goal_deadline" date,
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "project_settings_goal_words_check" CHECK (((goal_words IS NULL) OR (goal_words > 0))),
  CONSTRAINT "project_settings_pkey" PRIMARY KEY (project_id)
);

ALTER TABLE "public"."project_settings"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."project_settings" FROM "anon";

CREATE TABLE "public"."projects" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      text                     NOT NULL DEFAULT 'anonymous'::text,
  "title"        text                     NOT NULL,
  "description"  text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "is_published" boolean                  DEFAULT false,
  "author_name"  text,
  "cover_url"    text,
  "likes"        text[]                   DEFAULT '{}'::text[],
  "genre"        text,
  "views"        text[]                   DEFAULT '{}'::text[],
  CONSTRAINT "projects_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."projects"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."reports" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "reporter_id"    text                     NOT NULL,
  "target_type"    text                     NOT NULL,
  "target_id"      text                     NOT NULL,
  "target_user_id" text,
  "project_id"     text,
  "reason"         text                     NOT NULL,
  "details"        text                     NOT NULL DEFAULT ''::text,
  "excerpt"        text                     NOT NULL DEFAULT ''::text,
  "status"         text                     NOT NULL DEFAULT 'open'::text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "resolved_at"    timestamp with time zone,
  CONSTRAINT "reports_details_check" CHECK ((char_length(details) <= 2000)),
  CONSTRAINT "reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "reports_reason_check" CHECK ((reason = ANY (ARRAY['spam'::text, 'harassment'::text, 'sexual'::text, 'violence'::text, 'copyright'::text, 'other'::text]))),
  CONSTRAINT "reports_reporter_id_target_type_target_id_key" UNIQUE (reporter_id, target_type, target_id),
  CONSTRAINT "reports_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'actioned'::text, 'dismissed'::text]))),
  CONSTRAINT "reports_target_type_check" CHECK ((target_type = ANY (ARRAY['novel'::text, 'comment'::text, 'review'::text, 'message'::text, 'author'::text])))
);

ALTER TABLE "public"."reports"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."reports" FROM "anon";

CREATE TABLE "public"."reviews" (
  "id"         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "project_id" uuid,
  "user_id"    uuid,
  "rating"     integer                  NOT NULL,
  "content"    text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "reviews_pkey" PRIMARY KEY (id),
  CONSTRAINT "reviews_rating_check" CHECK (((rating >= 1) AND (rating <= 5)))
);

ALTER TABLE "public"."reviews"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."share_comments" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "link_id"       uuid                     NOT NULL,
  "project_id"    uuid                     NOT NULL,
  "chapter_id"    text                     NOT NULL,
  "chapter_title" text                     NOT NULL DEFAULT ''::text,
  "reader_key"    text                     NOT NULL,
  "reader_name"   text                     NOT NULL,
  "quote"         text                     NOT NULL DEFAULT ''::text,
  "note"          text                     NOT NULL,
  "status"        text                     NOT NULL DEFAULT 'open'::text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "share_comments_note_check" CHECK (((char_length(note) >= 1) AND (char_length(note) <= 5000))),
  CONSTRAINT "share_comments_pkey" PRIMARY KEY (id),
  CONSTRAINT "share_comments_quote_check" CHECK ((char_length(quote) <= 1000)),
  CONSTRAINT "share_comments_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'done'::text])))
);

ALTER TABLE "public"."share_comments"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."share_comments" FROM "anon";

CREATE TABLE "public"."share_links" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id" uuid                     NOT NULL,
  "token"      text                     NOT NULL DEFAULT replace(((gen_random_uuid())::text || (gen_random_uuid())::text), '-'::text, ''::text),
  "label"      text                     NOT NULL DEFAULT ''::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "share_links_pkey" PRIMARY KEY (id),
  CONSTRAINT "share_links_token_key" UNIQUE (token)
);

ALTER TABLE "public"."share_links"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."share_links" FROM "anon";

CREATE TABLE "public"."user_blocks" (
  "blocker_id" text                     NOT NULL,
  "blocked_id" text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_blocks_check" CHECK ((blocker_id <> blocked_id)),
  CONSTRAINT "user_blocks_pkey" PRIMARY KEY (blocker_id, blocked_id)
);

ALTER TABLE "public"."user_blocks"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."user_blocks" FROM "anon";

CREATE TABLE "public"."word_count_logs" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id" uuid                     NOT NULL,
  "date"       date                     NOT NULL,
  "word_count" integer                  NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "unique_project_date" UNIQUE (project_id, date),
  CONSTRAINT "word_count_logs_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."word_count_logs"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  select coalesce(auth.jwt() ->> 'email', '') = 'aruhaadmin@novelist.com'
$function$;

REVOKE ALL ON FUNCTION "public"."_is_admin"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public._live_share_link (
  p_token text
)
  RETURNS public.share_links
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select l.* from public.share_links l
   where l.token = p_token and l.revoked_at is null and (l.expires_at is null or l.expires_at > now())
$function$;

REVOKE ALL ON FUNCTION "public"."_live_share_link"(text) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public._refuse_blocked_message()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."_refuse_blocked_message"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.add_share_comment (
  p_token       text,
  p_reader_key  text,
  p_reader_name text,
  p_chapter_id  text,
  p_quote       text,
  p_note        text
)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report (
  p_report_id uuid,
  p_action    text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."admin_resolve_report"(uuid, text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.delete_my_account()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth'
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."delete_my_account"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.delete_share_comment (
  p_token      text,
  p_reader_key text,
  p_comment_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_shared_manuscript (
  p_token text
)
  RETURNS json
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.list_share_comments (
  p_token      text,
  p_reader_key text
)
  RETURNS json
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.submit_report (
  p_type      text,
  p_target_id text,
  p_reason    text,
  p_details   text DEFAULT ''::text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."submit_report"(text, text, text, text) FROM PUBLIC, "anon";

ALTER TABLE "public"."chapter_notes"
  ADD CONSTRAINT "chapter_notes_chapter_id_fkey" FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;

ALTER TABLE "public"."chapter_snapshots"
  ADD CONSTRAINT "chapter_snapshots_chapter_id_fkey" FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;

ALTER TABLE "public"."chat_messages"
  ADD CONSTRAINT "chat_messages_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."chat_messages"
  ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."comments"
  ADD CONSTRAINT "comments_chapter_id_fkey" FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;

ALTER TABLE "public"."comments"
  ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."chapter_notes"
  ADD CONSTRAINT "chapter_notes_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."chapter_snapshots"
  ADD CONSTRAINT "chapter_snapshots_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."chapters"
  ADD CONSTRAINT "chapters_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."comments"
  ADD CONSTRAINT "comments_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."deleted_chapters"
  ADD CONSTRAINT "deleted_chapters_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."entities"
  ADD CONSTRAINT "entities_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."project_settings"
  ADD CONSTRAINT "project_settings_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."reviews"
  ADD CONSTRAINT "reviews_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."reviews"
  ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."share_comments"
  ADD CONSTRAINT "share_comments_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."share_comments"
  ADD CONSTRAINT "share_comments_link_id_fkey" FOREIGN KEY (link_id) REFERENCES public.share_links(id) ON DELETE CASCADE;

ALTER TABLE "public"."share_links"
  ADD CONSTRAINT "share_links_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."word_count_logs"
  ADD CONSTRAINT "word_count_logs_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE INDEX chapter_notes_project_idx ON public.chapter_notes USING btree (project_id);

CREATE INDEX chapter_snapshots_chapter_idx ON public.chapter_snapshots USING btree (chapter_id, created_at DESC);

CREATE INDEX chapter_snapshots_project_idx ON public.chapter_snapshots USING btree (project_id);

CREATE INDEX deleted_chapters_project_idx ON public.deleted_chapters USING btree (project_id, deleted_at DESC);

CREATE INDEX reports_status_idx ON public.reports USING btree (status, created_at DESC);

CREATE INDEX share_comments_link_idx ON public.share_comments USING btree (link_id, reader_key);

CREATE INDEX share_comments_project_idx ON public.share_comments USING btree (project_id, created_at);

CREATE INDEX share_links_project_idx ON public.share_links USING btree (project_id);

CREATE TRIGGER refuse_blocked_message
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public._refuse_blocked_message();

CREATE POLICY "owner_all" ON "public"."chapter_notes"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = chapter_notes.project_id) AND (p.user_id = (auth.uid())::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = chapter_notes.project_id) AND (p.user_id = (auth.uid())::text)))));

CREATE POLICY "owner_all" ON "public"."chapter_snapshots"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = chapter_snapshots.project_id) AND (p.user_id = (auth.uid())::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = chapter_snapshots.project_id) AND (p.user_id = (auth.uid())::text)))));

CREATE POLICY "Allow public delete" ON "public"."chapters"
  FOR DELETE
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow public insert" ON "public"."chapters"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

CREATE POLICY "Allow public read" ON "public"."chapters"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow public update" ON "public"."chapters"
  FOR UPDATE
  TO PUBLIC
  USING (true);

CREATE POLICY "Users can delete their own messages" ON "public"."chat_messages"
  FOR DELETE
  TO PUBLIC
  USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));

CREATE POLICY "Users can insert their own messages" ON "public"."chat_messages"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = sender_id));

CREATE POLICY "Users can read their own messages" ON "public"."chat_messages"
  FOR SELECT
  TO PUBLIC
  USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));

CREATE POLICY "Anyone can view comments" ON "public"."comments"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Users can delete their own comments" ON "public"."comments"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert comments" ON "public"."comments"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update their own comments" ON "public"."comments"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "owner_all" ON "public"."deleted_chapters"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = deleted_chapters.project_id) AND (p.user_id = (auth.uid())::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = deleted_chapters.project_id) AND (p.user_id = (auth.uid())::text)))));

CREATE POLICY "Allow public delete" ON "public"."entities"
  FOR DELETE
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow public insert" ON "public"."entities"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

CREATE POLICY "Allow public read" ON "public"."entities"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow public update" ON "public"."entities"
  FOR UPDATE
  TO PUBLIC
  USING (true);

CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Users can insert their own profile." ON "public"."profiles"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users can update their own profile." ON "public"."profiles"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = id));

CREATE POLICY "owner_all" ON "public"."project_settings"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_settings.project_id) AND (p.user_id = (auth.uid())::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_settings.project_id) AND (p.user_id = (auth.uid())::text)))));

CREATE POLICY "Allow public delete" ON "public"."projects"
  FOR DELETE
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow public insert" ON "public"."projects"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

CREATE POLICY "Allow public read" ON "public"."projects"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow public update" ON "public"."projects"
  FOR UPDATE
  TO PUBLIC
  USING (true);

CREATE POLICY "admin_read" ON "public"."reports"
  FOR SELECT
  TO "authenticated"
  USING (public._is_admin());

CREATE POLICY "Anyone can view reviews" ON "public"."reviews"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Users can delete their own reviews" ON "public"."reviews"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert reviews" ON "public"."reviews"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update their own reviews" ON "public"."reviews"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "owner_delete" ON "public"."share_comments"
  FOR DELETE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = share_comments.project_id) AND (p.user_id = (auth.uid())::text)))));

CREATE POLICY "owner_read" ON "public"."share_comments"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = share_comments.project_id) AND (p.user_id = (auth.uid())::text)))));

CREATE POLICY "owner_update" ON "public"."share_comments"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = share_comments.project_id) AND (p.user_id = (auth.uid())::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = share_comments.project_id) AND (p.user_id = (auth.uid())::text)))));

CREATE POLICY "owner_all" ON "public"."share_links"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = share_links.project_id) AND (p.user_id = (auth.uid())::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = share_links.project_id) AND (p.user_id = (auth.uid())::text)))));

CREATE POLICY "owner_all" ON "public"."user_blocks"
  FOR ALL
  TO "authenticated"
  USING ((blocker_id = (auth.uid())::text))
  WITH CHECK ((blocker_id = (auth.uid())::text));

CREATE POLICY "Allow public delete" ON "public"."word_count_logs"
  FOR DELETE
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow public insert" ON "public"."word_count_logs"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

CREATE POLICY "Allow public read" ON "public"."word_count_logs"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow public update" ON "public"."word_count_logs"
  FOR UPDATE
  TO PUBLIC
  USING (true);

GRANT EXECUTE ON FUNCTION "public"."_is_admin"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."_is_admin"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_is_admin"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_is_admin"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_live_share_link"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_live_share_link"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_live_share_link"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_refuse_blocked_message"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_refuse_blocked_message"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."_refuse_blocked_message"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_share_comment"(text, text, text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."add_share_comment"(text, text, text, text, text, text) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."add_share_comment"(text, text, text, text, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."add_share_comment"(text, text, text, text, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."add_share_comment"(text, text, text, text, text, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."admin_resolve_report"(uuid, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_resolve_report"(uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_resolve_report"(uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_resolve_report"(uuid, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."delete_my_account"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."delete_my_account"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_my_account"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_my_account"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."delete_share_comment"(text, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."delete_share_comment"(text, text, uuid) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."delete_share_comment"(text, text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_share_comment"(text, text, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_share_comment"(text, text, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_shared_manuscript"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_shared_manuscript"(text) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_shared_manuscript"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_shared_manuscript"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_shared_manuscript"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."list_share_comments"(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."list_share_comments"(text, text) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."list_share_comments"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."list_share_comments"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."list_share_comments"(text, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."submit_report"(text, text, text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."submit_report"(text, text, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_report"(text, text, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_report"(text, text, text, text) TO "service_role";

REVOKE ALL ON SEQUENCE "public"."chapter_snapshots_id_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."chapter_snapshots_id_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."chapter_snapshots_id_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."chapter_snapshots_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."chapter_snapshots_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."chapter_snapshots_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."chapter_snapshots_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."chapter_snapshots_id_seq" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chapter_notes" TO "authenticated";

REVOKE ALL ON TABLE "public"."chapter_notes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chapter_notes" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chapter_notes" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chapter_snapshots" TO "authenticated";

REVOKE ALL ON TABLE "public"."chapter_snapshots" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chapter_snapshots" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chapter_snapshots" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chapters" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."chapters" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chapters" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chapters" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chat_messages" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."chat_messages" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chat_messages" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chat_messages" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."comments" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."comments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."comments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."comments" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."deleted_chapters" TO "authenticated";

REVOKE ALL ON TABLE "public"."deleted_chapters" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."deleted_chapters" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."deleted_chapters" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."entities" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."entities" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."entities" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."entities" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."project_settings" TO "authenticated";

REVOKE ALL ON TABLE "public"."project_settings" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."project_settings" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."project_settings" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."projects" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."projects" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."projects" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."projects" TO "service_role";

REVOKE ALL ON TABLE "public"."reports" FROM "authenticated";

GRANT SELECT ON TABLE "public"."reports" TO "authenticated";

REVOKE ALL ON TABLE "public"."reports" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reports" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reports" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reviews" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."reviews" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reviews" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reviews" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."share_comments" TO "authenticated";

REVOKE ALL ON TABLE "public"."share_comments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."share_comments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."share_comments" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."share_links" TO "authenticated";

REVOKE ALL ON TABLE "public"."share_links" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."share_links" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."share_links" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_blocks" TO "authenticated";

REVOKE ALL ON TABLE "public"."user_blocks" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_blocks" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_blocks" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."word_count_logs" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."word_count_logs" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."word_count_logs" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."word_count_logs" TO "service_role";

