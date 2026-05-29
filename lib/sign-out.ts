import { InteractionManager, Keyboard, Platform } from 'react-native';

/** Espera al siguiente frame tras animaciones (evita cuelgues en iOS al cerrar sesión). */
export function afterSignOutUiSettled(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => resolve());
    });
  });
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
