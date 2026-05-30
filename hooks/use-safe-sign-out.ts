import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { afterSignOutUiSettled, runSignOutTask } from '@/lib/sign-out';

type Options = {
  redirectTo?: Href;
};

/**
 * Cierra sesión, vacía el stack de navegación y va al inicio sin Redirect en bucle (iOS).
 */
export function useSafeSignOut(options: Options = {}) {
  const router = useRouter();
  const { signOut, finishSignOutNavigation, signingOut } = useAuth();
  const redirectTo = options.redirectTo ?? ('/' as Href);

  const safeSignOut = useCallback(() => {
    if (signingOut) return;

    runSignOutTask(async () => {
      try {
        await afterSignOutUiSettled();
        await signOut();

        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

        if (typeof router.dismissAll === 'function') {
          router.dismissAll();
        }
        router.replace(redirectTo);

        await afterSignOutUiSettled();
      } finally {
        requestAnimationFrame(() => finishSignOutNavigation());
      }
    });
  }, [signOut, finishSignOutNavigation, router, redirectTo, signingOut]);

  return { safeSignOut, signingOut };
}
