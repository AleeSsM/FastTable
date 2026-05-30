import { Image } from 'expo-image';
import { StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import { BRAND, withAlpha, BRAND_RGB } from '@/constants/palette';

export function initialsFromName(name?: string | null): string {
  const clean = (name ?? '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).slice(0, 2);
  const ini = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  return ini || '?';
}

/**
 * Foto de perfil reutilizable (comensal y personal). Si no hay foto, muestra
 * las iniciales del nombre sobre un círculo de marca.
 */
export function Avatar({
  uri,
  name,
  size = 44,
  style,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const radius = size / 2;
  const sizeStyle = { width: size, height: size, borderRadius: radius };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[sizeStyle, styles.img, style as StyleProp<ImageStyle>]}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      style={[
        sizeStyle,
        styles.fallback,
        style,
      ]}>
      <Text style={[styles.initials, { fontSize: Math.max(11, size * 0.4) }]}>{initialsFromName(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: BRAND.surfaceElevated, borderWidth: 1, borderColor: BRAND.border },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(BRAND_RGB.accent, 0.18),
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  initials: { color: BRAND.accent, fontWeight: '800' },
});
