import type { Href, Router } from 'expo-router';

export const COMENSAL_MORE: Href = '/(tabs)/more';

type Nav = Pick<Router, 'back' | 'replace' | 'canGoBack'>;

/** Vuelve atrás si hay historial; si no, replace al destino seguro (evita pasar por `/` con sesión activa). */
export function navigateBackOrReplace(router: Nav, fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
