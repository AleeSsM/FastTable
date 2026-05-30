import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/** Ruta única donde Supabase devuelve tokens o `code` (confirmación, recuperación). */
export const AUTH_CALLBACK_PATH = '/auth/callback';

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function productionWebOrigin(): string | null {
  const siteUrl = process.env.EXPO_PUBLIC_APP_URL?.trim();
  return siteUrl ? siteUrl.replace(/\/$/, '') : null;
}

/** Deep link fijo de la app instalada (`app.json` → scheme `alacarta`). */
export function getNativeAuthRedirectUrl(path: string = AUTH_CALLBACK_PATH): string {
  return Linking.createURL(normalizePath(path));
}

/**
 * URL enviada a Supabase al registrarse o recuperar contraseña.
 * Web: dominio público (`EXPO_PUBLIC_APP_URL`) o el origen actual en desarrollo.
 * Móvil: siempre `alacarta://auth/callback` (no usa la URL web).
 */
export function getAuthRedirectUrl(path: string = AUTH_CALLBACK_PATH): string {
  const normalized = normalizePath(path);

  if (Platform.OS === 'web') {
    const prod = productionWebOrigin();
    if (prod) return `${prod}${normalized}`;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${normalized}`;
    }
  }

  return getNativeAuthRedirectUrl(path);
}

/** URLs que deben estar en Supabase → Redirect URLs (producción + desarrollo). */
export function getAuthRedirectUrlHints(): string[] {
  const hints: string[] = [];

  const prod = productionWebOrigin();
  if (prod) {
    hints.push(`${prod}${AUTH_CALLBACK_PATH}`);
  }

  hints.push(getNativeAuthRedirectUrl(AUTH_CALLBACK_PATH));

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const local = `${window.location.origin}${AUTH_CALLBACK_PATH}`;
    if (!hints.includes(local)) hints.unshift(local);
  } else {
    hints.push(getAuthRedirectUrl(AUTH_CALLBACK_PATH));
  }

  return [...new Set(hints)];
}
