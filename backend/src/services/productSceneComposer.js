import sharp from "sharp";
import { env } from "../config.js";
import { fetchImageBuffer } from "./llamaVisionImage.js";
import { resolveFetchableImageUrlForMidia } from "./referenceMidiaUrls.js";

const COMPOSE_FETCH_MAX_BYTES = 20 * 1024 * 1024;
const BG_EDGE_MAX_AVG_DIFF = 20;
const BG_EDGE_NEAR_RATIO_MIN = 0.78;
const BG_FLOOD_BASE_THRESHOLD = 26;
const BG_FLOOD_SOFT_THRESHOLD = 38;
const BG_REMOVAL_MIN_RATIO = 0.05;
const BG_REMOVAL_MAX_RATIO = 0.85;

function pixelOffset(x, y, width) {
  return (y * width + x) * 4;
}

function colorDistanceSq(r, g, b, base) {
  const dr = r - base[0];
  const dg = g - base[1];
  const db = b - base[2];
  return dr * dr + dg * dg + db * db;
}

function analyzeEdgeBackground(data, width, height) {
  const samples = [];
  const push = (x, y) => {
    const idx = pixelOffset(x, y, width);
    const alpha = data[idx + 3];
    if (alpha < 245) return;
    samples.push([data[idx], data[idx + 1], data[idx + 2]]);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    if (height > 1) push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    push(0, y);
    if (width > 1) push(width - 1, y);
  }
  if (samples.length < Math.max(24, Math.round((width + height) * 0.15))) return null;
  const mean = [0, 0, 0];
  for (const [r, g, b] of samples) {
    mean[0] += r;
    mean[1] += g;
    mean[2] += b;
  }
  mean[0] /= samples.length;
  mean[1] /= samples.length;
  mean[2] /= samples.length;
  let nearCount = 0;
  let diffSum = 0;
  for (const [r, g, b] of samples) {
    const diff = Math.sqrt(colorDistanceSq(r, g, b, mean));
    diffSum += diff;
    if (diff <= BG_FLOOD_BASE_THRESHOLD) nearCount += 1;
  }
  const avgDiff = diffSum / samples.length;
  const nearRatio = nearCount / samples.length;
  if (avgDiff > BG_EDGE_MAX_AVG_DIFF || nearRatio < BG_EDGE_NEAR_RATIO_MIN) return null;
  return {
    mean,
    baseThresholdSq: BG_FLOOD_BASE_THRESHOLD ** 2,
    softThresholdSq: BG_FLOOD_SOFT_THRESHOLD ** 2,
  };
}

async function removeSolidEdgeBackground(buffer) {
  const { data, info } = await sharp(buffer).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = Math.max(1, info.width ?? 1);
  const height = Math.max(1, info.height ?? 1);
  const total = width * height;
  let hasMeaningfulTransparency = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 245) {
      hasMeaningfulTransparency = true;
      break;
    }
  }
  if (hasMeaningfulTransparency) return { buffer, removed: false };
  const bg = analyzeEdgeBackground(data, width, height);
  if (!bg) return { buffer, removed: false };

  const visited = new Uint8Array(total);
  const queue = [];
  const seed = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const px = pixelOffset(x, y, width);
    if (data[px + 3] < 245) return;
    const distSq = colorDistanceSq(data[px], data[px + 1], data[px + 2], bg.mean);
    if (distSq > bg.baseThresholdSq) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    seed(x, 0);
    if (height > 1) seed(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    seed(0, y);
    if (width > 1) seed(width - 1, y);
  }

  let removed = 0;
  for (let q = 0; q < queue.length; q++) {
    const idx = queue[q];
    removed += 1;
    const x = idx % width;
    const y = Math.floor(idx / width);
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (visited[next]) continue;
      const px = pixelOffset(nx, ny, width);
      if (data[px + 3] < 245) continue;
      const distSq = colorDistanceSq(data[px], data[px + 1], data[px + 2], bg.mean);
      if (distSq > bg.softThresholdSq) continue;
      visited[next] = 1;
      queue.push(next);
    }
  }

  const removedRatio = removed / total;
  if (removedRatio < BG_REMOVAL_MIN_RATIO || removedRatio > BG_REMOVAL_MAX_RATIO) {
    return { buffer, removed: false };
  }

  const out = Buffer.from(data);
  for (let idx = 0; idx < total; idx++) {
    if (!visited[idx]) continue;
    out[idx * 4 + 3] = 0;
  }
  const cutout = await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { buffer: cutout, removed: true };
}

