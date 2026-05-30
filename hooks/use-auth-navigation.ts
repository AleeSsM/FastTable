import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import {
  navigateToGuestTabsRoot,
  navigateToWelcomeRoot,
  navigateToWorkerRoot,
} from '@/lib/navigate-root';
import { isSignOutNavigationActive } from '@/lib/sign-out-nav';
import { isAlreadyAtRoute } from '@/hooks/use-replace-when';

/** Ir al stack de tabs comensal (solo desde index / pantallas raíz). */
export function useNavigateToGuestTabsWhen(when: boolean) {
  const pathname = usePathname();
  const sent = useRef(false);

  useEffect(() => {
    if (!when || isSignOutNavigationActive()) {
      sent.current = false;
      return;
    }
    if (isAlreadyAtRoute(pathname, '/(tabs)')) {
      sent.current = false;
      return;
    }
    if (sent.current) return;
    sent.current = true;
    navigateToGuestTabsRoot();
  }, [when, pathname]);
}

/** Ir al stack worker desde index o layouts anidados. */
export function useNavigateToWorkerWhen(when: boolean) {
  const pathname = usePathname();
  const sent = useRef(false);

  useEffect(() => {
    if (!when || isSignOutNavigationActive()) {
      sent.current = false;
      return;
    }
    if (pathname.startsWith('/worker')) {
      sent.current = false;
      return;
    }
    if (sent.current) return;
    sent.current = true;
    navigateToWorkerRoot();
  }, [when, pathname]);
}

/** Sesión expirada en tabs/worker (no durante cierre de sesión manual). */
export function useNavigateToWelcomeOnceWhen(when: boolean) {
  const pathname = usePathname();

  useEffect(() => {
    if (!when || isSignOutNavigationActive()) return;
    if (isAlreadyAtRoute(pathname, '/')) return;
    navigateToWelcomeRoot({ force: true });
  }, [when, pathname]);
}

export { isAlreadyAtRoute, useReplaceWhen } from '@/hooks/use-replace-when';
