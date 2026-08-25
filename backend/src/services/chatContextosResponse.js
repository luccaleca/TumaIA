/**
 * Respostas sobre contextos RAG da empresa.
 */

import { loadContextosEmpresaAtivos } from "./imagePreviewPrompt.js";
import { isIdentidadeMarcaContexto } from "../modules/empresas/identidadeMarca.js";

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function formatContextosListAnswer(rows) {
  const list = (rows || []).filter((r) => !isIdentidadeMarcaContexto(r));
  if (!list.length) {
    return "Modelos de post foram descontinuados. Descreva o pedido no chat — uso identidade da marca, mídias do acervo e o briefing visual.";
  }

  const names = list
    .map((r) => String(r?.nome ?? "").trim())
    .filter(Boolean)
    .slice(0, 12);

  const bullets = names.map((n) => `• ${n}`).join("\n");
  const extra = list.length > names.length ? `\n\n… e mais ${list.length - names.length}.` : "";
  return (
    `Temos ${list.length} ${list.length === 1 ? "modelo" : "modelos"} de post ativo${list.length === 1 ? "" : "s"}:\n\n${bullets}${extra}` +
    "\n\nUse no chat qual tipo combina com o pedido (ex.: promoção, lançamento, produto) — eu monto a arte com o layout desse modelo."
  );
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function buildContextosPromptBlock(rows) {
  const list = (rows || []).filter((r) => !isIdentidadeMarcaContexto(r)).slice(0, 8);
  if (!list.length) return "";

  const lines = ["[MODELOS DE POST ATIVOS — layout visual para a arte]"];
  for (const r of list) {
    const nome = String(r?.nome ?? "").trim();
    const desc = String(r?.descricao ?? "").trim();
    if (!nome) continue;
    lines.push(`- ${nome}${desc ? `: ${desc.slice(0, 200)}` : ""}`);
  }
  return lines.join("\n");
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 */
export async function loadContextosChatFacts(db, idEmpresa) {
  return loadContextosEmpresaAtivos(db, idEmpresa);
}
