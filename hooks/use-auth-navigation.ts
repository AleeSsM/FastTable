import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import {
  navigateToGuestTabsRoot,
  navigateToWelcomeRoot,
  navigateToWorkerRoot,
  isWelcomeRootPath,
} from '@/lib/navigate-root';
import { isSignOutNavigationActive } from '@/lib/sign-out-nav';
import { isAlreadyAtRoute, isOnGuestTabRoute } from '@/hooks/use-replace-when';

/** Ir al stack de tabs comensal (solo desde index / pantallas raíz). */
export function useNavigateToGuestTabsWhen(when: boolean) {
  const pathname = usePathname();
  const sent = useRef(false);

  useEffect(() => {
    if (!when || isSignOutNavigationActive()) {
      sent.current = false;
      return;
    }
    if (!isWelcomeRootPath(pathname)) {
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

/** Ir al stack worker desde bienvenida o tabs comensal (personal mal enrutado). */
export function useNavigateToWorkerWhen(when: boolean) {
  const pathname = usePathname();
  const sent = useRef(false);

  useEffect(() => {
    if (!when || isSignOutNavigationActive()) {
      sent.current = false;
      return;
    }
    const fromWelcomeOrTabs = isWelcomeRootPath(pathname) || isOnGuestTabRoute(pathname);
    if (!fromWelcomeOrTabs) {
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

const AUTH_FLOW_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/sign-out',
  '/auth/callback',
]);

function isAuthFlowPath(pathname: string): boolean {
  if (AUTH_FLOW_PATHS.has(pathname)) return true;
  return pathname.startsWith('/auth/');
}

/** Sesión expirada en tabs/worker (no durante cierre de sesión manual). */
export function useNavigateToWelcomeOnceWhen(when: boolean) {
  const pathname = usePathname();

  useEffect(() => {
    if (!when || isSignOutNavigationActive()) return;
    if (isAlreadyAtRoute(pathname, '/')) return;
    if (isAuthFlowPath(pathname)) return;
    navigateToWelcomeRoot({ force: true });
  }, [when, pathname]);
}

export { isAlreadyAtRoute, useReplaceWhen } from '@/hooks/use-replace-when';
