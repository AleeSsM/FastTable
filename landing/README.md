# FastTable — Landing page (copia histórica)

La versión que se **publica en internet** está en **`host/site/`** (ver [`host/README.md`](../host/README.md)).

Esta carpeta `landing/` se mantiene como referencia; edita y despliega desde `host/`.
Sirve para mostrar la app y, más adelante, enlazar la descarga en Google Play.

## Estructura

```
landing/
├── index.html   → estructura y contenido
├── styles.css   → estilos (paleta premium oscura de FastTable)
├── script.js    → nav móvil, animaciones y botones de descarga
└── README.md    → este archivo
```

## Cómo verla

No necesita servidor: abre `index.html` en el navegador (doble clic).

Si prefieres servirla localmente:

```bash
# desde la carpeta landing/
npx serve .
# o
python -m http.server 5500
```

## Secciones

- **Hero** con mockup de teléfono animado (imagen provisional hecha en CSS).
- **Funciones** (tiempo real, pedidos por mesa, recibos, indicadores, roles, móvil).
- **Roles**: Comensal, Sala, Cocina, Gerencia.
- **Cómo funciona**: 3 pasos.
- **Descargar**: botones de Google Play y APK demo + QR provisional.
- **Footer**.

## Activar la descarga (cuando publiques)

Edita las constantes al inicio de `script.js`:

```js
const DOWNLOAD_LINKS = {
  play: "https://play.google.com/store/apps/details?id=...", // link real de Play Store
  apk: "https://.../fasttable.apk",                          // o descarga directa
};
```

- Si la cadena está **vacía** (`""`), el botón muestra el aviso de "próximamente".
- Si tiene un enlace, el botón abre ese enlace en una pestaña nueva.

## Cambiar la paleta (reskin)

Toda la paleta vive en **un solo lugar**: el bloque `:root { ... }` al inicio de
`styles.css`, sección **BRAND**. Cambia los hex y, si tocas un color con
transparencia (acento, éxito, etc.), actualiza también su versión `-rgb`
correspondiente. Los glows, badges y banners se recalculan solos.

## Notas

- Las imágenes son **provisionales** (mockups y QR generados con CSS), pensadas para
  revisar el diseño. Se pueden cambiar por capturas reales o un QR auténtico después.
- Es 100% estático: se puede publicar tal cual en GitHub Pages, Vercel o Netlify.
