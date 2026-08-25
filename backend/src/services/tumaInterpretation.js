/**
 * Interpretação de intenção — porteiro do fluxo de post.
 * Distingue pedido real de arte/post de conversa, dúvida de capacidade ou menção casual.
 * A LLM não classifica o ramo: estas regras rodam antes.
 */

function normalizeIntentText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Menção a tema visual (não basta sozinha para abrir fluxo). */
const VISUAL_TOPIC =
  /instagram|insta\b|reels?\b|stories|feed\b|legenda|hashtag|#\w|arte\b|banner|flyer|card[aá]pio|campanha|divulga(c|ç)(a|ã)o|m[ií]dia\s*social|pr[eé][- ]?via|visual\b|design\b|ilustra(c|ç)[aã]o|foto(grafia)?\b|png\b|quadrado\b|1080|key\s*visual|capa\s+de|thumbnail|thumb\b|convite|dia\s+dos|black\s*friday|natal|p[aá]scoa/i;

/** Post/postagem só conta junto com verbo de criação. */
const POST_WITH_ACTION =
  /\b(post(agem|ar)?)\b.{0,24}\b(fazer|criar|montar|gerar|publicar)\b|\b(fazer|criar|montar|gerar|publicar)\b.{0,24}\b(post(agem|ar)?)\b/i;

/** “Fazer um pedido” / “pedido de uma postagem” como fala de processo — não é arte agora. */
const PEDIDO_META_NAO_ARTE = /\bfazer\s+um\s+pedido\b|\bpedido\s+de\s+(um|uma)\s+post(agem)?\b/i;

const HAS_PRODUCT_OR_SCENE =
  /\b(whey|creatina|protein|produto|academia|pessoa|usando|embalagem|png|cookie|wafer|promo[cç][aã]o|desconto|pre[cç]o)\b/i;

/** Pedido com modelo de post + produto/cena. */
const POST_MODEL_CREATE_REQUEST =
  /\b(post(agem|ar)?|arte|imagem)\b.{0,48}\bmodelo\s+de\s+(produto|promo[cç][aã]o|lan[cç]amento|mensagens?)\b|\bmodelo\s+de\s+(produto|promo[cç][aã]o|lan[cç]amento|mensagens?)\b.{0,48}\b(com|do|da|usando|whey|creatina|produto)\b|\bgostaria\s+de\s+(uma\s+)?post(agem|ar)?\b/i;

/** Pedido claro de criar arte/post agora (não “pode fazer um post?”). */
const EXPLICIT_CREATE_REQUEST =
  /\b(quero|preciso|vamos|bora|gostaria\s+de)\s+(de\s+)?(fazer|criar|montar|gerar|publicar|uma?)?\s*(arte|imagem|post(agem)?|banner|flyer|pr[eé]via|visual)\b|\b(quero|preciso)\s+(um|uma|minha|meu)\s+(arte|imagem|post(agem)?|banner|flyer|pr[eé]via|visual)\b|\b(gere|gera|gerar|monta|montar|cria|criar|crie|faz|faça|manda|mandar)\s+(um|uma|a|o|minha|meu|pra|para)?\s*(arte|imagem|post(agem)?|banner|flyer|pr[eé]via|visual)\b|\bfazer\s+(um|uma)\s+(arte|imagem|post(agem)?|banner|flyer)\b|\bme\s+ajuda\s+a\s+(fazer|criar|montar|gerar|publicar)\s+(um|uma)?\s*(arte|imagem|post(agem)?|banner)?\b|\bcri(e|ar)\s+(um|uma)\s+(arte|imagem|post(agem)?|visual)\b|\bmont(a|ar)\s+(um|uma|a)\s+(arte|imagem|post(agem)?|banner)\b|\bgera(r|ç)[aã]o\s+(de\s+)?(imagem|arte|visual)\b|\bgera(r)?\s+imagem\b|\bpode\s+fazer\b.{0,40}\b(pessoa|academia|usando|whey|creatina|produto)\b/i;

const INTENT_NOW =
  /\b(quero|preciso|vamos|bora|gere|gera|gerar|monta|montar|cria|criar|faz|faça|manda|gostaria\s+de)\b/i;

