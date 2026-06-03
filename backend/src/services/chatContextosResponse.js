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
    return "Ainda não há contextos de campanha cadastrados — você pode adicionar em Contextos no painel (tom, FAQ, promoções).";
  }

  const names = list
    .map((r) => String(r?.nome ?? "").trim())
    .filter(Boolean)
    .slice(0, 12);

  const bullets = names.map((n) => `• ${n}`).join("\n");
  const extra = list.length > names.length ? `\n… e mais ${list.length - names.length}.` : "";
  return `Temos ${list.length} ${list.length === 1 ? "contexto" : "contextos"} ativos:\n\n${bullets}${extra}`;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function buildContextosPromptBlock(rows) {
  const list = (rows || []).filter((r) => !isIdentidadeMarcaContexto(r)).slice(0, 8);
  if (!list.length) return "";

  const lines = ["[CONTEXTOS DA MARCA — trechos para campanhas e tom]"];
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
