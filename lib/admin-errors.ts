/** Mensajes claros para errores comunes de administración (Supabase RLS). */
export function mapAdminSupabaseError(message: string, table?: string): string {
  const m = message.toLowerCase();
  if (m.includes('row-level security') || m.includes('row level security')) {
    if (!table || table === 'mesas') {
      return (
        'La base de datos no permite crear mesas desde la app todavía.\n\n' +
        'En Supabase → SQL Editor ejecuta el archivo:\n' +
        'supabase/04_patch_mesas_admin_gerente.sql\n\n' +
        'Luego vuelve a intentar (o reinicia la app).'
      );
    }
    return (
      `Permiso denegado en la tabla "${table}". ` +
      'Revisa que tu usuario esté en `personal` con rol gerente y que el esquema esté actualizado (ver supabase/README.md).'
    );
  }
  if (m.includes('solo_gerente')) {
    return 'Solo gerencia puede hacer esta acción.';
  }
  return message;
}
