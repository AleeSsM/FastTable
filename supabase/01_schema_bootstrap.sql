-- =============================================================================
-- FastTable — Bootstrap completo del esquema (Supabase SQL Editor)
-- Incluye: tipos, tablas, inventario/recetas, RLS, RPC, seed (menú, mesas, almacén),
-- reservas por día, sesión comensal por visita, Realtime.
-- 1) Opcional: ejecutar antes 00_schema_teardown.sql si ya existía FastTable.
-- 2) Pegar TODO este archivo y Run (no Explain). Transacción BEGIN…COMMIT.
-- 3) Crear usuarios demo en Auth; enlazar personal (ver supabase/README.md).
-- RLS: dejar activado; el SQL Editor corre con privilegios de administración del proyecto.
-- =============================================================================

BEGIN;

-- ========== Esquema ==========

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE public.estado_mesa AS ENUM ('libre', 'ocupada', 'reservada');
CREATE TYPE public.estado_fila AS ENUM ('esperando', 'sentado', 'cancelado');
CREATE TYPE public.estado_solicitud AS ENUM ('abierta', 'reconocida', 'cerrada');
CREATE TYPE public.rol_personal AS ENUM ('anfitrion', 'mesero', 'gerente', 'cocina');
CREATE TYPE public.ciclo_reserva AS ENUM ('activa', 'cancelada', 'completada');
CREATE TYPE public.estado_pedido_cocina AS ENUM ('pendiente', 'listo');
CREATE TYPE public.estado_servicio_mesa AS ENUM ('activo', 'cerrado');
CREATE TYPE public.tipo_movimiento_almacen AS ENUM ('entrada', 'salida_pedido', 'ajuste');

CREATE TABLE public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre_completo TEXT,
  telefono TEXT,
  foto_url TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.personal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre_visible TEXT NOT NULL,
  rol public.rol_personal NOT NULL DEFAULT 'mesero',
  codigo_empleado TEXT UNIQUE,
  foto_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_personal_id_usuario ON public.personal (id_usuario);

CREATE TABLE public.zonas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  id_zona UUID REFERENCES public.zonas (id) ON DELETE SET NULL,
  capacidad INT NOT NULL CHECK (capacidad > 0),
  estado public.estado_mesa NOT NULL DEFAULT 'libre',
  notas TEXT,
  descripcion_publica TEXT,
  imagen_url TEXT,
  id_personal_atendiendo UUID REFERENCES public.personal (id) ON DELETE SET NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mesas_zona ON public.mesas (id_zona);
CREATE INDEX idx_mesas_estado ON public.mesas (estado);
CREATE INDEX idx_mesas_personal_atendiendo ON public.mesas (id_personal_atendiendo);

CREATE TABLE public.fila_espera (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  nombre_cliente TEXT,
  personas_grupo INT NOT NULL CHECK (personas_grupo > 0),
  estado public.estado_fila NOT NULL DEFAULT 'esperando',
  nota TEXT,
  minutos_espera_estimados INT,
  unido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  sentado_en TIMESTAMPTZ,
  cancelado_en TIMESTAMPTZ,
  id_mesa_asignada UUID REFERENCES public.mesas (id) ON DELETE SET NULL
);

CREATE INDEX idx_fila_estado_unido ON public.fila_espera (estado, unido_en);
CREATE INDEX idx_fila_usuario ON public.fila_espera (id_usuario);

CREATE TABLE public.categorias_menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.items_menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_categoria UUID NOT NULL REFERENCES public.categorias_menu (id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio_centavos INT NOT NULL CHECK (precio_centavos >= 0),
  disponible BOOLEAN NOT NULL DEFAULT true,
  sin_stock BOOLEAN NOT NULL DEFAULT false,
  imagen_url TEXT,
  alergenos_json JSONB,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_menu_categoria ON public.items_menu (id_categoria);

CREATE TABLE public.solicitudes_servicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_mesa UUID REFERENCES public.mesas (id) ON DELETE SET NULL,
  id_usuario UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  mensaje TEXT,
  estado public.estado_solicitud NOT NULL DEFAULT 'abierta',
  id_personal_asignado UUID REFERENCES public.personal (id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_solicitudes_estado ON public.solicitudes_servicio (estado, creado_en);
CREATE INDEX idx_solicitudes_mesa ON public.solicitudes_servicio (id_mesa);

CREATE TABLE public.eventos_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_entidad TEXT NOT NULL,
  id_entidad UUID NOT NULL,
  accion TEXT NOT NULL,
  payload JSONB,
  id_personal UUID REFERENCES public.personal (id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auditoria_entidad ON public.eventos_auditoria (tipo_entidad, id_entidad);

CREATE TABLE public.reservas_mesa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  id_mesa UUID NOT NULL REFERENCES public.mesas (id) ON DELETE CASCADE,
  fecha_hora_reserva TIMESTAMPTZ NOT NULL,
  personas_grupo INT NOT NULL DEFAULT 2 CHECK (personas_grupo > 0),
  nota TEXT,
  ciclo public.ciclo_reserva NOT NULL DEFAULT 'activa',
  comensal_llego BOOLEAN,
  mesero_atender_a_partir_de TIMESTAMPTZ NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservas_usuario ON public.reservas_mesa (id_usuario);
CREATE INDEX idx_reservas_mesa ON public.reservas_mesa (id_mesa);
CREATE INDEX idx_reservas_cola ON public.reservas_mesa (ciclo, comensal_llego, mesero_atender_a_partir_de);

CREATE TABLE public.pedidos_cocina (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_mesa UUID NOT NULL REFERENCES public.mesas (id) ON DELETE CASCADE,
  id_usuario UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  id_item_menu UUID NOT NULL REFERENCES public.items_menu (id) ON DELETE CASCADE,
  id_reserva_mesa UUID REFERENCES public.reservas_mesa (id) ON DELETE SET NULL,
  id_fila_espera UUID REFERENCES public.fila_espera (id) ON DELETE SET NULL,
  id_servicio_mesa UUID,
  id_personal_registro UUID REFERENCES public.personal (id) ON DELETE SET NULL,
  cantidad INT NOT NULL CHECK (cantidad >= 1 AND cantidad <= 99),
  nota_cliente TEXT,
  estado public.estado_pedido_cocina NOT NULL DEFAULT 'pendiente',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  listo_en TIMESTAMPTZ,
  CONSTRAINT chk_pedido_origen_sesion CHECK (
    NOT (id_reserva_mesa IS NOT NULL AND id_fila_espera IS NOT NULL)
  )
);

CREATE INDEX idx_pedidos_cocina_estado ON public.pedidos_cocina (estado, creado_en);
CREATE INDEX idx_pedidos_cocina_mesa ON public.pedidos_cocina (id_mesa);
CREATE INDEX idx_pedidos_cocina_reserva ON public.pedidos_cocina (id_reserva_mesa) WHERE id_reserva_mesa IS NOT NULL;
CREATE INDEX idx_pedidos_cocina_fila ON public.pedidos_cocina (id_fila_espera) WHERE id_fila_espera IS NOT NULL;

CREATE TABLE public.servicios_mesa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_mesa UUID NOT NULL REFERENCES public.mesas (id) ON DELETE CASCADE,
  id_usuario UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  id_reserva_mesa UUID REFERENCES public.reservas_mesa (id) ON DELETE SET NULL,
  id_fila_espera UUID REFERENCES public.fila_espera (id) ON DELETE SET NULL,
  nombre_invitado TEXT,
  id_personal_apertura UUID REFERENCES public.personal (id) ON DELETE SET NULL,
  id_personal_cierre UUID REFERENCES public.personal (id) ON DELETE SET NULL,
  id_personal_atendio UUID REFERENCES public.personal (id) ON DELETE SET NULL,
  estado public.estado_servicio_mesa NOT NULL DEFAULT 'activo',
  total_centavos INT NOT NULL DEFAULT 0 CHECK (total_centavos >= 0),
  abierto_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrado_en TIMESTAMPTZ,
  CONSTRAINT chk_servicio_origen CHECK (
    NOT (id_reserva_mesa IS NOT NULL AND id_fila_espera IS NOT NULL)
  )
);

CREATE UNIQUE INDEX un_servicio_activo_por_mesa ON public.servicios_mesa (id_mesa) WHERE estado = 'activo';
CREATE INDEX idx_servicios_mesa_mesa_cerrado ON public.servicios_mesa (id_mesa, cerrado_en DESC NULLS LAST) WHERE estado = 'cerrado';
CREATE INDEX idx_pedidos_servicio ON public.pedidos_cocina (id_servicio_mesa);

ALTER TABLE public.pedidos_cocina
  ADD CONSTRAINT pedidos_cocina_id_servicio_mesa_fkey
  FOREIGN KEY (id_servicio_mesa) REFERENCES public.servicios_mesa (id) ON DELETE SET NULL;

CREATE TABLE public.ingredientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  cantidad_disponible NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
  unidad_medida TEXT NOT NULL CHECK (unidad_medida IN ('g', 'ml', 'piezas', 'unidades')),
  stock_minimo NUMERIC(14, 4) NULL CHECK (stock_minimo IS NULL OR stock_minimo >= 0),
  categoria TEXT NOT NULL DEFAULT 'Ingredientes'
    CHECK (categoria IN ('Bebidas', 'Alimentos', 'Ingredientes', 'Otros')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingredientes_nombre ON public.ingredientes (lower(nombre));
CREATE INDEX idx_ingredientes_categoria ON public.ingredientes (categoria);

CREATE TABLE public.recetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_item_menu UUID NOT NULL UNIQUE REFERENCES public.items_menu (id) ON DELETE CASCADE,
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recetas_item ON public.recetas (id_item_menu);

CREATE TABLE public.receta_ingredientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_receta UUID NOT NULL REFERENCES public.recetas (id) ON DELETE CASCADE,
  id_ingrediente UUID NOT NULL REFERENCES public.ingredientes (id) ON DELETE RESTRICT,
  cantidad_por_plato NUMERIC(14, 4) NOT NULL CHECK (cantidad_por_plato > 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_receta, id_ingrediente)
);

CREATE INDEX idx_receta_ing_receta ON public.receta_ingredientes (id_receta);
CREATE INDEX idx_receta_ing_ing ON public.receta_ingredientes (id_ingrediente);

CREATE TABLE public.movimientos_almacen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_ingrediente UUID NOT NULL REFERENCES public.ingredientes (id) ON DELETE CASCADE,
  tipo public.tipo_movimiento_almacen NOT NULL,
  delta_cantidad NUMERIC(14, 4) NOT NULL CHECK (delta_cantidad <> 0),
  id_pedido_cocina UUID NULL REFERENCES public.pedidos_cocina (id) ON DELETE SET NULL,
  nota TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_delta_sign CHECK (
    (tipo = 'entrada' AND delta_cantidad > 0)
    OR (tipo = 'salida_pedido' AND delta_cantidad < 0)
    OR (tipo = 'ajuste')
  )
);

CREATE INDEX idx_mov_almacen_ing ON public.movimientos_almacen (id_ingrediente, creado_en DESC);
CREATE INDEX idx_mov_almacen_pedido ON public.movimientos_almacen (id_pedido_cocina);

CREATE TABLE public.reportes_problema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre_usuario TEXT,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'revisado', 'cerrado')),
  id_personal_atendio UUID REFERENCES public.personal (id) ON DELETE SET NULL,
  mesero_nombre TEXT,
  correo_contacto TEXT,
  telefono_contacto TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reportes_estado_fecha ON public.reportes_problema (estado, creado_en DESC);
