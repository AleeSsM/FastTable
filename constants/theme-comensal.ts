/**
 * Tema visual del comensal. Se DERIVA de `constants/palette.ts`.
 *
 * No edites los colores aquí: cambia `BRAND` en `constants/palette.ts` y se
 * actualiza en toda la app. Este archivo solo arma los tokens (incluidos los
 * fondos translúcidos) que ya usan las pantallas del comensal.
 */
import { ALPHAS, BRAND, BRAND_RGB, RADII, withAlpha } from '@/constants/palette';

export const Comensal = {
  background: BRAND.background,
  surface: BRAND.surface,
  surfaceElevated: BRAND.surfaceElevated,
  surfaceInput: BRAND.surfaceInput,
  text: BRAND.text,
  textMuted: BRAND.textMuted,
  textFaint: BRAND.textFaint,
  border: BRAND.border,
  borderSubtle: BRAND.borderSubtle,
  /** Azul elegante (botones y acentos) */
  accent: BRAND.accent,
  accentText: BRAND.accentText,
  accentMuted: BRAND.accentMuted,
  onAccent: BRAND.onAccent,
  success: BRAND.success,
  warning: BRAND.warning,
  danger: BRAND.danger,
  overlay: withAlpha(BRAND_RGB.shadow, ALPHAS.overlay),
  chipSelectedBg: withAlpha(BRAND_RGB.accent, ALPHAS.chipSelected),
  mesaBannerBg: withAlpha(BRAND_RGB.success, ALPHAS.bannerBgSoft),
  mesaBannerBorder: withAlpha(BRAND_RGB.success, ALPHAS.bannerBorderSoft),
  warnBannerBg: withAlpha(BRAND_RGB.warning, ALPHAS.warnBg),
  warnBannerBorder: withAlpha(BRAND_RGB.warning, ALPHAS.warnBorder),
  badgeOkBg: withAlpha(BRAND_RGB.success, ALPHAS.badgeOk),
  badgeBusyBg: withAlpha(BRAND_RGB.danger, ALPHAS.badgeBusy),
  badgeHoldBg: withAlpha(BRAND_RGB.warning, ALPHAS.badgeHold),
  heroImgFallback: BRAND.heroImgFallback,
  glowSoft: withAlpha(BRAND_RGB.accent, ALPHAS.glowSoft),
  glowStrong: withAlpha(BRAND_RGB.accent, ALPHAS.glowStrong),
  radiusSm: RADII.sm,
  radiusMd: RADII.md,
  radiusLg: RADII.lg,
  radiusPill: RADII.pill,
} as const;
