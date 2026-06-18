/**
 * Briefing adaptativo: a IA interpreta o pedido (texto solto); regras só completam lacunas óbvias.
 */

import {
  collectMandatoryImageFacts,
  extractFraseFromUserText,
  normalizeFraseNaImagem,
} from "./imageHeadline.js";

/** @typedef {'produto' | 'beneficio' | 'periodo' | 'frase_imagem' | 'midia_acervo'} BriefingSlotId */

const VALID_SLOTS = new Set(["produto", "beneficio", "periodo", "frase_imagem", "midia_acervo"]);

/** @type {Record<BriefingSlotId, { label: string, ask: string }>} */
export const BRIEFING_SLOT_META = {
  produto: {
    label: "produto",
    ask: "Qual produto ou linha entra na promoção? (Se for só institucional, sem produto em destaque, diga «sem produto».)",
  },
  beneficio: {
    label: "benefício",
    ask: "Qual o benefício da promoção? (Ex.: 20% off, de R$ 199 por R$ 149, frete grátis.)",
  },
  periodo: {
    label: "período",
    ask: "Qual o período ou validade? (Ex.: de 10/06 a 14/06, até domingo.)",
  },
  frase_imagem: {
    label: "frase na imagem",
    ask: "Qual frase deve aparecer na imagem? (Ex.: «Até 40% OFF». Se não quiser texto na arte, diga «sem texto».)",
  },
  midia_acervo: {
    label: "foto do produto no acervo",
    ask: "Cadastre o PNG do produto em Mídias e tente de novo.",
  },
};

const PROMO_HINT =
  /\b(promo(c|ç)(a|ã)o|promo\b|desconto|%|off\b|black\s*friday|oferta|cupom|dia\s+dos\s+namorados|namorados|natal|p[aá]scoa|cyber)\b/i;

const SEM_PRODUTO_HINT =
  /\b(sem\s+produto|s[oó]\s+institucional|institucional|marca\s+apenas|n[aã]o\s+tem\s+produto|sem\s+item)\b/i;

const INSTITUTIONAL_HINT =
  /\b(institucional|identidade\s+da\s+marca|fundo\s+(na\s+)?cor|cor\s+da\s+marca|logo|post\s+quadrado|feed|só\s+a\s+marca|marca\s+apenas)\b/i;

const PRODUTO_HINT =
  /\b(produto|kit|linha|whey|creatina|camiseta|vestido|sapato|curso|plano|servi[cç]o|combo|embalagem|modelo\s+\w+)\b/i;

const BENEFICIO_HINT =
  /\b(\d+\s*%\s*off|\d+\s*%|desconto|off\b|de\s+r\$\s*\d|por\s+r\$\s*\d|frete\s+gr[aá]tis|leve\s+\d|pague\s+\d|cashback|cupom)\b|\d+\s*%(?=\s|$|[,.;])|(?:^|[\s,;])(\d{1,2})\s+por\s+(?:r\$\s*)?\d{1,5}(?:[.,]\d{1,2})?/i;

const PERIODO_HINT =
  /(de\s+\d{1,2}\s*[/\-]\s*\d{1,2}(?:\s+a\s+\d{1,2}\s*[/\-]\s*\d{1,2})?|at[eé]\s+\d{1,2}\s*[/\-]?\s*\d{1,2}|\d{1,2}\s*[/\-]\s*\d{1,2}(?:\s*[/\-]\s*\d{2,4})?|validade|v[aá]lido\s+at[eé]|enquanto\s+durar|at[eé]\s+domingo|at[eé]\s+s[aá]bado)/i;

