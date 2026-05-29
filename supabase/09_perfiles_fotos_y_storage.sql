-- =====================================================================
-- 09 · Fotos de perfil (comensales y personal) + bucket de avatares
-- ---------------------------------------------------------------------
-- Parche idempotente para bases ya creadas. En un bootstrap nuevo estas
-- columnas y el bucket ya quedan incluidos en 01_schema_bootstrap.sql.
--
-- Qué hace:
--   1. Agrega `foto_url` a `perfiles` (comensal) y a `personal` (trabajador).
--   2. Crea el bucket público `avatars` en Supabase Storage.
--   3. Define políticas: lectura pública; cada usuario solo escribe/borra
--      archivos dentro de su carpeta `<auth.uid()>/...`.
--
-- Las políticas existentes ya permiten:
--   · que el personal lea perfiles de comensales (perfiles_select_personal),
--   · que cada quien actualice su propio perfil / ficha de personal.
-- =====================================================================

ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Bucket público de avatares (lectura pública; subida controlada por RLS).
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Cualquiera puede VER los avatares (son fotos de perfil públicas).
DROP POLICY IF EXISTS avatars_lectura_publica ON storage.objects;
CREATE POLICY avatars_lectura_publica ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Cada usuario solo puede subir dentro de su propia carpeta `<uid>/...`.
DROP POLICY IF EXISTS avatars_insert_propio ON storage.objects;
CREATE POLICY avatars_insert_propio ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_update_propio ON storage.objects;
CREATE POLICY avatars_update_propio ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_delete_propio ON storage.objects;
CREATE POLICY avatars_delete_propio ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );
