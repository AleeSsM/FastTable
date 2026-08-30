# Backend propio de A la Carta

La aplicación requiere **Supabase**, no una base PostgreSQL genérica: utiliza PostgreSQL, Auth, Storage y Realtime. Puedes usar un proyecto gratuito o de pago de [Supabase](https://supabase.com), Supabase CLI en tu equipo, o una instalación autohospedada compatible. Cada opción mantiene los datos aislados en tu propia instancia.

## Opción A: Supabase alojado (la más sencilla)

1. Crea un proyecto nuevo en tu organización de Supabase y espera a que termine de iniciarse.
2. En **SQL Editor**, abre `01_schema_bootstrap.sql`, copia todo su contenido y ejecútalo con **Run**. No uses *Explain* ni ejecutes el archivo por partes.
3. En **Project Settings → API**, copia la **Project URL** y la clave pública **anon** (o publishable, si tu proyecto muestra esa nomenclatura).
4. En la raíz del repositorio crea tu archivo local:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-id-de-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_publica
```

5. Instala y arranca la aplicación:

```bash
npm install
npm start
```

## Opción B: Supabase local

Necesitas Docker y la CLI de Supabase. Desde la raíz del repositorio inicializa y levanta una instancia local:

```bash
npx supabase init
npx supabase start
npx supabase status
```

Abre el Studio local que muestra la CLI, entra a **SQL Editor** y ejecuta `01_schema_bootstrap.sql` completo. Usa la URL local y la clave `anon` que imprime `npx supabase status` en tu `.env`. Para probar en un teléfono físico, asegúrate de que ese teléfono pueda alcanzar la URL de tu instancia; el `localhost` del ordenador no sirve directamente.

## Qué instala el esquema

`01_schema_bootstrap.sql` se ejecuta dentro de una transacción y crea las tablas, tipos, índices, RLS, políticas, RPC, triggers, publicación Realtime, bucket público `avatars` y datos iniciales de zonas, mesas, menú, ingredientes y recetas. No depende de ningún proyecto del autor.

Después del bootstrap, prueba primero el registro de un comensal desde la app. Para dar de alta el primer gerente o cualquier trabajador, añade temporalmente la clave de servicio a tu `.env` local y ejecuta:

```env
SUPABASE_SERVICE_ROLE_KEY=tu_clave_secreta_de_servicio
```

```bash
npm run staff:console
```

Elige crear personal con rol `gerente`. Esta clave tiene privilegios administrativos: nunca la publiques, nunca la nombres con `EXPO_PUBLIC_` y nunca la añadas a las variables del build web o móvil.

## Autenticación y URLs

Para desarrollo local con Expo, registra las URLs que la aplicación indique en su pantalla de callback. Para web publicada, configura en **Authentication → URL Configuration**:

| Campo | Valor |
|---|---|
| Site URL | URL pública de tu sitio, por ejemplo `https://mi-restaurante.vercel.app` |
| Redirect URLs | `https://mi-restaurante.vercel.app/auth/callback` |
| Redirect URLs | `fasttable://auth/callback` para la app instalada |

Consulta [`../host/README.md`](../host/README.md) para el flujo web completo.

## Archivos y mantenimiento

| Archivo | Uso |
|---|---|
| `01_schema_bootstrap.sql` | Instalación nueva: esquema completo y datos iniciales. |
| `00_schema_teardown.sql` | Elimina objetos A la Carta de `public`; úsalo solo en una instancia de pruebas que controles. No borra `auth.users` ni archivos de Storage. |
| `02_mesa_codigos_limpios.sql` | Migración opcional para instalaciones antiguas con códigos `M1`…`M4`. |

No ejecutes el bootstrap sobre una instalación ya usada: sus inserts iniciales pueden chocar con datos existentes. En desarrollo, si deseas empezar de cero, ejecuta primero el teardown y elimina manualmente los usuarios/archivos de prueba que ya no necesites.
