/**
 * Padrões de falha frequentes em LLMs conversacionais (especialmente modelos pequenos + RAG).
 * Usado no treino (docs/txt) e no pós-processamento (sanitizer).
 *
 * Referência: docs/ia/padroes-erro-llm-tuma.md
 */

/** @typedef {'remove_sentence' | 'remove_inline' | 'truncate'} FailureFix */

/**
 * @typedef {object} LlmFailurePattern
 * @property {string} id
 * @property {string} label
 * @property {RegExp} re
 * @property {FailureFix} fix
 * @property {boolean} [skipIfQuestionMentionsArt]
 */

export const LLM_FAILURE_PATTERN_IDS = [
  "PROMPT_LEAK",
  "FALSE_TOOL_USE",
  "STEReOTYPE_ANCHOR",
  "GENERIC_MARKETING",
  "MENU_BOT",
  "SYcOPHANCY_FILLER",
  "UNASKED_DISCLAIMER",
  "OVER_APOLOGY",
  "POST_SPAM",
  "ENGLISH_DRIFT",
  "FAKE_URGENCY",
  "HALLUCINATION_STOCK",
];

/** Frases inteiras a remover (testadas por sentença). */
export const SENTENCE_FAILURE_PATTERNS = [
  {
    id: "FALSE_TOOL_USE",
    label: "Fingir que consultou sistema",
    re: /\b(consultei|busquei|pesquisei|acessei|verifiquei)\s+(?:o\s+)?(?:banco|base|rag|sistema|supabase|chroma|embeddings|acervo\s+de\s+dados)\b/i,
    fix: "remove_sentence",
  },
  {
    id: "PROMPT_LEAK",
    label: "Vazar instrução interna",
    re: /\b(de\s+acordo\s+com\s+(?:as\s+)?regras|conforme\s+(?:o\s+)?prompt|instru[cç][oõ]es\s+fornecidas|documentos?\s+recuperados?|contexto\s+fornecido\s+abaixo)\b/i,
    fix: "remove_sentence",
  },
  {
    id: "GENERIC_MARKETING",
    label: "Dicas genéricas de marketing",
    re: /\b(conhe[cç]a\s+seu\s+p[uú]blico|use\s+hashtags?|engajamento\s+org[aâ]nico|estrat[eé]gia\s+de\s+conte[uú]do|identidade\s+visual\s+consistente|calend[aá]rio\s+editorial)\b/i,
    fix: "remove_sentence",
  },
  {
    id: "MENU_BOT",
    label: "Menu numerado robótico",
    re: /\b(op[cç][aã]o\s*\d|escolha\s+uma\s+op[cç][aã]o|digite\s+\d|menu\s*:)\b/i,
    fix: "remove_sentence",
  },
  {
    id: "UNASKED_DISCLAIMER",
    label: "Disclaimer longo não pedido",
    re: /\b(como\s+modelo\s+de\s+linguagem|n[aã]o\s+tenho\s+acesso\s+em\s+tempo\s+real|minha\s+base\s+de\s+conhecimento|at[eé]\s+minha\s+data\s+de\s+corte)\b/i,
    fix: "remove_sentence",
  },
  {
    id: "FAKE_URGENCY",
    label: "Urgência fabricada",
    re: /\b(n[aã]o\s+perca\s+essa\s+oportunidade|aproveite\s+agora|oferta\s+por\s+tempo\s+limitado|clique\s+aqui)\b/i,
    fix: "remove_sentence",
  },
  {
    id: "HALLUCINATION_STOCK",
    label: "Estoque/preço inventado",
    re: /\b(temos\s+\d+\s+unidades|estoque\s+de\s+\d+|por\s+apenas\s+r\$\s*\d|pre[cç]o\s+promocional\s+de)\b/i,
    fix: "remove_sentence",
  },
  {
    id: "POST_SPAM",
    label: "Pitch de post fora de contexto",
    re: /\b(planej(ar?|e)\s+(?:um\s+)?post(?:agem)?\s+(?:para\s+)?(?:o\s+)?instagram|quer\s+montar\s+(?:um\s+)?post|gerar\s+(?:a\s+)?pr[eé]via\s+(?:da\s+)?(?:arte|imagem))\b/i,
    fix: "remove_sentence",
    skipIfQuestionMentionsArt: true,
  },
  {
    id: "MARKETING_PITCH_FILLER",
    label: "Pitch de marketing em toda resposta",
    re: /\bcomo\s+posso\s+ajudar\s+(?:voc[eê]\s+)?com\s+o\s+marketing\s+visual\b/i,
    fix: "remove_sentence",
  },
  {
    id: "nao_entendi",
    label: "Evasiva «não entendi»",
    re: /\b(n[aã]o\s+entendi|n[aã]o\s+captei|isso\s+foge\s+do\s+(?:que\s+fa[cç]o|escopo))\b/i,
    fix: "remove_sentence",
  },
];

