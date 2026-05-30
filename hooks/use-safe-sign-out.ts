import type { Href } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { navigateToWelcomeRoot } from '@/lib/navigate-root';
import {
  markSignOutNavigationEnd,
  markSignOutNavigationStart,
} from '@/lib/sign-out-nav';
import {
  afterSignOutNavigationSettled,
  afterSignOutUiSettled,
  runSignOutTask,
} from '@/lib/sign-out';

type Options = {
  redirectTo?: Href;
};

/**
 * Cierra sesión: una sola navegación a bienvenida, luego limpia Supabase.
 */
export function useSafeSignOut(_options: Options = {}) {
  const { beginSignOut, signOut, finishSignOutNavigation, signingOut } = useAuth();

  const safeSignOut = useCallback(() => {
    if (signingOut) return;

    runSignOutTask(async () => {
      markSignOutNavigationStart();

      try {
        await afterSignOutUiSettled();
        beginSignOut();
        navigateToWelcomeRoot();
        await afterSignOutNavigationSettled();
        await signOut();
        await afterSignOutUiSettled();
      } finally {
        finishSignOutNavigation();
        markSignOutNavigationEnd();
      }
    });
  }, [beginSignOut, signOut, finishSignOutNavigation, signingOut]);

  return { safeSignOut, signingOut };
}
