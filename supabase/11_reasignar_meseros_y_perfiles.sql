-- =====================================================================
-- 11 · Reasignar mesas entre meseros + auto-crear perfiles faltantes
-- ---------------------------------------------------------------------
-- Parche idempotente para bases ya creadas. En un bootstrap nuevo esto
-- ya queda incluido en 01_schema_bootstrap.sql.
--
-- Qué hace:
--   1. Permite que cada usuario CREE su propia fila en `perfiles` (faltaba
--      la política INSERT; por eso cuentas antiguas sin fila no podían
--      guardar foto/nombre con upsert).
--   2. Backfill: crea `perfiles` para usuarios de auth que no la tengan.
--   3. RPCs para que recepción/gerencia reasigne mesas de un mesero a otro
--      (caso: un mesero se siente mal y pasa sus mesas a otro).
-- =====================================================================

-- 1) Política para que cada quien pueda crear su propia fila de perfil.
DROP POLICY IF EXISTS perfiles_insert_propios ON public.perfiles;
CREATE POLICY perfiles_insert_propios ON public.perfiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- 2) Backfill de perfiles faltantes (cuentas creadas antes del trigger).
INSERT INTO public.perfiles (id, nombre_completo)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = u.id);

-- 3) Reasignar UNA mesa a otro mesero.
CREATE OR REPLACE FUNCTION public.personal_reasignar_mesa(p_id_mesa uuid, p_id_mesero uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.personal
    WHERE id_usuario = auth.uid() AND activo = true AND rol IN ('anfitrion', 'gerente')
  ) THEN
    RAISE EXCEPTION 'Solo recepción o gerencia puede reasignar mesas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.personal WHERE id = p_id_mesero AND activo = true AND rol = 'mesero'
  ) THEN
    RAISE EXCEPTION 'El mesero destino no es válido';
  END IF;

  UPDATE public.mesas
  SET id_personal_atendiendo = p_id_mesero, actualizado_en = now()
  WHERE id = p_id_mesa AND estado IN ('ocupada', 'reservada');
END;
$function$;

-- 4) Reasignar TODAS las mesas de un mesero a otro (mesero indispuesto).
CREATE OR REPLACE FUNCTION public.personal_reasignar_mesero(p_origen uuid, p_destino uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.personal
    WHERE id_usuario = auth.uid() AND activo = true AND rol IN ('anfitrion', 'gerente')
  ) THEN
    RAISE EXCEPTION 'Solo recepción o gerencia puede reasignar mesas';
  END IF;

  IF p_origen = p_destino THEN
    RAISE EXCEPTION 'El mesero origen y destino no pueden ser el mismo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.personal WHERE id = p_destino AND activo = true AND rol = 'mesero'
  ) THEN
    RAISE EXCEPTION 'El mesero destino no es válido';
  END IF;

  UPDATE public.mesas
  SET id_personal_atendiendo = p_destino, actualizado_en = now()
  WHERE id_personal_atendiendo = p_origen AND estado IN ('ocupada', 'reservada');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.personal_reasignar_mesa(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_reasignar_mesero(uuid, uuid) TO authenticated;
