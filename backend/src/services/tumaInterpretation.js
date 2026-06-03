/**
 * Interpretação de intenção do usuário — distingue pedido real de arte/post
 * de perguntas hipotéticas, dúvidas de capacidade ou menção casual da palavra "postagem".
 */

/** Menção a tema visual (não basta sozinha para abrir fluxo de imagem). */
const VISUAL_TOPIC =
  /instagram|insta\b|reels?\b|stories|feed\b|legenda|hashtag|#\w|arte\b|banner|flyer|card[aá]pio|campanha|divulga(c|ç)(a|ã)o|m[ií]dia\s*social|pr[eé][- ]?via|visual\b|design\b|ilustra(c|ç)[aã]o|foto(grafia)?\b|png\b|quadrado\b|1080|key\s*visual|capa\s+de|thumbnail|thumb\b|convite|dia\s+dos|black\s*friday|natal|p[aá]scoa/i;

/** Post/postagem só conta junto com verbo de criação (evita "pedido de uma postagem" hipotético). */
const POST_WITH_ACTION =
  /\b(post(agem|ar)?)\b.{0,24}\b(fazer|criar|montar|gerar|publicar)\b|\b(fazer|criar|montar|gerar|publicar)\b.{0,24}\b(post(agem|ar)?)\b/i;

const PEDIDO_META_NAO_ARTE = /\bfazer\s+um\s+pedido\b|\bpedido\s+de\s+(um|uma)\s+post(agem)?\b/i;

const EXPLICIT_CREATE_REQUEST =
  /\b(quero|preciso|vamos|bora)\s+(de\s+)?(fazer|criar|montar|gerar|publicar)\s+(um|uma|minha|meu)?\s*(arte|imagem|post(agem)?|banner|flyer|pr[eé]via|visual)\b|\b(quero|preciso)\s+(um|uma|minha|meu)\s+(arte|imagem|post(agem)?|banner|flyer|pr[eé]via|visual)\b|\b(gera|gerar|monta|montar|cria|criar|faz|faça|manda|mandar)\s+(um|uma|a|o|minha|meu|pra|para|meu|minha)?\s*(arte|imagem|post(agem)?|banner|flyer|pr[eé]via|visual)\b|\bfazer\s+(um|uma)\s+(arte|imagem|post(agem)?|banner|flyer)\b|\bme\s+ajuda\s+a\s+(fazer|criar|montar|gerar|publicar)\s+(um|uma)?\s*(arte|imagem|post(agem)?|banner)?\b|\bcri(e|ar)\s+(um|uma)\s+(arte|imagem|post(agem)?|visual)\b|\bmont(a|ar)\s+(um|uma|a)\s+(arte|imagem|post(agem)?|banner)\b|\bgera(r|ç)[aã]o\s+(de\s+)?(imagem|arte|visual)\b|\bgera(r)?\s+imagem\b|\bimagem\s+(para|de|com)\b/i;

const META_OR_HYPOTHETICAL_PATTERNS = [
  /\bse\s+eu\s+(fizer|pedir|quiser|for|puder|montar|criar|fazer|solicitar)\b/i,
  /\b(se|caso)\s+eu\b/i,
  /\b(dá|da)\s+pra\s+(fazer|pedir|montar|criar|gerar)\b/i,
  /\bposso\s+pedir\b/i,
  /\bcomo\s+(eu\s+)?(faço|faco|pedir|solicito|funciona)\b/i,
  /\bo\s+que\s+(preciso|é\s+necess[aá]rio|eu\s+preciso)\b/i,
  /\b(será|sera)\s+que\b/i,
  /\bteria\s+como\b/i,
  /\bgostaria\s+de\s+saber\b/i,
  /\bé\s+poss[ií]vel\b/i,
  /\bconsegue\s+me\s+ajudar\b/i,
  /\b(você|voce|vc)\s+me\s+ajuda\s*\?\s*$/i,
  /\bme\s+explica\b/i,
  /\bqual\s+(é|e)\s+o\s+processo\b/i,
  /\bcomo\s+funciona\s+(o\s+)?(pedido|processo)\b/i,
  /\bapenas\s+(uma\s+)?d[uú]vida\b/i,
  /\b(só|so)\s+queria\s+saber\b/i,
  /\bseria\s+(poss[ií]vel|vi[aá]vel)\b/i,
  /\bna\s+teoria\b/i,
  /\bno\s+futuro\b/i,
  /\bquando\s+eu\s+(quiser|precisar|for)\b/i,
  /\b(amanh[aã]|depois|mais\s+tarde|semana\s+que\s+vem)\b/i,
];

