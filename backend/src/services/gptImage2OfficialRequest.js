/**
 * Espelha o fluxo documentado da OpenAI para gpt-image-2:
 * POST /v1/images/edits — vários `image[]` + um prompt em bloco único.
 * @see https://developers.openai.com/api/docs/guides/image-generation
 */

/** Máximo de referências por chamada (API oficial). */
export const GPT_IMAGE_REFERENCE_MAX = 4;

/** Com logo no array, reservamos 1 slot para ela. */
export const GPT_IMAGE_MAX_PRODUCT_REFS_WITH_LOGO = 3;

/**
 * @param {string[]} productRefIds
 * @param {{ heroProductId?: string | null, logoId?: string | null, logoAsHero?: boolean }} [opts]
 * @returns {string[]}
 */
export function orderGptImage2ReferenceIds(productRefIds, opts = {}) {
  const heroProductId = String(opts.heroProductId || "").trim();
  const logoId = String(opts.logoId || "").trim();
  const logoAsHero = opts.logoAsHero === true;

  let products = [...new Set((productRefIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (heroProductId && products.includes(heroProductId)) {
    products = [heroProductId, ...products.filter((id) => id !== heroProductId)];
  }

  if (logoAsHero && logoId) {
    return [logoId, ...products.filter((id) => id !== logoId)].slice(0, GPT_IMAGE_REFERENCE_MAX);
  }

  const productSlots = logoId ? GPT_IMAGE_MAX_PRODUCT_REFS_WITH_LOGO : GPT_IMAGE_REFERENCE_MAX;
  products = products.filter((id) => id !== logoId).slice(0, productSlots);
  if (logoId && products.length < GPT_IMAGE_REFERENCE_MAX) {
    return [...products, logoId];
  }
  return products;
}

/**
 * Prompt no mesmo formato do exemplo oficial (um parágrafo contínuo).
 *
 * @param {{
 *   nomeFantasia?: string | null,
 *   productNames?: string[],
 *   pedido?: string | null,
 *   fraseNaImagem?: string | null,
 *   contextoNome?: string | null,
 *   aspectRatio?: string | null,
 *   logoInReferences?: boolean,
 *   heroProductName?: string | null,
 * }} ctx
 */
export function buildOfficialGptImage2Prompt(ctx = {}) {
  const nomeFantasia = String(ctx.nomeFantasia || "").trim();
  const names = (ctx.productNames || []).map((n) => String(n || "").trim()).filter(Boolean);
  const pedido = String(ctx.pedido || "").trim();
  const frase = String(ctx.fraseNaImagem || "").trim();
  const contexto = String(ctx.contextoNome || "").trim();
  const aspect = String(ctx.aspectRatio || "1:1").trim();
  const hero = String(ctx.heroProductName || "").trim();
  const logoInReferences = ctx.logoInReferences === true;

  const itemsPhrase = names.length
    ? `containing all the items shown in the reference pictures (${names.join(", ")})`
    : "containing all the items shown in the reference pictures";

  const parts = [
    `Generate a photorealistic promotional image for Instagram (aspect ratio ${aspect}).`,
    itemsPhrase + ".",
    hero ? `Feature «${hero}» as the main hero product in the composition.` : "",
    frase
      ? `Include this campaign text prominently with correct spelling: «${frase}».`
      : "",
    pedido ? `Creative direction from the client: ${pedido}` : "",
    contexto ? `Campaign context: ${contexto}.` : "",
    "Preserve the exact packaging design, labels, colors, proportions and brand details from every product reference — do not redraw or invent new labels.",
    "Use professional studio lighting and a cohesive scene.",
    logoInReferences
      ? "Place the brand logo from the reference images as a small watermark in one corner (about 8% of frame height), semi-transparent."
      : "",
    nomeFantasia ? `Brand: ${nomeFantasia}.` : "",
  ].filter(Boolean);

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 32_000);
}

/**
 * Evita cobrar geração sem referências quando o pedido exige produtos do acervo.
 *
 * @param {{ productRefIds?: string[], inputImages?: string[] | undefined }} refs
 */
export function assertGptImage2ReferencesReady(refs) {
  const need = Array.isArray(refs?.productRefIds) ? refs.productRefIds.length : 0;
  const have = Array.isArray(refs?.inputImages) ? refs.inputImages.length : 0;
  if (need > 0 && have === 0) {
    throw new Error(
      "Não foi possível enviar os PNGs do acervo ao GPT Image (URLs indisponíveis). " +
        "Confira Mídias/storage antes de gerar de novo.",
    );
  }
  if (need > 0 && have < need && have < GPT_IMAGE_REFERENCE_MAX) {
    console.warn(
      `[gpt-image-2] apenas ${have}/${need} referências com URL — seguindo com as disponíveis`,
    );
  }
}
