/**
 * Detecta pedido de arte / imagem / post visual no texto (usuário ou assistente).
 */
const IMAGE_INTENT_HINT =
  /post(agem|ar|s)?|instagram|insta\b|reels?\b|stories|feed\b|legenda|hashtag|#\w|arte\b|banner|flyer|card[aá]pio|campanha|divulga(c|ç)(a|ã)o|m[ií]dia\s*social|pr[eé][- ]?via|visual\b|design\b|ilustra(c|ç)[aã]o|foto(grafia)?\b|png\b|quadrado\b|1080|stories|cri(e|ar)\s+(uma?\s+)?(arte|imagem|post|visual)|mont(a|ar)\s+(a\s+)?(arte|imagem|post)|montar|gerar\s+(a\s+)?(imagem|arte|pr[eé]via|visual)|gera(r|ç)[aã]o\s+(de\s+)?(imagem|arte|visual)|gera(r)?\s+imagem|imagem\s+(para|de|com)|fazer\s+(um\s+)?post|convite|dia\s+dos|black\s*friday|natal|p[aá]scoa|seguidores?|500\s*k|\bmarco\b|alcance|whey|suplement|plano\s+pro|propaganda|key\s*visual|capa\s+de|thumbnail|thumb\b/i;

const SHORT_CONFIRM =
  /^(sim|ok|pode|gera|gerar|manda|faz|faça|confirmo|confirmar|bora|vai)\b/i;

/**
 * @param {string} text
 */
export function detectImageGenerationIntent(text) {
  const q = String(text || "").trim();
  if (q.length < 6) return false;
  return IMAGE_INTENT_HINT.test(q);
}

/**
 * @param {Array<{ role: string, content: string }>} history
 * @param {string} [latestUserText]
 */
export function detectImageGenerationIntentFromHistory(history, latestUserText) {
  if (detectImageGenerationIntent(latestUserText)) return true;

  const h = Array.isArray(history) ? history : [];
  for (let i = h.length - 1; i >= 0 && i >= h.length - 8; i--) {
    const m = h[i];
    if (!m || typeof m.content !== "string") continue;
    if (m.role === "user" && detectImageGenerationIntent(m.content)) return true;
  }

  const lastAssistant = [...h].reverse().find((m) => m.role === "assistant");
  const confirmTexts = [];
  if (typeof latestUserText === "string" && latestUserText.trim()) confirmTexts.push(latestUserText.trim());
  const lastUser = [...h].reverse().find((m) => m.role === "user");
  if (lastUser && typeof lastUser.content === "string") confirmTexts.push(lastUser.content.trim());

  if (
    lastAssistant &&
    detectImageGenerationIntent(lastAssistant.content) &&
    confirmTexts.some((t) => SHORT_CONFIRM.test(t))
  ) {
    return true;
  }

  return false;
}
