-- Takes back what 20261106_cover_uploads.sql added: nobody can upload, replace or delete a cover any more.
--
-- It keeps the bucket and every file already in it, so covers that are in use keep showing. SQL cannot remove stored files safely (the
-- files themselves live outside the database); to clear them out, empty and delete the "covers" bucket under Storage in the dashboard.
-- A novel whose cover_url points at a file there would then show no cover until someone sets another.

drop policy if exists covers_read_own on storage.objects;
drop policy if exists covers_insert_own on storage.objects;
drop policy if exists covers_update_own on storage.objects;
drop policy if exists covers_delete_own on storage.objects;
