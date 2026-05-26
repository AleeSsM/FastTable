-- =============================================================================
-- Cierre de servicio unificado (comensal o mesero) y pedidos sin mezclar visitas
-- Ejecutar en SQL Editor si ya tienes 05_servicios_mesa_mesero_pedidos.sql aplicado.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.terminar_servicio_en_mesa(p_id_mesa uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM 1 FROM public.mesas m WHERE m.id = p_id_mesa FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mesa_no_encontrada';
  END IF;

  PERFORM public.cerrar_servicio_mesa_activo(p_id_mesa);

  UPDATE public.fila_espera f
  SET estado = 'cancelado',
      cancelado_en = now()
  WHERE f.id_mesa_asignada = p_id_mesa
    AND f.estado = 'sentado';

  UPDATE public.reservas_mesa rm
  SET comensal_llego = false
  WHERE rm.id_mesa = p_id_mesa
    AND rm.ciclo = 'completada'
    AND rm.comensal_llego IS TRUE;

  UPDATE public.mesas m
  SET estado = 'libre',
      id_personal_atendiendo = NULL,
      actualizado_en = now()
  WHERE m.id = p_id_mesa;
END;
$function$;

CREATE OR REPLACE FUNCTION public.asegurar_servicio_mesa_activo(p_id_mesa uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id uuid;
  v_staff uuid;
  v_reserva uuid;
  v_fila uuid;
  v_uid uuid;
  v_invitado text;
BEGIN
  SELECT sv.id INTO v_id
  FROM public.servicios_mesa sv
  WHERE sv.id_mesa = p_id_mesa AND sv.estado = 'activo'
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  IF (SELECT m.estado FROM public.mesas m WHERE m.id = p_id_mesa) IS DISTINCT FROM 'ocupada' THEN
    RAISE EXCEPTION 'mesa_no_ocupada_servicio';
  END IF;

  SELECT p.id INTO v_staff
  FROM public.personal p
  WHERE p.id_usuario = auth.uid() AND p.activo = true
  LIMIT 1;

  SELECT rm.id, rm.id_usuario
  INTO v_reserva, v_uid
  FROM public.reservas_mesa rm
  INNER JOIN public.mesas m ON m.id = rm.id_mesa
  WHERE rm.id_mesa = p_id_mesa
    AND rm.ciclo = 'completada'
    AND rm.comensal_llego IS TRUE
    AND m.estado = 'ocupada'
  ORDER BY rm.creado_en DESC
  LIMIT 1;

  IF v_reserva IS NULL THEN
    SELECT f.id, f.id_usuario, f.nombre_cliente
    INTO v_fila, v_uid, v_invitado
    FROM public.fila_espera f
    INNER JOIN public.mesas m ON m.id = f.id_mesa_asignada
    WHERE f.id_mesa_asignada = p_id_mesa
      AND f.estado = 'sentado'
      AND m.estado = 'ocupada'
    ORDER BY f.sentado_en DESC NULLS LAST, f.unido_en DESC
    LIMIT 1;
  END IF;

  INSERT INTO public.servicios_mesa (
    id_mesa, id_usuario, id_reserva_mesa, id_fila_espera, nombre_invitado, id_personal_apertura, estado
  )
  VALUES (p_id_mesa, v_uid, v_reserva, v_fila, v_invitado, v_staff, 'activo')
  RETURNING id INTO v_id;

  -- Solo pedidos de la sesión actual (misma reserva o misma fila), nunca mezclar visitas anteriores
  IF v_reserva IS NOT NULL THEN
    UPDATE public.pedidos_cocina pc
    SET id_servicio_mesa = v_id
    WHERE pc.id_mesa = p_id_mesa
      AND pc.id_servicio_mesa IS NULL
      AND pc.id_reserva_mesa = v_reserva;
  ELSIF v_fila IS NOT NULL THEN
    UPDATE public.pedidos_cocina pc
    SET id_servicio_mesa = v_id
    WHERE pc.id_mesa = p_id_mesa
      AND pc.id_servicio_mesa IS NULL
      AND pc.id_fila_espera = v_fila;
  END IF;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.personal_liberar_mesa_atendida(p_id_mesa uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_staff_id uuid;
  v_asignado uuid;
BEGIN
  IF NOT public.es_personal_activo() THEN RAISE EXCEPTION 'solo_personal'; END IF;
  SELECT p.id INTO v_staff_id FROM public.personal AS p WHERE p.id_usuario = auth.uid() AND p.activo = true LIMIT 1;
  IF v_staff_id IS NULL THEN RAISE EXCEPTION 'sin_personal'; END IF;

  PERFORM 1 FROM public.mesas AS m WHERE m.id = p_id_mesa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_encontrada'; END IF;

  SELECT m.id_personal_atendiendo INTO v_asignado FROM public.mesas AS m WHERE m.id = p_id_mesa;
  IF v_asignado IS NULL OR v_asignado <> v_staff_id THEN
    RAISE EXCEPTION 'no_tu_mesa';
  END IF;
  IF (SELECT m.estado FROM public.mesas AS m WHERE m.id = p_id_mesa) IS DISTINCT FROM 'ocupada' THEN
    RAISE EXCEPTION 'solo_ocupada_liberar';
  END IF;

  PERFORM public.terminar_servicio_en_mesa(p_id_mesa);
END;
$function$;

CREATE OR REPLACE FUNCTION public.comensal_terminar_servicio()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_mesa uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'no_autenticado'; END IF;

  SELECT rm.id_mesa INTO v_mesa
  FROM public.reservas_mesa rm
  INNER JOIN public.mesas m ON m.id = rm.id_mesa
  WHERE rm.id_usuario = v_uid AND rm.ciclo = 'completada' AND rm.comensal_llego IS TRUE AND m.estado = 'ocupada'
  ORDER BY rm.creado_en DESC LIMIT 1;

  IF v_mesa IS NULL THEN
    SELECT f.id_mesa_asignada INTO v_mesa
    FROM public.fila_espera f
    INNER JOIN public.mesas m ON m.id = f.id_mesa_asignada
    WHERE f.id_usuario = v_uid AND f.estado = 'sentado' AND f.id_mesa_asignada IS NOT NULL AND m.estado = 'ocupada'
    ORDER BY f.sentado_en DESC NULLS LAST, f.unido_en DESC LIMIT 1;
  END IF;

  IF v_mesa IS NULL THEN RAISE EXCEPTION 'sin_mesa_activa_para_terminar'; END IF;

  PERFORM public.terminar_servicio_en_mesa(v_mesa);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.terminar_servicio_en_mesa(uuid) TO authenticated;

COMMIT;
