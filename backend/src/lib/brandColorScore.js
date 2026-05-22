/**
 * Prioriza cores típicas de logo/site (saturadas + neutros de UI) e reduz ruído de ilustração (pelo/pele).
 * Genérico para qualquer empresa — não hardcode de paleta Tuma.
 */

const HEX_RE = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

/**
 * @param {unknown} v
 * @returns {string | null}
 */
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

/**
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number } | null}
 */
export function hexToRgb(hex) {
  const norm = normalizeHexColor(hex);
  if (!norm) return null;
  const n = parseInt(norm.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max <= 0) return 0;
  return (max - min) / max;
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function hueDegrees(r, g, b) {
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

/**
 * Marrom/bege de ilustração (mascote, pele) — não é cor de marca típica.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function isLikelyFurOrSkinTone(r, g, b) {
  const sat = saturation(r, g, b);
  const lum = luminance(r, g, b);
  const h = hueDegrees(r, g, b);
  if (lum < 45 || lum > 238) return false;
  if (sat < 0.1 || sat > 0.72) return false;
  return h >= 16 && h <= 52;
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function isNeutralUiColor(r, g, b) {
  const sat = saturation(r, g, b);
  const lum = luminance(r, g, b);
  if (sat < 0.14) {
    if (lum > 210 || lum < 55) return true;
  }
  /** Cinza de texto/UI (não marrom de ilustração). */
  if (sat < 0.2 && lum >= 70 && lum <= 215) {
    const h = hueDegrees(r, g, b);
    if (h < 16 || h > 52) return true;
  }
  return false;
}

/**
 * Pontuação maior = mais provável cor de marca (logo, site, UI).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function brandColorScoreRgb(r, g, b) {
  if (isLikelyFurOrSkinTone(r, g, b)) return 0.02;

  const sat = saturation(r, g, b);
  const lum = luminance(r, g, b);
  const h = hueDegrees(r, g, b);

  let score = 0.35 + sat * 2.4;

  if (sat >= 0.3) score += 1.2;
  if (sat >= 0.45) score += 0.9;
  /** Verde/ciano de botões e destaques em fundo escuro (comum em landing pages). */
  if (h >= 85 && h <= 205 && sat >= 0.22 && lum >= 45 && lum <= 230) score += 1.5;
  if (isNeutralUiColor(r, g, b)) score += lum < 80 ? 1.6 : 0.85;

  /** Marrom “ilustrativo” (mascote/foto) — não penaliza marrom de marca forte e saturado. */
  if (h >= 22 && h <= 42 && sat >= 0.1 && sat <= 0.52 && lum >= 85 && lum <= 205) score *= 0.18;

  if (lum > 248 && sat < 0.08) score *= 0.55;
  if (lum < 12) score *= 0.2;

  return score;
}

/**
 * @param {string} hex
 * @returns {'light' | 'mid' | 'dark' | 'chromatic'}
 */
export function classifyPaletteColorKind(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "chromatic";
  const sat = saturation(rgb.r, rgb.g, rgb.b);
  const lum = luminance(rgb.r, rgb.g, rgb.b);
  if (sat < 0.12) {
    if (lum > 218) return "light";
    if (lum < 78) return "dark";
    return "mid";
  }
  if (sat < 0.22 && lum >= 95 && lum <= 215) return "mid";
  return "chromatic";
}

/**
 * @param {string} hexA
 * @param {string} hexB
 */
export function areHexColorsTooSimilar(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return false;
  const dist = Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
  if (dist < 32) return true;

  const satA = saturation(a.r, a.g, a.b);
  const satB = saturation(b.r, b.g, b.b);
  const lumA = luminance(a.r, a.g, a.b);
  const lumB = luminance(b.r, b.g, b.b);
  const hA = hueDegrees(a.r, a.g, a.b);
  const hB = hueDegrees(b.r, b.g, b.b);
  const hueDiff = Math.min(Math.abs(hA - hB), 360 - Math.abs(hA - hB));

  if (satA < 0.35 && satB < 0.35 && lumA < 105 && lumB < 105 && hueDiff < 28 && dist < 58) {
    return true;
  }
  if (satA > 0.18 && satB > 0.18 && hueDiff < 22 && dist < 50) return true;
  return false;
}

/**
 * Monta paleta com variedade: cor de marca + neutros (branco/cinza/escuro) sem duplicar azuis parecidos.
 * @param {string[]} hexes
 * @param {number} max
 */
export function pickDiverseBrandPalette(hexes, max = 6) {
  const candidates = [];
  const seen = new Set();
  for (const raw of hexes) {
    const hex = normalizeHexColor(raw);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    candidates.push({ hex, score: brandColorScoreHex(hex), kind: classifyPaletteColorKind(hex) });
  }
  if (!candidates.length) return [];
  candidates.sort((a, b) => b.score - a.score);

  /** @type {string[]} */
  const picked = [];

  const pickFirst = (match) => {
    for (const c of candidates) {
      if (picked.includes(c.hex)) continue;
      if (match && !match(c)) continue;
      if (picked.some((h) => areHexColorsTooSimilar(h, c.hex))) continue;
      picked.push(c.hex);
      return true;
    }
    return false;
  };

  pickFirst((c) => c.kind === "chromatic" && c.score >= 1.8) ||
    pickFirst((c) => c.kind === "chromatic");
  pickFirst((c) => c.kind === "light");
  pickFirst((c) => c.kind === "chromatic");
  pickFirst((c) => c.kind === "mid");
  pickFirst((c) => c.kind === "dark");

  while (picked.length < max) {
    if (!pickFirst()) break;
  }

  return picked;
}

/**
 * @param {string} hex
 */
export function brandColorScoreHex(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return brandColorScoreRgb(rgb.r, rgb.g, rgb.b);
}

/**
 * @param {string[]} hexes
 * @returns {string[]}
 */
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

/**
 * @param {string[]} hexes
 * @param {number} max
 */
export function assignRankedPalette(hexes, max = 6) {
  const ranked = pickDiverseBrandPalette(hexes, max);
  return {
    cor_primaria: ranked[0] || "",
    cor_secundaria: ranked[1] || "",
    cores_adicionais: ranked.slice(2, max),
  };
}
