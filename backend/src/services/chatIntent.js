/**
 * Intenção de catálogo / acervo (lista ou item) — heurística no Node.
 */

import { isIdentityOrMetaQuestion } from "./chatOffTopic.js";
import { parseProductMentionSpec } from "./productMentionMatch.js";

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

/**
 * @param {string} question
 * @param {Array<{ role: string, content: string }>} [history]
 */
export function classifyChatAcervoIntent(question, history = []) {
  const raw = String(question || "").trim();
  if (!raw || isIdentityOrMetaQuestion(raw)) {
    return { kind: "NONE", termo: null };
  }

  const q = normalizeChatQuery(
    raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim(),
  );

  if (wantsProductList(q) || wantsFilteredProductList(raw, history)) {
    const filtro = extractAcervoListFilter(raw);
    const rotulo =
      filtro?.mode === "specific"
        ? filtro.specificPhrases.find((p) => p.includes(" ")) || filtro.specificPhrases[0]
        : filtro?.genericTerms?.[0] || null;
    return { kind: "LISTAR_PRODUTOS", termo: rotulo, filtro };
  }

  const infoMatch = q.match(
    /\b(temos|tem|existe|ha|há|cadastrad[oa]?)\s+(?:o\s+|a\s+|os\s+|as\s+)?(.{2,60})/,
  );
  if (infoMatch) {
    const termo = String(infoMatch[2] || "")
      .replace(/\?.*$/, "")
      .replace(/\b(no\s+acervo|em\s+midias?|disponivel|disponiveis)\b/g, "")
      .trim();
    if (termo.length >= 2 && !/^(isso|aquilo|la|aqui)$/.test(termo) && !isGenericCatalogPhrase(termo)) {
      return { kind: "INFO_PRODUTO", termo };
    }
  }

  return { kind: "NONE", termo: null };
}
