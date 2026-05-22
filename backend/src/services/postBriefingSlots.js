/**
 * Briefing adaptativo para posts: contexto = playbook fixo; chat = variáveis do episódio.
 */

/** @typedef {'produto' | 'beneficio' | 'periodo' | 'frase_imagem'} BriefingSlotId */

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
    ask: 'Qual frase deve aparecer na imagem? (Ex.: «Até 40% OFF». Se não quiser texto na arte, diga «sem texto».)',
  },
};

const PROMO_HINT =
  /\b(promo(c|ç)(a|ã)o|promo\b|desconto|%|off\b|black\s*friday|oferta|cupom|dia\s+dos\s+namorados|namorados|natal|p[aá]scoa|cyber)\b/i;

const SEM_PRODUTO_HINT =
  /\b(sem\s+produto|s[oó]\s+institucional|institucional|marca\s+apenas|n[aã]o\s+tem\s+produto|sem\s+item)\b/i;

const PRODUTO_HINT =
  /\b(produto|kit|linha|whey|creatina|camiseta|vestido|sapato|curso|plano|servi[cç]o|combo|embalagem|modelo\s+\w+)\b/i;

const BENEFICIO_HINT =
  /\b(\d+\s*%\s*off|\d+\s*%|desconto|off\b|de\s+r\$\s*\d|por\s+r\$\s*\d|frete\s+gr[aá]tis|leve\s+\d|pague\s+\d|cashback|cupom)\b|\d+\s*%(?=\s|$|[,.;])/i;

const PERIODO_HINT =
  /(de\s+\d{1,2}\s*[/\-]\s*\d{1,2}(?:\s+a\s+\d{1,2}\s*[/\-]\s*\d{1,2})?|at[eé]\s+\d{1,2}\s*[/\-]?\s*\d{1,2}|\d{1,2}\s*[/\-]\s*\d{1,2}(?:\s*[/\-]\s*\d{2,4})?|validade|v[aá]lido\s+at[eé]|enquanto\s+durar|at[eé]\s+domingo|at[eé]\s+s[aá]bado)/i;

const FRASE_HINT =
  /(frase\s+(na\s+)?(imagem|arte)|texto\s+na\s+(imagem|arte)|sem\s+texto|sem\s+frase|n[aã]o\s+quero\s+texto|frase\s+[«"][^»"]{2,40}[»"]|«[^»]{2,40}»)/i;

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
 * @param {string} text
 * @returns {Record<BriefingSlotId, boolean>}
 */
export function detectFilledSlots(text) {
  const t = String(text || "");
  const promo = PROMO_HINT.test(t);
  const semProduto = SEM_PRODUTO_HINT.test(t);

  return {
    produto: semProduto || PRODUTO_HINT.test(t) || !promo,
    beneficio: BENEFICIO_HINT.test(t) || (!promo && /institucional/i.test(t)),
    periodo: PERIODO_HINT.test(t) || (!promo && /institucional/i.test(t)),
    frase_imagem: FRASE_HINT.test(t),
  };
}

/**
 * @param {Array<{ role: string, content: string }>} history
 * @returns {BriefingSlotId[]}
 */
export function listMissingBriefingSlots(history) {
  const userText = userTextFromHistory(history);
  if (userText.length < 8) {
    return ["produto", "beneficio", "periodo", "frase_imagem"];
  }

  const promo = PROMO_HINT.test(userText);
  const filled = detectFilledSlots(userText);
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
 * @param {Array<{ role: string, content: string }>} history
 * @param {{
 *   confirmation_message: string,
 *   post_context_proposal: Record<string, unknown>,
 *   links?: unknown[],
 * }} proposalOut
 */
export function applyBriefingGate(history, proposalOut) {
  const missing = listMissingBriefingSlots(history);

  if (missing.length === 0) {
    return {
      briefing_status: "ready",
      missing_slots: [],
      confirmation_message: proposalOut.confirmation_message,
      post_context_proposal: proposalOut.post_context_proposal,
      links: proposalOut.links,
    };
  }

  const questions = buildBriefingQuestionsMessage(missing, proposalOut.post_context_proposal);
  return {
    briefing_status: "collecting",
    missing_slots: missing,
    confirmation_message: questions || proposalOut.confirmation_message,
    post_context_proposal: proposalOut.post_context_proposal,
    links: proposalOut.links,
  };
}
