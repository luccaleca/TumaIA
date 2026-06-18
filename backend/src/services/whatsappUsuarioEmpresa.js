import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { normalizeTelefoneUsuario } from "../modules/auth/telefoneUsuario.js";
import { isPlausibleAuthPhone, normalizeWhatsappPhone } from "./whatsappPhoneAuth.js";

/**
 * @param {string} a
 * @param {string} b
 */
export function telefonesUsuarioMatch(a, b) {
  const da = normalizeTelefoneUsuario(a);
  const db = normalizeTelefoneUsuario(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length > db.length && da.endsWith(db)) return true;
  if (db.length > da.length && db.endsWith(da)) return true;
  return false;
}

/**
 * Usuário cadastrado + workspace ativo (`id_empresa_ultima`) → contexto da empresa no WhatsApp.
 * @param {string} from
 * @returns {Promise<
 *   | { ok: true, phone: string, id_empresa: string, id_usuario: string, nome: string | null }
 *   | { ok: false, status: number, error: string, reason?: string, phone_detected?: string }
 * >}
 */
export async function resolveWhatsappUsuarioEmpresa(from) {
  const phone = normalizeWhatsappPhone(from);
  if (!phone || !isPlausibleAuthPhone(phone)) {
    return {
      ok: false,
      status: 403,
      error: "Não foi possível identificar seu telefone no WhatsApp. Tente enviar outra mensagem.",
      reason: "invalid_phone",
      phone_detected: phone || String(from || "").trim(),
    };
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return { ok: false, status: 503, error: "Supabase não configurado.", reason: "no_db" };
  }

  const { data: users, error: eUsers } = await db
    .from("usuario")
    .select("id_usuario, telefone, id_empresa_ultima, ativo, nome")
    .eq("ativo", true)
    .not("telefone", "is", null);

  if (eUsers) {
    return { ok: false, status: 500, error: eUsers.message, reason: "db_error" };
  }

  const usuario = (users || []).find((u) => telefonesUsuarioMatch(u.telefone, phone));
  if (!usuario) {
    return {
      ok: false,
      status: 403,
      error: "Telefone não cadastrado no TumaIA.",
      reason: "not_registered",
      phone_detected: phone,
    };
  }

  const { data: vinculos, error: eV } = await db
    .from("usuario_empresa")
    .select("id_empresa")
    .eq("id_usuario", usuario.id_usuario)
    .eq("ativo", true);

  if (eV) {
    return { ok: false, status: 500, error: eV.message, reason: "db_error" };
  }

  const empresaIds = [...new Set((vinculos || []).map((v) => String(v.id_empresa).trim()).filter(Boolean))];
  if (!empresaIds.length) {
    return {
      ok: false,
      status: 403,
      error: "Você ainda não faz parte de nenhuma empresa no TumaIA.",
      reason: "no_empresa",
      phone_detected: phone,
    };
  }

  let idEmpresa = usuario.id_empresa_ultima ? String(usuario.id_empresa_ultima).trim() : null;
  if (idEmpresa && !empresaIds.includes(idEmpresa)) {
    idEmpresa = null;
  }

  if (!idEmpresa && empresaIds.length === 1) {
    idEmpresa = empresaIds[0];
  }

  if (!idEmpresa) {
    return {
      ok: false,
      status: 403,
      error:
        "Abra o painel TumaIA e entre no workspace da empresa antes de usar o WhatsApp (isso define qual marca atender).",
      reason: "no_workspace",
      phone_detected: phone,
    };
  }

  return {
    ok: true,
    phone,
    id_empresa: idEmpresa,
    id_usuario: String(usuario.id_usuario),
    nome: typeof usuario.nome === "string" ? usuario.nome.trim() : null,
  };
}