/**
 * Citação / pergunta de processo: o comando aparece no texto, mas o ato de fala não é pedir arte agora.
 * Generaliza o erro (não lista exemplos): atribuição a terceiros, mídia, aspas, “como/por que funciona”.
 */
const REPORTING_ACTOR =
  /\b(o\s+usu[aá]rio|algu[eé]m|a\s+pessoa|o\s+cliente|ele|ela|fulano|o\s+cara|a\s+mo[cç]a|o\s+professor|no\s+v[ií]deo|no\s+tutorial)\b/i;
const REPORTING_VERB = /\b(pediu|pediram|falou|falaram|disse|disseram|mandou|mandaram|escreveu|citou|mostrou)\b/i;
const MEDIA_OR_EXAMPLE =
  /\b(v[ií]deo|tutorial|aula|reels?|tiktok|podcast|exemplo|artigo|tweet|print)\b/i;
const SAW_MEDIA = /\b(vi|assisti|ouvi|li|apareceu|mostraram)\b/i;
const PROCESS_QUESTION =
  /\b(como|por\s+qu[eê]|porque)\b.{0,48}\b(faz|gera|funciona|cria|ia|tuma|sistema|modelo|pipeline)\b|\b(explica|me\s+explica|quero\s+entender|qual\s+o\s+processo)\b/i;

const META_OR_HYPOTHETICAL_PATTERNS = [
  /\bse\s+eu\s+(fizer|pedir|quiser|for|puder|montar|criar|solicitar)\b/i,
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
];

/** Capacidade / “vocês fazem isso?” — continua conversa, não abre briefing. */
const CAPABILITY_OR_PROCESS_QUESTION = [
  /\b(voc[eê]|voce|vc|tuma)\s+(faz|fazem|cria|criam|gera|geram|monta|consegue)\s+(posts?|artes?|imagens?|banner)/i,
  /\bpode\s+(fazer|criar|gerar|montar)\s+(um|uma)\s+(post(agem)?|arte|imagem|banner)\s*\??$/i,
  /\b(voc[eê]|voce|vc)\s+(me\s+)?ajuda\s+com\s+(marketing|instagram|redes|posts?)\s*\??$/i,
  /\bpreciso\s+de\s+ajuda\s+com\b/i,
];

const CONVERSATIONAL_ONLY =
  /^(oi+|ol[aá]+|opa+|e\s*a[ií]+|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+bem|blz+|ok[!.,?\s]*$|teste+)\b|quem\s+(é|e)\s+(você|voce|vc|tu)\b|o\s+que\s+(é|e)\s+(você|voce|vc|tu|isso)\b|como\s+(você|voce|vc)\s+funciona|qual\s+(é|e)\s+seu\s+nome|qual\s+seu\s+nome|me\s+(fala|conta)\s+sobre\s+(você|voce|vc)|o\s+que\s+você\s+faz|o\s+que\s+voce\s+faz|quem\s+é\s+(o\s+)?(tuma|bot|assistente)|^(ajuda|help)\b/i;

const ASSISTANT_IMAGE_OFFER =
  /(posso|quer\s+que\s+eu|vamos)\s+(montar|gerar|criar|fazer).{0,40}(arte|imagem|post|pr[eé]via|visual)|gerar\s+(a\s+)?pr[eé]via|confirma(r)?\s+(a\s+)?(arte|imagem|post)|resumo\s+do\s+pedido\s+para\s+a\s+arte|monta\s+a\s+arte\s+com|modelos?\s+de\s+post\s+ativos?|layout\s+desse\s+modelo|qual\s+tipo\s+combina/i;

const ASSISTANT_POST_BRIEFING =
  /confira se entendi certo|modelo de post|resumo do pedido|gerar imagem para criar/i;

const ASSISTANT_POST_MODEL_LIST =
  /modelos?\s+de\s+post|monta\s+a\s+arte\s+com|layout\s+desse\s+modelo|qual\s+tipo\s+combina/i;

const POST_BRIEFING_CORRECTION =
  /^(n[aã]o\s+(est[aá]|t[aá])\s+corret|errado|n[aã]o\s+[eé]\s+isso|n[aã]o\s+era\s+isso|ta\s+errado|est[aá]\s+errado)/i;

