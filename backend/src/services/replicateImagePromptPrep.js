import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { env } from "../config.js";

/** Mínimo exigido pelo FLUX 1.1 Pro (`image_prompt`). */
export const REPLICATE_IMAGE_PROMPT_MIN_PX = 256;

/** Canvas enviado à Replicate quando a referência é o logo da marca. */
export const LOGO_IMAGE_PROMPT_CANVAS_PX = 512;

/** Logo ocupa no máximo esta fração do canvas (marca pequena, não full-bleed). */
export const LOGO_IMAGE_PROMPT_MAX_FRACTION = 0.18;

/**
 * Escala preservando proporção até ambos os lados serem >= minPx.
 * @param {number} width
 * @param {number} height
 * @param {number} [minPx]
 */
export function dimensionsForReplicateImagePrompt(width, height, minPx = REPLICATE_IMAGE_PROMPT_MIN_PX) {
  const w = Math.max(1, Math.round(Number(width) || 1));
  const h = Math.max(1, Math.round(Number(height) || 1));
  if (w >= minPx && h >= minPx) {
    return { width: w, height: h, needsResize: false };
  }
  const scale = Math.max(minPx / w, minPx / h);
  return {
    width: Math.ceil(w * scale),
    height: Math.ceil(h * scale),
    needsResize: true,
  };
}

/**
 * Logo pequeno e centralizado em canvas quadrado (pixels extras = “respiro”, não estica a marca).
 * @param {Buffer} buffer
 * @param {number} [canvasPx]
 * @param {number} [maxFraction]
 */
export async function compositeBrandLogoForImagePrompt(
  buffer,
  canvasPx = LOGO_IMAGE_PROMPT_CANVAS_PX,
  maxFraction = LOGO_IMAGE_PROMPT_MAX_FRACTION,
) {
  const logoMax = Math.max(REPLICATE_IMAGE_PROMPT_MIN_PX / 2, Math.floor(canvasPx * maxFraction));
  const logo = await sharp(buffer).resize(logoMax, logoMax, { fit: "inside" }).png().toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const lw = logoMeta.width ?? logoMax;
  const lh = logoMeta.height ?? logoMax;
  const left = Math.max(0, Math.floor((canvasPx - lw) / 2));
  const top = Math.max(0, Math.floor((canvasPx - lh) / 2));
  return sharp({
    create: {
      width: canvasPx,
      height: canvasPx,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toBuffer();
}

/**
 * Produto / packshot: mantém proporção e letterbox se precisar atingir o mínimo.
 * @param {Buffer} buffer
 */
export async function prepareProductImagePromptBuffer(buffer) {
  const meta = await sharp(buffer).metadata();
  const sw = Math.max(1, meta.width ?? 1);
  const sh = Math.max(1, meta.height ?? 1);
  const target = dimensionsForReplicateImagePrompt(sw, sh);
  const side = Math.max(target.width, target.height, REPLICATE_IMAGE_PROMPT_MIN_PX);
  return sharp(buffer)
    .resize(side, side, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/**
 * @param {Buffer} buffer
 * @param {{ kind?: 'logo' | 'product' }} [opts]
 */
export async function prepareImagePromptPngBuffer(buffer, opts = {}) {
  const kind = opts.kind === "logo" ? "logo" : "product";
  if (kind === "logo") {
    return { buffer: await compositeBrandLogoForImagePrompt(buffer), alwaysUpload: true };
  }
  const meta = await sharp(buffer).metadata();
  const sw = meta.width ?? 1;
  const sh = meta.height ?? 1;
  const needs =
    sw < REPLICATE_IMAGE_PROMPT_MIN_PX ||
    sh < REPLICATE_IMAGE_PROMPT_MIN_PX ||
    dimensionsForReplicateImagePrompt(sw, sh).needsResize;
  if (!needs) {
    return { buffer, alwaysUpload: false };
  }
  return { buffer: await prepareProductImagePromptBuffer(buffer), alwaysUpload: true };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string} path
 * @param {Buffer} png
 */
async function uploadPrepPng(db, idEmpresa, path, png) {
  const bucket = (env.MEDIA_BUCKET || "midias").trim();
  const { error: upErr } = await db.storage.from(bucket).upload(path, png, {
    contentType: "image/png",
    upsert: true,
  });
  if (upErr) {
    throw new Error(upErr.message || "Falha ao preparar imagem de referência.");
  }
  const { data, error: signErr } = await db.storage.from(bucket).createSignedUrl(path, 3600);
  if (signErr || !data?.signedUrl) {
    throw new Error(signErr?.message || "Não foi possível gerar URL da referência preparada.");
  }
  return data.signedUrl;
}

/**
 * Baixa a imagem, prepara para o FLUX (logo pequeno no canvas / produto com letterbox) e devolve URL assinada.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string} imageUrl
 * @param {{ idMidia?: string, kind?: 'logo' | 'product' }} [opts]
 * @returns {Promise<string>}
 */
export async function ensureReplicateImagePromptUrl(db, idEmpresa, imageUrl, opts = {}) {
  const url = String(imageUrl || "").trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("URL de referência inválida.");
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 45_000);
  let buffer;
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Não foi possível baixar a imagem de referência (HTTP ${res.status}).`);
    }
    const ab = await res.arrayBuffer();
    buffer = Buffer.from(ab);
    if (buffer.length < 32) {
      throw new Error("Arquivo de referência vazio ou inválido.");
    }
  } finally {
    clearTimeout(timer);
  }

  const kind = opts.kind === "logo" ? "logo" : "product";
  const { buffer: prepared, alwaysUpload } = await prepareImagePromptPngBuffer(buffer, { kind });

  if (!alwaysUpload && kind === "product") {
    const meta = await sharp(buffer).metadata();
    const sw = meta.width ?? 1;
    const sh = meta.height ?? 1;
    if (sw >= REPLICATE_IMAGE_PROMPT_MIN_PX && sh >= REPLICATE_IMAGE_PROMPT_MIN_PX) {
      return url;
    }
  }

  const idMidia = String(opts.idMidia || "").trim() || randomUUID();
  const suffix = kind === "logo" ? "logo" : "ref";
  const path = `${idEmpresa}/_replicate_prep/${idMidia}_${suffix}.png`;
  return uploadPrepPng(db, idEmpresa, path, prepared);
}

/**
 * @param {string} msg
 */
export function friendlyImageGenerationError(msg) {
  const s = String(msg || "").trim();
  if (!s) return "Não foi possível gerar a prévia agora. Tente novamente.";
  if (/256\s*x\s*256|at least 256/i.test(s)) {
    return "A foto de referência é muito pequena para compor a arte. Use uma imagem maior no acervo ou tente de novo.";
  }
  if (/replicate|flux|prediction/i.test(s)) {
    return "Não foi possível gerar a prévia agora. Tente novamente em instantes.";
  }
  return s.length > 220 ? `${s.slice(0, 217)}…` : s;
}
