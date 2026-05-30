import type { ReactNode } from 'react';

import { AuthBoot } from '@/components/auth-boot';
import { useAuth } from '@/contexts/auth-context';

/** Bloquea el stack worker sin Redirect cuando no hay sesión (cierre de sesión en iOS). */
export function WorkerAuthGate({ children }: { children: ReactNode }) {
  const { session, loading, signingOut } = useAuth();

  if (loading || signingOut || !session) {
    return <AuthBoot variant="worker" />;
  }

  return <>{children}</>;
}
