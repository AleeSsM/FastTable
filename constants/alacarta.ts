/**
 * Paleta del personal (worker). Se DERIVA de `constants/palette.ts`.
 *
 * No edites los colores aquí: cambia `BRAND` en `constants/palette.ts` y se
 * actualiza en toda la app.
 */
import { BRAND } from '@/constants/palette';
import { SemanticSurfaces } from '@/constants/semantic-surfaces';

export const AcColors = {
  background: BRAND.background,
  surface: BRAND.surface,
  surfaceElevated: BRAND.surfaceElevated,
  text: BRAND.text,
  textMuted: BRAND.textMuted,
  textFaint: BRAND.textFaint,
  border: BRAND.border,
  borderSubtle: BRAND.borderSubtle,
  accent: BRAND.accent,
  accentText: BRAND.accentText,
  accentMuted: BRAND.accentMuted,
  onAccent: BRAND.onAccent,
  success: BRAND.success,
  warning: BRAND.warning,
  danger: BRAND.danger,
} as const;

export { SemanticSurfaces as AcSurfaces };

/** @deprecated Usa `AcColors`. */
export const FtColors = AcColors;

/** @deprecated Usa `AcSurfaces`. */
export const FtSurfaces = SemanticSurfaces;
