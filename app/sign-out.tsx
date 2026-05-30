import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { AuthBoot } from '@/components/auth-boot';
import { useAuth } from '@/contexts/auth-context';
import { markSignOutNavigationEnd, markSignOutNavigationStart } from '@/lib/sign-out-nav';

/** Pantalla raíz: limpia sesión y vuelve a bienvenida (sale del stack de tabs en iOS). */
export default function SignOutScreen() {
  const router = useRouter();
  const { beginSignOut, signOut, finishSignOutNavigation } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    markSignOutNavigationStart();
    beginSignOut();

    void (async () => {
      try {
        await signOut();
        router.replace('/');
      } finally {
        finishSignOutNavigation();
        markSignOutNavigationEnd();
      }
    })();
  }, [beginSignOut, signOut, finishSignOutNavigation, router]);

  return <AuthBoot />;
}
