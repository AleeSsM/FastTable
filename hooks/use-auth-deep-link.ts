import * as Linking from 'expo-linking';
import type { Router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { handleAuthCallbackFromUrl, hasAuthParamsInUrl } from '@/lib/auth-callback';

/**
 * Enlaces con tokens fuera de /auth/callback (p. ej. deep link antiguo).
 * La pantalla /auth/callback es la ruta principal tras los correos de Supabase.
 */
export function useAuthDeepLink(router: Router | null) {
  useEffect(() => {
    const apply = async (url: string | null) => {
      if (!url || !hasAuthParamsInUrl(url)) return;
      if (url.includes('/auth/callback')) return;

      const result = await handleAuthCallbackFromUrl(url);
      if (result.ok && router) {
        router.replace(result.next);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const href = window.location.href;
      if (hasAuthParamsInUrl(href) && !href.includes('/auth/callback')) {
        void apply(href);
      }
    }

    void Linking.getInitialURL().then((u) => apply(u));
    const sub = Linking.addEventListener('url', (e) => void apply(e.url));
    return () => sub.remove();
  }, [router]);
}
