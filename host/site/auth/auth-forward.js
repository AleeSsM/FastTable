/**
 * Si Supabase devuelve tokens en la raíz (Site URL) en lugar de /auth/callback,
 * reenvía al handler correcto antes de que la landing ignore el hash.
 */
(function () {
  var path = window.location.pathname || '/';
  if (path.indexOf('/auth/callback') !== -1) return;

  var search = window.location.search || '';
  var hash = window.location.hash || '';
  if (!/(access_token|refresh_token|code=|token_hash=)/.test(search + hash)) return;

  var callback = path.indexOf('/app') === 0 ? '/app/auth/callback' : '/auth/callback';
  window.location.replace(callback + search + hash);
})();
