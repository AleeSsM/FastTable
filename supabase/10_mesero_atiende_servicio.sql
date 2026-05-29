-- =====================================================================
-- 10 · Mesero que atiende: visible para el comensal (en vivo y en recibo)
-- ---------------------------------------------------------------------
-- Parche idempotente para bases ya creadas. En un bootstrap nuevo esto
-- ya queda incluido en 01_schema_bootstrap.sql.
--
-- Qué hace:
--   1. Agrega `id_personal_atendio` a `servicios_mesa` (snapshot del mesero).
--   2. Al cerrar un servicio, copia el mesero asignado a la mesa (o quien
--      abrió/cerró) para que el recibo conserve quién atendió, aunque la
--      mesa ya se haya liberado.
--   3. RPC `comensal_mesa_mesero(p_id_mesa)`: el comensal sentado (o el
--      personal) obtiene nombre y foto del mesero asignado a su mesa.
--   4. RPC `comensal_mis_recibos()`: lista de recibos del comensal con el
--      mesero que atendió (nombre + foto), evitando el bloqueo de RLS de
--      `personal`.
-- =====================================================================

ALTER TABLE public.servicios_mesa
  ADD COLUMN IF NOT EXISTS id_personal_atendio UUID REFERENCES public.personal (id) ON DELETE SET NULL;

-- Recrea el cierre para guardar quién atendió antes de limpiar la mesa.
CREATE OR REPLACE FUNCTION public.cerrar_servicio_mesa_activo(p_id_mesa uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id uuid;
  v_total int;
  v_staff uuid;
  v_mesero uuid;
BEGIN
  SELECT sv.id INTO v_id
  FROM public.servicios_mesa sv
  WHERE sv.id_mesa = p_id_mesa AND sv.estado = 'activo'
  FOR UPDATE;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_total := public._calcular_total_servicio(v_id);

  SELECT p.id INTO v_staff
  FROM public.personal p
  WHERE p.id_usuario = auth.uid() AND p.activo = true
  LIMIT 1;

  -- Mesero asignado a la mesa en este momento (aún no se ha liberado).
  SELECT m.id_personal_atendiendo INTO v_mesero
  FROM public.mesas m
  WHERE m.id = p_id_mesa;

  UPDATE public.servicios_mesa sv
  SET estado = 'cerrado',
      total_centavos = v_total,
      cerrado_en = now(),
      id_personal_cierre = v_staff,
      id_personal_atendio = COALESCE(v_mesero, sv.id_personal_apertura, v_staff)
  WHERE sv.id = v_id;

  RETURN v_id;
END;
$function$;

-- Mesero asignado a la mesa, visible para el comensal sentado o el personal.
CREATE OR REPLACE FUNCTION public.comensal_mesa_mesero(p_id_mesa uuid)
RETURNS TABLE (id uuid, nombre_visible text, foto_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.id, p.nombre_visible, p.foto_url
  FROM public.mesas m
  JOIN public.personal p ON p.id = m.id_personal_atendiendo
  WHERE m.id = p_id_mesa
    AND (
      public.es_personal_activo()
      OR EXISTS (
        SELECT 1 FROM public.reservas_mesa rm
        WHERE rm.id_mesa = p_id_mesa
          AND rm.id_usuario = auth.uid()
          AND rm.ciclo = 'completada'
          AND rm.comensal_llego IS TRUE
      )
      OR EXISTS (
        SELECT 1 FROM public.fila_espera f
        WHERE f.id_mesa_asignada = p_id_mesa
          AND f.id_usuario = auth.uid()
          AND f.estado = 'sentado'
      )
    );
$function$;

-- Recibos del comensal con el mesero que atendió (sortea el RLS de personal).
CREATE OR REPLACE FUNCTION public.comensal_mis_recibos()
RETURNS TABLE (
  id uuid,
  total_centavos int,
  cerrado_en timestamptz,
  mesa_codigo text,
  mesero_nombre text,
  mesero_foto text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    sv.id,
    sv.total_centavos,
    sv.cerrado_en,
    m.codigo,
    p.nombre_visible,
    p.foto_url
  FROM public.servicios_mesa sv
  JOIN public.mesas m ON m.id = sv.id_mesa
  LEFT JOIN public.personal p
    ON p.id = COALESCE(sv.id_personal_atendio, sv.id_personal_cierre, sv.id_personal_apertura)
  WHERE sv.id_usuario = auth.uid()
    AND sv.estado = 'cerrado'
  ORDER BY sv.cerrado_en DESC NULLS LAST
  LIMIT 50;
$function$;

GRANT EXECUTE ON FUNCTION public.comensal_mesa_mesero(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comensal_mis_recibos() TO authenticated;
