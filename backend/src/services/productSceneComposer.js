import sharp from "sharp";
import { env } from "../config.js";
import { fetchImageBuffer } from "./llamaVisionImage.js";
import { resolveFetchableImageUrlForMidia } from "./referenceMidiaUrls.js";

const COMPOSE_FETCH_MAX_BYTES = 20 * 1024 * 1024;

function orderedRows(rows, ids) {
  const map = new Map((rows || []).map((row) => [String(row.id_midia ?? "").trim(), row]));
  return ids.map((id) => map.get(String(id).trim())).filter(Boolean);
}

/**
 * @param {number} count
 * @param {number} width
 * @param {number} height
 */
export function buildProductLayoutSlots(count, width, height) {
  const total = Math.max(1, Math.min(3, Math.round(Number(count) || 1)));
  const ratio = width / Math.max(1, height);

  if (total === 1) {
    return [
      {
        x: 0.5,
        width: ratio < 0.8 ? 0.5 : ratio > 1.2 ? 0.34 : 0.42,
        bottom: ratio < 0.8 ? 0.04 : 0.05,
      },
    ];
  }

  if (total === 2) {
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

  if (ratio < 0.8) {
    return [
      { x: 0.22, width: 0.22, bottom: 0.055 },
      { x: 0.5, width: 0.34, bottom: 0.03 },
      { x: 0.78, width: 0.22, bottom: 0.055 },
    ];
  }
  if (ratio > 1.2) {
    return [
      { x: 0.26, width: 0.18, bottom: 0.05 },
      { x: 0.5, width: 0.26, bottom: 0.03 },
      { x: 0.74, width: 0.18, bottom: 0.05 },
    ];
  }
  return [
    { x: 0.22, width: 0.24, bottom: 0.055 },
    { x: 0.5, width: 0.34, bottom: 0.03 },
    { x: 0.78, width: 0.24, bottom: 0.055 },
  ];
}

/**
 * @param {Buffer} buffer
 * @param {number} targetWidth
 */
async function prepareProductLayer(buffer, targetWidth) {
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
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string} backgroundUrl
 * @param {string[]} productRefIds
 * @param {number} [variant]
 */
export async function composeGeneratedSceneWithProducts(db, idEmpresa, backgroundUrl, productRefIds, variant = 0) {
  const ids = [...new Set((productRefIds || []).map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 3);
  if (!backgroundUrl || !ids.length) return backgroundUrl;

  const { buffer: backgroundBuffer } = await fetchImageBuffer(backgroundUrl, {
    maxBytes: COMPOSE_FETCH_MAX_BYTES,
  });
  const bgMeta = await sharp(backgroundBuffer).metadata();
  const width = Math.max(1, bgMeta.width ?? 1024);
  const height = Math.max(1, bgMeta.height ?? 1024);

  const { data, error } = await db
    .from("midia")
    .select("id_midia, id_empresa, caminho_storage, url_arquivo")
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .in("id_midia", ids);
  if (error) throw new Error(error.message);

  const rows = orderedRows(Array.isArray(data) ? data : [], ids);
  if (!rows.length) return backgroundUrl;

  const slots = buildProductLayoutSlots(rows.length, width, height);
  /** @type {Array<{ input: Buffer, left: number, top: number }>} */
  const composites = [];

  for (let i = 0; i < rows.length && i < slots.length; i++) {
    const row = rows[i];
    const slot = slots[i];
    const url = await resolveFetchableImageUrlForMidia(db, row);
    const { buffer } = await fetchImageBuffer(url, { maxBytes: COMPOSE_FETCH_MAX_BYTES });
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

  const out = await sharp(backgroundBuffer).composite(composites).png().toBuffer();
  const stamp = `${Date.now()}-${variant}-${Math.random().toString(36).slice(2, 8)}`;
  return uploadComposedPreview(db, idEmpresa, `preview-composed-${stamp}.png`, out);
}
