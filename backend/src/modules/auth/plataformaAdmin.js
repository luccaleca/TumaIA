/**
 * Dono da plataforma (TumaCore Plataforma) — separado do cargo
 * `administrador` da empresa (TumaCore Empresa / workspace do cliente).
 *
 * Fonte da verdade: identidade autenticada + allowlist
 * `TUMAIA_PLATAFORMA_ADMIN_EMAILS` (e opcionalmente coluna `usuario.dono_plataforma`).
 * Nunca autorizar por domínio de e-mail nem por flag enviada pelo frontend.
 */

/**
 * @param {string | undefined | null} raw
 * @returns {string[]}
 */
export function parsePlataformaAdminEmails(raw) {
  return String(raw || "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {Record<string, unknown> | null | undefined} usuario
 * @param {string[] | string | undefined | null} allowlist
 */
export function isDonoPlataforma(usuario, allowlist) {
  if (!usuario || typeof usuario !== "object") return false;
  if (usuario.dono_plataforma === true) return true;

  const emails = Array.isArray(allowlist)
    ? allowlist.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean)
    : parsePlataformaAdminEmails(allowlist);
  if (!emails.length) return false;

  const email = String(usuario.email || "")
    .trim()
    .toLowerCase();
  return Boolean(email && emails.includes(email));
}

/**
 * Anexa `dono_plataforma` ao payload de /auth/me sem mutar a linha do banco.
 *
 * @param {Record<string, unknown>} usuario
 * @param {string[] | string | undefined | null} allowlist
 */
export function withDonoPlataformaFlag(usuario, allowlist) {
  return {
    ...usuario,
    dono_plataforma: isDonoPlataforma(usuario, allowlist),
  };
}
