import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { runSignOutTask } from '@/lib/sign-out';

type Options = {
  redirectTo?: Href;
};

/**
 * Cierra sesión navegando a /sign-out (stack raíz), que limpia auth y redirige a bienvenida.
 */
export function useSafeSignOut(_options: Options = {}) {
  const router = useRouter();
  const { signingOut } = useAuth();
  const navigating = useRef(false);

  const safeSignOut = useCallback(() => {
    if (signingOut || navigating.current) return;
    navigating.current = true;
    runSignOutTask(() => {
      router.replace('/sign-out');
    });
  }, [router, signingOut]);

  return { safeSignOut, signingOut };
}
