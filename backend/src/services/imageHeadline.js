import { extractProductMentions } from "./productMentionMatch.js";
import { describeAmbienteFromCadastro } from "./visualResumoFromCadastro.js";
import {
  extractPedidoCampanhaLabels,
  formatProductDisplayName,
  intentLooksPromotional,
  isMeaningfulCadastroValue,
} from "./cadastroMeaningful.js";

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

/** @param {string} text */
export function isPostBriefingCorrectionText(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  return /^(n[aã]o\s+(est[aá]|t[aá])\s+corret|errado|n[aã]o\s+[eé]\s+isso|n[aã]o\s+era\s+isso|ta\s+errado|est[aá]\s+errado)/i.test(
    t,
  );
}

/**
 * Cenário visual explícito no pedido (mesa, pessoa, ambiente…).
 * @param {string} text
 */
export function extractExplicitSceneFromPedido(text) {
  const t = String(text || "").trim();
  if (!t) return "";

  const patterns = [
    /\b(?:a\s+)?ideia\s+[eé]\s+(.+)$/i,
    /\b(?:quero|gostaria)\s+(?:que\s+)?(?:fazer|seja|mostrar|montar)\s+(.+)$/i,
    /\b(?:cen[aá]rio|ambienta[cç][aã]o)\s*[:\-]?\s*(.+)$/i,
    /\b(?:com|fazer)\s+((?:ele|ela|os|as).{12,280})$/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    const scene = String(m?.[1] ?? "").trim().replace(/[.!?]+$/, "");
    if (scene.length >= 12) return scene.slice(0, 320);
  }

  const sceneBits = [];
  if (/\b(?:mesa|cozinha|sala|casa|varanda)\b/i.test(t)) {
    const home = t.match(
      /(?:em\s+cima\s+da\s+)?mesa\s+(?:de\s+uma?\s+)?(?:casa|cozinha)|(?:na|em)\s+(?:mesa|cozinha|sala|casa)[^.!?]{0,80}/i,
    );
    if (home?.[0]) sceneBits.push(home[0].trim());
  }
  if (/\bpessoa\b/i.test(t)) {
    const person = t.match(/\bpessoa[^.!?]{0,100}/i);
    if (person?.[0]) sceneBits.push(person[0].trim());
  }
  if (sceneBits.length) return sceneBits.join("; ").slice(0, 320);
  return "";
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
/**
 * Pedido ativo para produto/mídia: última mensagem real do cliente (não mistura pedidos antigos).
 *
 * @param {Array<{ role: string, content: string }>} history
 * @param {{ question?: string, proposal?: Record<string, unknown> | null }} [opts]
 */
export function resolveActivePedidoHint(history, opts = {}) {
  const question = typeof opts.question === "string" ? opts.question.trim() : "";
  if (question && !isPostBriefingCorrectionText(question)) {
    return question.slice(0, 2000);
  }

  const pedidoTexts = recentUserTexts(history, 6).filter((t) => !isPostBriefingCorrectionText(t));
  const latestPedido = pedidoTexts.length ? pedidoTexts[pedidoTexts.length - 1].trim() : "";
  if (latestPedido) return latestPedido.slice(0, 2000);

  const proposal = opts.proposal && typeof opts.proposal === "object" ? opts.proposal : null;
  const fromProposal = proposal ? String(proposal.intent_summary ?? "").trim() : "";
  if (fromProposal) return fromProposal.slice(0, 2000);

  return "";
}

export function recentUserTexts(history, maxUserMessages = 3) {
  const out = [];
  for (let i = history.length - 1; i >= 0 && out.length < maxUserMessages; i--) {
    const m = history[i];
    if (m?.role !== "user") continue;
    const t = String(m.content ?? "").trim();
    if (!t) continue;
    const norm = t.toLowerCase().replace(/\s+/g, " ");
    if (HIDDEN_USER_LINES.has(norm)) continue;
    if (isPostBriefingCorrectionText(t)) continue;
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

export function looksLikeRawUserCopy(resumo, intent) {
  const r = normalizeLiteText(resumo);
  const i = normalizeLiteText(intent);
  if (!r || !i || i.length < 14) return false;
  if (r === i) return true;
  const chunk = i.slice(0, Math.min(56, i.length));
  return chunk.length >= 14 && r.includes(chunk);
}

/** Resumo do Llama válido para exibir (composição, não cópia do chat nem template de regras). */
export function isUsableModelResumoVisual(resumo, intent) {
  const rv = String(resumo ?? "").trim();
  const it = String(intent ?? "").trim();
  if (!rv || rv.length < 24) return false;
  if (looksLikeRawUserCopy(rv, it)) return false;
  if (/não repetir o pedido do chat|use preço e chamada da promo/i.test(rv)) return false;
  if (/OBRIGATÓRIO na tipografia/i.test(rv) && !/ao lado|destaque|tipográfico/i.test(rv)) {
    return false;
  }
  return true;
}

/**
 * @param {Array<{ role: string, content: string }>} history
 */
export function userTextBlobFromHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter((m) => {
      const content = String(m?.content ?? "").trim();
      return m?.role === "user" && content && !isPanelNoiseMessage("user", content);
    })
    .map((m) => String(m.content).trim())
    .join("\n");
}

/**
 * @param {string} raw
 */
function formatMoneyLabel(raw) {
  const m = String(raw || "").match(/(\d{1,6}(?:[.,]\d{1,2})?)/);
  if (!m) return String(raw || "").trim();
  return m[1].includes(",") || m[1].includes(".") ? m[1] : m[1];
}

/**
 * Extrai preços explícitos do pedido (faixas, de/por, 1 por 99,99 e 2 por 149,99).
 *
 * @param {string} text
 * @returns {{ kind: "tiered" | "pair", display: string, lines: string[] } | null}
 */
export function extractPromoPricing(text) {
  const lower = String(text || "").toLowerCase();

  const decimalPair = lower.match(
    /(\d{1,4}[.,]\d{2})\s+por\s+(?:r\$\s*)?(\d{1,4}[.,]\d{2})/,
  );
  if (decimalPair) {
    const de = formatMoneyLabel(decimalPair[1]);
    const por = formatMoneyLabel(decimalPair[2]);
    const display = `de R$ ${de} por R$ ${por}`;
    return { kind: "pair", display, lines: [display] };
  }

  const dePor =
    lower.match(
      /\bde\s+(?:r\$\s*)?(\d{1,5}(?:[.,]\d{1,2})?)\s+por\s+(?:r\$\s*)?(\d{1,5}(?:[.,]\d{1,2})?)/,
    ) ||
    lower.match(
      /(?:r\$\s*)?(\d{1,5}(?:[.,]\d{1,2})?)\s+reais?\s+para\s+(?:r\$\s*)?(\d{1,5}(?:[.,]\d{1,2})?)/,
    );
  if (dePor) {
    const display = `de R$ ${formatMoneyLabel(dePor[1])} por R$ ${formatMoneyLabel(dePor[2])}`;
    return { kind: "pair", display, lines: [display] };
  }

  const tierMatches = [...lower.matchAll(/(?:^|[\s,;])(\d{1,2})\s+por\s+(?:r\$\s*)?(\d{1,5}(?:[.,]\d{1,2})?)/g)];
  const tiers = tierMatches
    .map((m) => ({ qty: Number(m[1]), price: formatMoneyLabel(m[2]) }))
    .filter((t) => t.qty >= 1 && t.qty <= 9);
  if (tiers.length >= 2 || (tiers.length === 1 && /[.,]\d{1,2}/.test(tiers[0].price))) {
    const lines = tiers.map((t) => `${t.qty} por R$ ${t.price}`);
    return { kind: "tiered", display: lines.join(" | "), lines };
  }

  const simplePor = lower.match(
    /(?:^|[^\d,])(\d{1,2})\s+por\s+(\d{1,2})(?:\s|$|[,.;])(?!\d)/,
  );
  if (simplePor && Number(simplePor[1]) >= 1 && Number(simplePor[1]) <= 9) {
    const display = `de R$ ${simplePor[1]} por R$ ${simplePor[2]}`;
    return { kind: "pair", display, lines: [display] };
  }

  return null;
}

/** @deprecated use extractPromoPricing */
function extractPromoPricePair(text) {
  const pricing = extractPromoPricing(text);
  if (!pricing || pricing.kind !== "pair") return null;
  const m = pricing.display.match(/de R\$\s*([\d.,]+)\s+por R\$\s*([\d.,]+)/i);
  if (!m) return null;
  return { de: m[1], por: m[2] };
}

/**
 * Fatos explícitos do cliente que DEVEM aparecer na arte (preço, ocasião).
 *
 * @param {Array<{ role: string, content: string }>} [history]
 * @param {Record<string, unknown>} [proposal]
 */
export function collectMandatoryImageFacts(history = [], proposal = {}) {
  const blob =
    userTextBlobFromHistory(history) ||
    String(proposal.intent_summary ?? "").trim();
  /** @type {Record<string, string | string[]>} */
  const facts = {};

  const existing =
    proposal.facts_for_image && typeof proposal.facts_for_image === "object"
      ? proposal.facts_for_image
      : {};
  for (const [k, v] of Object.entries(existing)) {
    if (typeof v === "string" && v.trim()) facts[k] = v.trim();
  }

  const pricing = extractPromoPricing(blob);
  if (pricing) {
    facts.precos_promocao = pricing.display;
    facts.precos_linhas = pricing.lines;
  }

  if (/dia\s+dos\s+namorados|\bnamorados\b/i.test(blob) && !facts.ocasiao) {
    facts.ocasiao = "Dia dos Namorados";
  }

  return facts;
}

/**
 * @param {Record<string, string | string[]>} facts
 */
export function formatMandatoryFactsAsComposition(facts) {
  if (!facts || typeof facts !== "object") return "";
  const parts = [];
  if (facts.ocasiao) {
    parts.push(`Ambientação com clima de ${facts.ocasiao}.`);
  }
  const priceLines = Array.isArray(facts.precos_linhas)
    ? facts.precos_linhas.map((x) => String(x))
    : facts.precos_promocao
      ? [String(facts.precos_promocao)]
      : [];
  if (priceLines.length) {
    parts.push(`Destaque tipográfico ao lado do produto com ${priceLines.join(" e ")}.`);
  }
  return parts.join(" ").trim();
}

/**
 * Regras técnicas de tipografia para o prompt do modelo de imagem (não exibir ao cliente).
 * @param {Record<string, string | string[]>} facts
 */
export function formatMandatoryTypographyBlock(facts) {
  if (!facts || typeof facts !== "object") return "";
  const lines = [];
  if (facts.ocasiao) {
    lines.push(`Tema/ocasião pedida pelo cliente: ${facts.ocasiao}.`);
  }
  const priceLines = Array.isArray(facts.precos_linhas)
    ? facts.precos_linhas.map((x) => String(x))
    : facts.precos_promocao
      ? [String(facts.precos_promocao)]
      : [];
  if (priceLines.length) {
    lines.push(
      `OBRIGATÓRIO na tipografia da arte (não omitir): ${priceLines.join("; ")}.`,
    );
  }
  return lines.join(" ").trim();
}

/**
 * @param {string} resumo
 * @param {Array<{ role: string, content: string }>} [history]
 * @param {Record<string, unknown>} [proposal]
 */
export function mergeMandatoryFactsIntoResumo(resumo, history = [], proposal = {}) {
  const base = String(resumo || "").trim();
  const facts = collectMandatoryImageFacts(history, proposal);
  const composition = formatMandatoryFactsAsComposition(facts);
  if (!composition) return base.slice(0, 480);

  const priceNeedle = String(facts.precos_promocao || "");
  if (priceNeedle && base.includes(priceNeedle)) return base.slice(0, 480);
  if (priceNeedle && facts.precos_linhas?.some((line) => base.includes(String(line)))) {
    return base.slice(0, 480);
  }
  if (facts.ocasiao && base.toLowerCase().includes(String(facts.ocasiao).toLowerCase())) {
    const withoutOccasion = composition.replace(
      new RegExp(`Ambientação com clima de ${facts.ocasiao}\\.`, "i"),
      "",
    ).trim();
    if (!withoutOccasion) return base.slice(0, 480);
  }
  if (/Destaque tipográfico ao lado do produto/i.test(base)) return base.slice(0, 480);

  const merged = `${base} ${composition}`.replace(/\s+/g, " ").trim();
  return merged.slice(0, 480);
}

/**
 * @param {Record<string, unknown> | null | undefined} matchedContexto
 * @param {string} intent
 */
function inferCampaignAtmosphere(matchedContexto, intent) {
  if (/queima\s+de\s+estoque|liquida[cç][aã]o/i.test(String(intent || ""))) {
    return "Clima de urgência e queima de estoque, com destaque na oferta.";
  }
  if (intentLooksPromotional(intent)) {
    return "Atmosfera vibrante, com cores de alto contraste para destacar a promoção no feed.";
  }
  const blob = `${matchedContexto?.nome || ""} ${matchedContexto?.tipo_schema || ""} ${intent}`.toLowerCase();
  if (/lancamento|lançamento|novidade|nova linha/i.test(blob)) {
    return "Visual claro e bem iluminado, transmitindo energia e novidade.";
  }
  if (/promo|promoção|desconto|oferta|black\s*friday/i.test(blob)) {
    return "Atmosfera vibrante, com cores de alto contraste para destacar no feed.";
  }
  if (/comemor|natal|namorados|páscoa|anivers/i.test(blob)) {
    return "Clima festivo e acolhedor na ambientação geral.";
  }
  return "Iluminação profissional e fundo limpo, mantendo foco no produto.";
}

/**
 * @param {Record<string, unknown> | null | undefined} matchedContexto
 * @param {string} intent
 * @param {string} heroName
 */
function campaignOpeningLine(matchedContexto, intent, heroName) {
  const productBit = heroName ? ` do ${formatProductDisplayName(heroName)}` : "";
  const modeloNome = String(matchedContexto?.nome || "").trim();
  const modeloNorm = modeloNome.toLowerCase();
  const intentNorm = String(intent || "").toLowerCase();

  if (
    modeloNorm === "produto" ||
    /\bmodelo\s+(?:de\s+)?post\s+de\s+produto\b|\bmodelo\s+de\s+produto\b/.test(intentNorm)
  ) {
    return `Arte de produto para feed do Instagram${productBit}.`;
  }
  if (intentLooksPromotional(intent)) {
    return `Post promocional para feed do Instagram${productBit}.`;
  }
  if (/lancamento|lançamento/i.test(modeloNorm)) {
    return `Arte de lançamento para feed do Instagram${productBit}.`;
  }
  if (/promo|promoção|desconto|oferta/i.test(intentNorm)) {
    return `Post promocional para feed do Instagram${productBit}.`;
  }
  return `Arte de campanha para feed do Instagram${productBit}.`;
}

export function synthesizeResumoVisual(proposal, userHint = "", visualCadastro = null) {
  const p = proposal && typeof proposal === "object" ? proposal : {};
  const intent =
    String(p.intent_summary ?? "").trim() || String(userHint || "").trim();
  const lower = intent.toLowerCase();
  const matched =
    p.matched_contexto && typeof p.matched_contexto === "object" ? p.matched_contexto : null;
  const refs = Array.isArray(p.midias_referenced) ? p.midias_referenced : [];
  const cadastro = visualCadastro && typeof visualCadastro === "object" ? visualCadastro : {};
  const empresaRow = cadastro.empresaRow || null;
  const identidadeDados = cadastro.identidadeDados || null;
  const heroName =
    p.hero_product && typeof p.hero_product === "object"
      ? String(p.hero_product.nome_exibicao ?? "").trim()
      : "";
  const refLabels = refs
    .map((r) => {
      const nome = formatProductDisplayName(r?.nome_exibicao ?? r?.nome_arquivo ?? "");
      return nome;
    })
    .filter(Boolean)
    .slice(0, 3);
  const focusName = formatProductDisplayName(heroName) || refLabels[0] || "";
  const parts = [];
  const explicitScene = extractExplicitSceneFromPedido(intent);

  parts.push(campaignOpeningLine(matched, intent, focusName));

  if (refLabels.length) {
    const pngLabel = refLabels.length === 1 ? refLabels[0] : refLabels.join(", ");
    parts.push(`O PNG do acervo (${pngLabel}) fica centralizado na composição.`);
    const price = extractPromoPricing(intent);
    if (price) {
      parts.push(`Ao lado do produto, destaque tipográfico com ${price.display}.`);
    }
    parts.push("Logo da empresa discretamente em um dos cantos.");
    if (explicitScene) {
      parts.push(`Cenário pedido pelo cliente: ${explicitScene}.`);
    } else {
      parts.push(describeAmbienteFromCadastro(empresaRow, identidadeDados, refs));
    }
  } else {
    const mentions = extractProductMentions(intent);
    if (mentions.length) {
      parts.push(
        `Composição prevista com ${mentions.map((m) => `«${m}»`).join(", ")} em destaque no centro — cadastre o PNG em Mídias para montar a arte.`,
      );
    } else if (/produto|item|servi[cç]o/i.test(lower)) {
      parts.push("Cadastre o PNG do produto em Mídias para completar a composição central.");
    }
    const price = extractPromoPricing(intent);
    if (price) {
      parts.push(`Destaque tipográfico com ${price.display} ao lado da área do produto.`);
    }
    parts.push("Logo da empresa em um dos cantos.");
    if (explicitScene) {
      parts.push(`Cenário pedido pelo cliente: ${explicitScene}.`);
    } else {
      parts.push(describeAmbienteFromCadastro(empresaRow, identidadeDados, refs));
    }
  }

  if (!explicitScene) {
    parts.push(inferCampaignAtmosphere(matched, intent));
  }

  const publicoCadastro = String(identidadeDados?.publico || "").trim();
  if (
    publicoCadastro &&
    isMeaningfulCadastroValue("publico", publicoCadastro) &&
    !parts.some((x) => x.includes(publicoCadastro.slice(0, 20)))
  ) {
    parts.push(`Tom visual para ${publicoCadastro}.`);
  } else if (/academia/i.test(lower)) {
    parts.push("Tom visual direcionado ao público de academias.");
  }

  if (/queima\s+de\s+estoque|liquida[cç][aã]o/i.test(lower)) {
    parts.push("Selo ou clima de urgência para queima de estoque.");
  }

  const explicit = extractFraseFromUserText(intent) || fraseFromProposal(p);
  if (explicit) {
    parts.push(`Texto em destaque na arte: «${explicit}».`);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 480);
}

/**
 * Direção visual para geração só do fundo (PNG do produto entra depois na composição).
 *
 * @param {Record<string, unknown>} proposal
 * @param {string} [userHint]
 */
export function synthesizeComposeSceneResumo(proposal, userHint = "") {
  const p = proposal && typeof proposal === "object" ? proposal : {};
  const intent =
    String(p.intent_summary ?? "").trim() || String(userHint || "").trim();
  const lower = intent.toLowerCase();
  const parts = [];

  if (/promo|desconto|off|%\b|de\s+\d+\s+por\s+\d+|\d+\s+reais?\s+para\s+\d+/i.test(intent)) {
    parts.push("Cenário promocional para feed do Instagram: tipografia, cores e atmosfera energética.");
  } else {
    parts.push("Cenário de campanha para feed do Instagram: clima visual e tipografia da marca.");
  }

  if (/academia/i.test(lower)) parts.push("Público-alvo: academias.");

  const price = extractPromoPricing(intent);
  if (price) {
    parts.push(
      `OBRIGATÓRIO na tipografia: ${price.display} (texto gráfico, não em embalagem).`,
    );
  }

  const refs = Array.isArray(p.midias_referenced) ? p.midias_referenced : [];
  const refNames = refs
    .map((r) => String(r?.nome_exibicao ?? "").trim())
    .filter(Boolean)
    .slice(0, 3);
  const heroName =
    p.hero_product && typeof p.hero_product === "object"
      ? String(p.hero_product.nome_exibicao ?? "").trim()
      : "";

  if (refNames.length) {
    parts.push(
      `Reservar espaço vazio no cenário para colagem posterior de ${refNames.length} PNG real(is) do acervo${heroName ? ` (hero: ${heroName})` : ""}. Não desenhar embalagens nem mockups.`,
    );
  } else {
    const mentions = extractProductMentions(intent);
    if (mentions.length) {
      parts.push(
        `Reservar zona hero para colagem de ${mentions.map((m) => `«${m}»`).join(", ")} quando o PNG estiver no acervo.`,
      );
    }
  }

  const explicit = extractFraseFromUserText(intent) || fraseFromProposal(p);
  if (explicit) {
    parts.push(`Texto gráfico pedido: «${explicit}».`);
  }

  parts.push(
    "Fundo contínuo (gradiente, textura ou piso real); proibido retângulo branco, silhueta de pote ou produto inventado no centro.",
  );
  parts.push(
    "Texto de campanha (títulos, preço, bullets) só no terço superior — nunca no terço inferior onde entram os PNG dos produtos.",
  );

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 480);
}

/**
 * @param {Record<string, unknown> | null | undefined} proposal
 * @param {Array<{ role: string, content: string }>} [history]
 * @param {string} [userHint]
 */
export function buildComposeSceneResumo(proposal, history = [], userHint = "") {
  const p = proposal && typeof proposal === "object" ? proposal : {};
  const intent =
    String(p.intent_summary ?? "").trim() ||
    resolveActivePedidoHint(history, { proposal: p, question: userHint }) ||
    String(userHint || "").trim();
  return mergeMandatoryFactsIntoResumo(
    synthesizeComposeSceneResumo(p, userTextBlobFromHistory(history) || intent || userHint),
    history,
    p,
  );
}

/**
 * Resumo do que a arte deve comunicar (direção visual para o modelo — não o pedido literal).
 *
 * @param {Record<string, unknown> | null | undefined} proposal
 * @param {Array<{ role: string, content: string }>} [history]
 * @param {string} [userHint]
 */
export function buildResumoVisual(proposal, history = [], userHint = "", visualCadastro = null) {
  const p = proposal && typeof proposal === "object" ? proposal : {};
  const intent =
    String(p.intent_summary ?? "").trim() ||
    resolveActivePedidoHint(history, { proposal: p, question: userHint }) ||
    String(userHint || "").trim();

  const fromProposal =
    typeof p.resumo_visual === "string" && p.resumo_visual.trim() ? p.resumo_visual.trim() : "";
  if (fromProposal && isUsableModelResumoVisual(fromProposal, intent)) {
    return mergeMandatoryFactsIntoResumo(fromProposal, history, p);
  }

  const hintBlob = userTextBlobFromHistory(history) || intent || userHint;
  return mergeMandatoryFactsIntoResumo(
    synthesizeResumoVisual(p, hintBlob, visualCadastro),
    history,
    p,
  );
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
