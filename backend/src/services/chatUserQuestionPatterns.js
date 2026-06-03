/**
 * Padrões de pergunta do usuário (PT-BR informal) — compartilhado entre roteamento e identidade.
 */

/** Para que / pra que / pro que serve (informal). */
export const PARA_QUE_SERVE_RE =
  /\b(?:para|pra|pro)\s+(?:que|q|oq)\s+(?:o\s+)?(?:vc|voc[eê])\s+serve\b|\b(?:para|pra|pro)\s+(?:que|q|oq)\s+serve\b|\bserve\s+(?:pra|para)\s+(?:que|q|oq)\b|\b(?:vc|voc[eê])\s+serve\s+pra\s+que\b/i;

/** O que faz / utilidade (sem ser só «como funciona» técnico). */
export const O_QUE_FAZ_RE =
  /\b(?:o\s+)?que\s+(?:é\s+que\s+)?(?:vc|voc[eê])\s+faz\b|\b(?:pra|para)\s+que\s+(?:vc|voc[eê])\s+(?:pode\s+)?(?:ser\s+)?(?:usad[oa]|util)\b|\bqual\s+(?:é\s+)?(?:a\s+)?(?:sua\s+)?fun[cç][aã]o\b/i;

export const COMO_FUNCIONA_RE =
  /\bcomo\s+(?:vc|voc[eê])\s+funciona\b|\bcomo\s+funciona\s+(?:o\s+)?(?:chat|tuma|painel|isso)\b|\bcomo\s+funciona\b/i;

/** Quem criou o Tuma — deve citar Diego Suhai Navarro. */
export const CRIADOR_RE =
  /\b(por\s+quem\s+(?:voc[eê]|voce|vc|te)\s+(?:foi\s+)?criad|quem\s+te\s+criou|quem\s+(?:é|e)\s+(?:seu|o)\s+criador|quem\s+foi\s+(?:que\s+)?(?:te\s+)?criou|quem\s+te\s+fez|quem\s+desenvolveu|(?:voc[eê]|voce|vc)\s+foi\s+criad|(?:foi|foram)\s+criad[oa]s?\s+por|criador\b)/i;

export const IDENTIDADE_CORE_RE =
  /\b(?:qual\s+seu\s+nome|seu\s+nome|como\s+(?:vc|voc[eê])\s+se\s+chama|quem\s+(?:é|e)\s+(?:vc|voc[eê]|tu)|(?:vc|voc[eê])\s+(?:é|e)\s+quem|(?:o\s+)?que\s+(?:é|e)\s+(?:vc|voc[eê])\b|significa\s+tuma|significado\s+do\s+nome|(?:fala|fale)\s+(?:sobre|de)\s+(?:vc|voc[eê])|(?:se\s+)?apresent[ae]|me\s+fala\s+(?:sobre|de)\s+(?:vc|voc[eê])|quem\s+(?:t[aá]|est[aá])\s+falando)\b/i;

/**
 * @param {string} question
 */
export function isCreatorQuestion(question) {
  return CRIADOR_RE.test(String(question || "").trim());
}

/**
 * Pergunta sobre papel/utilidade do Tuma (não cumprimento nem lista de produtos).
 * @param {string} question
 */
export function isTumaRoleOrUtilityQuestion(question) {
  const q = String(question || "").trim();
  if (!q) return false;
  return PARA_QUE_SERVE_RE.test(q) || O_QUE_FAZ_RE.test(q) || COMO_FUNCIONA_RE.test(q);
}

/**
 * @param {string} question
 */
export function isIdentityRelatedQuestion(question) {
  const q = String(question || "").trim();
  if (!q) return false;
  return IDENTIDADE_CORE_RE.test(q) || isCreatorQuestion(q) || isTumaRoleOrUtilityQuestion(q);
}
