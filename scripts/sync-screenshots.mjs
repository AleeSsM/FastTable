/**
 * Copia y optimiza capturas de APP pics/ → host/site/assets/screenshots/
 * Ejecutar tras añadir fotos nuevas: npm run sync:screenshots
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "host", "site", "assets", "screenshots");

/** dest filename → ruta relativa en APP pics/ */
const MAP = {
  "hero-comensal.jpg": "ClienteMovil/WhatsApp Image 2026-05-30 at 12.33.37 (1).jpeg",
  "comensal-menu.jpg": "ClienteMovil/WhatsApp Image 2026-05-30 at 12.33.37 (2).jpeg",
  "staff-host.jpg": "TrabajadoresMovil/WhatsApp Image 2026-05-30 at 12.33.38.jpeg",
  "staff-cocina.jpg": "TrabajadoresMovil/WhatsApp Image 2026-05-30 at 12.33.38 (3).jpeg",
  "staff-gerencia.jpg": "TrabajadoresMovil/WhatsApp Image 2026-05-30 at 12.33.38 (2).jpeg",
  "web-host.jpg": "InterfacesWeb/WhatsApp Image 2026-05-30 at 12.33.36.jpeg",
  "web-waiter.jpg": "InterfacesWeb/WhatsApp Image 2026-05-30 at 12.33.21 (1).jpeg",
  "web-inventario.jpg": "InterfacesWeb/WhatsApp Image 2026-05-30 at 12.33.36 (3).jpeg",
};

const MOBILE_WIDTH = 900;
const WEB_WIDTH = 1440;
const QUALITY = 82;

async function optimize(src, dest, maxWidth) {
  await sharp(src)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(dest);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  for (const [destName, rel] of Object.entries(MAP)) {
    const src = path.join(ROOT, "APP pics", rel);
    if (!fs.existsSync(src)) {
      console.warn(`⚠ No encontrado: ${rel}`);
      continue;
    }
    const dest = path.join(OUT, destName);
    const maxW = destName.startsWith("web-") ? WEB_WIDTH : MOBILE_WIDTH;
    await optimize(src, dest, maxW);
    console.log(`✔ ${path.relative(ROOT, dest)}`);
  }

  console.log("\n✔ Capturas listas en host/site/assets/screenshots/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
