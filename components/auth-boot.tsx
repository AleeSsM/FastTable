import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Comensal } from '@/constants/theme-comensal';
import { AcColors } from '@/constants/alacarta';

type Props = {
  variant?: 'comensal' | 'worker';
};

/** Pantalla neutra mientras auth carga o cierra sesión (evita Redirect en bucle). */
export function AuthBoot({ variant = 'comensal' }: Props) {
  const color = variant === 'worker' ? AcColors.accent : Comensal.accent;
  const bg = variant === 'worker' ? AcColors.background : Comensal.background;

  return (
    <View style={[styles.boot, { backgroundColor: bg }]}>
      <ActivityIndicator color={color} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
