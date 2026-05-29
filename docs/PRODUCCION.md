# FastTable en producción (Vercel)

Sitio publicado:

| Qué | URL |
|-----|-----|
| Landing | https://fast-table.vercel.app |
| App web (comensal + personal) | https://fast-table.vercel.app/app/ |
| Auth (enlaces del correo) | https://fast-table.vercel.app/auth/callback |

## Variables en Vercel (no van en GitHub)

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_URL` = `https://fast-table.vercel.app`

Tras cambiar variables → **Redeploy** en Vercel.

## Supabase → Authentication → URL configuration

- **Site URL:** `https://fast-table.vercel.app`
- **Redirect URLs:**
  - `https://fast-table.vercel.app/auth/callback`
  - `fasttable://auth/callback`

## Build local del mismo sitio que Vercel

```bash
npm run build:host
```

Salida: `host/dist/` (no se sube a git).
