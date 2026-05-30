/**
 * Lógica compartida: confirmar correo y recuperar contraseña (páginas estáticas del host).
 * Requiere /config.js generado en el build y Supabase JS por CDN.
 */
(function (global) {
  "use strict";

  function getConfig() {
    const c = global.ALACARTA_CONFIG;
    if (!c?.supabaseUrl || !c?.supabaseAnonKey) {
      throw new Error(
        "Falta configuración. Genera el sitio con «npm run build:host» y variables en .env.",
      );
    }
    return c;
  }

  function parseAuthParams() {
    const href = global.location.href;
    const hashPart = href.includes("#") ? href.split("#")[1] : "";
    const beforeHash = href.split("#")[0];
    const queryPart = beforeHash.includes("?") ? beforeHash.split("?")[1] : "";
    const fromHash = new URLSearchParams(hashPart);
    const fromQuery = new URLSearchParams(queryPart);
    const pick = (key) => fromHash.get(key) ?? fromQuery.get(key);
    return {
      access_token: pick("access_token"),
      refresh_token: pick("refresh_token"),
      type: pick("type"),
      code: pick("code"),
      error: pick("error"),
      error_description: pick("error_description"),
    };
  }

  function formatError(raw) {
    const m = (raw || "").toLowerCase();
    if (m.includes("otp_expired") || m.includes("expired")) {
      return "El enlace caducó o ya se usó. Pide otro desde la app.";
    }
    return raw || "No se pudo completar la operación.";
  }

  function loadSupabase() {
    return new Promise((resolve, reject) => {
      if (global.supabase?.createClient) {
        resolve(global.supabase);
        return;
      }
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      s.onload = () => resolve(global.supabase);
      s.onerror = () => reject(new Error("No se pudo cargar Supabase."));
      document.head.appendChild(s);
    });
  }

  async function createClient() {
    const cfg = getConfig();
    const lib = await loadSupabase();
    return lib.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { detectSessionInUrl: false, persistSession: true },
    });
  }

  function cleanUrl() {
    const path = global.location.pathname;
    global.history.replaceState({}, "", path);
  }

  async function handleAuthCallback() {
    const params = parseAuthParams();

    if (params.error) {
      throw new Error(formatError(params.error_description || params.error));
    }

    const client = await createClient();

    if (params.code) {
      const { error } = await client.auth.exchangeCodeForSession(params.code);
      if (error) throw new Error(formatError(error.message));
    } else if (params.access_token && params.refresh_token) {
      const { error } = await client.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (error) throw new Error(formatError(error.message));
    } else {
      throw new Error("Enlace incompleto. Abre de nuevo el correo o pide otro enlace.");
    }

    cleanUrl();
    return params.type;
  }

  global.AlaCartaAuth = {
    getConfig,
    parseAuthParams,
    createClient,
    handleAuthCallback,
    formatError,
    appUrl(path) {
      const cfg = getConfig();
      const base = cfg.appBase || "/app";
      return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    },
    siteUrl(path) {
      const cfg = getConfig();
      const origin = cfg.siteUrl || global.location.origin;
      return `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    },
  };
})(window);