/** Substituições inline (meta, estereótipos). */
export const INLINE_FAILURE_PATTERNS = [
  {
    id: "PROMPT_LEAK",
    re: /\b(empresa\s+em\s+sess[aã]o|empresa\s+selecionada|interpretar\s+(?:a\s+)?empresa|processar\s+(?:o\s+)?contexto|assistente\s+virtual\s+que|sou\s+uma\s+ia\s+que)\b/gi,
    replacement: "",
  },
  {
    id: "STEReOTYPE_ANCHOR",
    re: /\b(suplementos?\s+de\s+muscula[cç][aã]o|hidrata[cç][aã]o\s+e\s+recupera[cç][aã]o|linha\s+de\s+suplementos|mercado\s+de\s+suplementos|necessidades\s+relacionadas\s+ao\s+nosso\s+mercado|academia\s+e\s+fitness\s+em\s+geral)\b/gi,
    replacement: "",
  },
];

const RE_SYCOPHANCY_OPEN =
  /^(?:claro|certainly|com\s+certeza|perfeito|ótimo|excelente\s+pergunta|maravilha|sem\s+d[uú]vida)[!,.\s—-]+/i;

const RE_OVER_APOLOGY =
  /\b(desculp[ae]|me\s+perdoe|foi\s+mal|lamento|sinto\s+muito)\b/gi;

const RE_ENGLISH_BLOCK =
  /\b(I\s+can\s+help|As\s+an\s+AI|language\s+model|How\s+can\s+I\s+assist|Let\s+me\s+know)\b/i;

/**
 * @param {string} text
 */
export function splitSentences(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} text
 * @param {{ question?: string, history?: Array<{ role: string, content: string }> }} [ctx]
 */
export function applySentenceFailureFilters(text, ctx = {}) {
  const question = String(ctx.question || "");
  const mentionArt = /\b(post|arte|instagram|banner|pr[eé]via|gera)\b/i.test(question);
  let sentences = splitSentences(text);
  if (!sentences.length) return text;

  for (const pat of SENTENCE_FAILURE_PATTERNS) {
    if (pat.skipIfQuestionMentionsArt && mentionArt) continue;
    sentences = sentences.filter((s) => !pat.re.test(s));
  }

  const joined = sentences.join(" ").trim();
  return joined || text;
}

/**
 * @param {string} text
 */
export function applyInlineFailureFilters(text) {
  let t = String(text || "");
  for (const pat of INLINE_FAILURE_PATTERNS) {
    t = t.replace(pat.re, pat.replacement);
  }
  return t.replace(/\s{2,}/g, " ").trim();
}

/**
 * @param {string} text
 */
export function stripSycophancyOpeners(text) {
  let t = String(text || "").trim();
  for (let i = 0; i < 2; i += 1) {
    const m = t.match(RE_SYCOPHANCY_OPEN);
    if (!m) break;
    t = t.slice(m[0].length).trim();
  }
  return t || text;
}

/**
 * @param {string} text
 */
export function collapseOverApology(text) {
  const matches = [...String(text || "").matchAll(RE_OVER_APOLOGY)];
  if (matches.length <= 2) return text;
  let count = 0;
  return String(text).replace(RE_OVER_APOLOGY, (m) => {
    count += 1;
    return count === 1 ? m : "";
  }).replace(/\s{2,}/g, " ").trim();
}

/**
 * @param {string} text
 * @param {string} question
 */
export function flagEnglishDrift(text, question) {
  if (!RE_ENGLISH_BLOCK.test(text)) return false;
  return /\b(oi|ol[aá]|produtos?|empresa|post|arte|nome|quem|temos)\b/i.test(question);
}

/**
 * @param {string} text
 * @param {string} question
 */
export function trimExcessiveLength(text, question) {
  if (/\b(lista|liste|quais|todos|cat[aá]logo|acervo)\b/i.test(question)) return text;
  const sentences = splitSentences(text);
  if (sentences.length <= 8) return text;
  return sentences.slice(0, 8).join(" ").trim();
}

/**
 * @param {string} text
 * @param {{ question?: string, history?: Array<{ role: string, content: string }> }} [ctx]
 */
export function applyLlmFailureMitigations(text, ctx = {}) {
  let t = String(text || "").trim();
  if (!t) return t;

  t = stripSycophancyOpeners(t);
  t = applyInlineFailureFilters(t);
  t = applySentenceFailureFilters(t, ctx);
  t = collapseOverApology(t);
  t = trimExcessiveLength(t, ctx.question || "");

  if (flagEnglishDrift(t, ctx.question || "")) {
    return "Desculpe — vou responder em português. Pode repetir o que você precisa?";
  }

  return t.trim() || String(text || "").trim();
}
