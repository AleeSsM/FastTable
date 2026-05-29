import type { Href } from 'expo-router';

import { formatAuthErrorMessage } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export type AuthCallbackParams = {
  access_token: string | null;
  refresh_token: string | null;
  type: string | null;
  code: string | null;
  error: string | null;
  error_description: string | null;
};

/** Lee tokens, `code` (PKCE) y errores del hash o query del enlace de Supabase. */
export function parseAuthParamsFromUrl(url: string): AuthCallbackParams {
  const hashPart = url.includes('#') ? (url.split('#')[1] ?? '') : '';
  const beforeHash = url.split('#')[0] ?? '';
  const queryPart = beforeHash.includes('?') ? (beforeHash.split('?')[1] ?? '') : '';

  const fromHash = new URLSearchParams(hashPart);
  const fromQuery = new URLSearchParams(queryPart);

  const pick = (key: string) => fromHash.get(key) ?? fromQuery.get(key);

  return {
    access_token: pick('access_token'),
    refresh_token: pick('refresh_token'),
    type: pick('type'),
    code: pick('code'),
    error: pick('error'),
    error_description: pick('error_description'),
  };
}

export function hasAuthParamsInUrl(url: string): boolean {
  const p = parseAuthParamsFromUrl(url);
  return Boolean(
    p.code || (p.access_token && p.refresh_token) || p.error || p.error_description,
  );
}

function nextRouteAfterAuth(type: string | null): Href {
  if (type === 'recovery') return '/reset-password' as Href;
  return '/' as Href;
}

export type AuthCallbackResult =
  | { ok: true; next: Href }
  | { ok: false; message: string };

/**
 * Aplica sesión desde el enlace del correo (confirmación o recuperación).
 */
export async function handleAuthCallbackFromUrl(url: string | null): Promise<AuthCallbackResult> {
  if (!url || !hasAuthParamsInUrl(url)) {
    return { ok: false, message: 'El enlace no contiene datos de autenticación. Pide uno nuevo.' };
  }

  const params = parseAuthParamsFromUrl(url);

  if (params.error) {
    const raw = params.error_description ?? params.error;
    if (raw.toLowerCase().includes('otp_expired') || raw.toLowerCase().includes('expired')) {
      return {
        ok: false,
        message: 'El enlace caducó o ya se usó. Solicita otro desde la app.',
      };
    }
    return { ok: false, message: formatAuthErrorMessage(raw) };
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) return { ok: false, message: formatAuthErrorMessage(error.message) };
    return { ok: true, next: nextRouteAfterAuth(params.type) };
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) return { ok: false, message: formatAuthErrorMessage(error.message) };
    return { ok: true, next: nextRouteAfterAuth(params.type) };
  }

  return { ok: false, message: 'Enlace incompleto. Abre de nuevo el correo o pide otro enlace.' };
}
