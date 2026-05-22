/** Espelha backend/src/lib/brandColorScore.js — regras genéricas de marca, não paleta Tuma. */

const HEX_RE = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

export function normalizeHexColor(v) {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
  if (!s.startsWith("#")) s = `#${s}`;
  if (!HEX_RE.test(s)) return null;
  if (s.length === 4) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    s = `#${r}${r}${g}${g}${b}${b}`;
  }
  return s.toUpperCase();
}

function hexToRgb(hex) {
  const norm = normalizeHexColor(hex);
  if (!norm) return null;
  const n = parseInt(norm.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max <= 0) return 0;
  return (max - min) / max;
}

function hueDegrees(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

function isLikelyFurOrSkinTone(r, g, b) {
  const sat = saturation(r, g, b);
  const lum = luminance(r, g, b);
  const h = hueDegrees(r, g, b);
  if (lum < 45 || lum > 238) return false;
  if (sat < 0.1 || sat > 0.72) return false;
  return h >= 16 && h <= 52;
}

function brandColorScoreHex(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const { r, g, b } = rgb;
  if (isLikelyFurOrSkinTone(r, g, b)) return 0.02;
  const sat = saturation(r, g, b);
  const lum = luminance(r, g, b);
  const h = hueDegrees(r, g, b);
  let score = 0.35 + sat * 2.4;
  if (sat >= 0.3) score += 1.2;
  if (sat >= 0.45) score += 0.9;
  if (sat < 0.14 && (lum > 210 || lum < 55)) score += lum < 80 ? 1.6 : 0.85;
  if (h >= 22 && h <= 42 && sat >= 0.1 && sat <= 0.52 && lum >= 85 && lum <= 205) score *= 0.18;
  return score;
}

export function rankBrandHexColors(hexes) {
  const seen = new Set();
  const list = [];
  for (const raw of hexes) {
    const hex = normalizeHexColor(raw);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    list.push({ hex, score: brandColorScoreHex(hex) });
  }
  list.sort((a, b) => b.score - a.score);
  return list.map((x) => x.hex);
}

export function assignRankedPalette(hexes, max = 6) {
  const ranked = rankBrandHexColors(hexes);
  return {
    cor_primaria: ranked[0] || "",
    cor_secundaria: ranked[1] || "",
    cores_adicionais: ranked.slice(2, max),
  };
}
