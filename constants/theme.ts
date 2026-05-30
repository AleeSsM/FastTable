/**
 * Colores del template Expo. El modo oscuro sigue `constants/palette.ts`.
 */
import { Platform } from 'react-native';

import { BRAND } from '@/constants/palette';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: BRAND.accent,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: BRAND.accent,
  },
  dark: {
    text: BRAND.text,
    background: BRAND.background,
    tint: BRAND.accentText,
    icon: BRAND.textMuted,
    tabIconDefault: BRAND.textFaint,
    tabIconSelected: BRAND.accentText,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
