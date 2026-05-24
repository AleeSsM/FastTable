-- Permite al gerente crear y eliminar mesas desde la app (admin).
-- Ejecutar en Supabase → SQL Editor si al crear mesa aparece
-- "violates row-level security policy for table mesas".
-- Idempotente: seguro ejecutar más de una vez.

DROP POLICY IF EXISTS mesas_insert_gerente ON public.mesas;
CREATE POLICY mesas_insert_gerente ON public.mesas
  FOR INSERT TO authenticated
  WITH CHECK (public.es_gerente());

DROP POLICY IF EXISTS mesas_delete_gerente ON public.mesas;
CREATE POLICY mesas_delete_gerente ON public.mesas
  FOR DELETE TO authenticated
  USING (public.es_gerente());