function orderedRows(rows, ids) {
  const map = new Map((rows || []).map((row) => [String(row.id_midia ?? "").trim(), row]));
  return ids.map((id) => map.get(String(id).trim())).filter(Boolean);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {number} count
 * @param {number} width
 * @param {number} height
 * @param {{ heroBottom?: number | null, heroPreferred?: boolean }} [opts]
 */
export function buildProductLayoutSlots(count, width, height, opts = {}) {
  const total = Math.max(1, Math.min(3, Math.round(Number(count) || 1)));
  const ratio = width / Math.max(1, height);
  const heroBottomRaw = Number(opts?.heroBottom);
  const heroBottom = Number.isFinite(heroBottomRaw) ? clamp(heroBottomRaw, 0.03, 0.24) : null;
  const heroPreferred = opts?.heroPreferred === true;

  if (total === 1) {
    return [
      {
        x: 0.5,
        width: ratio < 0.8 ? (heroBottom && heroBottom > 0.12 ? 0.42 : 0.5) : ratio > 1.2 ? 0.34 : 0.42,
        bottom: heroBottom ?? (ratio < 0.8 ? 0.04 : 0.05),
      },
    ];
  }

  if (total === 2) {
    if (heroPreferred) {
      if (ratio < 0.8) {
        return [
          { x: 0.27, width: 0.21, bottom: 0.06 },
          { x: 0.58, width: heroBottom && heroBottom > 0.12 ? 0.29 : 0.33, bottom: heroBottom ?? 0.04 },
        ];
      }
      return [
        { x: 0.3, width: ratio > 1.2 ? 0.18 : 0.22, bottom: 0.055 },
        { x: 0.58, width: ratio > 1.2 ? 0.24 : 0.3, bottom: heroBottom ?? 0.04 },
      ];
    }
    if (ratio < 0.8) {
      return [
        { x: 0.31, width: 0.29, bottom: 0.05 },
        { x: 0.69, width: 0.29, bottom: 0.05 },
      ];
    }
    return [
      { x: 0.33, width: ratio > 1.2 ? 0.22 : 0.26, bottom: 0.05 },
      { x: 0.67, width: ratio > 1.2 ? 0.22 : 0.26, bottom: 0.05 },
    ];
  }

  const centerBottom = heroBottom ?? 0.03;
  if (ratio < 0.8) {
    return [
      { x: 0.22, width: 0.22, bottom: 0.055 },
      { x: 0.5, width: heroBottom && heroBottom > 0.12 ? 0.29 : 0.34, bottom: centerBottom },
      { x: 0.78, width: 0.22, bottom: 0.055 },
    ];
  }
  if (ratio > 1.2) {
    return [
      { x: 0.26, width: 0.18, bottom: 0.05 },
      { x: 0.5, width: heroBottom && heroBottom > 0.1 ? 0.22 : 0.26, bottom: centerBottom },
      { x: 0.74, width: 0.18, bottom: 0.05 },
    ];
  }
  return [
    { x: 0.22, width: 0.24, bottom: 0.055 },
    { x: 0.5, width: heroBottom && heroBottom > 0.1 ? 0.28 : 0.34, bottom: centerBottom },
    { x: 0.78, width: 0.24, bottom: 0.055 },
  ];
}

async function detectCentralSupportBottom(buffer, width, height) {
  const { data } = await sharp(buffer)
    .rotate()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const x0 = Math.max(0, Math.round(width * 0.28));
  const x1 = Math.min(width - 1, Math.round(width * 0.72));
  const yStart = Math.max(12, Math.round(height * 0.42));
  const yEnd = Math.max(yStart + 1, Math.round(height * 0.88));
  let bestY = -1;
  let bestScore = 0;

  for (let y = yStart; y < yEnd - 1; y++) {
    let diffSum = 0;
    let brightSum = 0;
    let count = 0;
    for (let x = x0; x <= x1; x += 2) {
      const idx = y * width + x;
      const next = (y + 1) * width + x;
      diffSum += Math.abs(data[idx] - data[next]);
      brightSum += data[idx];
      count += 1;
    }
    if (!count) continue;
    const support = diffSum / count;
    const bright = brightSum / count;

    let noiseSum = 0;
    let noiseCount = 0;
    const boxTop = Math.max(2, y - Math.round(height * 0.24));
    for (let yy = boxTop; yy < y - 2; yy += 6) {
      for (let xx = x0; xx <= x1; xx += 6) {
        const idx = yy * width + xx;
        const right = yy * width + Math.min(width - 1, xx + 1);
        const down = Math.min(height - 1, yy + 1) * width + xx;
        noiseSum += Math.abs(data[idx] - data[right]) + Math.abs(data[idx] - data[down]);
        noiseCount += 2;
      }
    }
    const noise = noiseCount ? noiseSum / noiseCount : 0;
    const score = support * 2.2 + bright * 0.08 - noise * 1.4;
    if (score > bestScore) {
      bestScore = score;
      bestY = y;
    }
  }

  if (bestY < 0 || bestScore < 18) return null;
  return clamp((height - bestY) / height, 0.03, 0.24);
}

function arrangeProductRowsForComposition(rows, heroProductId = "") {
  const heroId = String(heroProductId || "").trim();
  if (!heroId || !Array.isArray(rows) || rows.length <= 1) return rows;
  const heroRow = rows.find((row) => String(row?.id_midia ?? "").trim() === heroId);
  if (!heroRow) return rows;
  const rest = rows.filter((row) => String(row?.id_midia ?? "").trim() !== heroId);
  if (rows.length === 2) return [...rest, heroRow];
  return [rest[0], heroRow, ...rest.slice(1)];
}

/**
 * @param {Buffer} buffer
 * @param {number} targetWidth
 */
async function prepareProductLayer(buffer, targetWidth) {
  const cutout = await removeSolidEdgeBackground(buffer);
  let img = sharp(cutout.buffer).rotate().ensureAlpha();
  try {
    img = img.trim();
  } catch {
    // keep original if trim fails
  }
  return img.resize({ width: targetWidth, fit: "inside", withoutEnlargement: false }).png().toBuffer();
}

async function prepareLogoLayer(buffer, targetWidth) {
  let img = sharp(buffer).rotate().ensureAlpha();
  try {
    img = img.trim();
  } catch {
    // keep original if trim fails
  }
  return img.resize({ width: targetWidth, fit: "inside", withoutEnlargement: false }).png().toBuffer();
}

/**
 * @param {number} width
 * @param {number} height
 * @param {number} cx
 * @param {number} cy
 * @param {number} ellipseW
 * @param {number} ellipseH
 */
function buildShadowSvg(width, height, cx, cy, ellipseW, ellipseH) {
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${Math.max(6, ellipseH / 3)}" />
    </filter>
  </defs>
  <ellipse cx="${cx}" cy="${cy}" rx="${ellipseW / 2}" ry="${ellipseH / 2}" fill="rgba(0,0,0,0.28)" filter="url(#blur)" />
</svg>`.trim());
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string} outputPath
 * @param {Buffer} buffer
 */
async function uploadComposedPreview(db, idEmpresa, outputPath, buffer) {
  const bucket = (env.MEDIA_BUCKET || "midias").trim();
  const path = `${idEmpresa}/_generated/${outputPath}`;
  const { error: upErr } = await db.storage.from(bucket).upload(path, buffer, {
    contentType: "image/png",
    upsert: true,
  });
  if (upErr) throw new Error(upErr.message || "Falha ao salvar a prévia composta.");
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Falha ao gerar URL da prévia composta.");
  }
  return data.signedUrl;
}

/**
 * Para assets da própria empresa, evita round-trip HTTP externo quando possível.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {Record<string, unknown>} row
 */
async function loadCompanyMidiaBuffer(db, row) {
  const path = String(row?.caminho_storage ?? "").trim();
  const bucket = (env.MEDIA_BUCKET || "midias").trim();
  if (path) {
    try {
      const { data, error } = await db.storage.from(bucket).download(path);
      if (!error && data) {
        return Buffer.from(await data.arrayBuffer());
      }
    } catch {
      // fallback para URL assinada abaixo
    }
  }
  const url = await resolveFetchableImageUrlForMidia(db, row);
  const { buffer } = await fetchImageBuffer(url, {
    maxBytes: COMPOSE_FETCH_MAX_BYTES,
    timeoutMs: 60_000,
    retries: 1,
  });
  return buffer;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string} backgroundUrl
 * @param {string[]} productRefIds
 * @param {number} [variant]
 * @param {{ heroProductId?: string | null, logoId?: string | null }} [opts]
 */
export async function composeGeneratedSceneWithProducts(
  db,
  idEmpresa,
  backgroundUrl,
  productRefIds,
  variant = 0,
  opts = {},
) {
  const productIds = [...new Set((productRefIds || []).map((id) => String(id || "").trim()).filter(Boolean))].slice(
    0,
    3,
  );
  const heroProductId = String(opts.heroProductId || "").trim();
  const logoId = String(opts.logoId || "").trim();
  if (!backgroundUrl || (!productIds.length && !logoId)) return backgroundUrl;

  const { buffer: backgroundBuffer } = await fetchImageBuffer(backgroundUrl, {
    maxBytes: COMPOSE_FETCH_MAX_BYTES,
    timeoutMs: 60_000,
    retries: 2,
  });
  const bgMeta = await sharp(backgroundBuffer).metadata();
  const width = Math.max(1, bgMeta.width ?? 1024);
  const height = Math.max(1, bgMeta.height ?? 1024);
  const ids = [...new Set([...productIds, ...(logoId ? [logoId] : [])])];

  const { data, error } = await db
    .from("midia")
    .select("id_midia, id_empresa, caminho_storage, url_arquivo")
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .in("id_midia", ids);
  if (error) throw new Error(error.message);

  const rows = orderedRows(Array.isArray(data) ? data : [], ids);
  if (!rows.length) return backgroundUrl;

  const productRows = arrangeProductRowsForComposition(orderedRows(rows, productIds), heroProductId);
  const logoRow = logoId ? rows.find((row) => String(row.id_midia ?? "").trim() === logoId) || null : null;
  const heroBottom = await detectCentralSupportBottom(backgroundBuffer, width, height);
  const slots = buildProductLayoutSlots(productRows.length, width, height, {
    heroBottom,
    heroPreferred: Boolean(heroProductId && productRows.some((row) => String(row?.id_midia ?? "").trim() === heroProductId)),
  });
  /** @type {Array<{ input: Buffer, left: number, top: number }>} */
  const composites = [];

  for (let i = 0; i < productRows.length && i < slots.length; i++) {
    const row = productRows[i];
    const slot = slots[i];
    const buffer = await loadCompanyMidiaBuffer(db, row);
    const layer = await prepareProductLayer(buffer, Math.max(120, Math.round(width * slot.width)));
    const layerMeta = await sharp(layer).metadata();
    const lw = Math.max(1, layerMeta.width ?? 1);
    const lh = Math.max(1, layerMeta.height ?? 1);
    const left = Math.max(0, Math.round(width * slot.x - lw / 2));
    const top = Math.max(0, Math.round(height - height * slot.bottom - lh));

    const shadow = buildShadowSvg(
      width,
      height,
      Math.round(left + lw / 2),
      Math.round(top + lh - Math.max(10, lw * 0.03)),
      Math.round(lw * 0.68),
      Math.round(Math.max(18, lw * 0.08)),
    );
    composites.push({ input: shadow, left: 0, top: 0 });
    composites.push({ input: layer, left, top });
  }

  if (logoRow) {
    const buffer = await loadCompanyMidiaBuffer(db, logoRow);
    const targetWidth = Math.max(72, Math.round(Math.min(width, height) * 0.12));
    const logo = await prepareLogoLayer(buffer, targetWidth);
    const logoMeta = await sharp(logo).metadata();
    const lw = Math.max(1, logoMeta.width ?? targetWidth);
    const lh = Math.max(1, logoMeta.height ?? targetWidth);
    const padding = Math.max(16, Math.round(Math.min(width, height) * 0.035));
    composites.push({
      input: logo,
      left: Math.max(0, width - lw - padding),
      top: Math.max(0, height - lh - padding),
    });
  }

  const out = await sharp(backgroundBuffer).composite(composites).png().toBuffer();
  const stamp = `${Date.now()}-${variant}-${Math.random().toString(36).slice(2, 8)}`;
  return uploadComposedPreview(db, idEmpresa, `preview-composed-${stamp}.png`, out);
}
