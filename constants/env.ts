/**
 * Variables públicas (EXPO_PUBLIC_*). Defínelas en `.env` o en Vercel al hacer build.
 *
 * Importante: referencias estáticas a `process.env.EXPO_PUBLIC_*` para que Metro
 * las incruste en el bundle web (`expo export`). Un acceso dinámico `process.env[key]`
 * deja el bundle vacío en producción → pantalla en blanco en /app/.
 */
function trimEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const env = {
  supabaseUrl: trimEnv(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: trimEnv(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  /** Dominio público de la app web (sin barra final). Ej. https://tu-proyecto.vercel.app */
  appUrl: trimEnv(process.env.EXPO_PUBLIC_APP_URL),
};

export function assertSupabaseConfigured(): void {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      'Falta EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY. Crea un archivo .env en la raíz del proyecto.',
    );
  }
  if (__DEV__ && env.supabaseUrl.includes('.supabase.com')) {
    console.warn(
      '[A la Carta] EXPO_PUBLIC_SUPABASE_URL parece incorrecta (.com). Usa la URL de Project Settings → API (.supabase.co).',
    );
  }
}
