import { z } from "zod";

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

export const registerBody = z.object({
  nome: z.string().min(1).max(150),
  email: emailNorm,
  senha: senhaRegister,
  telefone: z.string().max(20).optional().nullable(),
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
    telefone: z.union([z.string().max(20), z.null()]).optional(),
    email: emailNorm.optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, {
    message: "Envie ao menos um campo: nome, telefone ou email",
  });
