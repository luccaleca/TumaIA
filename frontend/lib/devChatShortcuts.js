/** Atalho dev: simula prévia gerada (pós-imagem) sem chamar API de imagem. */
const WAGNER_POST_IMAGE_MOCK = /^\s*wagner\s*[!.?]*\s*$/i;

export const WAGNER_MOCK_IMAGE_URL = "/imagens/imagem-final-pronto-instagram.jpg";

/**
 * @param {string} text
 */
export function isWagnerPostImageMock(text) {
  return WAGNER_POST_IMAGE_MOCK.test(String(text || "").trim());
}

/**
 * @param {{ urls?: string[], model?: string, imageGeneration?: object | null }} [overrides]
 */
export function buildWagnerPostImageMockResult(overrides = {}) {
  const urls = Array.isArray(overrides.urls) && overrides.urls.length
    ? overrides.urls
    : [WAGNER_MOCK_IMAGE_URL];
  return {
    ok: true,
    urls,
    model: overrides.model ?? "dev/wagner",
    contexto: overrides.contexto ?? null,
    imageGeneration: overrides.imageGeneration ?? null,
  };
}
