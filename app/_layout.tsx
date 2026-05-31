import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { DeepLinkBridge } from '@/components/deep-link-bridge';
import { AuthProvider } from '@/contexts/auth-context';
import { Comensal } from '@/constants/theme-comensal';

/** Navegación raíz: comensal e invitado. El stack `worker` redefine estilos propios. */
const RootNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Comensal.accentText,
    background: Comensal.background,
    card: Comensal.surfaceElevated,
    text: Comensal.text,
    border: Comensal.border,
    notification: Comensal.accentMuted,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={RootNavigationTheme}>
      <Head>
        <title>A la Carta</title>
      </Head>
      <AuthProvider>
        <DeepLinkBridge />
        <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="sign-out" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="register" options={{ title: 'Crear cuenta', headerBackTitle: 'Atrás' }} />
          <Stack.Screen name="login" options={{ title: 'Iniciar sesión', headerBackTitle: 'Atrás' }} />
          <Stack.Screen name="forgot-password" options={{ title: 'Recuperar contraseña', headerBackTitle: 'Atrás' }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false, title: 'Acceso' }} />
          <Stack.Screen name="reset-password" options={{ title: 'Nueva contraseña', headerBackTitle: 'Atrás' }} />
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="mis-cuentas"
            options={{
              title: 'Mis cuentas',
              headerBackTitle: 'Atrás',
              headerStyle: { backgroundColor: Comensal.surface },
              headerTitleStyle: { color: Comensal.text, fontWeight: '700' },
              headerTintColor: Comensal.accentText,
            }}
          />
          <Stack.Screen name="perfil" options={{ headerShown: false }} />
          <Stack.Screen
            name="worker"
            options={{
              headerShown: false,
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
            }}
          />
        </Stack>
        <StatusBar style="light" />
      </AuthProvider>
    </ThemeProvider>
  );
}
