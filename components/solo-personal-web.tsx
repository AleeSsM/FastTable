import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Comensal } from '@/constants/theme-comensal';
import { useSafeSignOut } from '@/hooks/use-safe-sign-out';

/** Aviso en web para clientes: la versión de navegador es solo para personal. */
export function SoloPersonalWeb() {
  const { safeSignOut, signingOut } = useSafeSignOut();

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.brand}>A la Carta</Text>
        <View style={styles.rule} />
        <Text style={styles.title}>Versión web exclusiva para personal</Text>
        <Text style={styles.body}>
          El acceso desde el navegador es para el equipo del restaurante (gerencia, anfitrión,
          cocina y meseros).
        </Text>
        <Text style={styles.body}>
          Si eres cliente, usa la app de A la Carta en tu teléfono para reservar mesa, ver el menú y
          pedir servicio.
        </Text>
        <Pressable
          style={[styles.btn, signingOut && styles.btnDisabled]}
          onPress={safeSignOut}
          disabled={signingOut}>
          {signingOut ? (
            <ActivityIndicator color={Comensal.onAccent} />
          ) : (
            <Text style={styles.btnText}>Cerrar sesión</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Comensal.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: Comensal.surfaceElevated,
    borderRadius: Comensal.radiusLg,
    borderWidth: 1,
    borderColor: Comensal.border,
    padding: 28,
    gap: 14,
  },
  brand: { fontSize: 28, fontWeight: '800', color: Comensal.text, letterSpacing: 0.8 },
  rule: { width: 64, height: 3, borderRadius: 99, backgroundColor: Comensal.accent },
  title: { fontSize: 20, fontWeight: '700', color: Comensal.text, marginTop: 4 },
  body: { fontSize: 15, lineHeight: 23, color: Comensal.textMuted },
  btn: {
    marginTop: 10,
    backgroundColor: Comensal.accent,
    paddingVertical: 14,
    borderRadius: Comensal.radiusMd,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: Comensal.onAccent, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});
