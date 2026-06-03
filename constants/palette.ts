/**
 * ============================================================================
 *  FastTable — Paleta única (fuente de verdad de TODA la app)
 * ============================================================================
 *
 *  👉  Para cambiar el look de la app, edita SOLO este archivo.
 *
 *  `FtColors` (personal/worker) y `Comensal` (comensal) se derivan de aquí,
 *  así que no hay que tocar cada pantalla: cambias el color una vez y se
 *  propaga a todos lados.
 *
 *  Si cambias un color de marca (p. ej. `accent`), actualiza también su
 *  versión RGB en `BRAND_RGB` para que los fondos translúcidos (badges,
 *  banners, glows) sigan coincidiendo.
 */

/** Colores base de marca (hex). Cambia aquí para reskin global. */
export const BRAND = {
  background: '#06080f',
  surface: '#0f1524',
  surfaceElevated: '#161f34',
  surfaceInput: '#0b1220',
  text: '#f4f7ff',
  textMuted: '#a4afc4',
  textFaint: '#6d7890',
  border: '#2a3b61',
  borderSubtle: '#1b2944',
  /** Azul eléctrico + violeta profundo (look premium tech) */
  accent: '#7c8cff',
  accentMuted: '#5f6ece',
  /** Texto sobre botones con acento */
  onAccent: '#f5f7ff',
  success: '#63c8a4',
  warning: '#f0bd73',
  danger: '#e47f9e',
  /** Relleno de imagen/hero mientras carga */
  heroImgFallback: '#1b2440',
} as const;

/**
 * Versiones RGB ("r, g, b") de los colores que necesitan transparencia.
 * Deben coincidir con los hex de `BRAND`.
 */
export const BRAND_RGB = {
  accent: '124, 140, 255',
  success: '99, 200, 164',
  warning: '240, 189, 115',
  danger: '228, 127, 158',
  /** Tono base para sombras y overlays (≈ background) */
  shadow: '4, 7, 14',
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
  chipSelected: 0.2,
  bannerBgSoft: 0.14,
  bannerBorderSoft: 0.36,
  warnBg: 0.12,
  warnBorder: 0.34,
  badgeOk: 0.18,
  badgeBusy: 0.2,
  badgeHold: 0.18,
  overlay: 0.9,
  glowSoft: 0.18,
  glowStrong: 0.3,
} as const;
