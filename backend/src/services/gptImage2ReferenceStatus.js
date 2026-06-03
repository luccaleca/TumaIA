import { GPT_IMAGE_REFERENCE_MAX } from "./gptImage2OfficialRequest.js";

/**
 * Avalia referências sem lançar (prévia / plano antes de cobrar).
 *
 * @param {{ productRefIds?: string[], inputImages?: string[] | undefined, productMode?: string }} refs
 * @param {{ integrated?: boolean }} [opts]
 */
export function evaluateGptImage2ReferencesReady(refs, opts = {}) {
  const integrated = opts.integrated !== false;
  const need = Array.isArray(refs?.productRefIds) ? refs.productRefIds.length : 0;
  const have = Array.isArray(refs?.inputImages) ? refs.inputImages.length : 0;
  const expected = integrated && need > 0 ? Math.min(need + (refs?.logoInReferences ? 1 : 0), GPT_IMAGE_REFERENCE_MAX) : have;

  if (integrated && need > 0 && have === 0) {
    return {
      ready: false,
      blocked: true,
      block_reason:
        "Não foi possível enviar os PNGs do acervo ao GPT Image (URLs indisponíveis). " +
        "Confira Mídias/storage antes de gerar de novo.",
      reference_png_count: 0,
      reference_png_expected: need,
      missing_midia_urls: true,
    };
  }

  const partial = integrated && need > 0 && have > 0 && have < need;
  return {
    ready: !partial || have > 0,
    blocked: false,
    block_reason: null,
    reference_png_count: have,
    reference_png_expected: integrated && need > 0 ? expected : have,
    missing_midia_urls: false,
    partial_reference_warning: partial
      ? `Apenas ${have} de ${need} PNG(s) do acervo têm URL acessível.`
      : null,
  };
}