CREATE INDEX idx_reportes_usuario ON public.reportes_problema (id_usuario);

CREATE UNIQUE INDEX un_reserva_activa_por_usuario
  ON public.reservas_mesa (id_usuario)
  WHERE ciclo = 'activa';

CREATE OR REPLACE FUNCTION public.tr_reservas_mesa_calcular_atencion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.mesero_atender_a_partir_de := NEW.fecha_hora_reserva + INTERVAL '5 minutes';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_reservas_mesa_atencion ON public.reservas_mesa;
CREATE TRIGGER tr_reservas_mesa_atencion
  BEFORE INSERT OR UPDATE OF fecha_hora_reserva ON public.reservas_mesa
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_reservas_mesa_calcular_atencion();

CREATE OR REPLACE FUNCTION public.actualizar_marca_tiempo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER tr_perfiles_actualizado BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_marca_tiempo();
CREATE TRIGGER tr_personal_actualizado BEFORE UPDATE ON public.personal
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_marca_tiempo();
CREATE TRIGGER tr_items_menu_actualizado BEFORE UPDATE ON public.items_menu
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_marca_tiempo();

CREATE OR REPLACE FUNCTION public.tr_ingredientes_actualizado()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER tr_ingredientes_actualizado
  BEFORE UPDATE ON public.ingredientes
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_ingredientes_actualizado();

CREATE TRIGGER tr_mesas_actualizado BEFORE UPDATE ON public.mesas
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_marca_tiempo();

CREATE OR REPLACE FUNCTION public.tr_mesas_al_liberar_mesero()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.estado = 'libre' THEN
    NEW.id_personal_atendiendo := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_mesas_liberar_mesero ON public.mesas;
CREATE TRIGGER tr_mesas_liberar_mesero
  BEFORE UPDATE OF estado ON public.mesas
  FOR EACH ROW
  WHEN (NEW.estado IS DISTINCT FROM OLD.estado)
  EXECUTE FUNCTION public.tr_mesas_al_liberar_mesero();

CREATE TRIGGER tr_solicitudes_actualizado BEFORE UPDATE ON public.solicitudes_servicio
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_marca_tiempo();

CREATE OR REPLACE FUNCTION public.perfiles_tras_alta_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.perfiles (id, nombre_completo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_auth_alta_perfil ON auth.users;
CREATE TRIGGER tr_auth_alta_perfil
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.perfiles_tras_alta_usuario();

CREATE OR REPLACE FUNCTION public.es_personal_activo()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.personal p
    WHERE p.id_usuario = auth.uid() AND p.activo = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.puede_ver_solicitud_servicio(p_id_mesa uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN NOT EXISTS (
      SELECT 1 FROM public.personal p
      WHERE p.id_usuario = auth.uid() AND p.activo = true
    ) THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.personal p
      WHERE p.id_usuario = auth.uid() AND p.activo = true
      AND p.rol IS DISTINCT FROM 'mesero'::public.rol_personal
    ) THEN true
    WHEN p_id_mesa IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.mesas m
      INNER JOIN public.personal p ON p.id = m.id_personal_atendiendo
      WHERE m.id = p_id_mesa AND p.id_usuario = auth.uid() AND p.activo = true
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.es_cocina_o_gerente()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.personal p
    WHERE p.id_usuario = auth.uid() AND p.activo = true
    AND p.rol IN ('cocina'::public.rol_personal, 'gerente'::public.rol_personal)
  );
$function$;

CREATE OR REPLACE FUNCTION public.es_gerente()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.personal p
    WHERE p.id_usuario = auth.uid() AND p.activo = true AND p.rol = 'gerente'::public.rol_personal
  );
$function$;

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

CREATE OR REPLACE FUNCTION public.refresh_items_menu_sin_stock_flags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.items_menu im
  SET sin_stock = false,
      actualizado_en = now()
  WHERE NOT EXISTS (SELECT 1 FROM public.recetas r WHERE r.id_item_menu = im.id);

  UPDATE public.items_menu im
  SET sin_stock = EXISTS (
    SELECT 1
    FROM public.recetas r
    INNER JOIN public.receta_ingredientes ri ON ri.id_receta = r.id
    INNER JOIN public.ingredientes ing ON ing.id = ri.id_ingrediente
    WHERE r.id_item_menu = im.id
      AND ing.cantidad_disponible < ri.cantidad_por_plato
  ),
  actualizado_en = now()
  WHERE EXISTS (SELECT 1 FROM public.recetas r WHERE r.id_item_menu = im.id);
END;
$function$;

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fila_espera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_mesa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_cocina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes_problema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receta_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_almacen ENABLE ROW LEVEL SECURITY;

CREATE POLICY perfiles_select_propios ON public.perfiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY perfiles_update_propios ON public.perfiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY perfiles_insert_propios ON public.perfiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY perfiles_select_personal ON public.perfiles FOR SELECT TO authenticated
  USING (public.es_personal_activo());

CREATE POLICY personal_select ON public.personal FOR SELECT TO authenticated
  USING (id_usuario = auth.uid() OR public.es_personal_activo());
CREATE POLICY personal_update_propios ON public.personal FOR UPDATE USING (id_usuario = auth.uid());

CREATE POLICY zonas_select ON public.zonas FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY mesas_select ON public.mesas FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY mesas_update_personal ON public.mesas FOR UPDATE TO authenticated
  USING (public.es_personal_activo());
CREATE POLICY mesas_insert_gerente ON public.mesas FOR INSERT TO authenticated
  WITH CHECK (public.es_gerente());
CREATE POLICY mesas_delete_gerente ON public.mesas FOR DELETE TO authenticated
  USING (public.es_gerente());

CREATE POLICY fila_select ON public.fila_espera FOR SELECT
  USING (id_usuario = auth.uid() OR public.es_personal_activo());
CREATE POLICY fila_insert ON public.fila_espera FOR INSERT TO authenticated
  WITH CHECK (id_usuario IS NULL OR id_usuario = auth.uid());
CREATE POLICY fila_update_personal ON public.fila_espera FOR UPDATE TO authenticated
  USING (public.es_personal_activo());
CREATE POLICY fila_update_propio ON public.fila_espera FOR UPDATE TO authenticated
  USING (id_usuario = auth.uid()) WITH CHECK (id_usuario = auth.uid());

CREATE POLICY categorias_select ON public.categorias_menu FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY categorias_write_personal ON public.categorias_menu FOR ALL TO authenticated
  USING (public.es_personal_activo()) WITH CHECK (public.es_personal_activo());

CREATE POLICY items_select ON public.items_menu FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY items_write_personal ON public.items_menu FOR ALL TO authenticated
  USING (public.es_personal_activo()) WITH CHECK (public.es_personal_activo());

