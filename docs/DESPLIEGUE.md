# Desplegar FastTable (web + móvil) sin depender de localhost

> **Guía principal del sitio público:** [`host/README.md`](../host/README.md) (landing, APK, `/auth/*`, app web en `/app`).

Objetivo: que los correos de Supabase (confirmar cuenta, recuperar contraseña) abran la app en **internet** o en la **app instalada**, no en tu PC.

---

## Resumen en 3 piezas

| Pieza | Qué es | Para qué |
|-------|--------|----------|
| **Web** | Sitio estático en Vercel/Netlify/etc. | Personal y comensales en navegador; enlaces del correo abiertos en PC |
| **Móvil** | APK/IPA (build de Expo/EAS) | App con esquema `fasttable://` |
| **Supabase** | Site URL + Redirect URLs | Autoriza a dónde puede redirigir el enlace del correo |

---

## 1. Supabase (hazlo primero)

Dashboard → **Authentication** → **URL configuration**

1. **Site URL**  
   La URL pública de tu web (la misma que `EXPO_PUBLIC_APP_URL`):  
   `https://TU-DOMINIO/auth/callback` → **no**, solo el origen:  
   `https://TU-DOMINIO`  
   (sin `/auth/callback` en Site URL)

2. **Redirect URLs** — añade **las dos** (botón Add URL):

   ```
   https://TU-DOMINIO/auth/callback
   fasttable://auth/callback
   ```

3. Guarda.

Los correos **viejos** no se arreglan solos: pide confirmación o recuperación **otra vez** después de esto.

---

## 2. Web (Vercel — recomendado)

### Variables en Vercel (Settings → Environment Variables)

| Variable | Valor |
|----------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | Tu proyecto `.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `EXPO_PUBLIC_APP_URL` | `https://tu-proyecto.vercel.app` (o tu dominio custom) |

`EXPO_PUBLIC_APP_URL` debe ser **exactamente** la URL que pusiste en Supabase como Site URL (sin `/` al final).

### Desplegar

1. Sube el repo a GitHub.
2. [vercel.com](https://vercel.com) → Import proyecto → raíz del repo FastTable.
3. Vercel detecta `vercel.json` (build `expo export -p web`, carpeta `dist`).
4. Deploy.

Prueba: abre `https://TU-DOMINIO/auth/callback` — debe cargar la app (pantalla de carga o error de enlace vacío), **no** 404.

### Dominio propio (opcional)

En Vercel añades el dominio; actualizas `EXPO_PUBLIC_APP_URL` y las URLs en Supabase al nuevo dominio; redeploy.

---

## 3. Móvil (build instalable, no Expo Go)

Expo Go usa URLs `exp://…` que cambian: **no** sirve para producción.

### Build con EAS (recomendado)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android
# y/o
eas build --platform ios
```

El `scheme` ya está en `app.json`: `fasttable`.  
En móvil, registro y recuperación envían `fasttable://auth/callback` a Supabase (no usa `EXPO_PUBLIC_APP_URL`).

Distribuye el APK/AAB o TestFlight. El usuario abre el enlace del correo en el teléfono → debe abrir **FastTable** instalada.

### Si el enlace abre el navegador en vez de la app

- Comprueba que la app **instalada** es el build EAS, no Expo Go.
- En Android, a veces hay que elegir «Abrir con FastTable».
- `fasttable://auth/callback` debe estar en Redirect URLs de Supabase.

---

## 4. Variables locales (desarrollo opcional)

En `.env` puedes dejar Supabase y, si quieres probar como producción en web:

```env
EXPO_PUBLIC_APP_URL=https://tu-preview.vercel.app
```

En móvil con `expo start`, los correos seguirán usando `fasttable://…` o `exp://…` según el cliente; para pruebas reales de correo en producción usa el build instalado + web desplegada.

---

## 5. Comprobar que todo encaja

| Prueba | Esperado |
|--------|----------|
| Recuperar contraseña **desde la web desplegada** | Correo → enlace `https://TU-DOMINIO/auth/callback?...` → «Completando acceso…» → nueva contraseña |
| Recuperar contraseña **desde la app instalada** | Correo → enlace `fasttable://...` → abre la app → nueva contraseña |
| Registro con confirmación de correo | Igual según hayas usado web o móvil al registrarte |

---

## Checklist rápido

- [ ] Web desplegada con HTTPS
- [ ] `EXPO_PUBLIC_APP_URL` = esa URL en Vercel y en `.env` de build
- [ ] Supabase Site URL = misma URL (sin path)
- [ ] Supabase Redirect: `https://…/auth/callback` + `fasttable://auth/callback`
- [ ] App móvil con build EAS (no solo Expo Go)
- [ ] Pedir **correo nuevo** después de cambiar Supabase

---

## Alternativas a Vercel

Cualquier host estático sirve si redirige todas las rutas a `index.html` (SPA):

- **Netlify**: `public` = carpeta `dist` tras `npx expo export -p web`, archivo `_redirects`: `/* /index.html 200`
- **Cloudflare Pages**: build `npx expo export -p web`, output `dist`, SPA fallback

El backend sigue en Supabase; no necesitas un servidor Node para la app.
