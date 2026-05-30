import { useGerenteGuard } from '@/lib/use-gerente-guard';
import { useNavigateToWelcomeOnceWhen, useReplaceWhen } from '@/hooks/use-auth-navigation';

/** useGerenteGuard + navegación imperativa (sin <Redirect> en iOS). */
export function useGerenteGuardNavigation() {
  const guard = useGerenteGuard();

  useNavigateToWelcomeOnceWhen(guard.redirectHref === '/');
  useReplaceWhen(guard.redirectHref === '/login', '/login');
  useReplaceWhen(guard.redirectHref === '/worker', '/worker');

  return guard;
}
