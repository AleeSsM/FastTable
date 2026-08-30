# Despliegue web

Este repositorio no apunta a una instancia ni un dominio concreto. Publica `host/` donde prefieras y usa las credenciales de tu propio proyecto Supabase.

## Variables de entorno del proveedor de hosting

Configura estas variables antes de crear el build:

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-id-de-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_publica
EXPO_PUBLIC_APP_URL=https://tu-dominio-publico.example
```

`EXPO_PUBLIC_APP_URL` no lleva barra final y debe ser el dominio final del sitio. Las variables `EXPO_PUBLIC_*` se incorporan al cliente al compilar; por eso solo se permite la URL y la clave pública de Supabase. No configures `SUPABASE_SERVICE_ROLE_KEY` en el hosting.

Compila con:

```bash
npm run build:host
```

La salida es `host/dist/`.

## Configurar Auth

En **Supabase → Authentication → URL Configuration**, configura el mismo dominio:

- **Site URL:** `https://tu-dominio-publico.example`
- **Redirect URLs:** `https://tu-dominio-publico.example/auth/callback`
- **Redirect URLs móvil:** `fasttable://auth/callback`

Después de cambiar una URL, redeploya y solicita un correo nuevo: los enlaces de autenticación ya emitidos mantienen el destino anterior.

La guía con reglas de rutas para Vercel, Netlify y Cloudflare Pages está en [`host/README.md`](../host/README.md).
