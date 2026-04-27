-- ============================================================================
-- Bucket для ассетов клубов (лого, обложка). Публичное чтение, write — только
-- для club_members, и только в свою папку <club_id>/.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('club-assets', 'club-assets', true)
ON CONFLICT (id) DO NOTHING;

-- SELECT — публично (любой может посмотреть лого клуба на витрине)
DROP POLICY IF EXISTS club_assets_select_public ON storage.objects;
CREATE POLICY club_assets_select_public ON storage.objects
  FOR SELECT USING (bucket_id = 'club-assets');

-- INSERT/UPDATE/DELETE — только club_members в свою папку
-- Path-format: <club_id>/<filename>
DROP POLICY IF EXISTS club_assets_insert_staff ON storage.objects;
CREATE POLICY club_assets_insert_staff ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'club-assets'
    AND public.is_club_member((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS club_assets_update_staff ON storage.objects;
CREATE POLICY club_assets_update_staff ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'club-assets'
    AND public.is_club_member((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS club_assets_delete_staff ON storage.objects;
CREATE POLICY club_assets_delete_staff ON storage.objects
  FOR DELETE USING (
    bucket_id = 'club-assets'
    AND public.is_club_member((string_to_array(name, '/'))[1]::uuid)
  );
