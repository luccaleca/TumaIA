const KEY_ID = "tuma_empresa_ativa_id";
const KEY_NOME = "tuma_empresa_ativa_nome";
export const EMPRESA_ATIVA_CHANGE_EVENT = "tuma-empresa-ativa-change";

/** @returns {{ id: string, nome: string } | null} */
export function getEmpresaAtivaSnapshot() {
  if (typeof window === "undefined") return null;
  const id = sessionStorage.getItem(KEY_ID)?.trim();
  if (!id) return null;
  const nome = sessionStorage.getItem(KEY_NOME)?.trim() || "Empresa";
  return { id, nome };
}

export function getEmpresaAtivaId() {
  return getEmpresaAtivaSnapshot()?.id ?? null;
}

/**
 * @param {{ id_empresa?: string, nome_fantasia?: string } | null | undefined} empresa
 */
export function setEmpresaAtiva(empresa) {
  if (typeof window === "undefined") return;
  const id = empresa?.id_empresa ? String(empresa.id_empresa).trim() : "";
  if (!id) {
    sessionStorage.removeItem(KEY_ID);
    sessionStorage.removeItem(KEY_NOME);
  } else {
    sessionStorage.setItem(KEY_ID, id);
    const nome = String(empresa.nome_fantasia ?? "").trim() || "Empresa";
    sessionStorage.setItem(KEY_NOME, nome);
  }
  window.dispatchEvent(new CustomEvent(EMPRESA_ATIVA_CHANGE_EVENT));
}

export function clearEmpresaAtiva() {
  setEmpresaAtiva(null);
}

/**
 * Escolhe a empresa ativa a partir da lista `/empresas/minhas`.
 * @param {Array<{ empresa?: { id_empresa?: string } }>} empresasRows
 * @param {{ preferId?: string | null, fallbackFirst?: boolean }} [options]
 */
export function resolveEmpresaAtivaId(empresasRows, options = {}) {
  const ids = (empresasRows || [])
    .map((row) => row?.empresa?.id_empresa)
    .filter(Boolean)
    .map(String);
  if (!ids.length) return null;

  const prefer = options.preferId ? String(options.preferId) : null;
  const stored = getEmpresaAtivaId();
  if (prefer && ids.includes(prefer)) return prefer;
  if (stored && ids.includes(stored)) return stored;
  if (options.fallbackFirst !== false) return ids[0];
  return null;
}

/**
 * @param {Array<{ empresa?: Record<string, unknown>, papel?: string }>} empresasRows
 * @param {string | null} id
 */
export function empresaRowFromMinhas(empresasRows, id) {
  if (!id || !Array.isArray(empresasRows)) return null;
  return empresasRows.find((row) => String(row?.empresa?.id_empresa ?? "") === String(id)) || null;
}

/**
 * @param {Array<{ empresa?: Record<string, unknown> }>} empresasRows
 * @param {{ preferId?: string | null, fallbackFirst?: boolean }} [options]
 * @returns {{ id: string, row: Record<string, unknown> | null, empresa: Record<string, unknown> | null }}
 */
export function syncEmpresaAtivaFromMinhas(empresasRows, options = {}) {
  const id = resolveEmpresaAtivaId(empresasRows, options);
  const row = id ? empresaRowFromMinhas(empresasRows, id) : null;
  const empresa = row?.empresa && typeof row.empresa === "object" ? row.empresa : null;
  if (empresa?.id_empresa) setEmpresaAtiva(empresa);
  else if (typeof window !== "undefined") {
    sessionStorage.removeItem(KEY_ID);
    sessionStorage.removeItem(KEY_NOME);
    window.dispatchEvent(new CustomEvent(EMPRESA_ATIVA_CHANGE_EVENT));
  }
  return { id, row, empresa };
}
