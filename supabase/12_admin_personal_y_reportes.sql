-- =====================================================================
-- 12 · Administración de personal (gerente) + reportes enriquecidos
-- ---------------------------------------------------------------------
-- Parche idempotente para bases ya creadas. En un bootstrap nuevo esto
-- ya queda incluido en 01_schema_bootstrap.sql.
--
-- Qué hace:
--   1. RPCs para que el GERENTE gestione personal: vincular (alta por
--      correo de una cuenta ya registrada), cambiar rol, activar/desactivar
--      y eliminar. Todo con SECURITY DEFINER porque no hay políticas de
--      escritura de personal para gerencia.
--   2. Reportes de problema: guardan quién atendió al comensal y su
--      contacto (correo + teléfono), y RPC `comensal_crear_reporte` que
--      arma todo eso del lado del servidor.
-- =====================================================================

-- ------------------------------------------------------------------
-- 1) Gestión de personal (solo gerente)
-- ------------------------------------------------------------------

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

-- Alta: vincula una cuenta YA registrada (por correo) como personal.
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

-- ------------------------------------------------------------------
-- 2) Reportes con mesero que atendió + contacto del comensal
-- ------------------------------------------------------------------

ALTER TABLE public.reportes_problema ADD COLUMN IF NOT EXISTS id_personal_atendio uuid REFERENCES public.personal (id) ON DELETE SET NULL;
ALTER TABLE public.reportes_problema ADD COLUMN IF NOT EXISTS mesero_nombre text;
ALTER TABLE public.reportes_problema ADD COLUMN IF NOT EXISTS correo_contacto text;
ALTER TABLE public.reportes_problema ADD COLUMN IF NOT EXISTS telefono_contacto text;

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

  -- Mesero del servicio más reciente del comensal (activo o cerrado).
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
