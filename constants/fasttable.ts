/**
 * Paleta del personal (worker). Se DERIVA de `constants/palette.ts`.
 *
 * No edites los colores aquí: cambia `BRAND` en `constants/palette.ts` y se
 * actualiza en toda la app. Este archivo solo expone los tokens que ya usan
 * las pantallas del personal, para no tener que tocar sus imports.
 */
import { BRAND } from '@/constants/palette';

export const FtColors = {
  background: BRAND.background,
  surface: BRAND.surface,
  surfaceElevated: BRAND.surfaceElevated,
  text: BRAND.text,
  textMuted: BRAND.textMuted,
  textFaint: BRAND.textFaint,
  border: BRAND.border,
  borderSubtle: BRAND.borderSubtle,
  accent: BRAND.accent,
  accentMuted: BRAND.accentMuted,
  /** Texto sobre botones con acento */
  onAccent: BRAND.onAccent,
  success: BRAND.success,
  warning: BRAND.warning,
  danger: BRAND.danger,
} as const;
