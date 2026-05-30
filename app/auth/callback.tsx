import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Comensal } from '@/constants/theme-comensal';
import { handleAuthCallbackFromUrl } from '@/lib/auth-callback';
import { getAuthRedirectUrlHints } from '@/lib/auth-redirect';

function readCallbackUrl(): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.href;
  }
  return null;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const ran = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      let url = readCallbackUrl();
      if (!url) {
        url = await Linking.getInitialURL();
      }

      const result = await handleAuthCallbackFromUrl(url);

      if (Platform.OS === 'web' && typeof window !== 'undefined' && url) {
        const clean = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, '', clean);
      }

      if (result.ok) {
        router.replace(result.next);
        return;
      }

      setMessage(result.message);
    };

    void run();
  }, [router]);

  if (message) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.box}>
          <Text style={styles.title}>No se pudo completar</Text>
          <Text style={styles.body}>{message}</Text>
          <Pressable style={styles.btn} onPress={() => router.replace('/')}>
            <Text style={styles.btnText}>Ir al inicio</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={() => router.replace('/forgot-password')}>
            <Text style={styles.linkText}>Recuperar contraseña</Text>
          </Pressable>
          <Text style={styles.hint}>
            Si el enlace del correo abre una página en blanco, en Supabase añade estas URLs permitidas:{' '}
            {getAuthRedirectUrlHints().join(' · ')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Comensal.accent} />
        <Text style={styles.loading}>Completando acceso…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Comensal.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  loading: { fontSize: 15, color: Comensal.textMuted },
  box: { flex: 1, padding: 24, paddingTop: 32, gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: Comensal.text },
  body: { fontSize: 15, lineHeight: 22, color: Comensal.textMuted },
  btn: {
    marginTop: 16,
    backgroundColor: Comensal.accent,
    paddingVertical: 14,
    borderRadius: Comensal.radiusMd,
    alignItems: 'center',
  },
  btnText: { color: Comensal.onAccent, fontSize: 16, fontWeight: '800' },
  link: { alignItems: 'center', marginTop: 8 },
  linkText: { fontSize: 15, color: Comensal.accentText },
  hint: { marginTop: 20, fontSize: 11, lineHeight: 16, color: Comensal.textFaint },
});
