/**
 * Fondos translúcidos derivados de `constants/palette.ts`.
 * Usar en lugar de rgba hardcodeados en worker, admin y web.
 */
import { ALPHAS, BRAND_RGB, withAlpha } from '@/constants/palette';

export const SemanticSurfaces = {
  accentChip: withAlpha(BRAND_RGB.accent, ALPHAS.chipSelected),
  accentPill: withAlpha(BRAND_RGB.accent, 0.16),
  successBadge: withAlpha(BRAND_RGB.success, ALPHAS.badgeOk),
  successBanner: withAlpha(BRAND_RGB.success, 0.2),
  successSwitch: withAlpha(BRAND_RGB.success, 0.45),
  warningBadge: withAlpha(BRAND_RGB.warning, ALPHAS.badgeHold),
  warningBanner: withAlpha(BRAND_RGB.warning, 0.2),
  warningSoft: withAlpha(BRAND_RGB.warning, 0.15),
  dangerBadge: withAlpha(BRAND_RGB.danger, ALPHAS.badgeBusy),
  dangerSoft: withAlpha(BRAND_RGB.danger, 0.15),
  dangerBorder: withAlpha(BRAND_RGB.danger, 0.4),
  overlay: withAlpha(BRAND_RGB.shadow, 0.55),
  overlayStrong: withAlpha(BRAND_RGB.shadow, 0.72),
  overlayModal: withAlpha(BRAND_RGB.shadow, 0.75),
  navGlass: withAlpha(BRAND_RGB.shadow, 0.6),
  navGlassScrolled: withAlpha(BRAND_RGB.shadow, 0.85),
} as const;
