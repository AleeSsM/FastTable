# Base de datos FastTable (Supabase)

Dos scripts SQL son la fuente de verdad del esquema. Todo lo que usa la app móvil hoy (reservas por día, sesión comensal, inventario, Realtime) está incluido en el bootstrap.

## Instalación desde cero

1. **Supabase → SQL Editor**
2. (Opcional) Ejecutar **`00_schema_teardown.sql`** si ya existían tablas FastTable.
3. Ejecutar **`01_schema_bootstrap.sql`** completo (Run, no Explain). Incluye `BEGIN`…`COMMIT`.
4. **Authentication → Users**: crear cuentas (comensales y, si quieres demo, personal). Ver **`demo-accounts.txt`**.
5. Enlazar personal demo con el bloque SQL de la sección [Personal demo](#personal-demo) (después de crear usuarios en Auth).
6. **Project Settings → Realtime**: Realtime habilitado en el proyecto (las tablas se registran en el bootstrap).

### Variables de la app

En la raíz del repo, `.env` con:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Plantilla: `.env.example`. La *service role* solo en máquina local para scripts admin, nunca en builds de la app.

---

## Archivos

| Archivo | Uso |
|---------|-----|
| `00_schema_teardown.sql` | Borra objetos FastTable en `public` (no borra `auth.users`). |
| `01_schema_bootstrap.sql` | Esquema completo: tablas, RLS, RPC, seed menú/mesas/inventario, Realtime. |
| `02_patch_inventario.sql` | Solo inventario en proyecto ya desplegado: columna `categoria` + datos demo (sin teardown). |
| `03_patch_unidades_inventario.sql` | Unidades `g` / `ml` / `piezas` / `unidades`; agua embotellada por pieza (sin teardown). |
| `04_patch_mesas_admin_gerente.sql` | RLS: gerente puede crear y eliminar mesas (admin en app). |
| `05_servicios_mesa_mesero_pedidos.sql` | Servicios por mesa, pedidos del mesero, cuenta unificada y recibos al cerrar. |
| `06_terminar_servicio_mesa_unificado.sql` | Cierre de servicio igual para comensal y mesero; pedidos sin mezclar visitas. |
| `demo-accounts.txt` | Correos y contraseña de cuentas demo de personal. |
| `SCHEMA_CHANGE_GUIDE.txt` | Notas para alterar el esquema con cuidado en producción. |

---

## Personal demo

Tras crear en Auth los cuatro usuarios de `demo-accounts.txt`, ejecuta en SQL Editor:

```sql
INSERT INTO public.personal (id_usuario, nombre_visible, rol, activo)
SELECT
  u.id,
  'Demo ' || v.rol::text,
  v.rol,
  true
FROM auth.users u
JOIN (
  VALUES
    ('demo-anfitrion@ftdemo.local', 'anfitrion'::public.rol_personal),
    ('demo-mesero@ftdemo.local', 'mesero'::public.rol_personal),
    ('demo-gerente@ftdemo.local', 'gerente'::public.rol_personal),
    ('demo-cocina@ftdemo.local', 'cocina'::public.rol_personal)
) AS v(email, rol) ON lower(u.email) = lower(v.email)
ON CONFLICT (id_usuario) DO UPDATE SET
  nombre_visible = EXCLUDED.nombre_visible,
  rol = EXCLUDED.rol,
  activo = true;
```

---

## Qué incluye el bootstrap (alineado con la app)

- Reservas por día de servicio (`mesas_con_reserva_activa_en_dia_servicio`, capacidad de mesa).
- Cuenta comensal por visita (`id_reserva_mesa` / `id_fila_espera` en pedidos; terminar servicio independiente por comensal).
- Inventario gerente (ingredientes, recetas, stock, `gerente_almacen_*`, `sin_stock` en menú).
- Realtime en mesas, fila, pedidos, menú, personal, reportes e inventario.

**Proyecto ya en producción:** en SQL Editor, en orden si aplica: **`02_patch_inventario.sql`** (categorías), **`03_patch_unidades_inventario.sql`** (piezas vs gramos/ml), **`04_patch_mesas_admin_gerente.sql`** (CRUD mesas gerente). Para otros cambios, usa `SCHEMA_CHANGE_GUIDE.txt` o reinstala con teardown + bootstrap en un entorno de prueba primero.