CREATE POLICY solicitudes_select ON public.solicitudes_servicio FOR SELECT TO authenticated
  USING (id_usuario = auth.uid() OR public.puede_ver_solicitud_servicio(id_mesa));
CREATE POLICY solicitudes_insert ON public.solicitudes_servicio FOR INSERT TO authenticated
  WITH CHECK (id_usuario IS NULL OR id_usuario = auth.uid());
CREATE POLICY solicitudes_update_personal ON public.solicitudes_servicio FOR UPDATE TO authenticated
  USING (public.puede_ver_solicitud_servicio(id_mesa));
CREATE POLICY solicitudes_delete_personal ON public.solicitudes_servicio FOR DELETE TO authenticated
  USING (public.puede_ver_solicitud_servicio(id_mesa));

CREATE POLICY auditoria_personal ON public.eventos_auditoria FOR ALL TO authenticated
  USING (public.es_personal_activo()) WITH CHECK (public.es_personal_activo());

CREATE POLICY reservas_select ON public.reservas_mesa FOR SELECT TO authenticated
  USING (id_usuario = auth.uid() OR public.es_personal_activo());

CREATE POLICY pedidos_cocina_select ON public.pedidos_cocina FOR SELECT TO authenticated
  USING (
    id_usuario = auth.uid()
    OR public.es_cocina_o_gerente()
    OR public.puede_ver_pedidos_mesa(id_mesa)
  );
CREATE POLICY pedidos_cocina_insert_rpc_only ON public.pedidos_cocina FOR INSERT TO authenticated
  WITH CHECK (false);

ALTER TABLE public.servicios_mesa ENABLE ROW LEVEL SECURITY;
CREATE POLICY servicios_select ON public.servicios_mesa FOR SELECT TO authenticated
  USING (id_usuario = auth.uid() OR public.es_personal_activo());

CREATE POLICY ingredientes_select_staff ON public.ingredientes FOR SELECT TO authenticated
  USING (public.es_cocina_o_gerente());
CREATE POLICY ingredientes_write_gerente ON public.ingredientes FOR ALL TO authenticated
  USING (public.es_gerente()) WITH CHECK (public.es_gerente());

CREATE POLICY recetas_select_staff ON public.recetas FOR SELECT TO authenticated
  USING (public.es_cocina_o_gerente());
CREATE POLICY recetas_write_gerente ON public.recetas FOR ALL TO authenticated
  USING (public.es_gerente()) WITH CHECK (public.es_gerente());

CREATE POLICY receta_ing_select_staff ON public.receta_ingredientes FOR SELECT TO authenticated
  USING (public.es_cocina_o_gerente());
CREATE POLICY receta_ing_write_gerente ON public.receta_ingredientes FOR ALL TO authenticated
  USING (public.es_gerente()) WITH CHECK (public.es_gerente());

CREATE POLICY mov_almacen_select_gerente ON public.movimientos_almacen FOR SELECT TO authenticated
  USING (public.es_gerente());
CREATE POLICY mov_almacen_no_direct_insert ON public.movimientos_almacen FOR INSERT TO authenticated
  WITH CHECK (false);
CREATE POLICY mov_almacen_no_direct_update ON public.movimientos_almacen FOR UPDATE TO authenticated
  USING (false);
CREATE POLICY mov_almacen_no_direct_delete ON public.movimientos_almacen FOR DELETE TO authenticated
  USING (false);

CREATE POLICY reportes_problema_select_propios ON public.reportes_problema FOR SELECT TO authenticated
  USING (id_usuario = auth.uid());
CREATE POLICY reportes_problema_insert_propios ON public.reportes_problema FOR INSERT TO authenticated
  WITH CHECK (id_usuario = auth.uid());
CREATE POLICY reportes_problema_select_gerente ON public.reportes_problema FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personal p
      WHERE p.id_usuario = auth.uid() AND p.activo = true AND p.rol = 'gerente'::public.rol_personal
    )
  );
CREATE POLICY reportes_problema_update_gerente ON public.reportes_problema FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personal p
      WHERE p.id_usuario = auth.uid() AND p.activo = true AND p.rol = 'gerente'::public.rol_personal
    )
  );

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

CREATE OR REPLACE FUNCTION public.cancelar_reserva_mesa(p_id_reserva uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  id_mesa_cancel uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'no_autenticado'; END IF;

  PERFORM 1 FROM public.reservas_mesa WHERE id = p_id_reserva FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_encontrada'; END IF;

  IF (SELECT id_usuario FROM public.reservas_mesa WHERE id = p_id_reserva) IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'no_permitido';
  END IF;
  IF (SELECT ciclo FROM public.reservas_mesa WHERE id = p_id_reserva) IS DISTINCT FROM 'activa' THEN
    RAISE EXCEPTION 'no_activa';
  END IF;

  id_mesa_cancel := (SELECT id_mesa FROM public.reservas_mesa WHERE id = p_id_reserva);

  UPDATE public.reservas_mesa SET ciclo = 'cancelada' WHERE id = p_id_reserva;

  UPDATE public.mesas AS t
  SET estado = (
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.reservas_mesa r
        WHERE r.id_mesa = id_mesa_cancel
          AND r.ciclo = 'activa'
          AND (r.fecha_hora_reserva AT TIME ZONE 'America/Mexico_City')::date
            <= (now() AT TIME ZONE 'America/Mexico_City')::date
      ) THEN 'reservada'::public.estado_mesa
      ELSE 'libre'::public.estado_mesa
    END
  ),
  actualizado_en = now()
  WHERE t.id = id_mesa_cancel;
END;
$function$;

CREATE OR REPLACE FUNCTION public.personal_resolver_reserva(p_id_reserva uuid, p_comensal_llego boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  id_mesa_accion uuid;
  v_staff_rol public.rol_personal;
BEGIN
  IF NOT public.es_personal_activo() THEN RAISE EXCEPTION 'solo_personal'; END IF;
  SELECT p.rol INTO v_staff_rol
  FROM public.personal AS p
  WHERE p.id_usuario = auth.uid() AND p.activo = true
  LIMIT 1;
  IF v_staff_rol IS DISTINCT FROM 'anfitrion'::public.rol_personal
     AND v_staff_rol IS DISTINCT FROM 'gerente'::public.rol_personal THEN
    RAISE EXCEPTION 'solo_anfitrion_gerente';
  END IF;

  PERFORM 1 FROM public.reservas_mesa WHERE id = p_id_reserva FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_encontrada'; END IF;

  IF (SELECT ciclo FROM public.reservas_mesa WHERE id = p_id_reserva) IS DISTINCT FROM 'activa' THEN
    RAISE EXCEPTION 'no_activa';
  END IF;
  IF (SELECT comensal_llego FROM public.reservas_mesa WHERE id = p_id_reserva) IS NOT NULL THEN
    RAISE EXCEPTION 'ya_atendida';
  END IF;

  id_mesa_accion := (SELECT id_mesa FROM public.reservas_mesa WHERE id = p_id_reserva);

  UPDATE public.reservas_mesa
  SET comensal_llego = p_comensal_llego, ciclo = 'completada'
  WHERE id = p_id_reserva;

  IF p_comensal_llego THEN
    UPDATE public.mesas SET estado = 'ocupada', actualizado_en = now() WHERE id = id_mesa_accion;
  ELSE
    UPDATE public.mesas AS t
    SET estado = (
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.reservas_mesa r
          WHERE r.id_mesa = id_mesa_accion
            AND r.ciclo = 'activa'
            AND (r.fecha_hora_reserva AT TIME ZONE 'America/Mexico_City')::date
              <= (now() AT TIME ZONE 'America/Mexico_City')::date
        ) THEN 'reservada'::public.estado_mesa
        ELSE 'libre'::public.estado_mesa
      END
    ),
    actualizado_en = now()
    WHERE t.id = id_mesa_accion;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.personal_atender_reserva(p_id_reserva uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_staff_id uuid;
  v_staff_rol public.rol_personal;
  v_mesa uuid;
  v_asignado uuid;
  v_estado_mesa public.estado_mesa;
BEGIN
  IF NOT public.es_personal_activo() THEN RAISE EXCEPTION 'solo_personal'; END IF;

  SELECT p.id, p.rol INTO v_staff_id, v_staff_rol FROM public.personal AS p WHERE p.id_usuario = auth.uid() AND p.activo = true LIMIT 1;
  IF v_staff_id IS NULL THEN RAISE EXCEPTION 'sin_personal'; END IF;
  IF v_staff_rol IS DISTINCT FROM 'anfitrion'::public.rol_personal
     AND v_staff_rol IS DISTINCT FROM 'gerente'::public.rol_personal THEN
    RAISE EXCEPTION 'solo_anfitrion_gerente';
  END IF;

  PERFORM 1 FROM public.reservas_mesa AS rm WHERE rm.id = p_id_reserva FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_encontrada'; END IF;

  IF (SELECT rm.ciclo FROM public.reservas_mesa AS rm WHERE rm.id = p_id_reserva) IS DISTINCT FROM 'activa' THEN
    RAISE EXCEPTION 'no_activa';
  END IF;
  IF (SELECT rm.comensal_llego FROM public.reservas_mesa AS rm WHERE rm.id = p_id_reserva) IS NOT NULL THEN
    RAISE EXCEPTION 'ya_atendida';
  END IF;

  v_mesa := (SELECT rm.id_mesa FROM public.reservas_mesa AS rm WHERE rm.id = p_id_reserva);

  SELECT m.estado INTO v_estado_mesa FROM public.mesas AS m WHERE m.id = v_mesa;
  IF v_estado_mesa = 'ocupada'::public.estado_mesa THEN
    RAISE EXCEPTION 'mesa_ocupada';
  END IF;
  IF v_estado_mesa NOT IN ('reservada'::public.estado_mesa, 'libre'::public.estado_mesa) THEN
    RAISE EXCEPTION 'mesa_no_reservada';
  END IF;
  IF v_estado_mesa = 'libre'::public.estado_mesa THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.reservas_mesa rm
      WHERE rm.id = p_id_reserva AND rm.id_mesa = v_mesa AND rm.ciclo = 'activa'
    ) THEN
      RAISE EXCEPTION 'mesa_no_reservada';
    END IF;
  END IF;

  SELECT m.id_personal_atendiendo INTO v_asignado FROM public.mesas AS m WHERE m.id = v_mesa;
  IF v_asignado IS NOT NULL AND v_asignado <> v_staff_id THEN
    RAISE EXCEPTION 'mesa_asignada_otro_mesero';
  END IF;

  EXECUTE 'UPDATE public.mesas AS t SET id_personal_atendiendo = $1, actualizado_en = now() WHERE t.id = $2'
  USING v_staff_id, v_mesa;
