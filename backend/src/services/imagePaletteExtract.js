import sharp from "sharp";

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
function saturation(r, g, b) {
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
function isNeutralBackground(r, g, b) {
  const lum = luminance(r, g, b);
  const sat = saturation(r, g, b);
  if (lum > 250 || lum < 8) return true;
  if (sat < 0.12 && lum > 40 && lum < 245) return true;
  return false;
}

/**
 * @param {{ r: number, g: number, b: number }} a
 * @param {{ r: number, g: number, b: number }} b
 */
function colorDistance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * @param {Array<{ r: number, g: number, b: number }>} pixels
 * @param {number} k
 */
function kMeans(pixels, k) {
  if (!pixels.length) return [];
  const kk = Math.min(k, pixels.length);
  /** @type {Array<{ r: number, g: number, b: number }>} */
  const centroids = [];
  const step = Math.max(1, Math.floor(pixels.length / kk));
  for (let i = 0; i < kk; i++) {
    centroids.push({ ...pixels[Math.min(i * step, pixels.length - 1)] });
  }

  for (let iter = 0; iter < 14; iter++) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0, satSum: 0 }));
    for (const p of pixels) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const d = colorDistance(p, centroids[i]);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      sums[best].r += p.r;
      sums[best].g += p.g;
      sums[best].b += p.b;
      sums[best].count++;
      sums[best].satSum += saturation(p.r, p.g, p.b);
    }
    let moved = false;
    for (let i = 0; i < centroids.length; i++) {
      if (!sums[i].count) continue;
      const nr = sums[i].r / sums[i].count;
      const ng = sums[i].g / sums[i].count;
      const nb = sums[i].b / sums[i].count;
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
    let satSum = 0;
    for (const p of matched) satSum += saturation(p.r, p.g, p.b);
    out.push({
      r: centroids[i].r,
      g: centroids[i].g,
      b: centroids[i].b,
      count: matched.length,
      avgSat: satSum / matched.length,
    });
  }
  return out;
}

/**
 * @param {{ r: number, g: number, b: number, count: number, avgSat: number }} c
 */
function clusterScore(c) {
  return c.count * (1 + c.avgSat * 2.5);
}

/**
 * @param {Buffer} buffer
 */
async function preprocessImageBuffer(buffer) {
  try {
    return await sharp(buffer)
      .rotate()
      .trim({ threshold: 12 })
      .resize(280, 280, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
  } catch {
    return sharp(buffer)
      .rotate()
      .resize(280, 280, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
  }
}

/**
 * Extrai paleta de marca (primária + secundária) com k-means em pixels saturados.
 * @param {Buffer} buffer
 * @returns {Promise<{ primary: string | null, secondary: string | null, accents: string[] }>}
 */
export async function extractBrandPaletteFromBuffer(buffer) {
  if (!buffer?.length) return { primary: null, secondary: null, accents: [] };

  const prepped = await preprocessImageBuffer(buffer);
  const { data, info } = await sharp(prepped).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  /** @type {Array<{ r: number, g: number, b: number }>} */
  const pixels = [];
  const stride = Math.max(1, Math.floor((width * height) / 2500));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((y * width + x) % stride !== 0) continue;
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isNeutralBackground(r, g, b)) continue;
      pixels.push({ r, g, b });
    }
  }

  if (!pixels.length) return { primary: null, secondary: null, accents: [] };

  const clusters = kMeans(pixels, 6);
  if (!clusters.length) return { primary: null, secondary: null, accents: [] };

  const ranked = [...clusters].sort((a, b) => clusterScore(b) - clusterScore(a));
  const primaryC = ranked[0];
  const primary = rgbToHex(primaryC.r, primaryC.g, primaryC.b);

  let secondaryC = null;
  let bestSecondaryScore = 0;
  for (let i = 1; i < ranked.length; i++) {
    const c = ranked[i];
    const dist = colorDistance(c, primaryC);
    if (dist < 38) continue;
    const score = dist * Math.sqrt(c.count) * (1 + c.avgSat);
    if (score > bestSecondaryScore) {
      bestSecondaryScore = score;
      secondaryC = c;
    }
  }

  if (!secondaryC && ranked.length > 1) {
    secondaryC = ranked[1];
  }

  if (!secondaryC || colorDistance(secondaryC, primaryC) < 28) {
    const lum = luminance(primaryC.r, primaryC.g, primaryC.b);
    const factor = lum > 145 ? 0.42 : 1.55;
    secondaryC = {
      r: Math.min(255, primaryC.r * factor),
      g: Math.min(255, primaryC.g * factor),
      b: Math.min(255, primaryC.b * factor),
      count: 0,
      avgSat: primaryC.avgSat,
    };
  }

  const secondary = rgbToHex(secondaryC.r, secondaryC.g, secondaryC.b);
  const accents = ranked
    .slice(0, 4)
    .map((c) => rgbToHex(c.r, c.g, c.b))
    .filter((hex, idx, arr) => arr.indexOf(hex) === idx && hex !== primary && hex !== secondary);

  return { primary, secondary, accents };
}
