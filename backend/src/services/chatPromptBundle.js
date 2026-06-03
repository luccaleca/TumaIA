/**
 * Monta bloco único de treino dinâmico para o worker Python.
 */

import { buildAcervoPromptBlock } from "./chatProductGuard.js";
import { buildEmpresaPromptBlock } from "./chatEmpresaResponse.js";
import { buildContextosPromptBlock } from "./chatContextosResponse.js";

/**
 * @param {{
 *   empresa?: Record<string, unknown> | null,
 *   contextos?: Array<Record<string, unknown>>,
 *   acervoLabels?: string[],
 *   nomeFantasia?: string | null,
 * }} facts
 */
export function buildChatTrainingPromptBlock(facts = {}) {
  const parts = [];
  const empresaBlock = buildEmpresaPromptBlock(facts.empresa ?? null);
  if (empresaBlock) parts.push(empresaBlock);

  const ctxBlock = buildContextosPromptBlock(facts.contextos ?? []);
  if (ctxBlock) parts.push(ctxBlock);

  const labels = Array.isArray(facts.acervoLabels) ? facts.acervoLabels : [];
  const acervoBlock = buildAcervoPromptBlock(labels, facts.nomeFantasia ?? null);
  if (acervoBlock) parts.push(acervoBlock);

  const checklist =
    "[CHECKLIST ANTI-ERRO LLM — antes de responder]\n" +
    "1) Só produtos do ACERVO abaixo. 2) Não meta (RAG/sessão/regras). 3) Escopo da pergunta.\n" +
    "4) Sem menu 1-2-3. 5) Sem dicas genéricas de marketing. 6) 2-4 frases salvo lista pedida.";

  return [checklist, ...parts.filter(Boolean)].join("\n\n");
}
