-- =============================================================================
-- FastTable — Servicios por mesa, pedidos del mesero y recibos al cerrar
-- Ejecutar en SQL Editor si el proyecto YA tiene 01_schema_bootstrap (y parches 02–04).
-- =============================================================================

BEGIN;

CREATE TYPE public.estado_servicio_mesa AS ENUM ('activo', 'cerrado');

CREATE TABLE IF NOT EXISTS public.servicios_mesa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_mesa UUID NOT NULL REFERENCES public.mesas (id) ON DELETE CASCADE,
  id_usuario UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  id_reserva_mesa UUID REFERENCES public.reservas_mesa (id) ON DELETE SET NULL,
  id_fila_espera UUID REFERENCES public.fila_espera (id) ON DELETE SET NULL,
  nombre_invitado TEXT,
  id_personal_apertura UUID REFERENCES public.personal (id) ON DELETE SET NULL,
  id_personal_cierre UUID REFERENCES public.personal (id) ON DELETE SET NULL,
  estado public.estado_servicio_mesa NOT NULL DEFAULT 'activo',
  total_centavos INT NOT NULL DEFAULT 0 CHECK (total_centavos >= 0),
  abierto_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrado_en TIMESTAMPTZ,
  CONSTRAINT chk_servicio_origen CHECK (
    NOT (id_reserva_mesa IS NOT NULL AND id_fila_espera IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS un_servicio_activo_por_mesa
  ON public.servicios_mesa (id_mesa)
  WHERE estado = 'activo';

CREATE INDEX IF NOT EXISTS idx_servicios_mesa_mesa_cerrado
  ON public.servicios_mesa (id_mesa, cerrado_en DESC NULLS LAST)
  WHERE estado = 'cerrado';

ALTER TABLE public.pedidos_cocina
  ADD COLUMN IF NOT EXISTS id_servicio_mesa UUID REFERENCES public.servicios_mesa (id) ON DELETE SET NULL;
ALTER TABLE public.pedidos_cocina
  ADD COLUMN IF NOT EXISTS id_personal_registro UUID REFERENCES public.personal (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_servicio ON public.pedidos_cocina (id_servicio_mesa);

CREATE OR REPLACE FUNCTION public.puede_ver_pedidos_mesa(p_id_mesa uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.es_personal_activo()
    AND EXISTS (SELECT 1 FROM public.mesas m WHERE m.id = p_id_mesa);
$function$;

DROP POLICY IF EXISTS pedidos_cocina_select ON public.pedidos_cocina;
CREATE POLICY pedidos_cocina_select ON public.pedidos_cocina FOR SELECT TO authenticated
  USING (
    id_usuario = auth.uid()
    OR public.es_cocina_o_gerente()
    OR public.puede_ver_pedidos_mesa(id_mesa)
  );

ALTER TABLE public.servicios_mesa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_select ON public.servicios_mesa;
CREATE POLICY servicios_select ON public.servicios_mesa FOR SELECT TO authenticated
  USING (
    id_usuario = auth.uid()
    OR public.es_personal_activo()
  );

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
    id_mesa,
    id_usuario,
    id_reserva_mesa,
    id_fila_espera,
    nombre_invitado,
    id_personal_apertura,
    estado
  )
  VALUES (
    p_id_mesa,
    v_uid,
    v_reserva,
    v_fila,
    v_invitado,
    v_staff,
    'activo'
  )
  RETURNING id INTO v_id;

  UPDATE public.pedidos_cocina pc
  SET id_servicio_mesa = v_id
  WHERE pc.id_mesa = p_id_mesa
    AND pc.id_servicio_mesa IS NULL
    AND (
      (v_reserva IS NOT NULL AND pc.id_reserva_mesa = v_reserva)
      OR (v_fila IS NOT NULL AND pc.id_fila_espera = v_fila)
      OR (v_reserva IS NULL AND v_fila IS NULL)
    );

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public._calcular_total_servicio(p_id_servicio uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(SUM(pc.cantidad * im.precio_centavos), 0)::int
  FROM public.pedidos_cocina pc
  INNER JOIN public.items_menu im ON im.id = pc.id_item_menu
  WHERE pc.id_servicio_mesa = p_id_servicio;
$function$;

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

  UPDATE public.servicios_mesa sv
  SET estado = 'cerrado',
      total_centavos = v_total,
      cerrado_en = now(),
      id_personal_cierre = v_staff
  WHERE sv.id = v_id;

  RETURN v_id;
END;
$function$;

-- Función interna compartida comensal + mesero (inventario / recetas)
CREATE OR REPLACE FUNCTION public.crear_pedido_cocina_interno(
  p_uid uuid,
  p_mesa uuid,
  p_item uuid,
  p_cantidad int,
  p_nota text,
  p_reserva uuid,
  p_fila uuid,
  p_servicio uuid,
  p_personal_registro uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_disp boolean;
  v_sin boolean;
  v_id uuid;
  v_id_receta uuid;
  r RECORD;
  v_need numeric;
  v_errors text[] := ARRAY[]::text[];
  v_err text;
BEGIN
  SELECT im.disponible, COALESCE(im.sin_stock, false)
  INTO v_disp, v_sin
  FROM public.items_menu im
  WHERE im.id = p_item
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_no_encontrado'; END IF;
  IF v_disp IS NOT TRUE THEN RAISE EXCEPTION 'item_no_disponible'; END IF;
  IF v_sin IS TRUE THEN RAISE EXCEPTION 'item_sin_stock'; END IF;

  SELECT rx.id INTO v_id_receta FROM public.recetas rx WHERE rx.id_item_menu = p_item LIMIT 1;

  IF v_id_receta IS NULL THEN
    INSERT INTO public.pedidos_cocina (
      id_mesa, id_usuario, id_item_menu, id_reserva_mesa, id_fila_espera,
      id_servicio_mesa, id_personal_registro, cantidad, nota_cliente, estado
    )
    VALUES (
      p_mesa, p_uid, p_item, p_reserva, p_fila, p_servicio, p_personal_registro,
      p_cantidad, NULLIF(trim(COALESCE(p_nota, '')), ''), 'pendiente'
    )
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri WHERE ri.id_receta = v_id_receta) THEN
    RAISE EXCEPTION 'item_sin_receta';
  END IF;

  FOR r IN
    SELECT ri.id_ingrediente, ri.cantidad_por_plato, i.nombre, i.cantidad_disponible, i.unidad_medida
    FROM public.receta_ingredientes ri
    INNER JOIN public.ingredientes i ON i.id = ri.id_ingrediente
    WHERE ri.id_receta = v_id_receta
    FOR UPDATE OF i
  LOOP
    v_need := r.cantidad_por_plato * p_cantidad::numeric;
    IF r.cantidad_disponible < v_need THEN
      v_errors := array_append(v_errors, format('%s: necesita %s %s, hay %s', r.nombre,
        trim(to_char(v_need, 'FM9999999999990.9999')), r.unidad_medida,
        trim(to_char(r.cantidad_disponible, 'FM9999999999990.9999'))));
    END IF;
  END LOOP;

  IF cardinality(v_errors) > 0 THEN
    v_err := array_to_string(v_errors, ' · ');
    RAISE EXCEPTION 'inventario_insuficiente: %', v_err;
  END IF;

  INSERT INTO public.pedidos_cocina (
    id_mesa, id_usuario, id_item_menu, id_reserva_mesa, id_fila_espera,
    id_servicio_mesa, id_personal_registro, cantidad, nota_cliente, estado
  )
  VALUES (
    p_mesa, p_uid, p_item, p_reserva, p_fila, p_servicio, p_personal_registro,
    p_cantidad, NULLIF(trim(COALESCE(p_nota, '')), ''), 'pendiente'
  )
  RETURNING id INTO v_id;

  FOR r IN
    SELECT ri.id_ingrediente, ri.cantidad_por_plato
    FROM public.receta_ingredientes ri WHERE ri.id_receta = v_id_receta
  LOOP
    v_need := r.cantidad_por_plato * p_cantidad::numeric;
    UPDATE public.ingredientes i SET cantidad_disponible = i.cantidad_disponible - v_need WHERE i.id = r.id_ingrediente;
    INSERT INTO public.movimientos_almacen (id_ingrediente, tipo, delta_cantidad, id_pedido_cocina, nota)
    VALUES (r.id_ingrediente, 'salida_pedido'::public.tipo_movimiento_almacen, -v_need, v_id, 'Consumo por pedido cocina');
  END LOOP;

  PERFORM public.refresh_items_menu_sin_stock_flags();
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.personal_crear_pedido_mesa(
  p_id_mesa uuid,
  p_id_item uuid,
  p_cantidad int,
  p_nota text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_staff_id uuid;
  v_staff_rol public.rol_personal;
  v_asignado uuid;
  v_servicio uuid;
  v_uid_pedido uuid;
  v_id_reserva uuid;
  v_id_fila uuid;
  v_id uuid;
BEGIN
  IF NOT public.es_personal_activo() THEN RAISE EXCEPTION 'solo_personal'; END IF;

  SELECT p.id, p.rol INTO v_staff_id, v_staff_rol
  FROM public.personal p
  WHERE p.id_usuario = auth.uid() AND p.activo = true
  LIMIT 1;
  IF v_staff_id IS NULL THEN RAISE EXCEPTION 'sin_personal'; END IF;

  IF p_cantidad IS NULL OR p_cantidad < 1 OR p_cantidad > 99 THEN
    RAISE EXCEPTION 'cantidad_invalida';
  END IF;

  PERFORM 1 FROM public.mesas m WHERE m.id = p_id_mesa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mesa_no_encontrada'; END IF;

  IF (SELECT m.estado FROM public.mesas m WHERE m.id = p_id_mesa) IS DISTINCT FROM 'ocupada' THEN
    RAISE EXCEPTION 'mesa_no_ocupada_pedido';
  END IF;

  SELECT m.id_personal_atendiendo INTO v_asignado FROM public.mesas m WHERE m.id = p_id_mesa;

  IF v_staff_rol = 'mesero'::public.rol_personal THEN
    IF v_asignado IS NULL OR v_asignado <> v_staff_id THEN
      RAISE EXCEPTION 'no_tu_mesa';
    END IF;
  END IF;

  v_servicio := public.asegurar_servicio_mesa_activo(p_id_mesa);

  SELECT sv.id_usuario, sv.id_reserva_mesa, sv.id_fila_espera
  INTO v_uid_pedido, v_id_reserva, v_id_fila
  FROM public.servicios_mesa sv
  WHERE sv.id = v_servicio;

  IF v_uid_pedido IS NULL THEN
    v_uid_pedido := auth.uid();
  END IF;

  SELECT public.crear_pedido_cocina_interno(
    v_uid_pedido,
    p_id_mesa,
    p_id_item,
    p_cantidad,
    p_nota,
    v_id_reserva,
    v_id_fila,
    v_servicio,
    v_staff_id
  ) INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.crear_pedido_cocina(p_id_item uuid, p_cantidad int, p_nota text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_mesa uuid;
  v_id_reserva uuid;
  v_id_fila uuid;
  v_servicio uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'no_autenticado'; END IF;
  IF p_cantidad IS NULL OR p_cantidad < 1 OR p_cantidad > 99 THEN RAISE EXCEPTION 'cantidad_invalida'; END IF;

  SELECT rm.id_mesa, rm.id INTO v_mesa, v_id_reserva
  FROM public.reservas_mesa rm
  INNER JOIN public.mesas m ON m.id = rm.id_mesa
  WHERE rm.id_usuario = v_uid AND rm.ciclo = 'completada' AND rm.comensal_llego IS TRUE AND m.estado = 'ocupada'
  ORDER BY rm.creado_en DESC LIMIT 1;

  IF v_mesa IS NULL THEN
    SELECT f.id_mesa_asignada, f.id INTO v_mesa, v_id_fila
    FROM public.fila_espera f
    INNER JOIN public.mesas m ON m.id = f.id_mesa_asignada
    WHERE f.id_usuario = v_uid AND f.estado = 'sentado' AND f.id_mesa_asignada IS NOT NULL AND m.estado = 'ocupada'
    ORDER BY f.sentado_en DESC NULLS LAST, f.unido_en DESC LIMIT 1;
  END IF;

  IF v_mesa IS NULL THEN RAISE EXCEPTION 'sin_mesa_para_pedidos'; END IF;

  v_servicio := public.asegurar_servicio_mesa_activo(v_mesa);

  RETURN public.crear_pedido_cocina_interno(
    v_uid, v_mesa, p_id_item, p_cantidad, p_nota, v_id_reserva, v_id_fila, v_servicio, NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mesa_cuenta_servicio_activo(p_id_mesa uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_servicio uuid;
  v_estado text;
  v_total int;
  r json;
BEGIN
  IF NOT (
    public.es_personal_activo()
    OR EXISTS (
      SELECT 1 FROM public.reservas_mesa rm
      WHERE rm.id_usuario = auth.uid() AND rm.id_mesa = p_id_mesa AND rm.ciclo = 'completada' AND rm.comensal_llego IS TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.fila_espera f
      WHERE f.id_usuario = auth.uid() AND f.id_mesa_asignada = p_id_mesa AND f.estado = 'sentado'
    )
  ) THEN
    RAISE EXCEPTION 'sin_acceso_cuenta_mesa';
  END IF;

  SELECT sv.id, sv.estado::text INTO v_servicio, v_estado
  FROM public.servicios_mesa sv
  WHERE sv.id_mesa = p_id_mesa AND sv.estado = 'activo'
  LIMIT 1;

  IF v_servicio IS NULL THEN
    RETURN json_build_object('servicio_id', NULL, 'estado', NULL, 'total_centavos', 0, 'lineas', '[]'::json);
  END IF;

  v_total := public._calcular_total_servicio(v_servicio);

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', pc.id,
        'cantidad', pc.cantidad,
        'nombre', im.nombre,
        'precio_unit_centavos', im.precio_centavos,
        'subtotal_centavos', pc.cantidad * im.precio_centavos,
        'registrado_por_mesero', (pc.id_personal_registro IS NOT NULL),
        'creado_en', pc.creado_en
      )
      ORDER BY pc.creado_en
    ),
    '[]'::json
  ) INTO r
  FROM public.pedidos_cocina pc
  INNER JOIN public.items_menu im ON im.id = pc.id_item_menu
  WHERE pc.id_servicio_mesa = v_servicio;

  RETURN json_build_object(
    'servicio_id', v_servicio,
    'estado', v_estado,
    'total_centavos', v_total,
    'lineas', r
  );
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

  PERFORM public.cerrar_servicio_mesa_activo(p_id_mesa);

  UPDATE public.fila_espera AS f
  SET estado = 'cancelado', cancelado_en = now()
  WHERE f.id_mesa_asignada = p_id_mesa AND f.estado = 'sentado';

  UPDATE public.reservas_mesa AS rm
  SET comensal_llego = false
  WHERE rm.id_mesa = p_id_mesa AND rm.ciclo = 'completada' AND rm.comensal_llego IS TRUE;

  UPDATE public.mesas AS t
  SET estado = 'libre',
      id_personal_atendiendo = NULL,
      actualizado_en = now()
  WHERE t.id = p_id_mesa;
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

  PERFORM public.cerrar_servicio_mesa_activo(v_mesa);

  UPDATE public.fila_espera
  SET estado = 'cancelado', cancelado_en = now()
  WHERE id_usuario = v_uid AND id_mesa_asignada = v_mesa AND estado = 'sentado';

  UPDATE public.reservas_mesa
  SET comensal_llego = false
  WHERE id_usuario = v_uid AND id_mesa = v_mesa AND ciclo = 'completada' AND comensal_llego IS TRUE;

  IF NOT EXISTS (
    SELECT 1 FROM public.fila_espera f WHERE f.id_mesa_asignada = v_mesa AND f.estado = 'sentado'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.reservas_mesa rm
    INNER JOIN public.mesas m ON m.id = rm.id_mesa
    WHERE rm.id_mesa = v_mesa AND rm.ciclo = 'completada' AND rm.comensal_llego IS TRUE AND m.estado = 'ocupada'
  ) THEN
    UPDATE public.mesas SET estado = 'libre', id_personal_atendiendo = NULL, actualizado_en = now() WHERE id = v_mesa;
  END IF;
END;
$function$;

DO $rt$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['servicios_mesa']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$rt$;

GRANT EXECUTE ON FUNCTION public.personal_crear_pedido_mesa(uuid, uuid, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mesa_cuenta_servicio_activo(uuid) TO authenticated;

COMMIT;
