/**
 * Supabase envía tokens en el fragmento (#access_token=…). Expo Router no los lee;
 * convertimos # → ? para que lleguen a /auth/callback como query.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  if (path.includes('#')) {
    return path.replace('#', '?');
  }
  return path;
}