const CONVERSATIONAL_ONLY =
  /^(oi+|ol[aá]+|opa+|e\s*a[ií]+|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+bem|blz+|ok[!.,?\s]*$|teste+)\b|quem\s+(é|e)\s+(você|voce|vc|tu)\b|o\s+que\s+(é|e)\s+(você|voce|vc|tu|isso)\b|como\s+(você|voce|vc)\s+funciona|qual\s+(é|e)\s+seu\s+nome|qual\s+seu\s+nome|me\s+(fala|conta)\s+sobre\s+(você|voce|vc)|o\s+que\s+você\s+faz|o\s+que\s+voce\s+faz|quem\s+é\s+(o\s+)?(tuma|bot|assistente)|^(ajuda|help)\b/i;

const ASSISTANT_IMAGE_OFFER =
  /(posso|quer\s+que\s+eu|vamos)\s+(montar|gerar|criar|fazer).{0,40}(arte|imagem|post|pr[eé]via|visual)|gerar\s+(a\s+)?pr[eé]via|confirma(r)?\s+(a\s+)?(arte|imagem|post)|resumo\s+do\s+pedido\s+para\s+a\s+arte/i;

const SHORT_CONFIRM =
  /^(sim|ok|pode|gera|gerar|manda|faz|faça|confirmo|confirmar|bora|vai)\b/i;

/**
 * @param {string} text
 */
export function isConversationalMessage(text) {
  const q = String(text || "").trim();
  if (q.length < 6) return true;
  return CONVERSATIONAL_ONLY.test(q);
}

/**
 * Pergunta condicional / sobre ajuda / processo — não executar fluxo de arte.
 * @param {string} text
 */
export function isMetaOrHypotheticalQuestion(text) {
  const q = String(text || "").trim();
  if (!q) return false;

  if (META_OR_HYPOTHETICAL_PATTERNS.some((re) => re.test(q))) {
    if (EXPLICIT_CREATE_REQUEST.test(q) && /\b(quero|preciso|gera|monta|cria|faz|me\s+ajuda\s+a)\b/i.test(q)) {
      return false;
    }
    return true;
  }

  if (/\b(você|voce|vc)\s+(me\s+)?ajuda\s*\?/i.test(q) && !/\bme\s+ajuda\s+a\s+(fazer|criar|montar|gerar)\b/i.test(q)) {
    return true;
  }

  if (/\bpedido\s+de\s+(um|uma)\s+post(agem)?\b/i.test(q) && /\b(se\s+eu|se\s+eu|caso\s+eu|dá\s+pra|da\s+pra|posso)\b/i.test(q)) {
    return true;
  }

  return false;
}

/**
 * Pedido claro de criar arte/post/imagem agora.
 * @param {string} text
 */
export function hasExplicitCreateRequest(text) {
  const q = String(text || "").trim();
  if (!q) return false;
  if (PEDIDO_META_NAO_ARTE.test(q)) return false;
  if (EXPLICIT_CREATE_REQUEST.test(q)) return true;
  if (POST_WITH_ACTION.test(q) && /\b(quero|preciso|agora|hoje|bora|vamos)\b/i.test(q)) return true;
  return false;
}

/**
 * Tema visual citado (Instagram, arte, banner…) sem ser pedido por si só.
 * @param {string} text
 */
export function mentionsVisualTopic(text) {
  const q = String(text || "").trim();
  if (!q) return false;
  return VISUAL_TOPIC.test(q) || POST_WITH_ACTION.test(q);
}

/**
 * Intenção de abrir fluxo de geração de imagem / resumo de arte.
 * @param {string} text
 */
export function detectImageGenerationIntent(text) {
  const q = String(text || "").trim();
  if (q.length < 6) return false;
  if (isConversationalMessage(q)) return false;
  if (isMetaOrHypotheticalQuestion(q)) return false;
  if (hasExplicitCreateRequest(q)) return true;
  if (mentionsVisualTopic(q) && /\b(quero|preciso|vamos|bora|agora|hoje|esse|esta|monta|gera|cria|faz)\b/i.test(q)) {
    return true;
  }
  return false;
}

/**
 * @param {Array<{ role: string, content: string }>} history
 * @param {string} [latestUserText]
 */
export function detectImageGenerationIntentFromHistory(history, latestUserText) {
  if (detectImageGenerationIntent(latestUserText)) return true;

  const h = Array.isArray(history) ? history : [];
  const lastAssistant = [...h].reverse().find((m) => m.role === "assistant");
  const confirmTexts = [];
  if (typeof latestUserText === "string" && latestUserText.trim()) confirmTexts.push(latestUserText.trim());
  const lastUser = [...h].reverse().find((m) => m.role === "user");
  if (lastUser && typeof lastUser.content === "string") confirmTexts.push(lastUser.content.trim());

  if (
    lastAssistant &&
    typeof lastAssistant.content === "string" &&
    ASSISTANT_IMAGE_OFFER.test(lastAssistant.content) &&
    confirmTexts.some((t) => SHORT_CONFIRM.test(t) && !isConversationalMessage(t) && !isMetaOrHypotheticalQuestion(t))
  ) {
    return true;
  }

  return false;
}

export { ASSISTANT_IMAGE_OFFER, SHORT_CONFIRM };
