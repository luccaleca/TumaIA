import { env } from "../config.js";

/**
 * Como os PNGs do acervo entram na arte final.
 *
 * - `gpt_integrated` — como a API oficial: PNGs em `input_images` / `images.edit`,
 *   o modelo monta cenário + produtos numa passada (recomendado).
 * - `collage` — fundo vazio no GPT + colagem Sharp (legado).
 * - `collage_refine` — collage Sharp e depois GPT harmoniza a imagem composta.
 */
export const IMAGE_PRODUCT_MODES = ["gpt_integrated", "collage", "collage_refine"];

export function getImageProductMode() {
  const raw = String(env.IMAGE_PRODUCT_MODE || "gpt_integrated")
    .trim()
    .toLowerCase();
  return IMAGE_PRODUCT_MODES.includes(raw) ? raw : "gpt_integrated";
}

export function usesGptIntegratedProducts(mode = getImageProductMode()) {
  return mode === "gpt_integrated";
}

export function usesSharpProductCollage(mode = getImageProductMode()) {
  return mode === "collage" || mode === "collage_refine";
}

export function usesGptRefineAfterCollage(mode = getImageProductMode()) {
  return mode === "collage_refine";
}
