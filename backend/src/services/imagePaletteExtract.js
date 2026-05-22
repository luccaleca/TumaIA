import sharp from "sharp";
import {
  brandColorScoreRgb,
  hueDegrees,
  isLikelyFurOrSkinTone,
  isNeutralUiColor,
  luminance,
  rankBrandHexColors,
  saturation,
} from "../lib/brandColorScore.js";

/**
 * Destaques de UI (verde/ciano em fundo escuro, texto claro).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
function isLikelyUiAccent(r, g, b) {
  const sat = saturation(r, g, b);
  const lum = luminance(r, g, b);
  const h = hueDegrees(r, g, b);
  if (sat >= 0.28 && lum >= 50 && lum <= 235 && h >= 85 && h <= 205) return true;
  if (sat < 0.12 && lum > 215) return true;
  return false;
}

/**
 * @param {{ r: number, g: number, b: number }} a
 * @param {{ r: number, g: number, b: number }} b
 */
function colorDistance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function rgbToHexLocal(r, g, b) {
  return `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * @param {Array<{ r: number, g: number, b: number, w?: number }>} pixels
 * @param {number} k
 */
function kMeansWeighted(pixels, k) {
  if (!pixels.length) return [];
  const kk = Math.min(k, pixels.length);
  /** @type {Array<{ r: number, g: number, b: number }>} */
  const centroids = [];
  const step = Math.max(1, Math.floor(pixels.length / kk));
  for (let i = 0; i < kk; i++) {
    centroids.push({ ...pixels[Math.min(i * step, pixels.length - 1)] });
  }

  for (let iter = 0; iter < 16; iter++) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, w: 0, scoreSum: 0 }));
    for (const p of pixels) {
      const w = p.w ?? 1;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const d = colorDistance(p, centroids[i]);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      sums[best].r += p.r * w;
      sums[best].g += p.g * w;
      sums[best].b += p.b * w;
      sums[best].w += w;
      sums[best].scoreSum += brandColorScoreRgb(p.r, p.g, p.b) * w;
    }
    let moved = false;
    for (let i = 0; i < centroids.length; i++) {
      if (!sums[i].w) continue;
      const nr = sums[i].r / sums[i].w;
      const ng = sums[i].g / sums[i].w;
      const nb = sums[i].b / sums[i].w;
      if (colorDistance(centroids[i], { r: nr, g: ng, b: nb }) > 2) moved = true;
      centroids[i] = { r: nr, g: ng, b: nb };
    }
    if (!moved) break;
  }

  const out = [];
  for (let i = 0; i < centroids.length; i++) {
    const matched = pixels.filter((p) => {
      let best = 0;
      let bestD = Infinity;
      for (let j = 0; j < centroids.length; j++) {
        const d = colorDistance(p, centroids[j]);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      return best === i;
    });
    if (!matched.length) continue;
    let wSum = 0;
    let scoreSum = 0;
    for (const p of matched) {
      const w = p.w ?? 1;
      wSum += w;
      scoreSum += brandColorScoreRgb(p.r, p.g, p.b) * w;
    }
    out.push({
      r: centroids[i].r,
      g: centroids[i].g,
      b: centroids[i].b,
      count: matched.length,
      weight: wSum,
      brandScore: scoreSum / Math.max(wSum, 1),
    });
  }
  return out;
}

/**
 * @param {{ r: number, g: number, b: number, count: number, weight: number, brandScore: number }} c
 */
function clusterRank(c) {
  return c.weight * (0.4 + c.brandScore * 1.8);
}

/**
 * @param {Buffer} buffer
 */
async function preprocessImageBuffer(buffer) {
  try {
    return await sharp(buffer)
      .rotate()
      .trim({ threshold: 12 })
      .resize(360, 360, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
  } catch {
    return sharp(buffer)
      .rotate()
      .resize(360, 360, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
  }
}

/**
 * Pixels com peso: ignora pelo/marrom fraco; reforça verde/azul/neutros de UI.
 * @param {Buffer} buffer
 */
async function samplePixels(buffer) {
  const prepped = await preprocessImageBuffer(buffer);
  const { data, info } = await sharp(prepped).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  /** @type {Array<{ r: number, g: number, b: number, w: number }>} */
  const brand = [];
  /** @type {Array<{ r: number, g: number, b: number }>} */
  const neutrals = [];
  const stride = Math.max(1, Math.floor((width * height) / 3200));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((y * width + x) % stride !== 0) continue;
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (isNeutralUiColor(r, g, b)) {
        neutrals.push({ r, g, b });
        continue;
      }
      if (isLikelyFurOrSkinTone(r, g, b)) continue;

      let score = brandColorScoreRgb(r, g, b);
      if (isLikelyUiAccent(r, g, b)) score *= 2.2;
      if (score < 0.15) continue;

      brand.push({ r, g, b, w: score });
    }
  }

  return { brand, neutrals };
}

/**
 * @param {Array<{ r: number, g: number, b: number }>} neutrals
 */
function pickKeyNeutrals(neutrals) {
  /** @type {string[]} */
  const out = [];
  let bestLight = null;
  let bestLightLum = 0;
  let bestDark = null;
  let bestDarkLum = 999;
  /** @type {Map<string, { count: number, r: number, g: number, b: number }>} */
  const midBuckets = new Map();

  for (const p of neutrals) {
    const lum = luminance(p.r, p.g, p.b);
    const sat = saturation(p.r, p.g, p.b);
    if (sat >= 0.2) continue;

    if (lum > bestLightLum && lum > 200) {
      bestLightLum = lum;
      bestLight = p;
    }
    if (lum < bestDarkLum && lum < 70) {
      bestDarkLum = lum;
      bestDark = p;
    }
    if (lum >= 85 && lum <= 210) {
      const key = `${Math.round(p.r / 12)}-${Math.round(p.g / 12)}-${Math.round(p.b / 12)}`;
      const prev = midBuckets.get(key);
      if (prev) {
        prev.count += 1;
        prev.r += p.r;
        prev.g += p.g;
        prev.b += p.b;
      } else {
        midBuckets.set(key, { count: 1, r: p.r, g: p.g, b: p.b });
      }
    }
  }

  if (bestLight) out.push(rgbToHexLocal(bestLight.r, bestLight.g, bestLight.b));
  if (bestDark) out.push(rgbToHexLocal(bestDark.r, bestDark.g, bestDark.b));

  let bestMid = null;
  let bestMidCount = 0;
  for (const bucket of midBuckets.values()) {
    if (bucket.count > bestMidCount) {
      bestMidCount = bucket.count;
      bestMid = {
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count,
      };
    }
  }
  if (bestMid) out.push(rgbToHexLocal(bestMid.r, bestMid.g, bestMid.b));

  return out;
}

/**
 * Extrai paleta priorizando cores de logo/site (não pelo de mascote).
 * @param {Buffer} buffer
 * @returns {Promise<{ primary: string | null, secondary: string | null, accents: string[] }>}
 */
export async function extractBrandPaletteFromBuffer(buffer) {
  if (!buffer?.length) return { primary: null, secondary: null, accents: [] };

  const { brand, neutrals } = await samplePixels(buffer);
  const pixels = brand.length ? brand : [];

  if (!pixels.length) {
    const neutralHex = pickKeyNeutrals(neutrals);
    const ranked = rankBrandHexColors(neutralHex);
    return {
      primary: ranked[0] || null,
      secondary: ranked[1] || null,
      accents: ranked.slice(2, 6),
    };
  }

  const clusters = kMeansWeighted(pixels, 8);
  if (!clusters.length) return { primary: null, secondary: null, accents: [] };

  const ranked = [...clusters].sort((a, b) => clusterRank(b) - clusterRank(a));
  const hexList = ranked.map((c) => rgbToHexLocal(c.r, c.g, c.b));
  const neutralHex = pickKeyNeutrals(neutrals);
  const merged = rankBrandHexColors([...hexList, ...neutralHex]);

  return {
    primary: merged[0] || null,
    secondary: merged[1] || null,
    accents: merged.slice(2, 6),
  };
}

export { rgbToHexLocal as rgbToHex };
