/**
 * ============================================================================
 *  A la Carta — Paleta única (fuente de verdad de TODA la app)
 * ============================================================================
 *
 *  👉  Para cambiar el look de la app, edita SOLO este archivo.
 *
 *  Dirección: “Noir & Azure” — negro, blanco y azul elegante.
 *  (Los iconos del restaurante son navy/oro; la UI usa esta paleta acordada.)
 *
 *  `AcColors` y `Comensal` se derivan de aquí. Tras cambiar colores, ejecuta
 *  `npm run sync:palette` para actualizar host/site/brand.css (landing y auth).
 */

/** Colores base de marca (hex). */
export const BRAND = {
  background: '#000000',
  surface: '#0c0c0e',
  surfaceElevated: '#14161a',
  surfaceInput: '#0c0c0e',
  text: '#ffffff',
  textMuted: '#aeb6c3',
  textFaint: '#6e7685',
  border: '#232830',
  borderSubtle: '#181a1f',
  /** Azul profundo — botones y acentos sólidos */
  accent: '#2b5a8c',
  /** Azul claro — enlaces, precios y texto de acento */
  accentText: '#6ba3e0',
  /** Etiquetas, cejas y acento secundario en texto */
  accentMuted: '#8eb4e8',
  onAccent: '#ffffff',
  success: '#5ec996',
  warning: '#ecc05a',
  danger: '#ec8888',
  heroImgFallback: '#14161a',
  logoBackdrop: '#ffffff',
} as const;

export const BRAND_RGB = {
  accent: '43, 90, 140',
  accentText: '107, 163, 224',
  accentMuted: '142, 180, 232',
  success: '94, 201, 150',
  warning: '236, 192, 90',
  danger: '236, 136, 136',
  shadow: '0, 0, 0',
} as const;

/** Construye un color con transparencia a partir de un triplete RGB. */
export function withAlpha(rgb: string, alpha: number): string {
  return `rgba(${rgb}, ${alpha})`;
}

/** Radios de borde compartidos. */
export const RADII = {
  sm: 10,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

/** Opacidades reutilizables para fondos translúcidos. */
export const ALPHAS = {
  chipSelected: 0.18,
  bannerBgSoft: 0.12,
  bannerBorderSoft: 0.28,
  warnBg: 0.1,
  warnBorder: 0.28,
  badgeOk: 0.16,
  badgeBusy: 0.16,
  badgeHold: 0.14,
  overlay: 0.92,
  glowSoft: 0.08,
  glowStrong: 0.16,
} as const;