END;
$function$;

CREATE OR REPLACE FUNCTION public.personal_desasignar_mesa(p_id_mesa uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_staff_id uuid;
  v_asignado uuid;
  v_estado public.estado_mesa;
BEGIN
  IF NOT public.es_personal_activo() THEN RAISE EXCEPTION 'solo_personal'; END IF;
  SELECT p.id INTO v_staff_id FROM public.personal AS p WHERE p.id_usuario = auth.uid() AND p.activo = true LIMIT 1;
  IF v_staff_id IS NULL THEN RAISE EXCEPTION 'sin_personal'; END IF;

  PERFORM 1 FROM public.mesas AS m WHERE m.id = p_id_mesa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_encontrada'; END IF;

  SELECT m.id_personal_atendiendo, m.estado INTO v_asignado, v_estado FROM public.mesas AS m WHERE m.id = p_id_mesa;
  IF v_asignado IS NULL OR v_asignado <> v_staff_id THEN
    RAISE EXCEPTION 'no_tu_mesa';
  END IF;
  IF v_estado NOT IN ('reservada'::public.estado_mesa, 'libre'::public.estado_mesa) THEN
    RAISE EXCEPTION 'solo_reservada_desasignar';
  END IF;

  UPDATE public.mesas AS t
  SET id_personal_atendiendo = NULL, actualizado_en = now()
  WHERE t.id = p_id_mesa;
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

-- Reasignar UNA mesa a otro mesero (recepción/gerencia).
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

-- Reasignar TODAS las mesas de un mesero a otro (mesero indispuesto).
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
  FROM public.personal p WHERE p.id_usuario = auth.uid() AND p.activo = true LIMIT 1;
  IF v_staff_id IS NULL THEN RAISE EXCEPTION 'sin_personal'; END IF;
  IF p_cantidad IS NULL OR p_cantidad < 1 OR p_cantidad > 99 THEN RAISE EXCEPTION 'cantidad_invalida'; END IF;
  PERFORM 1 FROM public.mesas m WHERE m.id = p_id_mesa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mesa_no_encontrada'; END IF;
  IF (SELECT m.estado FROM public.mesas m WHERE m.id = p_id_mesa) IS DISTINCT FROM 'ocupada' THEN
    RAISE EXCEPTION 'mesa_no_ocupada_pedido';
  END IF;
  SELECT m.id_personal_atendiendo INTO v_asignado FROM public.mesas m WHERE m.id = p_id_mesa;
  IF v_staff_rol = 'mesero'::public.rol_personal THEN
    IF v_asignado IS NULL OR v_asignado <> v_staff_id THEN RAISE EXCEPTION 'no_tu_mesa'; END IF;
  END IF;
  v_servicio := public.asegurar_servicio_mesa_activo(p_id_mesa);
  SELECT sv.id_usuario, sv.id_reserva_mesa, sv.id_fila_espera
  INTO v_uid_pedido, v_id_reserva, v_id_fila FROM public.servicios_mesa sv WHERE sv.id = v_servicio;
  IF v_uid_pedido IS NULL THEN v_uid_pedido := auth.uid(); END IF;
  SELECT public.crear_pedido_cocina_interno(
    v_uid_pedido, p_id_mesa, p_id_item, p_cantidad, p_nota, v_id_reserva, v_id_fila, v_servicio, v_staff_id
  ) INTO v_id;
  RETURN v_id;
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
  FROM public.servicios_mesa sv WHERE sv.id_mesa = p_id_mesa AND sv.estado = 'activo' LIMIT 1;

  IF v_servicio IS NULL THEN
    RETURN json_build_object('servicio_id', NULL, 'estado', NULL, 'total_centavos', 0, 'lineas', '[]'::json);
  END IF;

  v_total := public._calcular_total_servicio(v_servicio);

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', pc.id, 'cantidad', pc.cantidad, 'nombre', im.nombre,
        'precio_unit_centavos', im.precio_centavos,
        'subtotal_centavos', pc.cantidad * im.precio_centavos,
        'registrado_por_mesero', (pc.id_personal_registro IS NOT NULL),
        'creado_en', pc.creado_en
      ) ORDER BY pc.creado_en
    ),
    '[]'::json
  ) INTO r
  FROM public.pedidos_cocina pc
  INNER JOIN public.items_menu im ON im.id = pc.id_item_menu
  WHERE pc.id_servicio_mesa = v_servicio;

  RETURN json_build_object('servicio_id', v_servicio, 'estado', v_estado, 'total_centavos', v_total, 'lineas', r);
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.personal_atender_reserva_completa(p_id_reserva uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_staff_id uuid;
  v_staff_rol public.rol_personal;
  v_mesa uuid;
  v_asignado uuid;
  v_estado_mesa public.estado_mesa;
BEGIN
  IF NOT public.es_personal_activo() THEN RAISE EXCEPTION 'solo_personal'; END IF;

  SELECT p.id, p.rol INTO v_staff_id, v_staff_rol FROM public.personal AS p WHERE p.id_usuario = auth.uid() AND p.activo = true LIMIT 1;
  IF v_staff_id IS NULL THEN RAISE EXCEPTION 'sin_personal'; END IF;
  IF v_staff_rol IS DISTINCT FROM 'anfitrion'::public.rol_personal
     AND v_staff_rol IS DISTINCT FROM 'gerente'::public.rol_personal THEN
    RAISE EXCEPTION 'solo_anfitrion_gerente';
  END IF;

  PERFORM 1 FROM public.reservas_mesa AS rm WHERE rm.id = p_id_reserva FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_encontrada'; END IF;

  IF (SELECT rm.ciclo FROM public.reservas_mesa AS rm WHERE rm.id = p_id_reserva) IS DISTINCT FROM 'activa' THEN
    RAISE EXCEPTION 'no_activa';
  END IF;
  IF (SELECT rm.comensal_llego FROM public.reservas_mesa AS rm WHERE rm.id = p_id_reserva) IS NOT NULL THEN
    RAISE EXCEPTION 'ya_atendida';
  END IF;

  v_mesa := (SELECT rm.id_mesa FROM public.reservas_mesa AS rm WHERE rm.id = p_id_reserva);

  SELECT m.estado INTO v_estado_mesa FROM public.mesas AS m WHERE m.id = v_mesa;
  IF v_estado_mesa = 'ocupada'::public.estado_mesa THEN
    RAISE EXCEPTION 'mesa_ocupada';
  END IF;
  IF v_estado_mesa NOT IN ('reservada'::public.estado_mesa, 'libre'::public.estado_mesa) THEN
    RAISE EXCEPTION 'mesa_no_reservada';
  END IF;
  IF v_estado_mesa = 'libre'::public.estado_mesa THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.reservas_mesa rm
      WHERE rm.id = p_id_reserva AND rm.id_mesa = v_mesa AND rm.ciclo = 'activa'
    ) THEN
      RAISE EXCEPTION 'mesa_no_reservada';
    END IF;
  END IF;

  SELECT m.id_personal_atendiendo INTO v_asignado FROM public.mesas AS m WHERE m.id = v_mesa;
  IF v_asignado IS NOT NULL AND v_asignado IS DISTINCT FROM v_staff_id THEN
    RAISE EXCEPTION 'mesa_asignada_otro_mesero';
  END IF;

  UPDATE public.reservas_mesa
  SET comensal_llego = true, ciclo = 'completada'
  WHERE id = p_id_reserva;

  EXECUTE
    'UPDATE public.mesas AS t SET estado = ''ocupada''::public.estado_mesa, id_personal_atendiendo = $1, actualizado_en = now() WHERE t.id = $2'
  USING v_staff_id, v_mesa;
