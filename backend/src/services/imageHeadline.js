import { extractProductMentions } from "./productMentionMatch.js";

/** Frase curta que aparece NA IMAGEM (não é legenda do post). */
export const FRASE_NA_IMAGEM_MAX = 56;

const HIDDEN_USER_LINES = new Set([
  "confirmar e gerar prévia da imagem.",
  "gerar arte com contextos e fotos do painel.",
]);

/** Mensagens automáticas do painel — não entram no pedido único. */
const ASSISTANT_NOISE_PREFIXES = [
  "preparando resumo",
  "resumo do pedido para a arte",
  "prévia da imagem gerada",
  "não encontrei o resumo",
  "falta só completar o pedido",
];

/**
 * @param {string} role
 * @param {string} content
 */
export function isPanelNoiseMessage(role, content) {
  const t = String(content ?? "").trim().toLowerCase();
  if (!t) return true;
  if (role === "user") {
    const norm = t.replace(/\s+/g, " ");
    return HIDDEN_USER_LINES.has(norm);
  }
  if (role === "assistant") {
    return ASSISTANT_NOISE_PREFIXES.some((p) => t.startsWith(p));
  }
  return false;
}

/**
 * Pedido único para geração de imagem: proposta confirmada ou última mensagem real do cliente.
 *
 * @param {Record<string, unknown> | null | undefined} proposal
 * @param {Array<{ role: string, content: string }>} history
 * @param {number} [maxLen]
 */
export function resolvePedidoCliente(proposal, history, maxLen = 720) {
  const fromProposal =
    proposal && typeof proposal === "object"
      ? String(proposal.intent_summary ?? "").trim()
      : "";
  if (fromProposal) return fromProposal.slice(0, maxLen);

  const recent = recentUserTexts(history, 1);
  const t = recent.join(" ").trim();
  return t ? t.slice(0, maxLen) : "";
}

const FOLLOWER_RE =
  /(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:k|mil|m|milh[oõ]es?)?\s*(?:de\s+)?seguidores?|seguidores?\s*(?:no\s+)?(?:instagram|insta)?/i;

/**
 * @param {string} text
 * @returns {string | null} ex. "500k"
 */
function parseFollowerMilestone(text) {
  const t = String(text || "");
  const m = t.match(FOLLOWER_RE);
  if (m) {
    const chunk = m[0];
    const num = chunk.match(/(\d{1,3}(?:[.,]\d{3})*|\d+)\s*k/i);
    if (num) return `${num[1].replace(/[.,]/g, "")}k`;
    const mil = chunk.match(/(\d+)\s*mil/i);
    if (mil) {
      const n = Number(mil[1]);
      if (n >= 10) return `${n}k`;
      return `${mil[1]} mil`;
    }
    const plain = chunk.match(/(\d{3,})/);
    if (plain) {
      const n = Number(plain[1]);
      if (n >= 1000) return `${Math.round(n / 1000)}k`;
      return plain[1];
    }
  }
  const lower = t.toLowerCase();
  if (/500\s*k|500\s*mil|500\.?000/.test(lower)) return "500k";
  if (/400\s*k|400\s*mil|400\.?000/.test(lower)) return "400k";
  if (/1\s*m|1\s*milh[aã]o|um\s+milh[aã]o/.test(lower)) return "1M";
  return null;
}

/**
 * Extrai frase explícita do pedido (ex.: "frase: TumaIA entende seu negócio").
 * @param {string} text
 */
export function extractFraseFromUserText(text) {
  const t = String(text || "");
  const patterns = [
    /frase\s*:\s*(.+?)(?:\s*[,;]|$)/i,
    /texto\s+(?:na\s+)?(?:imagem|arte)\s*:\s*(.+?)(?:\s*[,;]|$)/i,
    /frase\s+(?:na\s+)?(?:imagem|arte)\s*(?:é|seria|será)\s*[«"]?(.+?)[«"]?(?:\s*[,;]|$)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m?.[1]) continue;
    const n = normalizeFraseNaImagem(m[1]);
    if (n) return n;
  }
  return null;
}

/**
 * @param {string} raw
 */
export function normalizeFraseNaImagem(raw) {
  let s = String(raw ?? "")
    .trim()
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/\s+/g, " ");
  if (!s) return null;
  if (s.length > FRASE_NA_IMAGEM_MAX) s = s.slice(0, FRASE_NA_IMAGEM_MAX - 1).trim() + "…";
  return s;
}

