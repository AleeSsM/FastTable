/** Evita redirecciones automáticas a tabs/worker mientras cerramos sesión. */
let active = false;

export function markSignOutNavigationStart(): void {
  active = true;
}

export function markSignOutNavigationEnd(): void {
  active = false;
}

export function isSignOutNavigationActive(): boolean {
  return active;
}
