/**
 * Genera host/dist: landing + auth + apk + app web (Expo export en /app).
 * Requiere .env en la raíz del repo con EXPO_PUBLIC_SUPABASE_* y EXPO_PUBLIC_APP_URL.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = path.resolve(__dirname, "..");
const ROOT = path.resolve(HOST, "..");
const SITE = path.join(HOST, "site");
const OUT = path.join(HOST, "dist");

function loadEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function copyRecursive(src, dest, skipNames = new Set()) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (skipNames.has(ent.name)) continue;
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyRecursive(s, d, skipNames);
    else fs.copyFileSync(s, d);
  }
}

function main() {
  const dotenv = loadEnvFile(path.join(ROOT, ".env"));
  const supabaseUrl = dotenv.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    dotenv.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const appUrl = (dotenv.EXPO_PUBLIC_APP_URL || process.env.EXPO_PUBLIC_APP_URL || "").replace(
    /\/$/,
    "",
  );

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("✖ Falta EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY en .env");
    process.exit(1);
  }

  if (!appUrl) {
    console.warn(
      "⚠ EXPO_PUBLIC_APP_URL vacío. Pon tu dominio público (ej. https://tu-proyecto.vercel.app) antes de desplegar.",
    );
  }

  console.log("→ Limpiando host/dist …");
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  console.log("→ Sincronizando paleta CSS …");
  execSync("node scripts/sync-palette-css.mjs", { cwd: ROOT, stdio: "inherit" });

  console.log("→ Copiando landing, auth y apk …");
  copyRecursive(SITE, OUT, new Set(["config.template.js"]));

  const configJs = `window.ALACARTA_CONFIG = {
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)},
  appBase: "/app",
  siteUrl: ${JSON.stringify(appUrl)},
};
`;
  fs.writeFileSync(path.join(OUT, "config.js"), configJs, "utf8");

  console.log("→ Exportando app Expo (web) a /app …");
  const exportEnv = {
    ...process.env,
    EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
    EXPO_PUBLIC_APP_URL: appUrl,
  };
  execSync("npx expo export -p web", { cwd: ROOT, env: exportEnv, stdio: "inherit" });

  const expoDist = path.join(ROOT, "dist");
  if (!fs.existsSync(path.join(expoDist, "index.html"))) {
    console.error("✖ No se encontró dist/index.html tras expo export.");
    process.exit(1);
  }

  const appOut = path.join(OUT, "app");
  copyRecursive(expoDist, appOut);

  const appIndex = path.join(appOut, "index.html");
  if (fs.existsSync(appIndex)) {
    let html = fs.readFileSync(appIndex, "utf8");
    const tag = '<script src="/auth/auth-forward.js"></script>';
    if (!html.includes("auth-forward.js")) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n    ${tag}`);
      fs.writeFileSync(appIndex, html, "utf8");
    }
  }

  console.log("");
  console.log("✔ Sitio listo en host/dist");
  console.log("  · /           → landing");
  console.log("  · /auth/*     → verificar correo y contraseña");
  console.log("  · /apk/       → coloca alacarta.apk en host/site/apk/");
  console.log("  · /app/       → app web (comensal + personal)");
  if (appUrl) console.log(`  · Supabase Site URL: ${appUrl}`);
  console.log(`  · Redirect: ${appUrl || "https://TU-DOMINIO"}/auth/callback`);
}

main();
