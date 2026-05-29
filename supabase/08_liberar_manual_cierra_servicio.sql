-- =============================================================================
-- Arreglo de aislamiento: liberar una mesa con el toggle manual (anfitrión/gerente)
-- debe cerrar el servicio activo, generar su recibo, cancelar la fila sentada y
-- limpiar la reserva atendida. Antes solo ponía la mesa "libre", dejando el
-- servicio abierto: el siguiente comensal de esa mesa heredaba la cuenta del
-- anterior (mezcla de pedidos entre clientes).
-- Requiere 06_terminar_servicio_mesa_unificado.sql aplicado.
-- Ejecutar en SQL Editor.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.personal_marcar_mesa_libre_ocupada(p_id_mesa uuid, p_ocupar boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_staff_id uuid;
  v_staff_rol public.rol_personal;
  v_estado public.estado_mesa;
  v_asignado uuid;
BEGIN
  IF NOT public.es_personal_activo() THEN RAISE EXCEPTION 'solo_personal'; END IF;

  SELECT p.id, p.rol INTO v_staff_id, v_staff_rol FROM public.personal AS p WHERE p.id_usuario = auth.uid() AND p.activo = true LIMIT 1;
  IF v_staff_id IS NULL THEN RAISE EXCEPTION 'sin_personal'; END IF;
  IF v_staff_rol IS DISTINCT FROM 'anfitrion'::public.rol_personal
     AND v_staff_rol IS DISTINCT FROM 'gerente'::public.rol_personal THEN
    RAISE EXCEPTION 'solo_anfitrion_gerente';
  END IF;

  PERFORM 1 FROM public.mesas AS m WHERE m.id = p_id_mesa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_encontrada'; END IF;

  SELECT m.estado, m.id_personal_atendiendo
  INTO v_estado, v_asignado
  FROM public.mesas AS m WHERE m.id = p_id_mesa;

  IF v_estado = 'reservada' THEN
    RAISE EXCEPTION 'mesa_en_reserva_panel';
  END IF;

  IF p_ocupar THEN
    IF v_estado IS DISTINCT FROM 'libre' THEN
      RAISE EXCEPTION 'solo_libre_a_ocupada';
    END IF;
    EXECUTE
      'UPDATE public.mesas AS t SET estado = ''ocupada''::public.estado_mesa, id_personal_atendiendo = $1, actualizado_en = now() WHERE t.id = $2'
    USING v_staff_id, p_id_mesa;
  ELSE
    IF v_estado IS DISTINCT FROM 'ocupada' THEN
      RAISE EXCEPTION 'solo_ocupada_a_libre_toggle';
    END IF;
    IF v_asignado IS NOT NULL
       AND v_asignado IS DISTINCT FROM v_staff_id
       AND v_staff_rol IS DISTINCT FROM 'anfitrion'::public.rol_personal
       AND v_staff_rol IS DISTINCT FROM 'gerente'::public.rol_personal THEN
      RAISE EXCEPTION 'no_tu_mesa_toggle';
    END IF;
    -- Cierre completo: cierra el servicio activo y genera su recibo, cancela la
    -- fila sentada y limpia la reserva atendida. Evita mezclar clientes.
    PERFORM public.terminar_servicio_en_mesa(p_id_mesa);
  END IF;
END;
$function$;

COMMIT;
