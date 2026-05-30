# A la Carta — Carpeta `host/` (todo lo que subes a internet)

Aquí vive **un solo sitio web** con todo lo público:

| Ruta en tu dominio | Qué es |
|--------------------|--------|
| `/` | Landing (presentación + descarga) |
| `/apk/alacarta.apk` | Instalable Android (tú subes el archivo) |
| `/auth/callback` | Enlace del correo (confirmar cuenta / recuperar) |
| `/auth/reset-password` | Pantalla para poner contraseña nueva |
| `/auth/confirmado` | Mensaje tras confirmar el correo |
| `/app/` | App web completa (comensal + **personal**: mesero, cocina, gerente…) |

La app móvil nativa sigue siendo aparte (APK/EAS); los correos en el teléfono usan `alacarta://auth/callback` (ya configurado en el código de la app).

---

## Estructura de carpetas

```
host/
├── README.md              ← esta guía
├── vercel.json            ← reglas de despliegue (Vercel)
├── scripts/build.mjs      ← arma host/dist
├── site/                  ← archivos estáticos (editas aquí)
│   ├── index.html         ← landing
│   ├── styles.css
│   ├── script.js
│   ├── auth/              ← verificación y contraseña
│   ├── apk/               ← pon alacarta.apk aquí
│   └── config.template.js
└── dist/                  ← GENERADO (no editar; se sube al host)
```

La carpeta **`host/site/`** es la landing que se publica en Vercel.

---

## Antes de desplegar (una vez)

### 1. Archivo `.env` en la raíz del proyecto

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
EXPO_PUBLIC_APP_URL=https://tu-proyecto.vercel.app
```

`EXPO_PUBLIC_APP_URL` = la URL **final** de tu sitio (sin `/` al final).  
Cuando tengas dominio propio, cámbiala (ej. `https://alacarta.ipn.mx`).

### 2. Supabase → Authentication → URL configuration

| Campo | Valor |
|--------|--------|
| **Site URL** | `https://tu-proyecto.vercel.app` (igual que `EXPO_PUBLIC_APP_URL`) |
| **Redirect URLs** | `https://tu-proyecto.vercel.app/auth/callback` |
| | `alacarta://auth/callback` |

Guarda. Los correos viejos no valen: pide **enlace nuevo** después de esto.

### 3. APK Android

1. Genera el APK (EAS Build o tu pipeline).
2. Cópialo como: `host/site/apk/alacarta.apk`
3. Vuelve a ejecutar el build del host (abajo).

---

## Generar el sitio en tu PC

Desde la **raíz** del repo:

```bash
npm run build:host
```

Crea `host/dist/` con landing + auth + apk + app en `/app`.

Probar en local:

```bash
cd host
npm run preview
```

Abre `http://localhost:3333` (landing), `http://localhost:3333/app/` (app web), `http://localhost:3333/auth/callback.html` (vacío sin token).

---

## Dónde subirlo — Vercel (recomendado)

### Opción A — Proyecto con carpeta `host` (recomendada)

