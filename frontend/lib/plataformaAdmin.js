/**
 * Espelha `backend/src/modules/auth/plataformaAdmin.js` no browser.
 * @param {Record<string, unknown> | null | undefined} usuario
 */
export function isDonoPlataformaUsuario(usuario) {
  return Boolean(usuario && usuario.dono_plataforma === true);
}