END;
$function$;

CREATE OR REPLACE FUNCTION public.personal_atender_reserva_completa_asignando_mesero(
  p_id_reserva uuid,
  p_id_mesero uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_staff_id uuid;
  v_staff_rol public.rol_personal;
  v_mesa uuid;
  v_estado_mesa public.estado_mesa;
BEGIN
  IF NOT public.es_personal_activo() THEN RAISE EXCEPTION 'solo_personal'; END IF;

  SELECT p.id, p.rol INTO v_staff_id, v_staff_rol
  FROM public.personal AS p
  WHERE p.id_usuario = auth.uid() AND p.activo = true
  LIMIT 1;
  IF v_staff_id IS NULL THEN RAISE EXCEPTION 'sin_personal'; END IF;
  IF v_staff_rol IS DISTINCT FROM 'anfitrion'::public.rol_personal
     AND v_staff_rol IS DISTINCT FROM 'gerente'::public.rol_personal THEN
    RAISE EXCEPTION 'solo_anfitrion_gerente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.personal p
    WHERE p.id = p_id_mesero
      AND p.rol = 'mesero'::public.rol_personal
      AND p.activo = true
  ) THEN
    RAISE EXCEPTION 'mesero_inactivo_o_inexistente';
  END IF;

  PERFORM 1 FROM public.reservas_mesa AS rm WHERE rm.id = p_id_reserva FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_encontrada'; END IF;

  IF (SELECT rm.ciclo FROM public.reservas_mesa AS rm WHERE rm.id = p_id_reserva) IS DISTINCT FROM 'activa' THEN
    RAISE EXCEPTION 'no_activa';
  END IF;
  IF (SELECT rm.comensal_llego FROM public.reservas_mesa AS rm WHERE rm.id = p_id_reserva) IS NOT NULL THEN
    RAISE EXCEPTION 'ya_atendida';
  END IF;

  v_mesa := (SELECT rm.id_mesa FROM public.reservas_mesa AS rm WHERE rm.id = p_id_reserva);

  SELECT m.estado INTO v_estado_mesa FROM public.mesas AS m WHERE m.id = v_mesa;
  IF v_estado_mesa = 'ocupada'::public.estado_mesa THEN
    RAISE EXCEPTION 'mesa_ocupada';
  END IF;
  IF v_estado_mesa NOT IN ('reservada'::public.estado_mesa, 'libre'::public.estado_mesa) THEN
    RAISE EXCEPTION 'mesa_no_reservada';
  END IF;
  IF v_estado_mesa = 'libre'::public.estado_mesa THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.reservas_mesa rm
      WHERE rm.id = p_id_reserva AND rm.id_mesa = v_mesa AND rm.ciclo = 'activa'
    ) THEN
      RAISE EXCEPTION 'mesa_no_reservada';
    END IF;
  END IF;

  UPDATE public.reservas_mesa
  SET comensal_llego = true, ciclo = 'completada'
  WHERE id = p_id_reserva;

  UPDATE public.mesas AS t
  SET estado = 'ocupada',
      id_personal_atendiendo = p_id_mesero,
      actualizado_en = now()
  WHERE t.id = v_mesa;
END;
$function$;

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
    -- Cierre completo (igual que liberar la mesa atendida): cierra el servicio
    -- activo y genera su recibo, cancela la fila sentada y limpia la reserva
    -- atendida. Sin esto, el servicio quedaría abierto y un próximo comensal
    -- en esta mesa heredaría la cuenta del anterior (mezcla entre clientes).
    PERFORM public.terminar_servicio_en_mesa(p_id_mesa);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.personal_sentar_desde_fila(
  p_id_fila uuid,
  p_id_mesa uuid,
  p_id_mesero uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_staff_actor uuid;
  v_staff_actor_rol public.rol_personal;
  v_estado_fila public.estado_fila;
  v_estado_mesa public.estado_mesa;
BEGIN
  IF NOT public.es_personal_activo() THEN
    RAISE EXCEPTION 'solo_personal';
  END IF;

  SELECT p.id, p.rol
  INTO v_staff_actor, v_staff_actor_rol
  FROM public.personal AS p
  WHERE p.id_usuario = auth.uid() AND p.activo = true
  LIMIT 1;

  IF v_staff_actor IS NULL THEN
    RAISE EXCEPTION 'sin_personal';
  END IF;

  IF v_staff_actor_rol IS DISTINCT FROM 'anfitrion'::public.rol_personal
     AND v_staff_actor_rol IS DISTINCT FROM 'gerente'::public.rol_personal THEN
    RAISE EXCEPTION 'solo_anfitrion_gerente';
  END IF;

  PERFORM 1 FROM public.fila_espera WHERE id = p_id_fila FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fila_no_encontrada';
  END IF;

  SELECT f.estado INTO v_estado_fila
  FROM public.fila_espera AS f
  WHERE f.id = p_id_fila;

  IF v_estado_fila IS DISTINCT FROM 'esperando'::public.estado_fila THEN
    RAISE EXCEPTION 'fila_no_esperando';
  END IF;

  PERFORM 1 FROM public.mesas WHERE id = p_id_mesa FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mesa_no_encontrada';
  END IF;

  SELECT m.estado INTO v_estado_mesa
  FROM public.mesas AS m
  WHERE m.id = p_id_mesa;

  IF v_estado_mesa IS DISTINCT FROM 'libre'::public.estado_mesa THEN
    RAISE EXCEPTION 'mesa_no_libre';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.personal AS p
    WHERE p.id = p_id_mesero
      AND p.rol = 'mesero'::public.rol_personal
      AND p.activo = true
  ) THEN
    RAISE EXCEPTION 'mesero_inactivo_o_inexistente';
  END IF;

  UPDATE public.mesas
  SET estado = 'ocupada',
      id_personal_atendiendo = p_id_mesero,
      actualizado_en = now()
  WHERE id = p_id_mesa;

  UPDATE public.fila_espera
  SET estado = 'sentado',
      sentado_en = now(),
      id_mesa_asignada = p_id_mesa
  WHERE id = p_id_fila;
END;
$function$;