1. Sube el repo a **GitHub**.
2. [vercel.com](https://vercel.com) → **Add New Project** → importa el repositorio.
3. Configuración:
   - **Root Directory:** `host`
   - Framework: Other (Vercel lee `host/vercel.json`)
4. **Environment Variables** (las mismas del `.env`):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_APP_URL` → `https://TU-PROYECTO.vercel.app` (la URL que te asigne Vercel la primera vez; luego redeploy si cambias dominio)
5. **Deploy**.

### Opción B — Raíz del repo

Si no quieres cambiar Root Directory, en la raíz ya está `vercel.json` que ejecuta `npm run build:host` y publica `host/dist`.

Variables de entorno: igual que arriba, en el proyecto de Vercel.

### Después del primer deploy

1. Copia la URL que te dio Vercel (ej. `https://fast-table.vercel.app`).
2. Ponla en `EXPO_PUBLIC_APP_URL` (Vercel env + tu `.env`).
3. Actualiza **Supabase** Site URL y Redirect con esa URL.
4. **Redeploy** en Vercel.
5. Pide un correo nuevo de prueba (recuperar contraseña).

---

## Otras plataformas

| Plataforma | Qué subes | Notas |
|------------|-----------|--------|
| **Netlify** | Carpeta `host/dist` tras `npm run build:host` | Build command: `npm run build:host`, publish: `host/dist` |
| **Cloudflare Pages** | Igual | SPA: redirects `/app/*` → `/app/index.html` |
| **GitHub Pages** | Solo si configuras rutas; Vercel es más simple para `/app` | |

---

## App móvil (APK instalado)

### Setup (una vez)

```bash
npm install
npx eas login
npx eas init
```

Configura en [expo.dev](https://expo.dev) → proyecto → **Environment variables** (perfil `preview`):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_URL` → `https://fast-table.vercel.app`

Package Android fijo: `com.alacarta.app` (en `app.json`). El slug de Expo sigue `FastTable` (ID del proyecto EAS); el nombre visible de la app es **A la Carta**.

### Generar APK

**Primera vez:** EAS debe crear el keystore de Android (solo una vez). Ejecuta en terminal **sin** `--non-interactive` y acepta que Expo genere las credenciales:

```bash
npm run build:apk
```

Cuando te pregunte por el keystore, elige **Let Expo handle it** (recomendado). EAS lo guarda en la nube; no lo pierdas.

Builds siguientes (o CI) pueden usar `npm run build:apk:ci`.

1. Descarga el APK desde el dashboard de Expo.
2. Colócalo en `host/site/apk/alacarta.apk`.
3. `npm run build:host` + redeploy.

Para Play Store (AAB): `npm run build:android:production`.

Los usuarios que abren el correo **en el teléfono con la app instalada** usan el deep link; los que abren en **PC** usan `https://…/auth/callback`.

---

## Checklist rápido

- [ ] `.env` con Supabase + `EXPO_PUBLIC_APP_URL`
- [ ] Supabase: Site URL + 2 Redirect URLs
- [ ] `npm run build:host` sin errores
- [ ] `alacarta.apk` en `host/site/apk/`
- [ ] Deploy en Vercel (u otro)
- [ ] Redeploy tras fijar la URL final en env y Supabase
- [ ] Probar: landing → descarga APK → `/app/` login personal → correo recuperación

---

## Problemas frecuentes

**404 al abrir el enlace del correo**  
→ Falta la redirect URL en Supabase o `EXPO_PUBLIC_APP_URL` no coincide con el dominio real.

**APK no descarga**  
→ No hay archivo en `host/site/apk/alacarta.apk` o no hiciste build + deploy después de copiarlo.

**`/app/` en blanco**  
→ Casi siempre: el build web no incrustó `EXPO_PUBLIC_SUPABASE_*` (revisa que existan en Vercel **antes** del deploy y redeploy). El código usa referencias estáticas en `constants/env.ts` para que Metro las embeba.  
→ También: falló `expo export` en los logs de Vercel.  
→ En consola del navegador (F12) puede aparecer: *Falta EXPO_PUBLIC_SUPABASE_URL…*

**`config.js` con `siteUrl: ""`**  
→ Falta `EXPO_PUBLIC_APP_URL` en el build; pon `https://tu-proyecto.vercel.app` en Vercel y redeploy (afecta enlaces de correo, no solo la landing).

**Personal no entra**  
→ Misma cuenta que en móvil; en web `/app/` → inicio de sesión → redirige a `/app/worker` si es personal.  
→ Si eres **comensal** (sin fila en `personal`), la web muestra el aviso «Versión web exclusiva para personal» (comportamiento esperado).

---

## Resumen: qué haces tú

1. Configuras `.env` y Supabase.  
2. Pones el APK en `host/site/apk/`.  
3. `npm run build:host`.  
4. Subes **`host/dist`** con Vercel (carpeta `host` o script en raíz).  
5. Ajustas URL en env + Supabase y redeploy.  
6. Generas el APK móvil con EAS cuando toque producción en tienda.

Dudas de dominio o IPN: usa la URL de Vercel primero; el dominio custom se cambia después sin tocar código, solo env y Supabase.
