import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

/**
 * Navega con replace una sola vez cuando `when` es true.
 * Evita <Redirect> en render, que en iOS provoca "Maximum update depth exceeded".
 */
export function useReplaceWhen(when: boolean, href: Href) {
  const router = useRouter();
  const lastHref = useRef<Href | null>(null);

  useEffect(() => {
    if (!when) {
      lastHref.current = null;
      return;
    }
    if (lastHref.current === href) return;
    lastHref.current = href;
    router.replace(href);
    // router estable en expo-router; no incluirlo en deps (evita bucle de replace).
  }, [when, href]);
}
