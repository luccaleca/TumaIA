/**
 * Modelos de post removidos do produto — stubs para compatibilidade de imports legados.
 */

/** @returns {Promise<Array<Record<string, unknown>>>} */
export async function loadActiveModeloContextoRowsForEmpresa(_supabase, _idEmpresa) {
  return [];
}

/** @returns {Promise<Array<Record<string, unknown>>>} */
export async function loadEmpresaModelosPostRows(_supabase, _idEmpresa) {
  return [];
}

/** @returns {Array<Record<string, unknown>>} */
export function mergePostModelosWithEmpresa(_modeloRows) {
  return [];
}

export async function ensureEmpresaModelosPostStructure(_supabase, _idEmpresa) {
  return [];
}

export async function seedEmpresaModelosPostForNewEmpresa(_supabase, _idEmpresa) {
  /* noop */
}

export function buildPlaybookContextoRow(_empresaModeloRow) {
  return null;
}

export async function setPostModeloAtivoForEmpresa(_supabase, _idEmpresa, _idUsuario, _slug, _ativo) {
  const err = new Error("Modelos de post foram descontinuados.");
  err.status = 410;
  throw err;
}
