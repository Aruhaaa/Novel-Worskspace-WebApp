-- Cover images for novels, uploaded from the app instead of pasted as a link.
--
-- Makes one public storage bucket, "covers". Anyone may look at a cover (it is shown with a published novel), but a signed-in person
-- can only add, replace or delete files inside their own folder: the first part of every file name is their account id, for example
-- "6f0c.../a1b2....jpg". The bucket accepts only JPEG, PNG and WebP and nothing over 2 MB. (The app shrinks a picture to about 150 KB
-- before it is sent, so the limit is only a safety net.)
--
-- It does not touch any table of the app. Safe to run more than once. supabase/rollback_cover_uploads.sql takes the permissions away again.
-- Needs nothing from the earlier setup scripts.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Looking at a cover needs no policy: the bucket is public, so its files are served to everyone. These four let a signed-in person
-- work on their own folder only. (Deleting or replacing a file first looks it up, which is why the first one is needed.)
drop policy if exists covers_read_own on storage.objects;
create policy covers_read_own on storage.objects for select to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists covers_insert_own on storage.objects;
create policy covers_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists covers_update_own on storage.objects;
create policy covers_update_own on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists covers_delete_own on storage.objects;
create policy covers_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
