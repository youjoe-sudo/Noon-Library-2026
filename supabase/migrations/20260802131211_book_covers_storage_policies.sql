/*
# Storage policies for book-covers bucket

## Overview
Allow admins to upload book cover images and everyone to view them.

## Policies
- SELECT: public read (anon + authenticated) - covers are public
- INSERT/UPDATE/DELETE: admin only
*/

DROP POLICY IF EXISTS "book_covers_read" ON storage.objects;
CREATE POLICY "book_covers_read" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'book-covers');

DROP POLICY IF EXISTS "book_covers_admin_write" ON storage.objects;
CREATE POLICY "book_covers_admin_write" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'book-covers' AND public.is_admin()
  );

DROP POLICY IF EXISTS "book_covers_admin_update" ON storage.objects;
CREATE POLICY "book_covers_admin_update" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'book-covers' AND public.is_admin()
  ) WITH CHECK (
    bucket_id = 'book-covers' AND public.is_admin()
  );

DROP POLICY IF EXISTS "book_covers_admin_delete" ON storage.objects;
CREATE POLICY "book_covers_admin_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'book-covers' AND public.is_admin()
  );