/**
 * Acesso ao TumaCore Empresa (UI) — espelha cargo administrador em /empresas/minhas.
 * Autorização real continua no backend (`requireTumaCoreEmpresa`).
 */

/**
 * @param {Array<{ papel?: string | null }> | null | undefined} empresasRows
 */
export function isAdminTumaCoreEmpresa(empresasRows) {
  if (!Array.isArray(empresasRows) || !empresasRows.length) return false;
  return empresasRows.some((row) => String(row?.papel || "").toLowerCase() === "administrador");
}
