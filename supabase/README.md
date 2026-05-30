# Base de datos FastTable (Supabase)

## Instalación desde cero

1. **Supabase → SQL Editor**
2. (Opcional) Ejecutar **`00_schema_teardown.sql`** si ya existían tablas FastTable.
3. Ejecutar **`01_schema_bootstrap.sql`** completo (Run, no Explain).
4. **Authentication → Users**: crear cuentas de comensales y personal.
5. Enlazar filas en `public.personal` para cada trabajador (ver app de gerencia o consola `npm run staff:console`).

### Variables de la app

En la raíz del repo, `.env`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_URL` (web en producción)

Plantilla: `.env.example`. La *service role* solo en máquina local para scripts admin, nunca en builds de la app.

## Archivos

| Archivo | Uso |
|---------|-----|
| `00_schema_teardown.sql` | Borra objetos FastTable en `public` (no borra `auth.users`). |
| `01_schema_bootstrap.sql` | Esquema completo: tablas, RLS, RPC, seed menú/mesas/inventario, Realtime. |
| `02_mesa_codigos_limpios.sql` | Migración opcional: renombra códigos demo `M1`…`M4` → `1`…`4` en proyectos ya desplegados. |

Despliegue web: [`host/README.md`](../host/README.md).
