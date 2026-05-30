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

## Si el enlace del correo abre solo la landing

1. **Site URL** debe ser `https://fast-table.vercel.app` (no `localhost:3000`).
2. **Redirect URLs** debe incluir `https://fast-table.vercel.app/auth/callback`.
3. Tras cambiar URLs en Supabase, pide un **correo nuevo** (enlaces viejos siguen con la URL antigua).
4. Redeploy en Vercel si cambiaste `EXPO_PUBLIC_APP_URL`.


```bash
npm run build:host
```

Salida: `host/dist/` (no se sube a git).
