import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type WorkerRol = 'gerente' | 'anfitrion' | 'mesero' | 'cocina';

export type WorkerNavItem = {
  label: string;
  href: string;
  icon: IoniconName;
  roles: WorkerRol[];
  /** Sección en la misma ruta (?sec=). */
  section?: string;
  /** Clave para el contador en la barra lateral. */
  badgeKey?: string;
  /** Badge naranja (notificación / requiere atención). */
  badgeAlert?: boolean;
};

export const MESERO_SECTIONS = ['resumen', 'mesas', 'solicitudes', 'libres'] as const;
export type MeseroSection = (typeof MESERO_SECTIONS)[number];

export const ANFITRION_SECTIONS = ['resumen', 'fila', 'reservas', 'mesas', 'equipo'] as const;
export type AnfitrionSection = (typeof ANFITRION_SECTIONS)[number];

export const GERENTE_SECTIONS = ['resumen', 'reportes'] as const;
export type GerenteSection = (typeof GERENTE_SECTIONS)[number];

export const COCINA_SECTIONS = ['resumen', 'pedidos', 'disponibilidad'] as const;
export type CocinaSection = (typeof COCINA_SECTIONS)[number];

const DEFAULT_SECTION: Record<WorkerRol, string> = {
  mesero: 'resumen',
  anfitrion: 'resumen',
  gerente: 'resumen',
  cocina: 'resumen',
};

/**
 * Navegación lateral del personal en WEB. El orden aquí es el orden visual.
 */
export const WORKER_NAV: WorkerNavItem[] = [
  // —— Gerente ——
  {
    label: 'Resumen',
    href: '/worker/gerente',
    section: 'resumen',
    icon: 'speedometer-outline',
    roles: ['gerente'],
  },
  {
    label: 'Problemas',
    href: '/worker/gerente',
    section: 'reportes',
    icon: 'mail-unread-outline',
    roles: ['gerente'],
    badgeKey: 'reportes',
    badgeAlert: true,
  },
  {
    label: 'Reservas',
    href: '/worker/reservations',
    icon: 'calendar-outline',
    roles: ['gerente', 'anfitrion'],
    badgeKey: 'reservas',
    badgeAlert: true,
  },
  {
    label: 'Cocina',
    href: '/worker/kitchen',
    icon: 'flame-outline',
    roles: ['gerente', 'cocina'],
    badgeKey: 'pedidos',
    badgeAlert: true,
  },
  { label: 'Inventario', href: '/worker/inventario', icon: 'cube-outline', roles: ['gerente'] },
  { label: 'Recibos', href: '/worker/servicios-cerrados', icon: 'receipt-outline', roles: ['gerente'] },
  { label: 'Administración', href: '/worker/admin', icon: 'construct-outline', roles: ['gerente'] },

  // —— Anfitrión ——
  {
    label: 'Resumen',
    href: '/worker',
    section: 'resumen',
    icon: 'speedometer-outline',
    roles: ['anfitrion'],
  },
  {
    label: 'Fila de espera',
    href: '/worker',
    section: 'fila',
    icon: 'people-outline',
    roles: ['anfitrion'],
    badgeKey: 'fila',
    badgeAlert: true,
  },
  {
    label: 'Reservas',
    href: '/worker',
    section: 'reservas',
    icon: 'calendar-outline',
    roles: ['anfitrion'],
    badgeKey: 'reservas_atender',
    badgeAlert: true,
  },
  {
    label: 'Mapa de mesas',
    href: '/worker',
    section: 'mesas',
    icon: 'grid-outline',
    roles: ['anfitrion'],
    badgeKey: 'mesas_libres',
  },
  {
    label: 'Equipo',
    href: '/worker',
    section: 'equipo',
    icon: 'swap-horizontal-outline',
    roles: ['anfitrion'],
  },

  // —— Mesero ——
  {
    label: 'Resumen',
    href: '/worker',
    section: 'resumen',
    icon: 'speedometer-outline',
    roles: ['mesero'],
  },
  {
    label: 'Mis mesas',
    href: '/worker',
    section: 'mesas',
    icon: 'grid-outline',
    roles: ['mesero'],
    badgeKey: 'mis_mesas',
  },
  {
    label: 'Solicitudes',
    href: '/worker',
    section: 'solicitudes',
    icon: 'chatbubble-ellipses-outline',
    roles: ['mesero'],
    badgeKey: 'solicitudes',
    badgeAlert: true,
  },
  {
    label: 'Mesas libres',
    href: '/worker',
    section: 'libres',
    icon: 'apps-outline',
    roles: ['mesero'],
    badgeKey: 'mesas_libres',
  },

  // —— Cocina (solo rol cocina; gerente usa ítem Cocina arriba) ——
  {
    label: 'Resumen',
    href: '/worker/kitchen',
    section: 'resumen',
    icon: 'speedometer-outline',
    roles: ['cocina'],
  },
  {
    label: 'Pedidos',
    href: '/worker/kitchen',
    section: 'pedidos',
    icon: 'flame-outline',
    roles: ['cocina'],
    badgeKey: 'pedidos',
    badgeAlert: true,
  },
  {
    label: 'Disponibilidad',
    href: '/worker/kitchen',
    section: 'disponibilidad',
    icon: 'options-outline',
    roles: ['cocina'],
    badgeKey: 'no_disponibles',
  },
];

export function navForRole(rol: string | null | undefined): WorkerNavItem[] {
  if (!rol) return [];
  return WORKER_NAV.filter((item) => item.roles.includes(rol as WorkerRol));
}

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

export function defaultSectionForRole(rol: WorkerRol | string | undefined): string {
  if (rol && rol in DEFAULT_SECTION) return DEFAULT_SECTION[rol as WorkerRol];
  return 'resumen';
}

export function navItemHref(item: WorkerNavItem): string {
  return item.section ? `${item.href}?sec=${item.section}` : item.href;
}

export function parseNavSection(
  rol: WorkerRol | string | undefined,
  sec: string | string[] | undefined,
  pathname: string,
): string {
  const raw = typeof sec === 'string' ? sec : Array.isArray(sec) ? sec[0] : undefined;
  const items = navForRole(rol);
  const sections = items.filter((i) => i.section).map((i) => i.section!);
  if (raw && sections.includes(raw)) return raw;
  // Ruta sin ?sec=: primera sección del rol en esa ruta.
  const onPath = items.filter((i) => i.href === pathname || pathname.startsWith(`${i.href}/`));
  const firstSec = onPath.find((i) => i.section)?.section;
  return firstSec ?? defaultSectionForRole(rol);
}
