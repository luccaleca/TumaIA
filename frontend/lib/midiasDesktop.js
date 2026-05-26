/**
 * Área de trabalho do acervo: pasta fixa no backend, invisível na UI.
 * `pastaAtualUi` vazio = usuário está na área de trabalho.
 */

/**
 * @param {string} pastaAtualUi
 * @param {string | null | undefined} pastaUploadRaiz
 */
export function isMidiasDesktop(pastaAtualUi, pastaUploadRaiz) {
  if (!pastaAtualUi) return true;
  if (pastaUploadRaiz && pastaAtualUi === pastaUploadRaiz) return true;
  return false;
}

/**
 * @param {string} pastaAtualUi
 * @param {string | null | undefined} pastaUploadRaiz
 */
export function resolveMidiasPastaAtivaId(pastaAtualUi, pastaUploadRaiz) {
  if (isMidiasDesktop(pastaAtualUi, pastaUploadRaiz)) return pastaUploadRaiz || null;
  return pastaAtualUi;
}

/**
 * Normaliza id vindo da API para estado da UI.
 * @param {string} pastaId
 * @param {string | null | undefined} pastaUploadRaiz
 */
export function midiasPastaIdToUi(pastaId, pastaUploadRaiz) {
  if (!pastaId) return "";
  if (pastaUploadRaiz && pastaId === pastaUploadRaiz) return "";
  return pastaId;
}

/**
 * @param {Array<{ id_pasta: string, id_pasta_pai?: string | null, nome?: string }>} pastas
 * @param {string} pastaAtualUi
 * @param {string | null | undefined} pastaUploadRaiz
 */
export function buildMidiasBreadcrumbs(pastas, pastaAtualUi, pastaUploadRaiz) {
  if (isMidiasDesktop(pastaAtualUi, pastaUploadRaiz) || !pastas.length) return [];
  const map = new Map(pastas.map((p) => [p.id_pasta, p]));
  const out = [];
  let current = map.get(pastaAtualUi) || null;
  while (current && current.id_pasta !== pastaUploadRaiz) {
    out.unshift(current);
    const paiId = current.id_pasta_pai;
    if (!paiId || paiId === pastaUploadRaiz) break;
    current = map.get(paiId) || null;
  }
  return out;
}
