import { Keyboard, Platform } from 'react-native';

function afterAnimationFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count;
    const step = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Breve pausa tras limpiar auth (sin InteractionManager: puede no resolver en iOS). */
export function afterSignOutUiSettled(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  return afterAnimationFrames(2);
}

/** Pausa tras router.replace antes de reactivar guards de navegación. */
export function afterSignOutNavigationSettled(): Promise<void> {
  if (Platform.OS === 'ios') return waitMs(120);
  return afterAnimationFrames(1);
}

export function dismissKeyboardForSignOut(): void {
  Keyboard.dismiss();
}

/** Ejecuta el cierre de sesión fuera del tick del toque en iOS. */
export function runSignOutTask(task: () => Promise<void>): void {
  dismissKeyboardForSignOut();
  if (Platform.OS === 'ios') {
    setTimeout(() => void task(), 0);
    return;
  }
  void task();
}
