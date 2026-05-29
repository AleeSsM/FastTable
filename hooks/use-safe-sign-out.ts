import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { afterSignOutUiSettled, runSignOutTask } from '@/lib/sign-out';

type Options = {
  /** Tras cerrar sesión (por defecto pantalla de bienvenida). */
  redirectTo?: Href;
};

/**
 * Cierra sesión y navega fuera de worker/tabs sin depender solo de Redirect en iOS.
 */
export function useSafeSignOut(options: Options = {}) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const redirectTo = options.redirectTo ?? ('/' as Href);

  const safeSignOut = useCallback(() => {
    if (signingOut) return;
    setSigningOut(true);

    runSignOutTask(async () => {
      try {
        await afterSignOutUiSettled();
        await signOut();
        router.replace(redirectTo);
      } finally {
        setSigningOut(false);
      }
    });
  }, [signOut, router, redirectTo, signingOut]);

  return { safeSignOut, signingOut };
}
