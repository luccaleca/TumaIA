/**
 * Telefone do usuário — só dígitos para comparar WhatsApp ↔ cadastro.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeTelefoneUsuario(raw) {
  const base = String(raw ?? "").split("@")[0].trim();
  return base.replace(/\D/g, "");
}

/**
 * @param {unknown} raw
 */
export function isTelefoneUsuarioValido(raw) {
  const digits = normalizeTelefoneUsuario(raw);
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
export function telefoneUsuarioParaDb(raw) {
  const digits = normalizeTelefoneUsuario(raw);
  return digits.length >= 10 ? digits : null;
}