/**
 * Últimas mensagens do cliente (ignora confirmações automáticas do painel).
 *
 * @param {Array<{ role: string, content: string }>} history
 * @param {number} maxUserMessages
 */
export function recentUserTexts(history, maxUserMessages = 3) {
  const out = [];
  for (let i = history.length - 1; i >= 0 && out.length < maxUserMessages; i--) {
    const m = history[i];
    if (m?.role !== "user") continue;
    const t = String(m.content ?? "").trim();
    if (!t) continue;
    const norm = t.toLowerCase().replace(/\s+/g, " ");
    if (HIDDEN_USER_LINES.has(norm)) continue;
    out.unshift(t);
  }
  return out;
}

function fraseFromProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  const direct = proposal.frase_na_imagem;
  if (typeof direct === "string") {
    const n = normalizeFraseNaImagem(direct);
    if (n) return n;
  }
  const facts = proposal.facts_for_image;
  if (facts && typeof facts === "object") {
    for (const key of ["frase_na_imagem", "headline", "texto_na_imagem", "frase"]) {
      const v = facts[key];
      if (typeof v === "string") {
        const n = normalizeFraseNaImagem(v);
        if (n) return n;
      }
    }
  }
  return null;
}

function isFollowerCelebrationFrase(frase) {
  return /parab[eé]ns\s+pelos|seguidores/i.test(String(frase || ""));
}

/**
 * Deriva frase só do pedido recente do cliente (não de toda a conversa nem nome de contexto antigo).
 *
 * @param {Array<{ role: string, content: string }>} history
 * @param {Array<Record<string, unknown>>} [contextoRows]
 */
export function deriveFraseNaImagemFromHistory(history, contextoRows = []) {
  /** Só o último pedido real do cliente — evita “500k” de mensagens antigas na mesma conversa. */
  const recent = recentUserTexts(history, 1).join(" ");
  if (!recent.trim()) return null;

  const milestone = parseFollowerMilestone(recent);
  if (milestone) {
    return normalizeFraseNaImagem(`Parabéns pelos ${milestone}!`);
  }

  const lower = recent.toLowerCase();
  if (/at[eé]\s*\d+\s*%|%\s*off|desconto|\bpromo\b|black\s*friday/i.test(lower)) {
    const pct = lower.match(
      /at[eé]\s*(\d{1,3})\s*%|(\d{1,3})\s*%\s*off|(\d{1,3})\s*%\s*(?:de\s+)?desconto|desconto\s+de\s+(\d{1,3})\s*%/,
    );
    if (pct) {
      const n = pct[1] || pct[2] || pct[3] || pct[4];
      if (n) return normalizeFraseNaImagem(`Até ${n}% OFF`);
    }
    if (/black\s*friday/i.test(lower)) return normalizeFraseNaImagem("Black Friday");
    // Não inventar só "Promoção" — o resumo visual usa o pedido completo.
  }

  if (/dia\s+das\s+m[aã]es|mothers?\s*day/i.test(lower)) {
    return normalizeFraseNaImagem("Feliz Dia das Mães!");
  }
  if (/natal|christmas/i.test(lower)) return normalizeFraseNaImagem("Feliz Natal!");

  const explicit = extractFraseFromUserText(recent);
  if (explicit) return explicit;

  return null;
}

function normalizeLiteText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function looksLikeRawUserCopy(resumo, intent) {
  const r = normalizeLiteText(resumo);
  const i = normalizeLiteText(intent);
  if (!r || !i || i.length < 14) return false;
  if (r === i) return true;
  const chunk = i.slice(0, Math.min(56, i.length));
  return chunk.length >= 14 && r.includes(chunk);
}

/**
 * Descrição do que a IA vai compor — nunca colar o pedido do cliente palavra por palavra.
 *
 * @param {Record<string, unknown>} proposal
 * @param {string} [userHint]
 */
