/**
 * Genera iconos PNG bien centrados para Expo / Android adaptive icon.
 * Fuente: assets/images/icon-source.png (maestro del logo).
 *
 * Android recorta ~17 % por borde; el logo debe caber en el 66 % central.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "assets", "images");
const HOST_ASSETS = path.join(ROOT, "host", "site", "assets");

/** Tamaño estándar Expo / Play Store */
const SIZE = 1024;
/** Zona segura adaptive icon (66 % del diámetro visible) */
const ADAPTIVE_SAFE = 0.6;
/** iOS / icono general — un poco más grande, bordes redondeados menos agresivos */
const APP_ICON_SCALE = 0.72;
/** Fondo navy del logo de restaurante */
const NAVY = { r: 12, g: 24, b: 42, alpha: 255 };
const NAVY_HEX = "#0c182a";

function resolveSource() {
  const candidates = [
    path.join(ASSETS, "icon-source.png"),
    path.join(ASSETS, "icon-source.jpg"),
    path.join(ASSETS, "icon.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("No se encontró imagen fuente del icono.");
}

async function centeredLogo(source, canvasSize, scale, dest) {
  const maxDim = Math.round(canvasSize * scale);
  const resized = await sharp(source)
    .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const left = Math.round((canvasSize - meta.width) / 2);
  const top = Math.round((canvasSize - meta.height) / 2);

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: NAVY,
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(dest);
}

async function writeIcon(source, dest, scale) {
  await centeredLogo(source, SIZE, scale, dest);
  console.log(`  ✔ ${path.relative(ROOT, dest)} (${Math.round(scale * 100)} %)`);
}

async function writeFavicon(source, dest, size) {
  const scale = 0.78;
  const maxDim = Math.round(size * scale);
  const resized = await sharp(source)
    .resize(maxDim, maxDim, { fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const left = Math.round((size - meta.width) / 2);
  const top = Math.round((size - meta.height) / 2);

  await sharp({
    create: { width: size, height: size, channels: 4, background: NAVY },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(dest);
  console.log(`  ✔ ${path.relative(ROOT, dest)} (${size}px)`);
}

async function writeMonochrome(source, dest) {
  const maxDim = Math.round(SIZE * ADAPTIVE_SAFE);
  const resized = await sharp(source)
    .resize(maxDim, maxDim, { fit: "inside" })
    .greyscale()
    .normalize()
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const left = Math.round((SIZE - meta.width) / 2);
  const top = Math.round((SIZE - meta.height) / 2);

  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(dest);
  console.log(`  ✔ ${path.relative(ROOT, dest)} (monochrome)`);
}

async function writeBackground(dest) {
  await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: NAVY },
  })
    .png()
    .toFile(dest);
  console.log(`  ✔ ${path.relative(ROOT, dest)} (solid ${NAVY_HEX})`);
}

/** Banner horizontal de la landing (sección descarga). */
async function writeBanner(source, dest, width, height) {
  const logoHeight = Math.round(height * 0.88);
  const resized = await sharp(source)
    .resize(logoHeight, logoHeight, { fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const left = Math.round((width - meta.width) / 2);
  const top = Math.round((height - meta.height) / 2);

  await sharp({
    create: { width, height, channels: 4, background: NAVY },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(dest);
  console.log(`  ✔ ${path.relative(ROOT, dest)} (${width}×${height})`);
}

async function main() {
  const source = resolveSource();
  console.log(`→ Fuente: ${path.relative(ROOT, source)}`);

  fs.mkdirSync(ASSETS, { recursive: true });
  fs.mkdirSync(HOST_ASSETS, { recursive: true });

  console.log("→ Iconos de app (1024×1024, centrados en zona segura)…");
  await writeIcon(source, path.join(ASSETS, "icon.png"), APP_ICON_SCALE);
  await writeIcon(source, path.join(ASSETS, "android-icon-foreground.png"), ADAPTIVE_SAFE);
  await writeIcon(source, path.join(ASSETS, "splash-icon.png"), ADAPTIVE_SAFE);
  await writeBackground(path.join(ASSETS, "android-icon-background.png"));
  await writeMonochrome(source, path.join(ASSETS, "android-icon-monochrome.png"));

  console.log("→ Web / host…");
  await writeFavicon(source, path.join(ASSETS, "favicon.png"), 192);
  await writeFavicon(source, path.join(HOST_ASSETS, "favicon.png"), 192);
  await writeFavicon(source, path.join(HOST_ASSETS, "logo-icon.png"), 256);
  await writeFavicon(source, path.join(HOST_ASSETS, "apple-touch-icon.png"), 180);
  await writeBanner(source, path.join(HOST_ASSETS, "banner.png"), 1040, 320);

  console.log("");
  console.log("✔ Iconos generados. Rebuild nativo (EAS) para ver el cambio en el launcher.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
