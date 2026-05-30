import { resetRootNavigationLocks } from '@/lib/navigate-root';

/** Evita redirecciones automáticas a tabs/worker mientras cerramos sesión. */
let active = false;
let blockRedirectsUntil = 0;

export function markSignOutNavigationStart(): void {
  active = true;
}

export function markSignOutNavigationEnd(): void {
  active = false;
  blockRedirectsUntil = Date.now() + 4000;
  resetRootNavigationLocks();
}

export function isSignOutNavigationActive(): boolean {
  return active || Date.now() < blockRedirectsUntil;
}