CREATE OR REPLACE FUNCTION public.gerente_almacen_entrada(
  p_id_ingrediente uuid,
  p_cantidad numeric,
  p_nota text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.es_gerente() THEN
    RAISE EXCEPTION 'solo_gerente';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'cantidad_invalida_almacen';
  END IF;

  PERFORM 1 FROM public.ingredientes i WHERE i.id = p_id_ingrediente FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ingrediente_no_encontrado';
  END IF;

  UPDATE public.ingredientes i
  SET cantidad_disponible = i.cantidad_disponible + p_cantidad
  WHERE i.id = p_id_ingrediente;

  INSERT INTO public.movimientos_almacen (id_ingrediente, tipo, delta_cantidad, nota)
  VALUES (p_id_ingrediente, 'entrada'::public.tipo_movimiento_almacen, p_cantidad, NULLIF(trim(COALESCE(p_nota, '')), ''));

  PERFORM public.refresh_items_menu_sin_stock_flags();
END;
$function$;

CREATE OR REPLACE FUNCTION public.gerente_almacen_ajuste(
  p_id_ingrediente uuid,
  p_nueva_cantidad numeric,
  p_nota text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actual numeric;
  v_delta numeric;
BEGIN
  IF NOT public.es_gerente() THEN
    RAISE EXCEPTION 'solo_gerente';
  END IF;
  IF p_nueva_cantidad IS NULL OR p_nueva_cantidad < 0 THEN
    RAISE EXCEPTION 'cantidad_negativa';
  END IF;

  SELECT i.cantidad_disponible INTO v_actual
  FROM public.ingredientes i
  WHERE i.id = p_id_ingrediente
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ingrediente_no_encontrado';
  END IF;

  v_delta := p_nueva_cantidad - v_actual;
  IF v_delta = 0 THEN
    RETURN;
  END IF;

  UPDATE public.ingredientes i
  SET cantidad_disponible = p_nueva_cantidad
  WHERE i.id = p_id_ingrediente;

  INSERT INTO public.movimientos_almacen (id_ingrediente, tipo, delta_cantidad, nota)
  VALUES (
    p_id_ingrediente,
    'ajuste'::public.tipo_movimiento_almacen,
    v_delta,
    NULLIF(trim(COALESCE(p_nota, '')), '')
  );

  PERFORM public.refresh_items_menu_sin_stock_flags();
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'no_autenticado';
  END IF;

  SELECT rm.id_mesa INTO v_mesa
  FROM public.reservas_mesa rm
  INNER JOIN public.mesas m ON m.id = rm.id_mesa
  WHERE rm.id_usuario = v_uid
    AND rm.ciclo = 'completada'
    AND rm.comensal_llego IS TRUE
    AND m.estado = 'ocupada'
  ORDER BY rm.creado_en DESC
  LIMIT 1;

  IF v_mesa IS NULL THEN
    SELECT f.id_mesa_asignada INTO v_mesa
    FROM public.fila_espera f
    INNER JOIN public.mesas m ON m.id = f.id_mesa_asignada
    WHERE f.id_usuario = v_uid
      AND f.estado = 'sentado'
      AND f.id_mesa_asignada IS NOT NULL
      AND m.estado = 'ocupada'
    ORDER BY f.sentado_en DESC NULLS LAST, f.unido_en DESC
    LIMIT 1;
  END IF;

  IF v_mesa IS NULL THEN
    RAISE EXCEPTION 'sin_mesa_activa_para_terminar';
  END IF;

  PERFORM public.terminar_servicio_en_mesa(v_mesa);
END;
$function$;

CREATE OR REPLACE FUNCTION public.marcar_pedido_listo_cocina(p_id_pedido uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_mesa uuid;
  v_codigo text;
  v_cant int;
  v_nombre text;
  v_msg text;
BEGIN
  IF NOT public.es_cocina_o_gerente() THEN RAISE EXCEPTION 'solo_cocina'; END IF;

  PERFORM 1 FROM public.pedidos_cocina pc WHERE pc.id = p_id_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido_no_encontrado'; END IF;

  IF (SELECT pc.estado FROM public.pedidos_cocina pc WHERE pc.id = p_id_pedido) IS DISTINCT FROM 'pendiente' THEN
    RAISE EXCEPTION 'pedido_ya_procesado';
  END IF;

  SELECT pc.id_mesa, pc.cantidad, im.nombre
  INTO v_mesa, v_cant, v_nombre
  FROM public.pedidos_cocina pc
  INNER JOIN public.items_menu im ON im.id = pc.id_item_menu
  WHERE pc.id = p_id_pedido;

  SELECT m.codigo INTO v_codigo FROM public.mesas m WHERE m.id = v_mesa;

  UPDATE public.pedidos_cocina pc
  SET estado = 'listo', listo_en = now()
  WHERE pc.id = p_id_pedido;

  v_msg := 'Llevar ' || v_cant::text || '× ' || v_nombre || ' a mesa ' || COALESCE(v_codigo, '?');

  INSERT INTO public.solicitudes_servicio (id_mesa, id_usuario, mensaje, estado)
  VALUES (v_mesa, NULL, v_msg, 'abierta');
END;
$function$;

CREATE OR REPLACE FUNCTION public.cocina_set_item_disponible(p_id_item uuid, p_disponible boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.es_cocina_o_gerente() THEN RAISE EXCEPTION 'solo_cocina'; END IF;

  PERFORM 1 FROM public.items_menu im WHERE im.id = p_id_item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_no_encontrado'; END IF;

  UPDATE public.items_menu im
  SET disponible = p_disponible, actualizado_en = now()
  WHERE im.id = p_id_item;

  PERFORM public.refresh_items_menu_sin_stock_flags();
END;
$function$;

CREATE OR REPLACE FUNCTION public.comensal_mi_posicion_fila()
RETURNS TABLE(entry_id uuid, queue_position int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'no_autenticado';
  END IF;

  RETURN QUERY
  WITH mine AS (
    SELECT f.id, f.unido_en
    FROM public.fila_espera f
    WHERE f.id_usuario = v_user_id
      AND f.estado = 'esperando'::public.estado_fila
    ORDER BY f.unido_en ASC
    LIMIT 1
  )
  SELECT
    m.id AS entry_id,
    (
      SELECT COUNT(*)::int
      FROM public.fila_espera f2
      WHERE f2.estado = 'esperando'::public.estado_fila
        AND (
          f2.unido_en < m.unido_en
          OR (f2.unido_en = m.unido_en AND f2.id <= m.id)
        )
    ) AS queue_position
  FROM mine m;
END;
$function$;

-- Día de servicio = fecha local en America/Mexico_City (ajustar si el restaurante usa otra zona).
CREATE OR REPLACE FUNCTION public.mesas_con_reserva_activa_en_dia_servicio(p_dia date)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT DISTINCT r.id_mesa
  FROM public.reservas_mesa r
  WHERE r.ciclo = 'activa'
    AND (r.fecha_hora_reserva AT TIME ZONE 'America/Mexico_City')::date = p_dia;
$function$;

REVOKE ALL ON FUNCTION public.mesas_con_reserva_activa_en_dia_servicio(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mesas_con_reserva_activa_en_dia_servicio(date) TO authenticated;

-- Gestión de personal (gerente) + reportes con mesero y contacto
CREATE OR REPLACE FUNCTION public.gerente_listar_personal()
RETURNS TABLE (
  id uuid,
  id_usuario uuid,
  nombre_visible text,
  rol text,
  codigo_empleado text,
  activo boolean,
  foto_url text,
  correo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.id, p.id_usuario, p.nombre_visible, p.rol::text, p.codigo_empleado, p.activo, p.foto_url, u.email
  FROM public.personal p
  LEFT JOIN auth.users u ON u.id = p.id_usuario
  WHERE public.es_gerente()
  ORDER BY p.activo DESC, p.nombre_visible;
$function$;

CREATE OR REPLACE FUNCTION public.gerente_vincular_personal(
  p_email text,
  p_nombre text,
  p_rol text,
  p_codigo text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid;
  v_id uuid;
BEGIN
  IF NOT public.es_gerente() THEN
    RAISE EXCEPTION 'Solo gerencia puede gestionar personal';
  END IF;
  IF p_rol NOT IN ('anfitrion', 'mesero', 'gerente', 'cocina') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;

  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No existe una cuenta con ese correo. Pide a la persona que se registre primero en la app.';
  END IF;

  SELECT id INTO v_id FROM public.personal WHERE id_usuario = v_uid;
  IF v_id IS NULL THEN
    INSERT INTO public.personal (id_usuario, nombre_visible, rol, codigo_empleado, activo)
    VALUES (
      v_uid,
      COALESCE(NULLIF(trim(p_nombre), ''), 'Sin nombre'),
      p_rol::public.rol_personal,
      NULLIF(trim(p_codigo), ''),
      true
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.personal
    SET nombre_visible = COALESCE(NULLIF(trim(p_nombre), ''), nombre_visible),
        rol = p_rol::public.rol_personal,
        codigo_empleado = NULLIF(trim(p_codigo), ''),
        activo = true
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.gerente_cambiar_rol_personal(p_id uuid, p_rol text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.es_gerente() THEN
    RAISE EXCEPTION 'Solo gerencia puede gestionar personal';
  END IF;
  IF p_rol NOT IN ('anfitrion', 'mesero', 'gerente', 'cocina') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;
  IF EXISTS (SELECT 1 FROM public.personal WHERE id = p_id AND id_usuario = auth.uid()) THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol';
  END IF;
  UPDATE public.personal SET rol = p_rol::public.rol_personal WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.gerente_set_activo_personal(p_id uuid, p_activo boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.es_gerente() THEN
    RAISE EXCEPTION 'Solo gerencia puede gestionar personal';
  END IF;
  IF EXISTS (SELECT 1 FROM public.personal WHERE id = p_id AND id_usuario = auth.uid()) THEN
    RAISE EXCEPTION 'No puedes desactivar tu propia cuenta';
  END IF;
  UPDATE public.personal SET activo = p_activo WHERE id = p_id;
  IF p_activo = false THEN
    UPDATE public.mesas SET id_personal_atendiendo = NULL WHERE id_personal_atendiendo = p_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.gerente_eliminar_personal(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.es_gerente() THEN
    RAISE EXCEPTION 'Solo gerencia puede gestionar personal';
  END IF;
  IF EXISTS (SELECT 1 FROM public.personal WHERE id = p_id AND id_usuario = auth.uid()) THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta';
  END IF;
  UPDATE public.mesas SET id_personal_atendiendo = NULL WHERE id_personal_atendiendo = p_id;
  DELETE FROM public.personal WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.comensal_crear_reporte(p_titulo text, p_descripcion text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid;
  v_id uuid;
  v_nombre text;
  v_correo text;
  v_tel text;
  v_mesero_id uuid;
  v_mesero_nombre text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF COALESCE(trim(p_titulo), '') = '' OR COALESCE(trim(p_descripcion), '') = '' THEN
    RAISE EXCEPTION 'Indica un título y una descripción';
  END IF;

  SELECT nombre_completo, telefono INTO v_nombre, v_tel FROM public.perfiles WHERE id = v_uid;
  SELECT email INTO v_correo FROM auth.users WHERE id = v_uid;

  SELECT COALESCE(m.id_personal_atendiendo, sv.id_personal_atendio, sv.id_personal_cierre, sv.id_personal_apertura)
  INTO v_mesero_id
  FROM public.servicios_mesa sv
  JOIN public.mesas m ON m.id = sv.id_mesa
  WHERE sv.id_usuario = v_uid
  ORDER BY sv.abierto_en DESC
  LIMIT 1;

  IF v_mesero_id IS NOT NULL THEN
    SELECT nombre_visible INTO v_mesero_nombre FROM public.personal WHERE id = v_mesero_id;
  END IF;

  INSERT INTO public.reportes_problema (
    id_usuario, nombre_usuario, titulo, descripcion, estado,
    id_personal_atendio, mesero_nombre, correo_contacto, telefono_contacto
  )
  VALUES (
    v_uid,
    COALESCE(NULLIF(trim(v_nombre), ''), split_part(v_correo, '@', 1), 'Comensal'),
    trim(p_titulo),
    trim(p_descripcion),
    'abierto',
    v_mesero_id,
    v_mesero_nombre,
    v_correo,
    v_tel
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.gerente_listar_personal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerente_vincular_personal(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerente_cambiar_rol_personal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerente_set_activo_personal(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerente_eliminar_personal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comensal_crear_reporte(text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.expirar_reservas_vencidas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_reserva_mesa(uuid, timestamptz, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_reserva_mesa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_resolver_reserva(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_atender_reserva(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_desasignar_mesa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_liberar_mesa_atendida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_atender_reserva_completa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_atender_reserva_completa_asignando_mesero(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_marcar_mesa_libre_ocupada(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_sentar_desde_fila(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_pedido_cocina(uuid, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_crear_pedido_mesa(uuid, uuid, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mesa_cuenta_servicio_activo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.terminar_servicio_en_mesa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comensal_terminar_servicio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_pedido_listo_cocina(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cocina_set_item_disponible(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comensal_mi_posicion_fila() TO authenticated;
GRANT EXECUTE ON FUNCTION public.comensal_mesa_mesero(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comensal_mis_recibos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_reasignar_mesa(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_reasignar_mesero(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerente_almacen_entrada(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerente_almacen_ajuste(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gerente_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r json;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.personal p
    WHERE p.id_usuario = auth.uid() AND p.activo = true AND p.rol = 'gerente'::public.rol_personal
  ) THEN
    RAISE EXCEPTION 'solo_gerente';
  END IF;

  SELECT json_build_object(
    'total_centavos', (
      SELECT COALESCE(SUM(pc.cantidad * im.precio_centavos), 0)::bigint
      FROM public.pedidos_cocina pc
      INNER JOIN public.items_menu im ON im.id = pc.id_item_menu
    ),
    'plato_top', (
      SELECT json_build_object('nombre', sq.nombre, 'unidades', sq.u)
      FROM (
        SELECT im.nombre, SUM(pc.cantidad)::bigint AS u
        FROM public.pedidos_cocina pc
        INNER JOIN public.items_menu im ON im.id = pc.id_item_menu
        GROUP BY im.id, im.nombre
        ORDER BY u DESC NULLS LAST
        LIMIT 1
      ) sq
    ),
    'equipo', (
      SELECT COALESCE(
        json_agg(json_build_object('nombre', nombre_visible, 'rol', rol::text) ORDER BY rol::text, nombre_visible),
        '[]'::json
      )
      FROM public.personal
      WHERE activo = true
    ),
    'no_disponibles', (
      SELECT COALESCE(
        json_agg(json_build_object('nombre', nombre) ORDER BY nombre),
        '[]'::json
      )
      FROM public.items_menu
      WHERE disponible = false OR COALESCE(sin_stock, false) = true
    )
  ) INTO r;

  RETURN r;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.gerente_dashboard_stats() TO authenticated;

-- ========== Datos de ejemplo (zonas, mesas, menú) ==========

DELETE FROM public.items_menu WHERE id_categoria IN (
  SELECT id FROM public.categorias_menu WHERE nombre IN ('Entradas', 'Platos fuertes', 'Bebidas', 'Postres')
);
DELETE FROM public.categorias_menu WHERE nombre IN ('Entradas', 'Platos fuertes', 'Bebidas', 'Postres');
DELETE FROM public.mesas WHERE codigo IN ('M1', 'M2', 'M3', 'M4');
DELETE FROM public.zonas WHERE nombre IN ('Salón principal', 'Terraza');

INSERT INTO public.zonas (nombre, orden) VALUES
  ('Salón principal', 1),
  ('Terraza', 2);

INSERT INTO public.mesas (codigo, id_zona, capacidad, estado, notas)
SELECT 'M1', id, 4, 'libre', 'Ventana'
FROM public.zonas WHERE nombre = 'Salón principal' LIMIT 1;

INSERT INTO public.mesas (codigo, id_zona, capacidad, estado, notas)
SELECT 'M2', id, 4, 'ocupada', NULL
FROM public.zonas WHERE nombre = 'Salón principal' LIMIT 1;

INSERT INTO public.mesas (codigo, id_zona, capacidad, estado, notas)
SELECT 'M3', id, 4, 'reservada', NULL
FROM public.zonas WHERE nombre = 'Salón principal' LIMIT 1;

INSERT INTO public.mesas (codigo, id_zona, capacidad, estado, notas)
SELECT 'M4', id, 4, 'libre', 'Vista jardín'
FROM public.zonas WHERE nombre = 'Terraza' LIMIT 1;

UPDATE public.mesas SET
  descripcion_publica = 'Mesa junto a la ventana, ideal para grupos pequeños.',
  imagen_url = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'
WHERE codigo = 'M1';
UPDATE public.mesas SET
  descripcion_publica = 'Mesa central en el salón.',
  imagen_url = 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800'
WHERE codigo = 'M2';
UPDATE public.mesas SET
  descripcion_publica = 'Mesa tranquila, buena para reuniones.',
  imagen_url = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800'
WHERE codigo = 'M3';
UPDATE public.mesas SET
  descripcion_publica = 'Terraza con vista al jardín.',
  imagen_url = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800'
WHERE codigo = 'M4';

INSERT INTO public.categorias_menu (nombre, orden) VALUES
  ('Entradas', 1),
  ('Platos fuertes', 2),
  ('Bebidas', 3),
  ('Postres', 4);

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Croquetas de jamón', 'Cremosas, con bechamel.', 14500, true FROM public.categorias_menu WHERE nombre = 'Entradas' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Ensalada de burrata', 'Tomate, albahaca, reducción balsámica.', 16500, true FROM public.categorias_menu WHERE nombre = 'Entradas' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Tartar de atún', 'Aguacate, sésamo y lima.', 19500, true FROM public.categorias_menu WHERE nombre = 'Entradas' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Risotto de hongos', 'Parmesano y aceite de trufa.', 24500, true FROM public.categorias_menu WHERE nombre = 'Platos fuertes' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Costillas BBQ', 'Patatas confitadas y ensalada coleslaw.', 28500, true FROM public.categorias_menu WHERE nombre = 'Platos fuertes' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Pescado del día', 'Según mercado, guarnición de temporada.', 26500, true FROM public.categorias_menu WHERE nombre = 'Platos fuertes' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Burger clásica', 'Queso cheddar, bacon crujiente.', 19500, true FROM public.categorias_menu WHERE nombre = 'Platos fuertes' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Limonada de hierbabuena', 'Jarra 1 L.', 8500, true FROM public.categorias_menu WHERE nombre = 'Bebidas' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Agua mineral', '750 ml.', 4500, true FROM public.categorias_menu WHERE nombre = 'Bebidas' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Cerveza artesanal', 'Estilo ale, 473 ml.', 9500, true FROM public.categorias_menu WHERE nombre = 'Bebidas' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Refresco', 'Lata 355 ml.', 5500, true FROM public.categorias_menu WHERE nombre = 'Bebidas' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Brownie con helado', 'Chocolate y nuez.', 11500, true FROM public.categorias_menu WHERE nombre = 'Postres' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Flan de la casa', 'Caramelo casero.', 8500, true FROM public.categorias_menu WHERE nombre = 'Postres' LIMIT 1;

INSERT INTO public.items_menu (id_categoria, nombre, descripcion, precio_centavos, disponible)
SELECT id, 'Tiramisú', 'Café y mascarpone.', 12500, true FROM public.categorias_menu WHERE nombre = 'Postres' LIMIT 1;

UPDATE public.items_menu
SET imagen_url = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80'
WHERE imagen_url IS NULL;

-- ========== Seed inventario (ingredientes, recetas, sin_stock inicial) ==========
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Pan hamburguesa', 'piezas', 80, 20, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Pan hamburguesa');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Carne de hamburguesa', 'g', 5000, 800, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Carne de hamburguesa');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Queso cheddar', 'piezas', 200, 40, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Queso cheddar');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Bacon', 'g', 3000, 400, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Bacon');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Bechamel', 'ml', 4000, 600, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Bechamel');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Jamón serrano', 'g', 2500, 300, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Jamón serrano');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Pan rallado', 'g', 1500, 200, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Pan rallado');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Costilla de cerdo', 'g', 8000, 1200, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Costilla de cerdo');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Salsa BBQ', 'ml', 6000, 800, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Salsa BBQ');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Papas', 'g', 12000, 2000, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Papas');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Mascarpone', 'g', 4000, 500, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Mascarpone');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Café espresso', 'ml', 8000, 1000, 'Bebidas' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Café espresso');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Bizcocho savoiardi', 'piezas', 300, 40, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Bizcocho savoiardi');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Cacao en polvo', 'g', 2000, 200, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Cacao en polvo');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Limón', 'piezas', 120, 24, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Limón');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Hierbabuena fresca', 'g', 800, 100, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Hierbabuena fresca');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Agua filtrada', 'ml', 50000, 5000, 'Bebidas' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Agua filtrada');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Azúcar', 'g', 10000, 1000, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Azúcar');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Hielo', 'g', 20000, 2000, 'Otros' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Hielo');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Burrata', 'piezas', 40, 6, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Burrata');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Tomate', 'g', 8000, 1000, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Tomate');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Albahaca', 'g', 300, 40, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Albahaca');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Atún fresco', 'g', 5000, 600, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Atún fresco');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Aguacate', 'g', 4000, 500, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Aguacate');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Arroz arborio', 'g', 6000, 800, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Arroz arborio');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Hongos', 'g', 5000, 600, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Hongos');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Parmesano', 'g', 3500, 400, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Parmesano');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Pescado blanco', 'g', 6000, 800, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Pescado blanco');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Verduras de temporada', 'g', 7000, 900, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Verduras de temporada');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Agua embotellada', 'piezas', 120, 15, 'Bebidas' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Agua embotellada');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Malta cervecera', 'ml', 20000, 3000, 'Bebidas' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Malta cervecera');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Lata refresco', 'piezas', 200, 24, 'Bebidas' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Lata refresco');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Chocolate postres', 'g', 5000, 600, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Chocolate postres');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Helado vainilla', 'g', 8000, 1000, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Helado vainilla');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Huevos', 'piezas', 200, 30, 'Alimentos' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Huevos');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Leche', 'ml', 20000, 2500, 'Bebidas' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Leche');
INSERT INTO public.ingredientes (nombre, unidad_medida, cantidad_disponible, stock_minimo, categoria)
SELECT 'Caramelo', 'ml', 2000, 200, 'Ingredientes' WHERE NOT EXISTS (SELECT 1 FROM public.ingredientes i WHERE i.nombre = 'Caramelo');

