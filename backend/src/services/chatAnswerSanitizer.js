/**
 * Pós-processamento de respostas do LLM — anti-repetição, anti-meta, anti-lixo genérico.
 */

import { tryChatIdentityResponse } from "./chatIdentityResponse.js";
import { isCreatorQuestion } from "./chatUserQuestionPatterns.js";
import { isIdentityOrMetaQuestion } from "./chatOffTopic.js";
import { detectImageGenerationIntentFromHistory } from "./chatDeliveryUi.js";
import { applyLlmFailureMitigations } from "./chatLlmFailurePatterns.js";
import { tryChatOutOfScopeResponse, isDateTimeQuestion } from "./chatOutOfScopeResponse.js";

const RE_GREETING_LINE =
  /^(ol[aá]|oi+|e\s*a[ií]|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+bem)[!.?\s,—-]*/i;

const RE_SAUDACAO_BLOCO =
  /^(ol[aá]|oi+)[!.?\s]*\s*(como\s+posso\s+ajudar|estamos\s+aqui\s+para|sou\s+o\s+tuma)/i;

const RE_META =
  /\b(empresa\s+em\s+sess[aã]o|empresa\s+selecionada|interpretar\s+(?:a\s+)?empresa|processar\s+(?:o\s+)?contexto|assistente\s+virtual\s+que|sou\s+uma\s+ia\s+que|consultei\s+(?:o\s+)?(?:rag|banco|embeddings)|information_schema|vector\s+store)\b/gi;

const RE_GENERIC_MARKET =
  /\b(suplementos?\s+de\s+muscula[cç][aã]o|hidrata[cç][aã]o\s+e\s+recupera[cç][aã]o|linha\s+de\s+suplementos|mercado\s+de\s+suplementos|necessidades\s+relacionadas\s+ao\s+nosso\s+mercado)\b/gi;

const RE_POST_PITCH =
  /\b(planej(ar?|e)\s+(?:um\s+)?post(?:agem)?\s+(?:para\s+)?(?:o\s+)?instagram|quer\s+montar\s+(?:um\s+)?post|gerar\s+(?:a\s+)?pr[eé]via\s+(?:da\s+)?(?:arte|imagem)|posso\s+ajudar\s+(?:voc[eê]\s+)?a\s+(?:montar|criar)\s+(?:um\s+)?post)\b/gi;

const RE_ROBOTIC_PIVOT =
  /\b(entendi\s*[—,-]?\s*vou\s+mudar\s+o\s+foco|vou\s+mudar\s+o\s+foco)\b/gi;

/**
 * @param {string} text
 */
function normalizeCompare(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} a
 * @param {string} b
 */
