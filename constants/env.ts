/** Variables públicas (EXPO_PUBLIC_*). Defínelas en `.env` en la raíz del proyecto. */
function envStr(key: string): string {
  const v = process.env[key];
  return typeof v === 'string' ? v.trim() : '';
}

export const env = {
  supabaseUrl: envStr('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: envStr('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  /** Dominio público de la app web (sin barra final). Ej. https://app.midominio.com */
  appUrl: envStr('EXPO_PUBLIC_APP_URL'),
};

export function assertSupabaseConfigured(): void {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      'Falta EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY. Crea un archivo .env en la raíz del proyecto.',
    );
  }
  if (__DEV__ && env.supabaseUrl.includes('.supabase.com')) {
    console.warn(
      '[FastTable] EXPO_PUBLIC_SUPABASE_URL parece incorrecta (.com). Usa la URL de Project Settings → API (.supabase.co).',
    );
  }
}
