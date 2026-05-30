import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

function hrefToPath(href: Href): string {
  if (typeof href === 'string') return href;
  return href.pathname ?? '/';
}

const TAB_SEGMENT_NAMES = new Set(['index', 'queue', 'menu', 'service', 'more']);

function isOnGuestTabRoute(pathname: string): boolean {
  if (pathname.startsWith('/(tabs)')) return true;
  const first = pathname.replace(/^\//, '').split('/')[0];
  return TAB_SEGMENT_NAMES.has(first);
}

/** true si la ruta actual ya coincide con el destino del replace. */
export function isAlreadyAtRoute(pathname: string, target: string): boolean {
  if (pathname === target) return true;
  if (target === '/' && (pathname === '/' || pathname === '')) return true;
  if (target === '/(tabs)' && isOnGuestTabRoute(pathname)) return true;
  if (target.startsWith('/worker') && pathname.startsWith('/worker')) {
    return target === '/worker' || pathname.startsWith(`${target}/`) || pathname === target;
  }
  return false;
}

/**
 * Navega con replace una sola vez cuando `when` es true.
 * Solo para rutas dentro del mismo navigator (login, admin, etc.).
 */
export function useReplaceWhen(when: boolean, href: Href) {
  const router = useRouter();
  const pathname = usePathname();
  const target = hrefToPath(href);
  const lastAttempt = useRef<string | null>(null);

  useEffect(() => {
    if (!when) {
      lastAttempt.current = null;
      return;
    }

    if (isAlreadyAtRoute(pathname, target)) {
      lastAttempt.current = null;
      return;
    }

    const attemptKey = `${pathname}->${target}`;
    if (lastAttempt.current === attemptKey) return;
    lastAttempt.current = attemptKey;

    const run = () => router.replace(href);

    if (Platform.OS === 'ios') {
      requestAnimationFrame(run);
    } else {
      run();
    }
  }, [when, href, pathname, target]);
}