-- Bases vivas: añadir categoría sin recrear la tabla
ALTER TABLE public.ingredientes
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'Ingredientes';
CREATE INDEX IF NOT EXISTS idx_ingredientes_categoria ON public.ingredientes (categoria);

-- Bases ya existentes sin categoría (tras añadir la columna en despliegues vivos)
UPDATE public.ingredientes i SET categoria = 'Alimentos'
WHERE i.categoria = 'Ingredientes' AND i.nombre IN (
  'Pan hamburguesa', 'Carne de hamburguesa', 'Queso cheddar', 'Bacon', 'Jamón serrano',
  'Costilla de cerdo', 'Mascarpone', 'Bizcocho savoiardi', 'Burrata', 'Atún fresco',
  'Pescado blanco', 'Chocolate postres', 'Helado vainilla', 'Huevos'
);
UPDATE public.ingredientes i SET categoria = 'Bebidas'
WHERE i.categoria = 'Ingredientes' AND i.nombre IN (
  'Café espresso', 'Agua filtrada', 'Agua embotellada', 'Malta cervecera', 'Lata refresco', 'Leche'
);
UPDATE public.ingredientes i SET categoria = 'Otros' WHERE i.nombre = 'Hielo';

-- Unidades de medida: catálogo y productos empaquetados por pieza
UPDATE public.ingredientes SET unidad_medida = 'g'
WHERE lower(unidad_medida) IN ('gramo', 'gramos', 'gr');
UPDATE public.ingredientes SET unidad_medida = 'piezas'
WHERE lower(unidad_medida) IN ('pieza', 'pza', 'pzas');
UPDATE public.ingredientes SET unidad_medida = 'unidades'
WHERE lower(unidad_medida) = 'unidad';

