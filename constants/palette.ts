/**
 * ============================================================================
 *  A la Carta — Paleta única (fuente de verdad de TODA la app)
 * ============================================================================
 *
 *  👉  Para cambiar el look de la app, edita SOLO este archivo.
 *
 *  Dirección: navy + crema + oro (identidad del restaurante).
 *
 *  `AcColors` y `Comensal` se derivan de aquí. Tras cambiar colores, ejecuta
 *  `npm run sync:palette` para actualizar host/site/brand.css (landing y auth).
 */

/** Colores base de marca (hex). */
export const BRAND = {
  background: '#121b2e',
  surface: '#1a2744',
  surfaceElevated: '#223454',
  surfaceInput: '#1a2744',
  text: '#f5efe3',
  textMuted: '#b4bcc8',
  textFaint: '#7a8496',
  border: '#2d4060',
  borderSubtle: '#22304a',
  /** Oro — botones y acentos sólidos */
  accent: '#b8956a',
  /** Oro claro — enlaces, precios y texto de acento */
  accentText: '#d4b896',
  /** Acento secundario en etiquetas y cejas */
  accentMuted: '#c9a86c',
  onAccent: '#121b2e',
  success: '#5ec996',
  warning: '#ecc05a',
  danger: '#ec8888',
  heroImgFallback: '#1a2744',
  logoBackdrop: '#f5efe3',
} as const;

export const BRAND_RGB = {
  accent: '184, 149, 106',
  accentText: '212, 184, 150',
  accentMuted: '201, 168, 108',
  success: '94, 201, 150',
  warning: '236, 192, 90',
  danger: '236, 136, 136',
  shadow: '18, 27, 46',
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
