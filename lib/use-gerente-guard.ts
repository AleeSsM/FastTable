import { useAuth } from '@/contexts/auth-context';

type GerenteGuardResult =
  | { boot: true; redirectHref: null }
  | { boot: false; redirectHref: '/' | '/login' | '/worker' };

/** Rutas de redirección para pantallas solo gerente (usar con `<Redirect href={…} />`). */
export function useGerenteGuard(): GerenteGuardResult {
  const { session, staffMember, loading: authLoading } = useAuth();

  if (authLoading) {
    return { boot: true, redirectHref: null };
  }
  if (!session) {
    return { boot: false, redirectHref: '/' };
  }
  if (!staffMember) {
    return { boot: false, redirectHref: '/login' };
  }
  if (staffMember.rol !== 'gerente') {
    return { boot: false, redirectHref: '/worker' };
  }
  return { boot: true, redirectHref: null };
}
