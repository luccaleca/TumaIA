import { env } from "../config.js";

/**
 * Como os PNGs do acervo entram na arte final.
 *
 * - `gpt_integrated` (padrão) — PNGs em `input_images` / `images.edit`.
 * - `collage` / `collage_refine` — legado Sharp; só debug local.
 */
export const IMAGE_PRODUCT_MODES = ["gpt_integrated", "collage", "collage_refine"];

/** true se o modo for colagem Sharp (legado). */
export function isLegacyCollageProductMode(mode = getImageProductMode()) {
  return mode === "collage" || mode === "collage_refine";
}
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
  return isLegacyCollageProductMode(mode);
}

export function usesGptRefineAfterCollage(mode = getImageProductMode()) {
  return mode === "collage_refine";
}
