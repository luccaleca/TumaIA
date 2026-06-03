/**
 * Quando não aplicar acervo/guarda de produto no LLM.
 */

import { isIdentityRelatedQuestion } from "./chatUserQuestionPatterns.js";
import { isIdentityFamilyQuestion, NEGOCIO_TUMA_BLOCK_RE } from "./chatIdentityClassifier.js";

const IDENTITY_RE =
  /\b(qual\s+seu\s+nome|seu\s+nome|como\s+(?:você|voce|vc)\s+se\s+chama|quem\s+(?:é|e)\s+(?:você|voce|vc|tu|a\s+gente\s+que\s+fala)|(?:você|voce|vc)\s+(?:é|e)\s+quem|quem\s+te\s+criou|criador|significa\s+tuma|significado\s+do\s+nome|(?:fala|fale)\s+(?:sobre|de)\s+(?:você|voce|vc)|(?:se\s+)?apresent[ae]|me\s+fala\s+(?:sobre|de)\s+(?:você|voce|vc)|quem\s+(?:t[aá]|est[aá])\s+falando|(?:você|voce|vc)\s+consegue\s+(?:me\s+)?ajudar|consegue\s+ajudar)\b/i;

const SAUDACAO_RE =
  /^\s*(oi+|ol[aá]|e\s*a[ií]|fala|opa|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+bem)\s*[!.?]*\s*$/i;

const AGRADECIMENTO_RE =
  /^\s*(obrigad[oa]|valeu|show|perfeito|fechou|blz|beleza|tchau|até\s+mais|falou)\s*[!.?]*\s*$/i;

const CORRECAO_RE =
  /\b(n[aã]o\s+era\s+isso|entendeu\s+errado|voc[eê]\s+errou|para\s+de\s+repetir|j[aá]\s+falei|n[aã]o\s+perguntei|s[oó]\s+queria)\b/i;

const COMO_FUNCIONA_RE =
  /\b(o\s+que\s+(?:é|e)\s+o\s+tuma|o\s+que\s+(?:é|e)\s+(?:essa|esta)\s+ia)\b/i;

/**
 * @param {string} question
 */
export function isIdentityOrMetaQuestion(question) {
  const q = String(question || "").trim();
  if (!q) return false;
  if (NEGOCIO_TUMA_BLOCK_RE.test(q)) return false;
  if (isIdentityFamilyQuestion(q)) return true;
  if (SAUDACAO_RE.test(q) || AGRADECIMENTO_RE.test(q) || CORRECAO_RE.test(q)) return true;
  return IDENTITY_RE.test(q) || COMO_FUNCIONA_RE.test(q) || isIdentityRelatedQuestion(q);
}

/**
 * @param {string} question
 */
export function shouldSkipProductGuard(question) {
  return isIdentityOrMetaQuestion(question);
}

/**
 * @param {string} question
 */
export function shouldSkipAcervoBlock(question) {
  return isIdentityOrMetaQuestion(question);
}
