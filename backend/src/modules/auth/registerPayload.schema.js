import { z } from "zod";
import {
  isTelefoneUsuarioValido,
  telefoneUsuarioParaDb,
} from "./telefoneUsuario.js";

/**
 * Espaços no início/fim e variações Unicode comuns ao colar senha.
 * Cadastro e login usam a mesma regra — precisa bater com o que vai para o Supabase.
 */
export function normalizeSenhaInput(raw) {
  if (typeof raw !== "string") return raw;
  return raw.normalize("NFC").trim();
}

/** Mesmo formato que o Supabase costuma guardar (evita falha de login por maiúsculas). */
export const emailNorm = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.string().email().max(150).transform((s) => s.toLowerCase()),
);

export const senhaRegister = z.preprocess(
  (v) => normalizeSenhaInput(v),
  z.string().min(8).max(128),
);

const telefoneRegister = z.preprocess(
  (v) => (v == null ? "" : String(v).trim()),
  z
    .string()
    .min(1, "Telefone é obrigatório.")
    .max(20)
    .transform((s) => telefoneUsuarioParaDb(s))
    .refine((digits) => Boolean(digits && isTelefoneUsuarioValido(digits)), {
      message: "Telefone inválido (use DDD + número, mínimo 10 dígitos).",
    }),
);

export const registerBody = z.object({
  nome: z.string().min(1).max(150),
  email: emailNorm,
  senha: senhaRegister,
  telefone: telefoneRegister,
});

export const senhaLogin = z.preprocess(
  (v) => normalizeSenhaInput(v),
  z.string().min(1).max(128),
);

export const loginBody = z.object({
  email: emailNorm,
  senha: senhaLogin,
});

/** Atualização parcial do perfil (PATCH /auth/me). Pelo menos um campo. */
export const patchMeBody = z
  .object({
    nome: z.string().min(1).max(150).optional(),
    telefone: z
      .preprocess((v) => (v == null ? v : String(v).trim()), z.string().min(10).max(20))
      .optional(),
    email: emailNorm.optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, {
    message: "Envie ao menos um campo: nome, telefone ou email",
  })
  .refine((o) => o.telefone !== null, {
    message: "Telefone é obrigatório e não pode ser removido.",
    path: ["telefone"],
  })
  .refine((o) => o.telefone === undefined || isTelefoneUsuarioValido(o.telefone), {
    message: "Telefone inválido (use DDD + número, mínimo 10 dígitos).",
    path: ["telefone"],
  });
