/**
 * Schema da interpretação de criação (saída do LLM).
 * O LLM só propõe; o código valida e aplica no estado.
 */
import { z } from "zod";

export const CreationOperationTypeSchema = z.enum([
  "set",
  "patch",
  "replace_product",
  "clarify_product",
]);

/** Aceita null/string solta do modelo local e normaliza para array. */
const stringList = z.preprocess((v) => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}, z.array(z.string()).default([]));

const nullableStr = z.preprocess((v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}, z.string().nullable().optional().default(null));

export const CreationLlmEntitiesSchema = z.object({
  produto: nullableStr,
  /** Referência vaga/descritiva sem nome resolvido (ex.: "latinha azul"). */
  produto_referencia: nullableStr,
  /** Sabor/variante do produto (não é estilo de arte). */
  sabor: nullableStr,
  /** Outros atributos de produto (cor, gramatura, etc.). */
  atributos: stringList,
  cenario: nullableStr,
  tema: nullableStr,
  oferta: nullableStr,
  estilo: stringList,
  destaque: nullableStr,
  formato: nullableStr,
  intencao: nullableStr,
});

export const CreationLlmSuggestedOpSchema = z.object({
  type: CreationOperationTypeSchema.default("set"),
  /** Campos que o usuário pediu para alterar (sugestão — o código decide). */
  fields: stringList,
  /** Nota de interpretação (não é decisão de sistema). */
  interpretation_note: nullableStr,
});

export const CreationLlmInterpretSchema = z.object({
  entities: CreationLlmEntitiesSchema.default({}),
  suggested_operation: CreationLlmSuggestedOpSchema.default({ type: "set" }),
  needs_product_clarification: z.boolean().optional().default(false),
  ambiguities: stringList,
});

/** @typedef {z.infer<typeof CreationLlmInterpretSchema>} CreationLlmInterpret */

/**
 * @param {unknown} raw
 * @returns {{ ok: true, data: CreationLlmInterpret } | { ok: false, error: string, raw: unknown }}
 */
export function parseCreationLlmInterpret(raw) {
  const parsed = CreationLlmInterpretSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      raw,
    };
  }
  return { ok: true, data: parsed.data };
}
