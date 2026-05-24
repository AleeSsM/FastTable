/** Errores de fetch / red en React Native y navegadores. */
export function isNetworkErrorMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('network request failed') ||
    m.includes('failed to fetch') ||
    m.includes('network error') ||
    m.includes('fetch failed') ||
    m.includes('timeout') ||
    m.includes('ecconnrefused') ||
    m.includes('enotfound')
  );
}

/** Mensajes en español para errores frecuentes de Supabase Auth. */
export function formatAuthErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (isNetworkErrorMessage(m)) {
    return (
      'No se pudo conectar con Supabase. Comprueba que el móvil o emulador tenga internet, ' +
      'reinicia el servidor de Expo con «npx expo start -c» y verifica en .env que EXPO_PUBLIC_SUPABASE_URL ' +
      'termine en .supabase.co (no .com).'
    );
  }
  if (m.includes('email rate limit') || m.includes('rate limit')) {
    return (
      'Demasiados intentos con este correo o desde esta red en poco tiempo. ' +
      'Espera varios minutos, prueba otra red Wi‑Fi o datos móviles, o usa «Recuperar contraseña» si ya tienes cuenta.'
    );
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Ese correo ya está registrado. Usa «Ya tengo cuenta» o «¿Olvidaste tu contraseña?».';
  }
  if (m.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (m.includes('email not confirmed')) {
    return 'Confirma tu correo con el enlace que te enviamos antes de entrar.';
  }
  return message;
}