const SHORT_CONFIRM =
  /^(sim|ok|pode|gera|gerar|manda|faz|faça|confirmo|confirmar|bora|vai)\b/i;

/**
 * @param {string} text
 */
export function isConversationalMessage(text) {
  const q = normalizeIntentText(text);
  if (q.length < 6) return true;
  return CONVERSATIONAL_ONLY.test(q);
}

/**
 * Dúvida de capacidade / processo / hipótese — não executar fluxo de arte.
 * @param {string} text
 */
export function isMetaOrHypotheticalQuestion(text) {
  const q = normalizeIntentText(text);
  if (!q) return false;

  const explicitNow = hasExplicitCreateRequest(q) && INTENT_NOW.test(q);

  if (isNonExecutorySpeechAct(q)) return true;

  if (CAPABILITY_OR_PROCESS_QUESTION.some((re) => re.test(q))) {
    if (explicitNow && HAS_PRODUCT_OR_SCENE.test(q)) return false;
    return true;
  }

  if (META_OR_HYPOTHETICAL_PATTERNS.some((re) => re.test(q))) {
    if (explicitNow) return false;
    return true;
  }

  if (/\b(você|voce|vc)\s+(me\s+)?ajuda\s*\?/i.test(q) && !/\bme\s+ajuda\s+a\s+(fazer|criar|montar|gerar)\b/i.test(q)) {
    return true;
  }

  if (PEDIDO_META_NAO_ARTE.test(q) && /\b(se\s+eu|caso\s+eu|dá\s+pra|da\s+pra|posso)\b/i.test(q)) {
    return true;
  }

  return false;
}

/**
 * O usuário não está executando o comando: cita, pergunta o processo ou fala de terceiros.
 * Preferimos deixar de abrir o fluxo (depois confirma) a gerar arte por palavra solta.
 * @param {string} text
 */