UPDATE public.ingredientes i
SET
  unidad_medida = 'piezas',
  cantidad_disponible = GREATEST(1, ROUND(i.cantidad_disponible / 750.0)),
  stock_minimo = CASE
    WHEN i.stock_minimo IS NOT NULL THEN GREATEST(1, ROUND(i.stock_minimo / 750.0))
    ELSE NULL
  END
WHERE i.nombre = 'Agua embotellada' AND i.unidad_medida = 'ml';

UPDATE public.receta_ingredientes
SET cantidad_por_plato = 1
WHERE id IN (
  SELECT ri.id
  FROM public.receta_ingredientes ri
  INNER JOIN public.ingredientes ing ON ing.id = ri.id_ingrediente
  INNER JOIN public.recetas r ON r.id = ri.id_receta
  INNER JOIN public.items_menu im ON im.id = r.id_item_menu
  WHERE ing.nombre = 'Agua embotellada'
    AND im.nombre = 'Agua mineral'
    AND ri.cantidad_por_plato >= 100
);

DO $$
BEGIN
  ALTER TABLE public.ingredientes
    ADD CONSTRAINT ingredientes_unidad_medida_check
    CHECK (unidad_medida IN ('g', 'ml', 'piezas', 'unidades'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.recetas (id_item_menu, notas)
SELECT im.id, 'Receta FastTable'
FROM public.items_menu im
WHERE NOT EXISTS (SELECT 1 FROM public.recetas r WHERE r.id_item_menu = im.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Burger clásica'
CROSS JOIN (VALUES
  ('Pan hamburguesa', 1::numeric),
  ('Carne de hamburguesa', 150::numeric),
  ('Queso cheddar', 1::numeric),
  ('Bacon', 30::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Croquetas de jamón'
CROSS JOIN (VALUES
  ('Bechamel', 40::numeric),
  ('Jamón serrano', 35::numeric),
  ('Pan rallado', 15::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Costillas BBQ'
CROSS JOIN (VALUES
  ('Costilla de cerdo', 420::numeric),
  ('Salsa BBQ', 80::numeric),
  ('Papas', 180::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Tiramisú'
CROSS JOIN (VALUES
  ('Mascarpone', 70::numeric),
  ('Café espresso', 25::numeric),
  ('Bizcocho savoiardi', 3::numeric),
  ('Cacao en polvo', 8::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Limonada de hierbabuena'
CROSS JOIN (VALUES
  ('Limón', 2::numeric),
  ('Hierbabuena fresca', 12::numeric),
  ('Agua filtrada', 900::numeric),
  ('Azúcar', 40::numeric),
  ('Hielo', 120::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Ensalada de burrata'
CROSS JOIN (VALUES
  ('Burrata', 1::numeric),
  ('Tomate', 120::numeric),
  ('Albahaca', 4::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Tartar de atún'
CROSS JOIN (VALUES
  ('Atún fresco', 140::numeric),
  ('Aguacate', 40::numeric),
  ('Limón', 0.5::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Risotto de hongos'
CROSS JOIN (VALUES
  ('Arroz arborio', 90::numeric),
  ('Hongos', 80::numeric),
  ('Parmesano', 15::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Pescado del día'
CROSS JOIN (VALUES
  ('Pescado blanco', 200::numeric),
  ('Verduras de temporada', 100::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Agua mineral'
CROSS JOIN (VALUES
  ('Agua embotellada', 1::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Cerveza artesanal'
CROSS JOIN (VALUES
  ('Malta cervecera', 473::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Refresco'
CROSS JOIN (VALUES
  ('Lata refresco', 1::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Brownie con helado'
CROSS JOIN (VALUES
  ('Chocolate postres', 55::numeric),
  ('Helado vainilla', 70::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, i.id, v.cant
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu AND im.nombre = 'Flan de la casa'
CROSS JOIN (VALUES
  ('Huevos', 2::numeric),
  ('Leche', 120::numeric),
  ('Azúcar', 25::numeric),
  ('Caramelo', 15::numeric)
) AS v(nombre, cant)
JOIN public.ingredientes i ON i.nombre = v.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes ri2 WHERE ri2.id_receta = r.id AND ri2.id_ingrediente = i.id);

INSERT INTO public.receta_ingredientes (id_receta, id_ingrediente, cantidad_por_plato)
SELECT r.id, ing.id, 1::numeric
FROM public.recetas r
JOIN public.items_menu im ON im.id = r.id_item_menu
JOIN public.ingredientes ing ON ing.nombre = 'Agua embotellada'
WHERE NOT EXISTS (SELECT 1 FROM public.receta_ingredientes x WHERE x.id_receta = r.id)
  AND im.nombre NOT IN (
    'Burger clásica', 'Croquetas de jamón', 'Costillas BBQ', 'Tiramisú', 'Limonada de hierbabuena',
    'Ensalada de burrata', 'Tartar de atún', 'Risotto de hongos', 'Pescado del día', 'Agua mineral',
    'Cerveza artesanal', 'Refresco', 'Brownie con helado', 'Flan de la casa'
  );

SELECT public.refresh_items_menu_sin_stock_flags();

-- ========== Realtime (actualización en vivo en la app) ==========
DO $realtime$
DECLARE
  t text;
  tables text[] := ARRAY[
    'mesas',
    'fila_espera',
    'solicitudes_servicio',
    'reservas_mesa',
    'pedidos_cocina',
    'servicios_mesa',
    'items_menu',
    'personal',
    'reportes_problema',
    'ingredientes',
    'recetas',
    'receta_ingredientes',
    'movimientos_almacen'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$realtime$;

-- ========== Storage: bucket de avatares (fotos de perfil) ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS avatars_lectura_publica ON storage.objects;
CREATE POLICY avatars_lectura_publica ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_insert_propio ON storage.objects;
CREATE POLICY avatars_insert_propio ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatars_update_propio ON storage.objects;
CREATE POLICY avatars_update_propio ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatars_delete_propio ON storage.objects;
CREATE POLICY avatars_delete_propio ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

COMMIT;
