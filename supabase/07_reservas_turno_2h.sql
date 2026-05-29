-- =============================================================================
-- Reservas por turno fijo de 2 horas (en vez de una sola reserva por día).
-- El comensal elige día y hora; el turno bloquea la mesa solo durante esas 2 h.
-- El anfitrión/gerente puede marcar "no llegó" (no-show) para liberar el turno.
-- Ejecutar en SQL Editor sobre una base ya inicializada.
-- =============================================================================

BEGIN;

-- Caduca reservas cuyo turno de 2 h ya terminó y nunca se sentaron, y libera la
-- mesa si ya no le queda ningún turno vigente. Evita que una mesa quede
-- "reservada" para siempre o que un cliente quede bloqueado por una reserva vieja.
CREATE OR REPLACE FUNCTION public.expirar_reservas_vencidas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.reservas_mesa rm
  SET ciclo = 'cancelada'
  WHERE rm.ciclo = 'activa'
    AND rm.comensal_llego IS NULL
    AND rm.fecha_hora_reserva + INTERVAL '2 hours' <= now();

  UPDATE public.mesas m
  SET estado = 'libre', actualizado_en = now()
  WHERE m.estado = 'reservada'
    AND NOT EXISTS (
      SELECT 1 FROM public.reservas_mesa r
      WHERE r.id_mesa = m.id
        AND r.ciclo = 'activa'
        AND r.comensal_llego IS NULL
        AND r.fecha_hora_reserva + INTERVAL '2 hours' > now()
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.crear_reserva_mesa(
  p_id_mesa uuid,
  p_fecha_hora timestamptz,
  p_personas_grupo int,
  p_nota text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'no_autenticado'; END IF;
  PERFORM public.expirar_reservas_vencidas();
  IF p_personas_grupo IS NULL OR p_personas_grupo < 1 THEN RAISE EXCEPTION 'grupo_invalido'; END IF;
  IF p_personas_grupo > (SELECT m.capacidad FROM public.mesas m WHERE m.id = p_id_mesa) THEN
    RAISE EXCEPTION 'grupo_excede_capacidad_mesa';
  END IF;
  IF p_fecha_hora <= now() THEN RAISE EXCEPTION 'debe_ser_futuro'; END IF;

  PERFORM 1 FROM public.mesas WHERE id = p_id_mesa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mesa_no_encontrada'; END IF;
  IF (SELECT estado FROM public.mesas WHERE id = p_id_mesa) = 'ocupada'::public.estado_mesa THEN
    RAISE EXCEPTION 'mesa_no_disponible';
  END IF;

  -- Cada reserva ocupa un turno fijo de 2 horas. No se permite otra reserva
  -- cuyo turno se solape con uno existente en la misma mesa. Dos turnos
  -- [a, a+2h) y [b, b+2h) se solapan si a < b+2h y b < a+2h.
  IF EXISTS (
    SELECT 1
    FROM public.reservas_mesa r
    WHERE r.id_mesa = p_id_mesa
      AND r.ciclo = 'activa'
      AND r.fecha_hora_reserva < p_fecha_hora + INTERVAL '2 hours'
      AND p_fecha_hora < r.fecha_hora_reserva + INTERVAL '2 hours'
  ) THEN
    RAISE EXCEPTION 'mesa_ya_reservada';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservas_mesa
    WHERE id_usuario = v_uid
      AND ciclo = 'activa'
      AND fecha_hora_reserva + INTERVAL '2 hours' > now()
  ) THEN
    RAISE EXCEPTION 'usuario_ya_tiene_reserva';
  END IF;

  INSERT INTO public.reservas_mesa (id_usuario, id_mesa, fecha_hora_reserva, personas_grupo, nota)
  VALUES (v_uid, p_id_mesa, p_fecha_hora, p_personas_grupo, NULLIF(trim(p_nota), ''))
  RETURNING id INTO v_id;

  UPDATE public.mesas AS t
  SET estado = (
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.reservas_mesa r
        WHERE r.id_mesa = p_id_mesa
          AND r.ciclo = 'activa'
          AND (r.fecha_hora_reserva AT TIME ZONE 'America/Mexico_City')::date
            <= (now() AT TIME ZONE 'America/Mexico_City')::date
      ) THEN 'reservada'::public.estado_mesa
      ELSE 'libre'::public.estado_mesa
    END
  ),
  actualizado_en = now()
  WHERE t.id = p_id_mesa;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.expirar_reservas_vencidas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_reserva_mesa(uuid, timestamptz, int, text) TO authenticated;

COMMIT;