const FRASE_HINT =
  /(frase\s+(na\s+)?(imagem|arte)|texto\s+na\s+(imagem|arte)|sem\s+texto|sem\s+frase|n[aã]o\s+quero\s+texto|frase\s*:\s*[^\n,;]{2,}|texto\s*:\s*[^\n,;]{2,}|frase\s+[«"][^»"]{2,56}[»"]|«[^»]{2,56}»)/i;

const SEM_FRASE_IMAGEM_HINT =
  /\b(sem\s+texto|sem\s+frase|n[aã]o\s+quero\s+texto|sem\s+legenda\s+na\s+arte)\b/i;

/**
 * @param {Array<{ role: string, content: string }>} history
 */
function userTextFromHistory(history) {
  return history
    .filter((m) => m.role === "user")
    .map((m) => String(m.content || ""))
    .join("\n")
    .trim();
}

/**
 * @param {unknown} raw
 * @returns {BriefingSlotId[]}
 */
function normalizeMissingSlots(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {BriefingSlotId[]} */
  const out = [];
  for (const item of raw) {
    const id = String(item ?? "").trim();
    if (VALID_SLOTS.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * @param {string} text
 * @param {Record<string, unknown>} [proposal]
 */
function frasePreenchida(text, proposal = {}) {
  if (SEM_FRASE_IMAGEM_HINT.test(text)) return true;
  if (FRASE_HINT.test(text)) return true;
  if (extractFraseFromUserText(text)) return true;
  const fromProposal = normalizeFraseNaImagem(proposal.frase_na_imagem);
  return Boolean(fromProposal);
}

/**
 * @param {string} text
 * @param {Record<string, unknown>} [proposal]
 */
function produtoPreenchido(text, proposal = {}) {
  if (SEM_PRODUTO_HINT.test(text)) return true;
  if (PRODUTO_HINT.test(text)) return true;
  if (!PROMO_HINT.test(text)) {
    if (INSTITUTIONAL_HINT.test(text)) return true;
    const intent = String(proposal.intent_summary ?? "").trim();
    if (intent.length >= 10) return true;
  }
  return false;
}

/**
 * @param {string} text
 * @param {Record<string, unknown>} [proposal]
 * @returns {Record<BriefingSlotId, boolean>}
 */
export function detectFilledSlots(text, proposal = {}) {
  const t = String(text || "");
  const promo = PROMO_HINT.test(t);

  return {
    produto: produtoPreenchido(t, proposal),
    beneficio: BENEFICIO_HINT.test(t) || (!promo && (INSTITUTIONAL_HINT.test(t) || produtoPreenchido(t, proposal))),
    periodo: PERIODO_HINT.test(t) || (!promo && (INSTITUTIONAL_HINT.test(t) || produtoPreenchido(t, proposal))),
    frase_imagem: frasePreenchida(t, proposal),
  };
}

/**
 * @param {Array<{ role: string, content: string }>} history
 * @param {Record<string, unknown>} [proposal]
 * @returns {BriefingSlotId[]}
 */
export function listMissingBriefingSlots(history, proposal = {}) {
  const userText = userTextFromHistory(history);
  if (userText.length < 8) {
    return ["produto", "beneficio", "periodo", "frase_imagem"];
  }

  const promo = PROMO_HINT.test(userText);
  const filled = detectFilledSlots(userText, proposal);
  /** @type {BriefingSlotId[]} */
  const missing = [];

  if (promo) {
    if (!filled.produto) missing.push("produto");
    if (!filled.beneficio) missing.push("beneficio");
    if (!filled.periodo) missing.push("periodo");
    if (!filled.frase_imagem) missing.push("frase_imagem");
  } else {
    if (!filled.produto) missing.push("produto");
    if (!filled.frase_imagem) missing.push("frase_imagem");
  }

  return missing;
}

/**
 * @param {{
 *   confirmation_message?: string,
 *   post_context_proposal?: Record<string, unknown>,
 *   briefing_status?: unknown,
 *   missing_slots?: unknown,
 * }} proposalOut
 */
function parseLlmBriefing(proposalOut) {
  const root = proposalOut && typeof proposalOut === "object" ? proposalOut : {};
  const nested =
    root.post_context_proposal && typeof root.post_context_proposal === "object"
      ? root.post_context_proposal
      : {};
  const status = String(root.briefing_status ?? nested.briefing_status ?? "").trim();
  if (status !== "ready" && status !== "collecting") return null;
  const missing = normalizeMissingSlots(root.missing_slots ?? nested.missing_slots);
  return { status, missing };
}

/**
 * @param {BriefingSlotId[]} missing
 * @param {Record<string, unknown>} [proposal]
 */
export function buildBriefingQuestionsMessage(missing, proposal) {
  const slots = missing.slice(0, 2);
  if (!slots.length) return "";

  const ctxNome =
    proposal?.matched_contexto &&
    typeof proposal.matched_contexto === "object" &&
    typeof proposal.matched_contexto.nome === "string"
      ? String(proposal.matched_contexto.nome).trim()
      : "";

  const intro = ctxNome
    ? `Para montar o post (${ctxNome}), preciso de mais alguns detalhes:`
    : "Para montar seu post, preciso de mais alguns detalhes:";

  const parts = slots.map((id) => BRIEFING_SLOT_META[id]?.ask).filter(Boolean);
  return `${intro}\n\n${parts.map((p, i) => `${i + 1}. ${p}`).join("\n\n")}`.slice(0, 900);
}

/**
 * @param {string} msg
 */
function looksLikeNaturalBriefingQuestion(msg) {
  const m = String(msg || "").trim();
  if (m.length < 18) return false;
  if (/^confira o resumo/i.test(m)) return false;
  return /\?|qual |quais |me diga|preciso saber|falta/i.test(m);
}

/**
 * @param {Array<{ role: string, content: string }>} history
 * @param {{
 *   confirmation_message: string,
 *   post_context_proposal: Record<string, unknown>,
 *   links?: unknown[],
 *   briefing_status?: unknown,
 *   missing_slots?: unknown,
 * }} proposalOut
 */
export function applyBriefingGate(history, proposalOut) {
  const root = proposalOut && typeof proposalOut === "object" ? proposalOut : {};
  const proposal =
    root.post_context_proposal && typeof root.post_context_proposal === "object"
      ? { ...root.post_context_proposal }
      : {};

  if (proposal.product_media_status === "missing") {
    const requested = Array.isArray(proposal.products_requested)
      ? proposal.products_requested.map((x) => String(x)).filter(Boolean)
      : [];
    const labels = requested.slice(0, 2).map((m) => `«${m}»`).join(", ");
    const msg =
      String(root.confirmation_message ?? "").trim() ||
      (labels
        ? `Não encontrei ${labels} em Mídias. Cadastre o PNG e tente de novo.`
        : BRIEFING_SLOT_META.midia_acervo.ask);
    return {
      briefing_status: "collecting",
      missing_slots: ["midia_acervo"],
      confirmation_message: msg.slice(0, 900),
      post_context_proposal: proposal,
      links: root.links,
    };
  }

  const userText = userTextFromHistory(history);
  const extracted = extractFraseFromUserText(userText);
  if (extracted) {
    proposal.frase_na_imagem = extracted;
    if (!proposal.facts_for_image || typeof proposal.facts_for_image !== "object") {
      proposal.facts_for_image = {};
    }
    proposal.facts_for_image.frase_na_imagem = extracted;
  }

  const mandatoryFacts = collectMandatoryImageFacts(history, proposal);
  if (Object.keys(mandatoryFacts).length) {
    if (!proposal.facts_for_image || typeof proposal.facts_for_image !== "object") {
      proposal.facts_for_image = {};
    }
    Object.assign(proposal.facts_for_image, mandatoryFacts);
  }

  const regexMissing = listMissingBriefingSlots(history, proposal);
  const llm = parseLlmBriefing(root);

  let status = regexMissing.length === 0 ? "ready" : "collecting";
  let finalMissing = regexMissing;

  if (llm) {
    if (llm.status === "ready" && regexMissing.length === 0) {
      status = "ready";
      finalMissing = [];
    } else if (llm.status === "collecting") {
      status = "collecting";
      finalMissing = llm.missing.length ? llm.missing : regexMissing;
    } else if (llm.status === "ready" && regexMissing.length > 0) {
      status = "collecting";
      finalMissing = regexMissing;
    }
  }

  if (status === "ready") {
    return {
      briefing_status: "ready",
      missing_slots: [],
      confirmation_message: root.confirmation_message,
      post_context_proposal: proposal,
      links: root.links,
    };
  }

  const templated = buildBriefingQuestionsMessage(finalMissing, proposal);
  const llmMsg = String(root.confirmation_message ?? "").trim();
  const confirmation_message =
    llm?.status === "collecting" && looksLikeNaturalBriefingQuestion(llmMsg)
      ? llmMsg.slice(0, 900)
      : templated || llmMsg;

  return {
    briefing_status: "collecting",
    missing_slots: finalMissing,
    confirmation_message,
    post_context_proposal: proposal,
    links: root.links,
  };
}
