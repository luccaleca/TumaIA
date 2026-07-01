/**
 * Intenção de catálogo / acervo (lista ou item) — heurística no Node.
 */

import { isIdentityOrMetaQuestion } from "./chatOffTopic.js";
import { parseProductMentionSpec } from "./productMentionMatch.js";

/** Adjetivos de status — não são nomes de produto no acervo. */
const ACERVO_STATUS_WORDS = new Set([
  "ativo",
  "ativa",
  "ativos",
  "ativas",
  "disponivel",
  "disponiveis",
  "cadastrado",
  "cadastrada",
  "cadastrados",
  "cadastradas",
  "habilitado",
  "habilitada",
  "habilitados",
  "habilitadas",
]);

/**
 * @param {string} q — já normalizado (sem acento, minúsculo)
 */
function normalizeChatQuery(q) {
  return String(q || "")
    .replace(/\boq\b/g, "o que")
    .replace(/\bvoce\b/g, "voce")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Termo extraído por engano de frases de catálogo («de produtos», «os produtos»).
 * @param {string} termo
 */
function isGenericCatalogPhrase(termo) {
  const t = String(termo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!t || t.length < 2) return true;
  if (/^(de|do|da|dos|das|no|na|nos|nas|em|o|a|os|as)\s+produtos?$/.test(t)) return true;
  if (/^produtos?$/.test(t)) return true;
  if (/^(o\s+)?que\s+temos(\s+de\s+produtos?)?$/.test(t)) return true;
  if (/^temos(\s+de\s+produtos?)?$/.test(t)) return true;
  if (/^(no\s+)?(acervo|catalogo|midias?)$/.test(t)) return true;
  if (/^cadastrad[oa]s?$/.test(t)) return true;
  if (/^(quais|que|qual|oq)$/.test(t)) return true;
  if (ACERVO_STATUS_WORDS.has(t)) return true;
  return false;
}

/**
 * Remove filtro de listagem quando só sobrou ruído da frase («quais», «disponiveis»…).
 * @param {ReturnType<typeof parseProductMentionSpec> | null} filtro
 */
function sanitizeAcervoListFiltro(filtro) {
  if (!filtro || filtro.mode === "none") return null;
  if (filtro.mode === "specific") {
    const phrases = (filtro.specificPhrases || []).filter((p) => !isGenericCatalogPhrase(p));
    if (!phrases.length) return null;
    return { ...filtro, specificPhrases: phrases, terms: phrases };
  }
  if (filtro.mode === "generic") {
    const terms = (filtro.genericTerms || []).filter((t) => !isGenericCatalogPhrase(t));
    if (!terms.length) return null;
    return { mode: "generic", terms, specificPhrases: [], genericTerms: terms };
  }
  return null;
}

/**
 * Pergunta sobre stack de IA (não confundir com modelos de post da empresa).
 * @param {string} q — normalizado
 */
function asksAiStackModel(q) {
  return /\b(gpt|chatgpt|openai|ollama|llama|claude|gemini|qwen|embedding|api\s+key|fine[\s-]?tun|servidor\s+local|qual\s+ia|modelo\s+de\s+linguagem|modelo\s+de\s+ia|treinamento)\b/.test(
    q,
  );
}

/**
 * Pergunta sobre modelos/playbooks de post (não confundir com produto no acervo).
 * @param {string} text
 */
export function isPostModelosQuestion(text) {
  const q = normalizeForIntent(text);
  if (!q || asksAiStackModel(q)) return false;

  if (/\b(modelos?\s+de\s+post|modelos?\s+post|playbooks?|templates?\s+de\s+post)\b/.test(q)) {
    return true;
  }
  if (/\b(quais|que)\s+modelos?\b/.test(q) && /\b(post|campanha|layout|arte|ativos?)\b/.test(q)) {
    return true;
  }
  if (/\bcontextos?\s+ativos?\b/.test(q) && !/\bprodutos?\b/.test(q)) {
    return true;
  }
  if (/\b(quais|que)\s+(?:tem|temos|ha)\s+ativos?\b/.test(q) && /\bmodelos?\b/.test(q)) {
    return true;
  }
  // Formas curtas no chat/WhatsApp — «modelos», «quais modelos», «qual modelo» (layout de post).
  if (/^modelos?\??$/.test(q)) return true;
  if (/\b(quais|que|os|nossos?|qual)\s+modelos?\b/.test(q)) return true;
  if (/\bmodelos?\s+ativos?\b/.test(q)) return true;
  if (/\btemos\s+modelos?\b/.test(q)) return true;
  if (/\blistar\s+modelos?\b/.test(q)) return true;
  return false;
}

/**
 * @param {string} q — normalizado
 */
function wantsProductList(q) {
  return (
    /\b(quais|que)\s+produtos?\b/.test(q) ||
    /\blista\s+(de\s+)?produtos?\b/.test(q) ||
    /\bprodutos?\s+disponive/.test(q) ||
    /\bprodutos?\s+relacionad[oa]s?\b/.test(q) ||
    (/\bquero\s+saber\b/.test(q) && /\b(temos|produtos?|acervo|midias?|catalogo)\b/.test(q)) ||
    (/\b(saber|ver|mostrar?)\s+(?:o\s+)?que\s+temos\b/.test(q)) ||
    /\bo\s+que\s+temos\b/.test(q) ||
    /\boq\s+temos\b/.test(q) ||
    /\btemos\s+(?:de\s+)?produtos?\b/.test(q) ||
    /\btemos\s+quais\s+produtos?\b/.test(q) ||
    /\bmostr(ar?|e)\s+(?:o\s+)?(?:os\s+)?produtos?\b/.test(q) ||
    /\bme\s+(?:mostra|lista|diz)\s+(?:o\s+)?(?:os\s+)?produtos?\b/.test(q) ||
    /\benumera(r)?\s+(?:os\s+)?produtos?\b/.test(q) ||
    /\b(cat[aá]logo|acervo)\s+(de\s+)?produtos?\b/.test(q) ||
    /\b(itens?|produtos?)\s+(cadastrad|no\s+acervo|em\s+midias?)\b/.test(q) ||
    /\bquais\s+(itens?|fotos?|imagens?)\s+(?:temos|tem|ha)\b/.test(q) ||
    (/\b(acervo|catalogo|midias?)\b/.test(q) &&
      /\b(produto|item|foto|imagem|tem|temos|listar|lista|mostra|saber)\b/.test(q))
  );
}

/**
 * @param {string} text
 */
function normalizeForIntent(text) {
  return normalizeChatQuery(
    String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim(),
  );
}

/**
 * Turno recente era listagem de catálogo (pergunta do usuário ou resposta com bullets).
 * @param {Array<{ role: string, content: string }>} history
 */
export function historySuggestsCatalogListing(history = []) {
  if (!Array.isArray(history) || history.length === 0) return false;

  const recent = history.slice(-40);
  for (let i = recent.length - 1; i >= 0; i--) {
    const msg = recent[i];
    const text = String(msg?.content || "").trim();
    if (!text) continue;

    if (msg.role === "user") {
      const q = normalizeForIntent(text);
      if (wantsProductList(q)) return true;
      if (
        /\b(temos|produtos?|acervo|midias?|catalogo|listar|lista)\b/.test(q) &&
        extractAcervoListFilter(text)
      ) {
        return true;
      }
      continue;
    }

    if (msg.role === "assistant") {
      if (/relacionados a «[^»]+»,\s*temos\s+\d+\s+produtos?/i.test(text)) return true;
      if (/No acervo[^.\n]*temos\s+\d+\s+produtos?:/i.test(text)) return true;
      if (/Quer montar post de algum deles/i.test(text)) return true;
      const bullets = text.match(/^•\s+/gm);
      if (bullets && bullets.length >= 2) return true;
    }
  }

  return false;
}

/**
 * Follow-up curto («e o pro force», «e sobre whey») — só lista se o histórico for de catálogo.
 * Fora desse contexto, deixa NONE para o LLM explicar o produto.
 * @param {string} raw — texto original (com acentos)
 * @param {Array<{ role: string, content: string }>} history
 */
function wantsFilteredProductList(raw, history = []) {
  if (isPostModelosQuestion(raw)) return false;
  if (!historySuggestsCatalogListing(history)) return false;

  const filtro = extractAcervoListFilter(raw);
  if (!filtro) return false;
  const t = String(raw || "").trim();
  if (!t || t.length > 140) return false;
  if (
    /^(e\s+)?(sobre|do|da|de|no|na|com)\s+/i.test(t) ||
    /^e\s+(o\s+|a\s+|os\s+|as\s+)?/i.test(t) ||
    /^e\s+[a-záàâãéêíóôõú]/i.test(t)
  ) {
    return true;
  }
  if (filtro.mode === "specific" && filtro.specificPhrases.length && t.length <= 64) {
    const phrase = filtro.specificPhrases[0];
    const bare = t.replace(/[?.!]+$/g, "").trim().toLowerCase();
    if (phrase && bare === phrase.toLowerCase()) return true;
  }
  return false;
}

/**
 * Filtro de listagem quando o usuário pede produtos de uma linha/marca específica.
 * @param {string} question
 * @returns {ReturnType<typeof parseProductMentionSpec> | null}
 */
export function extractAcervoListFilter(question) {
  const raw = String(question || "").trim();
  if (!raw) return null;

  const spec = parseProductMentionSpec(raw);
  if (spec.mode === "specific" && spec.specificPhrases.length) {
    return spec;
  }

  const GENERIC_STOP = new Set([
    "saber",
    "quero",
    "perfeito",
    "relacionados",
    "relacionado",
    "relacionada",
    "produto",
    "produtos",
    "item",
    "itens",
    "acervo",
    "midia",
    "midias",
    "catalogo",
    "temos",
    "tenho",
    "lista",
    "listar",
    "mostra",
    "mostrar",
    "gostaria",
    "quais",
    "que",
    "qual",
    "disponivel",
    "disponiveis",
  ]);

  if (spec.mode === "generic" && spec.genericTerms.length) {
    const terms = spec.genericTerms.filter(
      (t) => t.length >= 4 && !GENERIC_STOP.has(t) && !/^(produto|produtos|item|itens)$/.test(t),
    );
    if (terms.length === 1 || (terms.length > 1 && terms.some((t) => t.includes(" ")))) {
      return {
        mode: "generic",
        terms,
        specificPhrases: [],
        genericTerms: terms,
      };
    }
  }

  return null;
}

/** @typedef {'promocao' | 'lancamento' | 'destaque' | 'campanha'} CampanhaTipo */

const CAMPAIGN_CUE_RE =
  /\b(promo[cç][aã]o|promo\b|desconto|campanha|oferta|black\s*friday|lancamento|novo\s+produto|novidade|estreia|divulga[cç][aã]o|divulgar|destaque|apresenta[cç][aã]o|apresentar)\b/;

const CAMPAIGN_FALLBACK_TERMS = [
  "pro force",
  "whey growth",
  "naked wafer",
  "chocolate",
  "morango",
  "baunilha",
  "cookies",
  "cookie",
  "cafe",
  "canela",
  "caramelo",
  "whey",
  "creatina",
  "monster",
];

/**
 * Remove ruído do termo capturado em pedidos de campanha.
 * @param {string} raw
 * @param {number} [maxWords]
 */
function sanitizeCampaignTerm(raw, maxWords = 3) {
  let term = String(raw || "")
    .replace(/\s+com\s+(\d{1,2}\s*%?|desconto).*$/, "")
    .replace(
      /\s+(na|no|em|a|o|pra|para|que|a gente|entra|entram|vai|vao|sera|será|com\s+\d).*/i,
      "",
    )
    .trim();
  term = term
    .split(/\s+/)
    .filter((t) => t && !/^\d+%?$/.test(t))
    .slice(0, maxWords)
    .join(" ")
    .trim();
  if (term.length < 3 || isGenericCatalogPhrase(term)) return null;
  return term;
}

/**
 * Pedido de campanha usando itens do acervo (promo, lançamento, destaque, data).
 * @param {string} q — normalizado
 * @param {string} raw
 */
export function wantsCampaignAcervoUsage(q, raw) {
  const hasCampaignCue =
    CAMPAIGN_CUE_RE.test(q) ||
    /\bcoloca(r|mos)?\s+(nessa|na)\s+(promo|campanha)/.test(q) ||
    /\bfazer\s+um[a]?\s+(post|arte|banner)\s+(de\s+)?(lancamento|promo[cç][aã]o|campanha)/.test(q);
  const scope = buildCampaignScope(raw);
  const hasProductScope =
    /\bprodutos?\b/.test(q) ||
    /\btodos\s+(os\s+)?(itens?|produtos?)\b/.test(q) ||
    /\b(acervo|midias?)\b/.test(q) ||
    /\b(?:linha|categoria)\s+(?:de\s+)?[a-z]/.test(q) ||
    /\bfazer\s+um[a]?\s+(arte|post|promo|campanha|lancamento)/.test(q) ||
    /\b(?:monta|montar|cria|criar|gera|gerar)\s+(?:um\s+)?(?:post|arte|banner)\b/.test(q) ||
    Boolean(scope.rotulo);
  return hasCampaignCue && hasProductScope;
}

/** @deprecated alias — use wantsCampaignAcervoUsage */
export function wantsPromoAcervoUsage(q, raw) {
  return wantsCampaignAcervoUsage(q, raw);
}

/**
 * Atributo/linha genérica para filtrar o acervo («todos com chocolate», «linha whey»).
 * @param {string} raw
 * @returns {string | null}
 */
export function extractCampaignProductAttribute(raw) {
  const n = normalizeForIntent(raw);
  if (!n) return null;

  const patterns = [
    /\bpromo[cç][aã]o\s+de\s+([a-z0-9][a-z0-9\s-]{1,28})/,
    /\bpromo\s+de\s+([a-z0-9][a-z0-9\s-]{1,28})/,
    /\b(?:campanha|oferta)\s+(?:de|do|da|dos|das)\s+([a-z0-9][a-z0-9\s-]{1,28})/,
    /\b(?:lancamento|novidade|estreia)\s+(?:de|do|da|dos|das)?\s*([a-z0-9][a-z0-9\s-]{1,28})/,
    /\bpost\s+(?:de\s+)?(?:lancamento|novidade)\s+(?:de|do|da)?\s*([a-z0-9][a-z0-9\s-]{1,28})/,
    /\b(?:divulga(?:r|cao)|destaque|apresenta(?:r|cao))\s+(?:de|do|da|dos|das|a|o)?\s*([a-z0-9][a-z0-9\s-]{1,28})/,
    /\bblack\s*friday\s+(?:com|de|dos|das|para|sobre)?\s*([a-z0-9][a-z0-9\s-]{1,28})/,
    /\b(?:linha|categoria)\s+(?:de\s+)?([a-z0-9][a-z0-9\s-]{1,22})/,
    /\bprodutos?\s+que\s+(?:tem|t[eê]m|contem|cont[eê]m)\s+([a-z0-9]{2,20})/,
    /\btodos\s+(?:os\s+)?produtos?\s+(?:que\s+)?(?:tem|t[eê]m|com|de)\s+([a-z0-9]{2,20})/,
    /\btudo\s+(?:que\s+)?(?:tem|t[eê]m|e\s+)?([a-z0-9]{2,20})\s+(?:no\s+nome|no\s+acervo)/,
    /\b(?:com|de)\s+([a-z0-9]{2,20})\s+(?:na\s+promo|no\s+post|na\s+campanha)/,
  ];

  for (const re of patterns) {
    const m = n.match(re);
    if (!m?.[1]) continue;
    const term = sanitizeCampaignTerm(m[1]);
    if (term) return term;
  }

  if (CAMPAIGN_CUE_RE.test(n)) {
    for (const token of CAMPAIGN_FALLBACK_TERMS) {
      const re = new RegExp(`\\b${token.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (re.test(n)) return token;
    }
  }

  return null;
}

/** @deprecated alias — use extractCampaignProductAttribute */
export function extractPromoProductAttribute(raw) {
  return extractCampaignProductAttribute(raw);
}

/**
 * Filtro + rótulo para campanhas (frases específicas do acervo ou termo genérico).
 * @param {string} raw
 * @returns {{ filtro: ReturnType<typeof parseProductMentionSpec> | null, rotulo: string | null }}
 */
export function buildCampaignScope(raw) {
  const listFilter = extractAcervoListFilter(raw);
  if (listFilter) {
    const rotulo =
      listFilter.mode === "specific"
        ? listFilter.specificPhrases.find((p) => p.includes(" ")) || listFilter.specificPhrases[0] || null
        : listFilter.genericTerms[0] || null;
    return { filtro: listFilter, rotulo: rotulo ? String(rotulo).trim() : null };
  }

  const attr = extractCampaignProductAttribute(raw);
  if (attr) {
    return {
      filtro: {
        mode: "generic",
        terms: [attr],
        specificPhrases: [],
        genericTerms: [attr],
      },
      rotulo: attr,
    };
  }

  return { filtro: null, rotulo: null };
}

/**
 * Tipo de campanha inferido do pedido.
 * @param {string} raw
 * @returns {CampanhaTipo}
 */
export function extractCampaignType(raw) {
  const n = normalizeForIntent(raw);
  if (/\b(lancamento|novo\s+produto|novidade|estreia|chegada|acabou\s+de\s+chegar)\b/.test(n)) {
    return "lancamento";
  }
  if (/\b(promo[cç][aã]o|promo\b|desconto|oferta|black\s*friday|%\s*off|\boff\b)\b/.test(n)) {
    return "promocao";
  }
  if (/\b(dia\s+dos|natal|pascoa|data\s+comemorativa|comemorativ)\b/.test(n)) {
    return "campanha";
  }
  if (/\b(divulga[cç][aã]o|divulgar|destaque|apresenta[cç][aã]o|apresentar)\b/.test(n)) {
    return "destaque";
  }
  if (extractCampaignBenefit(raw)) return "promocao";
  return "destaque";
}

/**
 * Benefício ou oferta citada no pedido.
 * @param {string} raw
 * @returns {string | null}
 */
export function extractCampaignBenefit(raw) {
  const n = normalizeForIntent(raw);
  const pct = n.match(/\b(\d{1,2})\s*%/);
  if (pct) return `${pct[1]}% de desconto`;
  const desconto = n.match(/\bdesconto\s+de\s+(\d{1,2})/);
  if (desconto) return `${desconto[1]}% de desconto`;
  const dePor = n.match(/\bde\s+r?\$?\s*([\d.,]+)\s+por\s+r?\$?\s*([\d.,]+)/);
  if (dePor) return `de R$ ${dePor[1]} por R$ ${dePor[2]}`;
  if (/\bfrete\s+gratis\b/.test(n)) return "frete grátis";
  if (/\bdesconto\b/.test(n)) return "desconto promocional";
  return null;
}

/** @deprecated alias — use extractCampaignBenefit */
export function extractPromoBenefit(raw) {
  return extractCampaignBenefit(raw);
}

/**
 * «Tem whey?» — não confundir com «produtos que tem chocolate na promoção».
 * @param {string} q
 * @param {string} raw
 * @returns {string | null}
 */
function extractInfoProductTerm(q, raw) {
  if (/\bprodutos?\s+que\s+(tem|t[eê]m|contem|cont[eê]m)\b/.test(q)) return null;
  if (/\b(promo[cç]|desconto|campanha|lancamento|novidade|divulgar|destaque|apresentar|coloca(r|mos)?)\b/.test(q)) {
    return null;
  }
  if (raw.length > 110) return null;

  const infoMatch = q.match(/\b(temos|tem|existe|ha|cadastrad[oa]?)\s+(?:o\s+|a\s+|os\s+|as\s+)?(.{2,48})/);
  if (!infoMatch) return null;

  let termo = String(infoMatch[2] || "")
    .replace(/\?.*$/, "")
    .replace(/\b(no\s+acervo|em\s+midias?|disponivel|disponiveis)\b/g, "")
    .replace(/\s+(a gente|que a gente|na promo|nessa promo|coloca|sera|será|com \d).*$/, "")
    .trim();

  if (termo.split(/\s+/).length > 4) return null;
  if (termo.length < 2 || /^(isso|aquilo|la|aqui)$/.test(termo) || isGenericCatalogPhrase(termo)) {
    return null;
  }
  return termo;
}

/**
 * @param {string} question
 * @param {Array<{ role: string, content: string }>} [history]
 */
export function classifyChatAcervoIntent(question, history = []) {
  const raw = String(question || "").trim();
  if (!raw || isIdentityOrMetaQuestion(raw) || isPostModelosQuestion(raw)) {
    return { kind: "NONE", termo: null };
  }

  const q = normalizeChatQuery(
    raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim(),
  );

  if (wantsCampaignAcervoUsage(q, raw)) {
    const { filtro, rotulo } = buildCampaignScope(raw);
    return {
      kind: "USO_ACERVO_PROMO",
      termo: rotulo,
      filtro,
      beneficio: extractCampaignBenefit(raw),
      campanhaTipo: extractCampaignType(raw),
    };
  }

  if (wantsProductList(q) || wantsFilteredProductList(raw, history)) {
    const filtro = sanitizeAcervoListFiltro(extractAcervoListFilter(raw));
    const rotulo =
      filtro?.mode === "specific"
        ? filtro.specificPhrases.find((p) => p.includes(" ")) || filtro.specificPhrases[0]
        : filtro?.genericTerms?.[0] || null;
    return { kind: "LISTAR_PRODUTOS", termo: rotulo, filtro };
  }

  const termoInfo = extractInfoProductTerm(q, raw);
  if (termoInfo) {
    return { kind: "INFO_PRODUTO", termo: termoInfo };
  }

  return { kind: "NONE", termo: null };
}
