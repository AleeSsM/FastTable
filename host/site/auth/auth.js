/**
 * Lógica compartida: confirmar correo y recuperar contraseña (páginas estáticas del host).
 * Requiere /config.js generado en el build y Supabase JS por CDN.
 */
(function (global) {
  "use strict";

  const NATIVE_SCHEME = "alacarta";
  const NATIVE_CALLBACK = "alacarta://auth/callback";
  const ANDROID_PACKAGE = "com.alacarta.app";

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

  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod/i.test(global.navigator.userAgent);
  }

  function hasAuthParams(params) {
    const p = params || parseAuthParams();
    return Boolean(
      p.code || (p.access_token && p.refresh_token) || p.error || p.error_description,
    );
  }

  function buildNativeAuthCallbackUrl() {
    return NATIVE_CALLBACK + global.location.search + global.location.hash;
  }

  function nativeAppUrl(path) {
    if (!path || path === "/") return `${NATIVE_SCHEME}://`;
    const normalized = path.startsWith("/") ? path.slice(1) : path;
    return `${NATIVE_SCHEME}://${normalized}`;
  }

  function tryOpenNativeApp(url) {
    if (/Android/i.test(global.navigator.userAgent)) {
      const withoutScheme = url.replace(/^alacarta:\/\//, "");
      global.location.href =
        "intent://" +
        withoutScheme +
        "#Intent;scheme=" +
        NATIVE_SCHEME +
        ";package=" +
        ANDROID_PACKAGE +
        ";end";
      return;
    }
    global.location.href = url;
  }

  function buildNativeSessionUrl(session, type) {
    const hash = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      type: type || "signup",
    }).toString();
    return `${NATIVE_CALLBACK}#${hash}`;
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      global.setTimeout(resolve, ms);
    });
  }

  /**
   * En móvil, intenta abrir la app nativa con el enlace del correo (o la sesión ya creada).
   * Si la app se abre, el usuario sale del navegador y no hace falta la página web.
   */
  async function completeAuthCallback() {
    const params = parseAuthParams();

    if (params.error) {
      throw new Error(formatError(params.error_description || params.error));
    }

    const isRecovery = params.type === "recovery";
    const onMobile = isMobileDevice();

    if (onMobile && !isRecovery && hasAuthParams(params)) {
      tryOpenNativeApp(buildNativeAuthCallbackUrl());
      await wait(1800);
      if (global.document.hidden) {
        return { type: params.type, handedOff: true };
      }
    }

    const type = await handleAuthCallback();

    if (isRecovery) {
      return { type, handedOff: false };
    }

    if (onMobile) {
      const client = await createClient();
      const {
        data: { session },
      } = await client.auth.getSession();
      if (session) {
        tryOpenNativeApp(buildNativeSessionUrl(session, type));
        await wait(1600);
        if (global.document.hidden) {
          return { type, handedOff: true };
        }
      }
    }

    return { type, handedOff: false };
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
    completeAuthCallback,
    isMobileDevice,
    hasAuthParams,
    buildNativeAuthCallbackUrl,
    nativeAppUrl,
    tryOpenNativeApp,
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