function overlapRatio(a, b) {
  const wa = new Set(normalizeCompare(a).split(" ").filter((w) => w.length > 3));
  const wb = new Set(normalizeCompare(b).split(" ").filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter += 1;
  return inter / Math.max(wa.size, wb.size);
}

/**
 * @param {Array<{ role: string, content: string }>} history
 */
function lastAssistantText(history) {
  const h = Array.isArray(history) ? history : [];
  for (let i = h.length - 1; i >= 0; i -= 1) {
    if (h[i]?.role === "assistant") return String(h[i].content || "").trim();
  }
  return "";
}

/**
 * @param {string} text
 * @param {Array<{ role: string, content: string }>} history
 */
function stripRepeatedGreeting(text, history) {
  if (!history?.length) return text;
  let t = String(text || "").trim();
  for (let i = 0; i < 3; i += 1) {
    const m = t.match(RE_GREETING_LINE);
    if (!m || m[0].length < 3) break;
    t = t.slice(m[0].length).trim();
  }
  const block = RE_SAUDACAO_BLOCO.exec(t);
  if (block && block.index === 0) {
    const cut = t.indexOf(". ");
    if (cut > 0 && cut < 120) t = t.slice(cut + 2).trim();
  }
  return t || text;
}

/**
 * @param {string} text
 */
function dedupeParagraphs(text) {
  const parts = String(text || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const key = normalizeCompare(p);
    if (key.length < 20) {
      out.push(p);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.join("\n\n");
}

/**
 * @param {string} text
 * @param {string} question
 * @param {Array<{ role: string, content: string }>} history
 */
function stripUnwantedPostPitch(text, question, history) {
  if (detectImageGenerationIntentFromHistory(history, question)) return text;
  if (/\b(post|arte|instagram|banner|pr[eé]via|gera)\b/i.test(question)) return text;

  let t = String(text || "");
  const sentences = t.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => !RE_POST_PITCH.test(s));
  if (kept.length && kept.length < sentences.length) {
    t = kept.join(" ").trim();
  }
  return t;
}

/**
 * @param {string} answer
 * @param {string} question
 * @param {string | null} nomeFantasia
 * @param {Array<{ role: string, content: string }>} history
 */
function recoverFromNonsenseOrRepeat(answer, question, nomeFantasia, history) {
  if (isIdentityOrMetaQuestion(question)) {
    const id = tryChatIdentityResponse(question, nomeFantasia);
    if (id) return id;
  }

  const prev = lastAssistantText(history);
  if (!prev) return answer;

  const ratio = overlapRatio(answer, prev);
  if (ratio < 0.72) return answer;

  const qNorm = normalizeCompare(question);
  const prevNorm = normalizeCompare(prev);
  if (qNorm === prevNorm) return answer;

  if (RE_GENERIC_MARKET.test(answer)) {
    return "Pode reformular o que você precisa? Posso listar produtos do acervo, montar post ou falar da empresa.";
  }

  const first = answer.split(/(?<=[.!?])\s+/)[0] || answer;
  if (first.length > 20 && ratio < 0.88) return answer;

  return "Me diz com mais detalhe o que você precisa — produtos, post ou informações da empresa.";
}

/**
 * @param {{
 *   answer: string,
 *   question: string,
 *   history?: Array<{ role: string, content: string }>,
 *   nomeFantasia?: string | null,
 * }} opts
 */
export function sanitizeChatAnswer(opts) {
  const { answer, question, history = [], nomeFantasia = null } = opts;

  if (isDateTimeQuestion(question)) {
    const dataAns = tryChatOutOfScopeResponse(question, nomeFantasia);
    if (dataAns) return dataAns;
  }

  if (isCreatorQuestion(question)) {
    const criador = tryChatIdentityResponse(question, nomeFantasia);
    if (criador) return criador;
  }

  if (isIdentityOrMetaQuestion(question)) {
    const direct = tryChatIdentityResponse(question, nomeFantasia);
    if (direct) return direct;
  }

  let text = String(answer || "").trim();
  if (!text) return text;

  text = text.replace(RE_ROBOTIC_PIVOT, "").replace(/\s{2,}/g, " ").trim();

  text = stripRepeatedGreeting(text, history);

  if (isIdentityOrMetaQuestion(question)) {
    const genericTrap =
      RE_GENERIC_MARKET.test(text) ||
      /\bprodutos?\s+incluem\b/i.test(text) ||
      /\bnossos?\s+produtos?\b/i.test(text);
    if (genericTrap) {
      const id = tryChatIdentityResponse(question, nomeFantasia);
      if (id) return id;
    }
  }

  text = applyLlmFailureMitigations(text, { question, history });
  text = text.replace(RE_META, "").replace(/\s{2,}/g, " ").trim();
  text = dedupeParagraphs(text);
  text = stripUnwantedPostPitch(text, question, history);

  if (isIdentityOrMetaQuestion(question)) {
    const id = tryChatIdentityResponse(question, nomeFantasia);
    if (id) return id;
  }

  text = recoverFromNonsenseOrRepeat(text, question, nomeFantasia, history);
  return text.trim() || String(answer || "").trim();
}
