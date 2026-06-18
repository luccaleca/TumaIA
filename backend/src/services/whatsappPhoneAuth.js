import { resolveWhatsappUsuarioEmpresa } from "./whatsappUsuarioEmpresa.js";

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeWhatsappPhone(raw) {
  const base = String(raw || "").split("@")[0].trim();
  return base.replace(/\D/g, "");
}

/**
 * Dígitos plausíveis de telefone (rejeita @lid — costumam ter 14+ dígitos).
 * @param {string} digits
 */
export function isPlausibleAuthPhone(digits) {
  const d = String(digits || "").replace(/\D/g, "");
  if (d.length < 10 || d.length > 13) return false;
  if (d.length === 10 || d.length === 11) return true;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return true;
  return d.length >= 11 && d.length <= 13;
}

/** @deprecated use resolveWhatsappUsuarioEmpresa */
export function resolveWhatsappEmpresa(from, opts = {}) {
  void from;
  void opts;
  return {
    ok: false,
    status: 503,
    error: "Use resolveWhatsappUsuarioEmpresa (lookup assíncrono no Supabase).",
  };
}

export { resolveWhatsappUsuarioEmpresa };