export function isNonExecutorySpeechAct(text) {
  const q = normalizeIntentText(text);
  if (!q) return false;

  const ownRequestUpFront = /^(quero|preciso|vamos|bora|gere|gera|gerar|monta|cria|crie|faz|faça|me\s+ajuda\s+a)\b/i.test(
    q,
  );
  const quoted = /["“”«»'].{6,}["“”«»']/.test(q);
  const reported = REPORTING_ACTOR.test(q) && REPORTING_VERB.test(q);
  const fromMedia = SAW_MEDIA.test(q) && MEDIA_OR_EXAMPLE.test(q);
  const askingHow = PROCESS_QUESTION.test(q);

  if (reported) return true;
  if (fromMedia && !ownRequestUpFront) return true;
  if (quoted && askingHow && !ownRequestUpFront) return true;
  if (askingHow && !ownRequestUpFront) return true;
  if (q.length > 90 && /\?/.test(q) && askingHow && !ownRequestUpFront) return true;
  return false;
}

/** @deprecated use isNonExecutorySpeechAct */
export function isReportedSpeechOrHowQuestion(text) {
  return isNonExecutorySpeechAct(text);
}

/**
 * Pedido claro de criar arte/post/imagem agora.
 * @param {string} text
 */
export function hasExplicitCreateRequest(text) {
  const q = normalizeIntentText(text);
  if (!q) return false;
  if (isNonExecutorySpeechAct(q)) return false;
  if (PEDIDO_META_NAO_ARTE.test(q) && !HAS_PRODUCT_OR_SCENE.test(q)) return false;
  if (POST_MODEL_CREATE_REQUEST.test(q)) return true;
  if (EXPLICIT_CREATE_REQUEST.test(q)) return true;
  if (POST_WITH_ACTION.test(q) && /\b(quero|preciso|agora|hoje|bora|vamos|gostaria)\b/i.test(q)) return true;
  return false;
}

/**
 * Resposta após o assistente listar modelos de post — pedido com produto ou cena.
 * @param {Array<{ role: string, content: string }>} history
 * @param {string} text
 */
export function isPostModelBriefingFollowUp(history, text) {
  const q = normalizeIntentText(text);
  if (!q || q.length < 12) return false;
  if (isPostDeliveryTypedCommand(q) || isImageRevisionRequest(q)) return false;
  if (isConversationalMessage(q) || isMetaOrHypotheticalQuestion(q)) return false;

  const h = Array.isArray(history) ? history : [];
  const lastAssistant = [...h].reverse().find((m) => m.role === "assistant");
  if (
    !lastAssistant ||
    typeof lastAssistant.content !== "string" ||
    !ASSISTANT_POST_MODEL_LIST.test(lastAssistant.content)
  ) {
    return false;
  }

  return (
    POST_MODEL_CREATE_REQUEST.test(q) ||
    /\bmodelo\s+de\s+(produto|promo[cç][aã]o|lan[cç]amento)\b/i.test(q) ||
    HAS_PRODUCT_OR_SCENE.test(q)
  );
}

/**
 * Cliente corrigiu o resumo de confirmação — remontar briefing sem LLM.
 * @param {Array<{ role: string, content: string }>} history
 * @param {string} text
 */
export function isPostBriefingCorrectionFollowUp(history, text) {
  const q = normalizeIntentText(text);
  if (!POST_BRIEFING_CORRECTION.test(q)) return false;
  const h = Array.isArray(history) ? history : [];
  const lastAssistant = [...h].reverse().find((m) => m.role === "assistant");
  return Boolean(
    lastAssistant &&
      typeof lastAssistant.content === "string" &&
      ASSISTANT_POST_BRIEFING.test(lastAssistant.content),
  );
}

/**
 * Tema visual citado (Instagram, arte, banner…) sem ser pedido por si só.
 * @param {string} text
 */
export function mentionsVisualTopic(text) {
  const q = normalizeIntentText(text);
  if (!q) return false;
  return VISUAL_TOPIC.test(q) || POST_WITH_ACTION.test(q);
}

const IMAGE_REVISION_REQUEST =
  /^quero\s+alterar\s+a\s+imagem\s*:\s*.+/is;

const POST_DELIVERY_TYPED_COMMAND =
  /^(gerar\s+legenda|publicar\s+no\s+instagram|(?:alterar|mudar)\s+legenda|alterar\s+imagem|quero\s+alterar\s+a\s+legenda\s*:.+)\s*[!.?]*$/i;

/**
 * @param {string} text
 */
export function isImageRevisionRequest(text) {
  return IMAGE_REVISION_REQUEST.test(normalizeIntentText(text));
}

/**
 * @param {string} text
 */
export function isPostDeliveryTypedCommand(text) {
  const q = normalizeIntentText(text);
  if (!q) return false;
  return isImageRevisionRequest(q) || POST_DELIVERY_TYPED_COMMAND.test(q);
}

/**
 * Abrir fluxo de briefing / arte. Só pedido explícito — não “falou de Instagram”.
 * @param {string} text
 */
export function detectImageGenerationIntent(text) {
  const q = normalizeIntentText(text);
  if (isPostDeliveryTypedCommand(q)) return false;
  if (isImageRevisionRequest(q)) return false;
  if (q.length < 6) return false;
  if (isConversationalMessage(q)) return false;
  if (isMetaOrHypotheticalQuestion(q)) return false;
  return hasExplicitCreateRequest(q);
}

/**
 * @param {Array<{ role: string, content: string }>} history
 * @param {string} [latestUserText]
 */
export function detectImageGenerationIntentFromHistory(history, latestUserText) {
  if (detectImageGenerationIntent(latestUserText)) return true;
  if (isPostModelBriefingFollowUp(history, latestUserText)) return true;
  if (isPostBriefingCorrectionFollowUp(history, latestUserText)) return true;

  const h = Array.isArray(history) ? history : [];
  const lastAssistant = [...h].reverse().find((m) => m.role === "assistant");
  const confirmTexts = [];
  if (typeof latestUserText === "string" && latestUserText.trim()) {
    confirmTexts.push(normalizeIntentText(latestUserText));
  }
  const lastUser = [...h].reverse().find((m) => m.role === "user");
  if (lastUser && typeof lastUser.content === "string") {
    confirmTexts.push(normalizeIntentText(lastUser.content));
  }

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
