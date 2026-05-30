/**
 * Genera host/site/brand.css desde constants/palette.ts (fuente de verdad).
 * Ejecutar tras cambiar la paleta: npm run sync:palette
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const palettePath = path.join(ROOT, 'constants/palette.ts');
const outPath = path.join(ROOT, 'host/site/brand.css');

const src = fs.readFileSync(palettePath, 'utf8');

function readBrand(key) {
  const m = src.match(new RegExp(`\\b${key}:\\s*'([^']+)'`));
  if (!m) throw new Error(`No se encontró BRAND.${key} en palette.ts`);
  return m[1];
}

function readRgb(key) {
  const m = src.match(new RegExp(`\\b${key}:\\s*'([0-9, ]+)'`));
  if (!m) throw new Error(`No se encontró BRAND_RGB.${key} en palette.ts`);
  return m[1].replace(/\s+/g, ' ').trim();
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

const tokens = {
  bg: readBrand('background'),
  surface: readBrand('surface'),
  surfaceElevated: readBrand('surfaceElevated'),
  text: readBrand('text'),
  textMuted: readBrand('textMuted'),
  textFaint: readBrand('textFaint'),
  border: readBrand('border'),
  borderSubtle: readBrand('borderSubtle'),
  accent: readBrand('accent'),
  accentText: readBrand('accentText'),
  accentMuted: readBrand('accentMuted'),
  onAccent: readBrand('onAccent'),
  success: readBrand('success'),
  warning: readBrand('warning'),
  danger: readBrand('danger'),
  logoBackdrop: readBrand('logoBackdrop'),
};

const css = `/* ============================================================================
   FastTable — Tokens de marca (GENERADO)
   👉 No edites a mano. Cambia constants/palette.ts y ejecuta:
      npm run sync:palette
   ============================================================================ */
:root {
  --bg: ${tokens.bg};
  --surface: ${tokens.surface};
  --surface-elevated: ${tokens.surfaceElevated};
  --text: ${tokens.text};
  --text-muted: ${tokens.textMuted};
  --text-faint: ${tokens.textFaint};
  --border: ${tokens.border};
  --border-subtle: ${tokens.borderSubtle};
  --accent: ${tokens.accent};
  --accent-text: ${tokens.accentText};
  --accent-muted: ${tokens.accentMuted};
  --on-accent: ${tokens.onAccent};
  --success: ${tokens.success};
  --warning: ${tokens.warning};
  --danger: ${tokens.danger};
  --logo-backdrop: ${tokens.logoBackdrop};

  --accent-rgb: ${readRgb('accent')};
  --accent-text-rgb: ${readRgb('accentText')};
  --accent-muted-rgb: ${readRgb('accentMuted')};
  --success-rgb: ${readRgb('success')};
  --warning-rgb: ${readRgb('warning')};
  --danger-rgb: ${readRgb('danger')};
  --surface-rgb: ${hexToRgb(tokens.surface)};
  --shadow-rgb: ${readRgb('shadow')};

  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 22px;
  --radius-pill: 999px;
  --maxw: 1180px;
  --shadow: 0 24px 60px -20px rgba(var(--shadow-rgb), 0.9);
  --glow: rgba(var(--accent-rgb), 0.22);
}
`;

fs.writeFileSync(outPath, css, 'utf8');
console.log('✔ host/site/brand.css sincronizado con constants/palette.ts');
