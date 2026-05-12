import { normalizeEmailClient } from "./auth.js";

/**
 * Iniciais para avatar/resumo na página Conta (mesma regra da UI).
 */
export function contaIniciais(nome, email) {
  const n = typeof nome === "string" ? nome.trim() : "";
  if (n.length >= 2) return n.slice(0, 2).toUpperCase();
  if (n.length === 1) return n.toUpperCase();
  const e = typeof email === "string" ? email.trim() : "";
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return "?";
}

/**
 * Rótulo legível para `usuario.data_criacao` (ISO), ou null se inválido.
 */
export function formatarDataContaPtBr(iso) {
  if (typeof iso !== "string" || !iso.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

/**
 * Valida o formulário da página Conta antes do PATCH /auth/me.
 * @param {{ nome: string, email: string, telefone: string, clearTelefone: boolean }} input
 */
export function validarContaForm(input) {
  const nome = typeof input.nome === "string" ? input.nome.trim() : "";
  const email = normalizeEmailClient(input.email);
  const telefone = typeof input.telefone === "string" ? input.telefone.trim() : "";
  if (!nome || !email) {
    return { ok: false, message: "Nome e e-mail são obrigatórios." };
  }
  if (telefone.length > 20) {
    return { ok: false, message: "Telefone pode ter no máximo 20 caracteres." };
  }
  return { ok: true, nome, email, telefone };
}

/**
 * Corpo JSON para PATCH /auth/me a partir do estado do formulário.
 */
export function montarBodyPatchConta(input) {
  const v = validarContaForm(input);
  if (!v.ok) return v;
  const { nome, email, telefone } = v;
  const { clearTelefone } = input;
  return {
    ok: true,
    body: {
      nome,
      email,
      telefone: clearTelefone ? null : telefone || null,
    },
  };
}
