import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type WorkerRol = 'gerente' | 'anfitrion' | 'mesero' | 'cocina';

export type WorkerNavItem = {
  label: string;
  href: string;
  icon: IoniconName;
  roles: WorkerRol[];
};

/**
 * Navegación lateral del personal en WEB. El orden aquí es el orden visual.
 * Cada entrada se muestra solo a los roles indicados.
 */
export const WORKER_NAV: WorkerNavItem[] = [
  { label: 'Resumen', href: '/worker/gerente', icon: 'speedometer-outline', roles: ['gerente'] },
  { label: 'Recepción', href: '/worker', icon: 'people-outline', roles: ['anfitrion'] },
  { label: 'Mis mesas', href: '/worker', icon: 'grid-outline', roles: ['mesero'] },
  {
    label: 'Reservas y mesas',
    href: '/worker/reservations',
    icon: 'calendar-outline',
    roles: ['gerente', 'anfitrion'],
  },
  { label: 'Cocina', href: '/worker/kitchen', icon: 'flame-outline', roles: ['gerente', 'cocina'] },
  { label: 'Inventario', href: '/worker/inventario', icon: 'cube-outline', roles: ['gerente'] },
  { label: 'Recibos', href: '/worker/servicios-cerrados', icon: 'receipt-outline', roles: ['gerente'] },
  { label: 'Administración', href: '/worker/admin', icon: 'construct-outline', roles: ['gerente'] },
];

export function navForRole(rol: string | null | undefined): WorkerNavItem[] {
  if (!rol) return [];
  return WORKER_NAV.filter((item) => item.roles.includes(rol as WorkerRol));
}

/** Pantalla principal a la que cae cada rol al entrar en web. */
export function homeHrefForRole(rol: string | null | undefined): string {
  if (rol === 'gerente') return '/worker/gerente';
  if (rol === 'cocina') return '/worker/kitchen';
  return '/worker';
}

export function roleLabel(rol: string | null | undefined): string {
  switch (rol) {
    case 'anfitrion':
      return 'Anfitrión';
    case 'mesero':
      return 'Mesero';
    case 'gerente':
      return 'Gerente';
    case 'cocina':
      return 'Cocina';
    default:
      return rol ?? '—';
  }
}