export function synthesizeResumoVisual(proposal, userHint = "") {
  const p = proposal && typeof proposal === "object" ? proposal : {};
  const intent =
    String(p.intent_summary ?? "").trim() || String(userHint || "").trim();
  const lower = intent.toLowerCase();
  const parts = [];

  if (/promo|desconto|off|%\b|de\s+\d+\s+por\s+\d+/i.test(intent)) {
    parts.push("Post promocional para feed do Instagram, visual chamativo e energético.");
  } else {
    parts.push("Arte para feed do Instagram alinhada à marca.");
  }

  if (/academia/i.test(lower)) {
    parts.push("Público-alvo: academias.");
  }

  const priceMatch = lower.match(/de\s+(\d+)\s+por\s+(\d+)|(\d+)\s+por\s+(\d+)/);
  if (priceMatch) {
    const de = priceMatch[1] || priceMatch[3];
    const por = priceMatch[2] || priceMatch[4];
    parts.push(`Destaque de preço: de R$ ${de} por R$ ${por}.`);
  }

  const refs = Array.isArray(p.midias_referenced) ? p.midias_referenced : [];
  const refNames = refs
    .map((r) => String(r?.nome_exibicao ?? "").trim())
    .filter(Boolean)
    .slice(0, 4);
  if (refNames.length) {
    parts.push(`PNG do acervo na composição: ${refNames.join(", ")}.`);
    const heroName =
      p.hero_product && typeof p.hero_product === "object"
        ? String(p.hero_product.nome_exibicao ?? "").trim()
        : "";
    if (heroName && !refNames.includes(heroName)) {
      parts.push(`Produto em destaque: ${heroName}.`);
    } else if (heroName) {
      parts.push(`Produto em destaque no centro: ${heroName}.`);
    }
  } else {
    const mentions = extractProductMentions(intent);
    if (mentions.length) {
      parts.push(
        `Produto(s) pedido(s): ${mentions.map((m) => `«${m}»`).join(", ")}. ` +
          "Nenhum PNG correspondente no acervo ainda — confira os itens abaixo ou cadastre em Mídias.",
      );
    } else if (/monster|creatina|whey|pro\s*force|produto/i.test(lower)) {
      parts.push(
        "Nenhum PNG do produto foi vinculado ainda — confira os itens abaixo ou cadastre em Mídias.",
      );
    }
  }

  const explicit = extractFraseFromUserText(intent) || fraseFromProposal(p);
  if (explicit) {
    parts.push(`Texto pedido na arte: «${explicit}».`);
  } else {
    parts.push(
      "Use preço e chamada da promo na tipografia; não repetir o pedido do chat como frase única na imagem.",
    );
  }

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 480);
}

/**
 * Resumo do que a arte deve comunicar (direção visual para o modelo — não o pedido literal).
 *
 * @param {Record<string, unknown> | null | undefined} proposal
 * @param {Array<{ role: string, content: string }>} [history]
 * @param {string} [userHint]
 */
export function buildResumoVisual(proposal, history = [], userHint = "") {
  const p = proposal && typeof proposal === "object" ? proposal : {};
  const intent =
    String(p.intent_summary ?? "").trim() ||
    recentUserTexts(history, 2).join(" ").trim() ||
    String(userHint || "").trim();

  const fromProposal =
    typeof p.resumo_visual === "string" && p.resumo_visual.trim() ? p.resumo_visual.trim() : "";
  if (fromProposal && !looksLikeRawUserCopy(fromProposal, intent)) {
    return fromProposal.slice(0, 480);
  }

  return synthesizeResumoVisual(p, intent || userHint);
}

/**
 * Frase para a arte: prioriza o pedido recente do cliente (evita “500k” de testes antigos na mesma conversa).
 *
 * @param {Record<string, unknown> | null | undefined} proposal
 * @param {Array<{ role: string, content: string }>} history
 * @param {Array<Record<string, unknown>>} [contextoRows]
 */
export function resolveFraseNaImagem(proposal, history, contextoRows = []) {
  const fromRecent = deriveFraseNaImagemFromHistory(history, contextoRows);
  const fromProposal = fraseFromProposal(proposal);
  const recentBlob = recentUserTexts(history, 1).join(" ");

  if (fromRecent) {
    if (
      fromProposal &&
      fromProposal !== fromRecent &&
      isFollowerCelebrationFrase(fromProposal) &&
      !parseFollowerMilestone(recentBlob)
    ) {
      return fromRecent;
    }
    return fromRecent;
  }

  return fromProposal;
}
