import { router } from 'expo-router';

const COOLDOWN_MS = 1500;

const welcomeLock = { current: false };
const tabsLock = { current: false };
const workerLock = { current: false };

/** Tras cerrar sesión, desbloquea reintentos si el primer replace no cambió de stack. */
export function resetRootNavigationLocks(): void {
  welcomeLock.current = false;
  tabsLock.current = false;
  workerLock.current = false;
}

export function isWelcomeRootPath(pathname: string): boolean {
  return pathname === '/' || pathname === '';
}

function scheduleRootNavigation(
  inFlight: { current: boolean },
  go: () => void,
  force = false,
): void {
  if (!force && inFlight.current) return;
  inFlight.current = true;

  requestAnimationFrame(() => {
    try {
      go();
    } catch {
      // Navegador aún montando.
    } finally {
      setTimeout(() => {
        inFlight.current = false;
      }, COOLDOWN_MS);
    }
  });
}

type RootNavOptions = { force?: boolean };

/** Bienvenida en app/index.tsx — reemplaza el stack raíz. */
export function navigateToWelcomeRoot(options: RootNavOptions = {}): void {
  scheduleRootNavigation(
    welcomeLock,
    () => {
      router.replace('/');
    },
    options.force === true,
  );
}

/** Tabs de comensal en app/(tabs) — stack raíz. */
export function navigateToGuestTabsRoot(): void {
  scheduleRootNavigation(tabsLock, () => {
    router.replace('/(tabs)');
  });
}

/** Panel personal en app/worker — stack raíz. */
export function navigateToWorkerRoot(): void {
  scheduleRootNavigation(workerLock, () => {
    router.replace('/worker');
  });
}
