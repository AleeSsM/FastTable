import type { ReactNode } from 'react';

import { AuthBoot } from '@/components/auth-boot';
import { useAuth } from '@/contexts/auth-context';
import { useNavigateToWelcomeOnceWhen } from '@/hooks/use-auth-navigation';

/** Bloquea el stack worker sin Redirect cuando no hay sesión (cierre de sesión en iOS). */
export function WorkerAuthGate({ children }: { children: ReactNode }) {
  const { session, loading, signingOut } = useAuth();

  const sendHome = !signingOut && !session;
  useNavigateToWelcomeOnceWhen(sendHome);

  if (signingOut || !session || loading) {
    return <AuthBoot variant="worker" />;
  }

  return <>{children}</>;
}
