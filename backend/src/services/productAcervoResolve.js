/**
 * Resolução de produto no acervo do tenant.
 * Interpretação (LLM/estado) sugere o candidato; só o cadastro real valida a mídia.
 */

import {
  buildMidiaSearchBlob,
  compactProductKey,
  normalizeProductSearchText,
  scorePhraseAgainstBlob,
} from "./productMentionMatch.js";
import { deriveCreationStateFromHistory, detectProductSubstitution } from "./chatCreationInterpret.js";

/**
 * @typedef {{
 *   nome: string | null,
 *   atributos: string[],
 *   referencia_descritiva: string | null,
 *   confianca: "named" | "descriptive" | "none",
 * }} ProductCandidate
 */

/**
 * @typedef {{
 *   status: "matched" | "ambiguous" | "missing" | "not_requested",
 *   matches: Array<Record<string, unknown>>,
 *   ask?: string,
 *   candidate: ProductCandidate,
 * }} ProductResolveResult
 */

/** Termos de briefing/criativo — nunca viram nome de produto sozinhos. */
const CREATIVE_BRIEFING_TOKENS = new Set([
  "espaco",
  "espacos",
  "chamada",
  "chamadas",
  "lancamento",
  "lancamentos",
  "campanha",
  "campanhas",
  "promocao",
  "promocoes",
  "promo",
  "divulgacao",
  "divulgar",
  "anuncio",
  "anunciar",
  "moderno",
  "moderna",
  "modernos",
  "modernas",
  "chamativo",
  "chamativa",
  "agressiva",
  "agressivo",
  "estetica",
  "estetico",
  "verao",
  "inverno",
  "outono",
  "primavera",
  "vibe",
  "vibes",
  "forte",
  "fortes",
  "esportiva",
  "esportivo",
  "esportivas",
  "esportivos",
  "elementos",
  "elemento",
  "remetam",
  "remeter",
  "colocar",
  "coloca",
  "quero",
  "criar",
  "cria",
  "fazer",
  "faz",
  "arte",
  "post",
  "banner",
  "imagem",
  "foto",
  "destaque",
  "destaques",
  "preco",
  "precos",
  "valor",
  "valores",
  "oferta",
  "estilo",
  "visual",
  "fundo",
  "background",
  "cenario",
  "tema",
  "intencao",
  "composicao",
  "formato",
  "usando",
  "usar",
  "usa",
  "monta",
  "montar",
  "algo",
  "nova",
  "novo",
  "mais",
  "bem",
  "produto",
  "produtos",
  "cadastrada",
  "cadastrado",
  "cadastrados",
  "aquela",
  "aquele",
  "daquela",
  "daquele",
  "essa",
  "esse",
  "esta",
  "este",
  "isto",
  "isso",
  "que",
  "sabor",
  "sabores",
  "variante",
  "variantes",
  "linha",
  "embalagem",
  "em",
  "vez",
  "lugar",
]);

/**
 * Ruído discursivo no nome interpretado (verbos/pronomes) — não é token de produto.
 * Diferente de “token criativo”: some no grounding, mas não prova produto inexistente.
 */
const DISCOURSE_PRODUCT_TOKENS = new Set([
  "usar",
  "usa",
  "usando",
  "quero",
  "monta",
  "montar",
  "faz",
  "fazer",
  "cria",
  "criar",
  "coloca",
  "colocar",
  "poe",
  "bota",
  "esta",
  "este",
  "isto",
  "isso",
  "que",
  "com",
  "para",
  "pra",
  "por",
  "uma",
  "umas",
  "uns",
  "meu",
  "minha",
  "nosso",
  "nossa",
  "pega",
  "pegar",
  "manda",
  "mandar",
  "faz",
  "fazer",
  "deixa",
  "deixar",
  "bota",
  "botar",
  "mas",
  "porem",
  "acabo",
  "acabei",
  "acabou",
  "cadastrar",
  "cadastrei",
  "cadastrou",
]);
/**
 * @returns {ProductCandidate}
 */
export function emptyProductCandidate() {
  return {
    nome: null,
    atributos: [],
    referencia_descritiva: null,
    confianca: "none",
  };
}

/**
 * @param {string} raw
 */
function cleanCandidateText(raw) {
  return normalizeProductSearchText(raw).replace(/\s+/g, " ").trim();
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeProductCandidate(text) {
  return cleanCandidateText(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2)
    .filter((t) => !/^(de|do|da|dos|das|com|por|pra|para|e|ou|a|o|as|os|um|uma|uns|umas)$/.test(t));
}

/**
 * @param {string} token
 */
export function isCreativeBriefingToken(token) {
  const t = cleanCandidateText(token);
  if (!t) return true;
  if (CREATIVE_BRIEFING_TOKENS.has(t)) return true;
  if (DISCOURSE_PRODUCT_TOKENS.has(t)) return true;
  if (/^\d+(?:[.,]\d{1,2})?$/.test(t)) return true;
  return false;
}

/**
 * Token fora do acervo que ainda pode ser nome/código de produto (ex.: «x»).
 * Verbos longos da frase («pega», «manda») não contam — só ruído discursivo.
 * @param {string} token
 */
export function isUnknownProductLikeToken(token) {
  const t = cleanCandidateText(token);
  if (!t) return false;
  if (isCreativeBriefingToken(t)) return false;
  if (DISCOURSE_PRODUCT_TOKENS.has(t)) return false;
  return true;
}

/**
 * Códigos/nomes fora do acervo reivindicados no pedido.
 * - letras/códigos curtos (≤2) em qualquer lugar da mensagem;
 * - tokens após «produto …» até oração relativa/verbo (sem engolir «que acabei de cadastrar»).
 * @param {string} message
 * @param {Set<string>} vocab
 */
function unknownProductLikeTokensInMessage(message, vocab) {
  const shortNoise = new Set([
    "um",
    "uns",
    "na",
    "no",
    "me",
    "se",
    "te",
    "tu",
    "eu",
    "ao",
    "ha",
    "ja",
    "so",
    "ou",
    "ei",
    "ai",
    "ok",
    "ah",
    "oh",
  ]);
  const out = [];
  const seen = new Set();
  const push = (t) => {
    if (!t || seen.has(t) || vocab.has(t) || !isUnknownProductLikeToken(t)) return;
    if (shortNoise.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  for (const t of tokenizeProdutoPedido(message)) {
    if (t.length <= 2) push(t);
  }

  const cleaned = cleanCandidateText(message);
  for (const m of cleaned.matchAll(/\bprodutos?\s+/g)) {
    let rest = cleaned.slice((m.index || 0) + m[0].length).trim();
    // «produto que/qual …» não embute nome logo após «produto».
    if (/^(que|qual)\b/.test(rest)) continue;
    // Corta conjunção / preposição de briefing / verbo de cadastro.
    const chunk = (rest.split(
      /\s+(?:mas|porem|porém|que|qual|cadastr\w*|acab\w*|com|para|pra|na|no|em|por|numa|num)\b/,
    )[0] || "").trim();
    if (!chunk) continue;
    for (const t of tokenizeProdutoPedido(chunk).slice(0, 3)) {
      push(t);
    }
  }
  return out;
}

/**
 * Tokens do produto de origem numa substituição («em vez do whey…»).
 * Não podem virar atributo nem puxar a mídia antiga.
 * @param {string} message
 * @returns {Set<string>}
 */
function substitutionFromTokens(message) {
  const sub = detectProductSubstitution(message);
  if (!sub?.from) return new Set();
  return new Set(tokenizeProdutoPedido(sub.from));
}

/**
 * Destino da substituição expandido com tokens do acervo na mensagem (ex.: creatina + limão).
 * @param {string} message
 * @param {Set<string>} vocab
 */
function expandSubstitutionTarget(message, vocab) {
  const sub = detectProductSubstitution(message);
  if (!sub?.to) return null;
  const toTokens = tokenizeProdutoPedido(sub.to);
  if (!toTokens.length) return null;
  const msgTokens = tokenizeProdutoPedido(message);
  const from = substitutionFromTokens(message);
  const expanded = [...toTokens];
  let sawTo = false;
  for (const t of msgTokens) {
    if (toTokens.includes(t)) {
      sawTo = true;
      continue;
    }
    if (!sawTo) continue;
    if (from.has(t)) continue;
    if (!vocab.has(t)) continue;
    if (isCreativeBriefingToken(t)) continue;
    if (!expanded.includes(t)) expanded.push(t);
    if (expanded.length >= 4) break;
  }
  return expanded.join(" ");
}

/**
 * Vocabulário do tenant: tokens presentes nas mídias cadastradas.
 * @param {Array<Record<string, unknown>>} rows
 * @returns {Set<string>}
 */
export function buildAcervoVocabulary(rows) {
  const vocab = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (String(row?.tipo_midia ?? "").trim().toLowerCase() === "imagem" || !row?.tipo_midia) {
      const blob = buildMidiaSearchBlob(row);
      for (const t of tokenizeProductCandidate(blob)) {
        if (!isCreativeBriefingToken(t)) vocab.add(t);
      }
    }
  }
  return vocab;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
function imageRowsOnly(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const tipo = String(row?.tipo_midia ?? "").trim().toLowerCase();
    return !tipo || tipo === "imagem";
  });
}

/**
 * Tokens do nome pedido (inclui códigos curtos tipo «x»), sem ruído criativo.
 * @param {string} text
 */
function tokenizeProdutoPedido(text) {
  return cleanCandidateText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((t) => !/^(de|do|da|dos|das|com|por|pra|para|e|ou|a|o|as|os|um|uma|uns|umas)$/.test(t))
    .filter((t) => !isCreativeBriefingToken(t));
}

/**
 * @param {string[]} attrs
 * @param {Set<string> | null} vocab
 */
function groundAtributosAgainstVocab(attrs, vocab) {
  const out = [];
  const schemaPlaceholders = new Set([
    "cor",
    "cores",
    "gramatura",
    "variante",
    "variantes",
    "tamanho",
    "tamanhos",
    "atributo",
    "atributos",
    "peso",
    "pesos",
    "etc",
  ]);
  for (const raw of attrs || []) {
    const cleaned = cleanCandidateText(raw);
    if (!cleaned || isCreativeBriefingToken(cleaned)) continue;
    // Placeholder vazado do schema do interpretador — não é atributo real.
    if (/^(cor|gramatura|variante|atributos?|tamanho|peso)(\s*,\s*(cor|gramatura|variante|atributos?|tamanho|peso|etc))*$/i.test(cleaned)) {
      continue;
    }
    const tokens = tokenizeProductCandidate(cleaned).filter((t) => !isCreativeBriefingToken(t));
    if (!tokens.length) continue;
    // Só tokens-placeholder (ex.: "tamanho cor gramatura") → ignora.
    if (tokens.every((t) => schemaPlaceholders.has(t))) continue;
    if (vocab) {
      const ok = tokens.filter((t) => vocab.has(t) && !schemaPlaceholders.has(t));
      if (!ok.length) continue;
      out.push(ok.join(" "));
    } else {
      out.push(tokens.filter((t) => !schemaPlaceholders.has(t)).join(" "));
    }
  }
  return [...new Set(out)].filter(Boolean);
}

/**
 * Converte entidades interpretadas (LLM/estado) em candidato de produto.
 * Não inclui intenção, estilo, preço, cenário, composição ou texto criativo.
 *
 * @param {Record<string, unknown> | null | undefined} entities
 * @param {{ acervoRows?: Array<Record<string, unknown>> }} [opts]
 * @returns {ProductCandidate}
 */
export function toProductCandidate(entities = {}, opts = {}) {
  const e = entities && typeof entities === "object" ? entities : {};
  const rows = Array.isArray(opts.acervoRows) ? opts.acervoRows : null;
  const vocab = rows?.length ? buildAcervoVocabulary(rows) : null;

  const atributosRaw = [];
  if (e.sabor) atributosRaw.push(String(e.sabor));
  if (Array.isArray(e.atributos)) {
    for (const a of e.atributos) {
      if (a) atributosRaw.push(String(a));
    }
  }

  const rawProduto = e.produto != null ? String(e.produto) : "";
  const cleanedProduto = cleanCandidateText(rawProduto);
  const produtoTokens = tokenizeProdutoPedido(cleanedProduto);

  let nome = null;
  if (produtoTokens.length) {
    if (vocab) {
      const grounded = produtoTokens.filter((t) => vocab.has(t));
      const unknown = produtoTokens.filter((t) => !vocab.has(t));
      const productUnknown = unknown.filter((t) => isUnknownProductLikeToken(t));
      // Descarta só ruído discursivo; mantém código/nome fora do acervo (ex.: «x»).
      if (productUnknown.length) {
        nome = [...grounded, ...productUnknown].join(" ");
      } else if (grounded.length) {
        nome = grounded.join(" ");
      }
    } else {
      nome = produtoTokens.filter((t) => !DISCOURSE_PRODUCT_TOKENS.has(t)).join(" ") || null;
    }
  }

  const atributos = groundAtributosAgainstVocab(atributosRaw, vocab);

  let referencia = cleanCandidateText(e.produto_referencia != null ? String(e.produto_referencia) : "");
  if (referencia) {
    const refTokens = tokenizeProdutoPedido(referencia);
    if (!refTokens.length) referencia = "";
    else if (vocab) {
      // Referência descritiva só vale se cruzar o acervo; ruído/instrução do LLM some.
      const grounded = refTokens.filter((t) => vocab.has(t));
      referencia = grounded.length ? grounded.join(" ") : "";
    } else {
      referencia = refTokens.join(" ");
    }
  }

  let confianca = "none";
  if (nome) confianca = "named";
  else if (referencia || atributos.length) confianca = "descriptive";

  return {
    nome: nome || null,
    atributos,
    referencia_descritiva: referencia || null,
    confianca,
  };
}

/**
 * Infere candidato a partir da mensagem cruzada com o vocabulário real do acervo.
 * Só tokens que existem no cadastro do tenant entram no candidato.
 *
 * @param {string} message
 * @param {Array<Record<string, unknown>>} rows
 * @returns {ProductCandidate}
 */
export function inferProductCandidateFromMessage(message, rows) {
  const msg = cleanCandidateText(message);
  const imageRows = imageRowsOnly(rows);
  if (!msg || !imageRows.length) return emptyProductCandidate();

  const vocab = buildAcervoVocabulary(imageRows);
  const fromExclude = substitutionFromTokens(message);
  const msgTokens = tokenizeProductCandidate(msg).filter(
    (t) => !isCreativeBriefingToken(t) && vocab.has(t) && !fromExclude.has(t),
  );
  if (!msgTokens.length) return emptyProductCandidate();

  // Pedido com token fora do acervo (ex.: «produto x») → não inferir outro produto cadastrado.
  if (unknownProductLikeTokensInMessage(message, vocab).length) {
    return emptyProductCandidate();
  }

  /** @type {{ label: string, score: number, hitTokens: string[] } | null} */
  let best = null;
  for (const row of imageRows) {
    const label = cleanCandidateText(
      String(row?.nome_exibicao ?? "").trim() || String(row?.nome_arquivo ?? "").trim(),
    );
    if (!label || label.length < 3) continue;
    const labelTokens = tokenizeProductCandidate(label).filter((t) => !isCreativeBriefingToken(t));
    if (!labelTokens.length) continue;

    let score = 0;
    if (msg.includes(label)) {
      score = 200 + label.length;
    } else {
      const hits = labelTokens.filter((t) => msgTokens.includes(t) || msg.includes(t));
      if (!hits.length) continue;
      const need = labelTokens.length >= 2 ? Math.ceil(labelTokens.length * 0.5) : 1;
      if (hits.length < need) continue;
      score = (hits.length / labelTokens.length) * 100 + hits.join("").length;
    }

    const hitTokens = labelTokens.filter((t) => msgTokens.includes(t) || msg.includes(t));
    if (!best || score > best.score) {
      best = { label, score, hitTokens };
    }
  }

  if (!best || best.score < 40) {
    // Só atributos/tokens soltos do acervo presentes na mensagem.
    return {
      nome: null,
      atributos: msgTokens.slice(0, 4),
      referencia_descritiva: msgTokens.join(" "),
      confianca: "descriptive",
    };
  }

  const attrExtra = msgTokens.filter(
    (t) => !best.hitTokens.includes(t) && !best.label.includes(t) && !fromExclude.has(t),
  );
  return {
    nome: best.hitTokens.length ? best.hitTokens.join(" ") : best.label,
    atributos: attrExtra.slice(0, 4),
    referencia_descritiva: null,
    confianca: "named",
  };
}

/**
 * @param {ProductCandidate} candidate
 * @returns {string[]}
 */
function candidateQueryTokens(candidate) {
  const parts = [];
  if (candidate?.nome) parts.push(candidate.nome);
  for (const a of candidate?.atributos || []) parts.push(a);
  if (candidate?.referencia_descritiva) parts.push(candidate.referencia_descritiva);
  const tokens = [];
  for (const p of parts) {
    for (const t of tokenizeProductCandidate(p)) {
      if (!isCreativeBriefingToken(t)) tokens.push(t);
    }
  }
  return [...new Set(tokens)];
}

/**
 * @param {ProductCandidate} candidate
 * @param {Record<string, unknown>} row
 */
export function scoreCandidateAgainstRow(candidate, row) {
  const blob = buildMidiaSearchBlob(row);
  if (!blob) return 0;

  const nome = cleanCandidateText(candidate?.nome || "");
  const attrs = (candidate?.atributos || []).map(cleanCandidateText).filter(Boolean);
  const ref = cleanCandidateText(candidate?.referencia_descritiva || "");
  const queryTokens = candidateQueryTokens(candidate);
  if (!queryTokens.length && !nome && !ref) return 0;

  let score = 0;
  if (nome) {
    score += scorePhraseAgainstBlob(blob, nome);
  }
  if (ref && ref !== nome) {
    score += Math.floor(scorePhraseAgainstBlob(blob, ref) * 0.85);
  }

  for (const t of queryTokens) {
    if (blob.includes(t)) score += 18 + Math.min(t.length, 12);
    else if (compactProductKey(blob).includes(compactProductKey(t))) score += 12;
  }

  if (attrs.length) {
    let missing = 0;
    let hit = 0;
    for (const attr of attrs) {
      const attrTokens = tokenizeProductCandidate(attr);
      const ok = attrTokens.every(
        (t) => blob.includes(t) || compactProductKey(blob).includes(compactProductKey(t)),
      );
      if (ok) {
        hit += 1;
        score += 40 + attr.length;
      } else missing += 1;
    }
    // Com nome já presente, atributo genérico ausente não pode inverter o ranking.
    const nomeScore = nome ? scorePhraseAgainstBlob(blob, nome) : 0;
    if (missing && !hit) {
      score = nomeScore >= 40 ? Math.floor(score * 0.85) : Math.floor(score * 0.25);
    } else if (missing > 0) {
      score = Math.floor(score * 0.45);
    }
  }

  return score;
}

/**
 * @param {Array<Record<string, unknown>>} matches
 */
export function buildAmbiguousProductAsk(matches) {
  const labels = (matches || [])
    .map((row) => String(row?.nome_exibicao ?? row?.nome_arquivo ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);
  if (!labels.length) {
    return "Encontrei mais de um produto parecido no acervo. Qual deles você quer na arte?";
  }
  return `Encontrei mais de um produto no acervo (${labels.join(", ")}). Qual deles você quer na arte?`;
}

/**
 * @param {ProductCandidate} candidate
 */
export function buildMissingProductAsk(candidate) {
  const label =
    cleanCandidateText(candidate?.nome || "") ||
    cleanCandidateText(candidate?.referencia_descritiva || "") ||
    (candidate?.atributos || []).map(cleanCandidateText).filter(Boolean).join(" ");
  if (label) {
    return `Não encontrei «${label}» em Mídias. Cadastre o PNG do produto e tente de novo.`;
  }
  return "Produto não encontrado em Mídias. Cadastre o PNG e tente de novo.";
}

/**
 * Candidato suficientemente confiável para autorizar matched de mídia.
 * Demonstrativo/vago/só atributo genérico → false (nunca matched por inferência frouxa).
 *
 * @param {ProductCandidate | null | undefined} candidate
 * @param {Array<Record<string, unknown>>} rows
 */
export function isReliableProductMediaCandidate(candidate, rows) {
  const c =
    candidate && typeof candidate === "object" ? candidate : emptyProductCandidate();
  if (c.confianca === "none") return false;

  const nomeTokens = tokenizeProdutoPedido(c.nome || "").filter((t) => !isCreativeBriefingToken(t));
  if (nomeTokens.length) {
    const joined = nomeTokens.join(" ");
    if (
      /^(disso|desse|dessa|daquilo|aquilo|isso|isto|esse|essa|aquele|aquela|outro|outra|novo|nova|segundo|cima)$/.test(
        joined,
      )
    ) {
      return false;
    }
  }

  const vocab = buildAcervoVocabulary(rows);
  const groundedNome = nomeTokens.filter((t) => vocab.has(t));
  if (groundedNome.length >= 1 && groundedNome.some((t) => t.length >= 3)) {
    return true;
  }

  const refToks = tokenizeProdutoPedido(c.referencia_descritiva || "").filter(
    (t) => vocab.has(t) && !isCreativeBriefingToken(t),
  );
  const attrToks = (c.atributos || [])
    .flatMap((a) => tokenizeProdutoPedido(a))
    .filter((t) => vocab.has(t) && !isCreativeBriefingToken(t));
  const groundedDesc = [...new Set([...refToks, ...attrToks])];
  // Descritivo forte: ≥2 tokens do acervo (ex.: cafe+torrado). Uma cor solta não basta.
  return groundedDesc.length >= 2;
}

/**
 * Só label completo do acervo presente na mensagem (menção explícita).
 * @param {string} message
 * @param {Array<Record<string, unknown>>} rows
 * @returns {ProductCandidate}
 */
export function findExplicitAcervoLabelCandidate(message, rows) {
  const msg = cleanCandidateText(message);
  const imageRows = imageRowsOnly(rows);
  if (!msg || !imageRows.length) return emptyProductCandidate();

  /** @type {{ label: string, len: number } | null} */
  let best = null;
  for (const row of imageRows) {
    const label = cleanCandidateText(
      String(row?.nome_exibicao ?? "").trim() || String(row?.nome_arquivo ?? "").trim(),
    );
    if (!label || label.length < 3) continue;
    if (!msg.includes(label)) continue;
    if (!best || label.length > best.len) best = { label, len: label.length };
  }
  if (!best) return emptyProductCandidate();
  return {
    nome: best.label,
    atributos: [],
    referencia_descritiva: null,
    confianca: "named",
  };
}

/**
 * Resolve candidato contra as mídias reais do tenant.
 * 0 → missing | 1 inequívoco → matched | N próximos → ambiguous | sem pedido → not_requested
 *
 * Contrato: sem candidato confiável → never matched (not_requested).
 *
 * @param {ProductCandidate | null | undefined} candidate
 * @param {Array<Record<string, unknown>>} rows
 * @returns {ProductResolveResult}
 */
export function resolveProductFromAcervo(candidate, rows) {
  const c =
    candidate && typeof candidate === "object" ? candidate : emptyProductCandidate();
  const empty = emptyProductCandidate();
  const imageRows = imageRowsOnly(rows);

  if (c.confianca === "none" && !c.nome && !c.atributos?.length && !c.referencia_descritiva) {
    return { status: "not_requested", matches: [], candidate: empty };
  }

  const queryTokens = candidateQueryTokens(c);
  // Inclui tokens curtos do nome (ex.: «x») para detectar pedido fora do acervo.
  const looseNomeTokens = tokenizeProdutoPedido(
    [c.nome, c.referencia_descritiva, ...(c.atributos || [])].filter(Boolean).join(" "),
  );
  if (!queryTokens.length && !looseNomeTokens.length) {
    return { status: "not_requested", matches: [], candidate: c };
  }

  if (!imageRows.length) {
    return {
      status: "missing",
      matches: [],
      candidate: c,
      ask: buildMissingProductAsk(c),
    };
  }

  const vocab = buildAcervoVocabulary(imageRows);
  const absent = looseNomeTokens.filter((t) => !vocab.has(t));
  if (absent.length) {
    return {
      status: "missing",
      matches: [],
      candidate: c,
      ask: buildMissingProductAsk(c),
    };
  }

  // Bloqueador de demo: sem produto confiável não há matched por score frouxo.
  if (!isReliableProductMediaCandidate(c, imageRows)) {
    return { status: "not_requested", matches: [], candidate: c };
  }

  const scored = imageRows
    .map((row) => ({ row, score: scoreCandidateAgainstRow(c, row) }))
    .filter((item) => item.score >= 45)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return {
      status: "missing",
      matches: [],
      candidate: c,
      ask: buildMissingProductAsk(c),
    };
  }

  const top = scored[0];
  const close = scored.filter((item) => item.score >= top.score * 0.82);
  const distinct = [];
  const seen = new Set();
  for (const item of close) {
    const id = String(item.row?.id_midia ?? item.row?.id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    distinct.push(item.row);
  }

  if (distinct.length === 1) {
    return { status: "matched", matches: [distinct[0]], candidate: c };
  }

  // Um claro vencedor se a 2ª estiver bem atrás.
  if (scored.length >= 2 && top.score >= scored[1].score * 1.35) {
    return { status: "matched", matches: [top.row], candidate: c };
  }

  if (distinct.length > 1) {
    return {
      status: "ambiguous",
      matches: distinct.slice(0, 5),
      candidate: c,
      ask: buildAmbiguousProductAsk(distinct),
    };
  }

  return { status: "matched", matches: [top.row], candidate: c };
}

/**
 * Candidato efetivo para criação: entidades interpretadas, senão label explícito no acervo.
 * Sem produto confiável → não infere mídia por bag-of-words.
 *
 * @param {{
 *   entities?: Record<string, unknown> | null,
 *   message?: string,
 *   midiaRows?: Array<Record<string, unknown>>,
 *   stateProduto?: string | null,
 * }} input
 * @returns {ProductCandidate}
 */
export function buildCreationProductCandidate(input = {}) {
  const rows = Array.isArray(input.midiaRows) ? input.midiaRows : [];
  const message = String(input.message || "").trim();
  const vocab = rows.length ? buildAcervoVocabulary(rows) : new Set();
  const fromExclude = substitutionFromTokens(message);
  const stateProduto = String(input.stateProduto || "").trim();

  /** @type {Record<string, unknown>} */
  let entities =
    input.entities && typeof input.entities === "object" ? { ...input.entities } : {};

  // Substituição: candidato = destino no acervo; origem não entra como atributo.
  const expandedTo = message && vocab.size ? expandSubstitutionTarget(message, vocab) : null;
  if (expandedTo) {
    entities.produto = expandedTo;
    const attrs = Array.isArray(entities.atributos) ? entities.atributos : [];
    entities.atributos = attrs.filter((a) => {
      const toks = tokenizeProdutoPedido(String(a || ""));
      return toks.length && !toks.some((t) => fromExclude.has(t));
    });
    if (entities.sabor && fromExclude.has(cleanCandidateText(String(entities.sabor)))) {
      entities.sabor = null;
    }
  }

  // Token fora do acervo na mensagem (ex.: «x») não pode sumir só porque o estado ficou «chocolate».
  if (message && vocab.size) {
    const unknowns = unknownProductLikeTokensInMessage(message, vocab);
    if (unknowns.length) {
      const baseTokens = tokenizeProdutoPedido(String(entities.produto || ""));
      entities.produto = [...new Set([...baseTokens, ...unknowns])].join(" ");
    }
  }

  let fromEntities = toProductCandidate(entities, { acervoRows: rows });
  // Remove atributos herdados do produto substituído.
  if (fromExclude.size && fromEntities.atributos?.length) {
    fromEntities.atributos = fromEntities.atributos.filter((a) => {
      const toks = tokenizeProdutoPedido(a);
      return toks.length && !toks.some((t) => fromExclude.has(t));
    });
  }

  // Follow-up: mensagem sem produto confiável → herda produto do estado acumulado.
  if (
    !expandedTo &&
    stateProduto &&
    !isReliableProductMediaCandidate(fromEntities, rows) &&
    !unknownProductLikeTokensInMessage(message, vocab).length
  ) {
    const inherited = toProductCandidate(
      { ...entities, produto: stateProduto },
      { acervoRows: rows },
    );
    if (isReliableProductMediaCandidate(inherited, rows)) {
      fromEntities = inherited;
    }
  }

  if (fromEntities.confianca !== "none") {
    const probe = resolveProductFromAcervo(fromEntities, rows);
    const completePrefer = () => {
      if (!message || !rows.length) return null;
      if (unknownProductLikeTokensInMessage(message, vocab).length) return null;
      const complete = inferCompleteLabelCandidateFromMessage(message, rows);
      if (complete.confianca === "none") return null;
      const entToks = tokenizeProdutoPedido(fromEntities.nome || "");
      const compToks = tokenizeProdutoPedido(complete.nome || "");
      // Label completo na mensagem é mais específico que entities parciais («camiseta» vs «camiseta preta»).
      if (compToks.length <= entToks.length) return null;
      const cProbe = resolveProductFromAcervo(complete, rows);
      if (cProbe.status === "matched" || cProbe.status === "ambiguous") return complete;
      return null;
    };

    // Só aceita matched de entities se o nome estiver sustentado pela mensagem (anti-alucinação).
    if (probe.status === "matched" && candidateNomeGroundedInMessage(fromEntities, message)) {
      return completePrefer() || fromEntities;
    }
    // Pedido explícito fora do acervo → não “salvar” com inferência de outro produto.
    if (probe.status === "missing" && (fromEntities.nome || unknownsKeep(fromEntities, vocab))) {
      if (candidateNomeGroundedInMessage(fromEntities, message) || unknownsKeep(fromEntities, vocab)) {
        return fromEntities;
      }
    }
    if (probe.status === "ambiguous" && candidateNomeGroundedInMessage(fromEntities, message)) {
      return completePrefer() || fromEntities;
    }
  }

  // CONTRATO: menção completa ao label (ordem livre / com preposição), sem bag-of-words frouxo.
  if (message && rows.length && !unknownProductLikeTokensInMessage(message, vocab).length) {
    const explicit = findExplicitAcervoLabelCandidate(message, rows);
    if (explicit.confianca !== "none" && isReliableProductMediaCandidate(explicit, rows)) {
      return explicit;
    }
    const complete = inferCompleteLabelCandidateFromMessage(message, rows);
    if (complete.confianca !== "none" && isReliableProductMediaCandidate(complete, rows)) {
      const probe = resolveProductFromAcervo(complete, rows);
      if (probe.status === "matched" || probe.status === "ambiguous") {
        return complete;
      }
    }
    const shared = inferSharedAcervoTokenCandidate(message, rows);
    if (shared.confianca !== "none" && isReliableProductMediaCandidate(shared, rows)) {
      return shared;
    }
  }

  return fromEntities;
}

/**
 * Token do acervo na mensagem que cobre 1 ou N labels (único → matched; vários → ambiguous).
 * Exige token com ≥4 chars presente no vocabulário — não usa criativo.
 *
 * @param {string} message
 * @param {Array<Record<string, unknown>>} rows
 * @returns {ProductCandidate}
 */
export function inferSharedAcervoTokenCandidate(message, rows) {
  const msg = cleanCandidateText(message);
  const imageRows = imageRowsOnly(rows);
  if (!msg || !imageRows.length) return emptyProductCandidate();
  const vocab = buildAcervoVocabulary(imageRows);
  const msgTokens = [
    ...new Set(
      tokenizeProductCandidate(msg).filter(
        (t) => !isCreativeBriefingToken(t) && vocab.has(t) && t.length >= 4,
      ),
    ),
  ];
  if (!msgTokens.length) return emptyProductCandidate();

  /** @type {{ token: string, count: number }[]} */
  const ranked = [];
  for (const token of msgTokens) {
    let count = 0;
    for (const row of imageRows) {
      const label = cleanCandidateText(
        String(row?.nome_exibicao ?? "").trim() || String(row?.nome_arquivo ?? "").trim(),
      );
      const labelTokens = tokenizeProductCandidate(label);
      if (labelTokens.includes(token)) count += 1;
    }
    if (count >= 1) ranked.push({ token, count });
  }
  if (!ranked.length) return emptyProductCandidate();

  // Preferir token que aparece em mais de um label (ambiguidade real) ou o único inequívoco.
  ranked.sort((a, b) => {
    if (a.count === 1 && b.count !== 1) return -1;
    if (b.count === 1 && a.count !== 1) return 1;
    if (a.count !== b.count) return b.count - a.count;
    return b.token.length - a.token.length;
  });

  const uniques = ranked.filter((r) => r.count === 1);
  const multis = ranked.filter((r) => r.count >= 2);
  const pick = uniques[0] || multis[0];
  if (!pick) return emptyProductCandidate();

  return {
    nome: pick.token,
    atributos: [],
    referencia_descritiva: null,
    confianca: "named",
  };
}

/**
 * Infere candidato só quando TODOS os tokens do nome_exibicao aparecem na mensagem.
 * Evita matched por 1 token genérico («azul», «bonita»).
 *
 * @param {string} message
 * @param {Array<Record<string, unknown>>} rows
 * @returns {ProductCandidate}
 */
export function inferCompleteLabelCandidateFromMessage(message, rows) {
  const msg = cleanCandidateText(message);
  const imageRows = imageRowsOnly(rows);
  if (!msg || !imageRows.length) return emptyProductCandidate();

  /** @type {{ label: string, hitTokens: string[], score: number }[]} */
  const scored = [];
  for (const row of imageRows) {
    const label = cleanCandidateText(
      String(row?.nome_exibicao ?? "").trim() || String(row?.nome_arquivo ?? "").trim(),
    );
    if (!label || label.length < 3) continue;
    const labelTokens = tokenizeProductCandidate(label).filter((t) => !isCreativeBriefingToken(t));
    if (!labelTokens.length) continue;

    if (msg.includes(label)) {
      scored.push({ label, hitTokens: labelTokens, score: 200 + label.length });
      continue;
    }
    const hits = labelTokens.filter((t) => msg.includes(t));
    if (hits.length < labelTokens.length) continue;
    scored.push({
      label,
      hitTokens: hits,
      score: 100 + hits.join("").length,
    });
  }

  if (!scored.length) return emptyProductCandidate();
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  return {
    nome: top.hitTokens.join(" "),
    atributos: [],
    referencia_descritiva: null,
    confianca: "named",
  };
}

function unknownsKeep(candidate, vocab) {
  const toks = tokenizeProdutoPedido(
    [candidate?.nome, candidate?.referencia_descritiva, ...(candidate?.atributos || [])]
      .filter(Boolean)
      .join(" "),
  );
  return toks.some((t) => isUnknownProductLikeToken(t) && !vocab.has(t));
}

/**
 * Nome do candidato precisa aparecer na mensagem (ou mensagem vazia = herança de estado).
 * @param {ProductCandidate} candidate
 * @param {string} message
 */
function candidateNomeGroundedInMessage(candidate, message) {
  const msg = cleanCandidateText(message);
  if (!msg) return true;
  const nomeTokens = tokenizeProdutoPedido(candidate?.nome || "").filter((t) => t.length >= 3);
  if (!nomeTokens.length) {
    // Só descritivo: atributos/ref também precisam de algum token na mensagem.
    const extra = [
      ...tokenizeProdutoPedido(candidate?.referencia_descritiva || ""),
      ...(candidate?.atributos || []).flatMap((a) => tokenizeProdutoPedido(a)),
    ].filter((t) => t.length >= 3);
    if (!extra.length) return true;
    return extra.some((t) => msg.includes(t));
  }
  return nomeTokens.some((t) => msg.includes(t));
}

/**
 * Mensagem do usuário ativa (não o hint composto de briefing).
 * @param {Array<{ role?: string, content?: string }>} history
 * @param {string} [fallback]
 */
export function pickCreationUserMessage(history, fallback = "") {
  const msgs = Array.isArray(history) ? history : [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.role !== "user") continue;
    const t = String(msgs[i]?.content ?? "").trim();
    if (t) return t;
  }
  const fb = String(fallback || "").trim();
  // Hint composto ("a · b · c") não é mensagem natural.
  if (fb && !/\s·\s/.test(fb)) return fb;
  return "";
}

/**
 * Várias mídias distintas claramente citadas na mensagem (ex.: três sabores).
 * @param {string} message
 * @param {Array<Record<string, unknown>>} rows
 * @returns {Array<Record<string, unknown>>}
 */
export function collectMentionedAcervoRows(message, rows) {
  const msg = cleanCandidateText(message);
  const imageRows = imageRowsOnly(rows);
  if (!msg || !imageRows.length) return [];

  const scored = [];
  for (const row of imageRows) {
    const label = cleanCandidateText(
      String(row?.nome_exibicao ?? "").trim() || String(row?.nome_arquivo ?? "").trim(),
    );
    if (!label || label.length < 3) continue;
    const labelTokens = tokenizeProductCandidate(label).filter((t) => !isCreativeBriefingToken(t));
    if (!labelTokens.length) continue;

    let score = 0;
    if (msg.includes(label)) {
      score = 200 + label.length;
    } else {
      const hits = labelTokens.filter((t) => msg.includes(t));
      if (!hits.length) continue;
      // Linhas com 2+ tokens: exige quase todos (evita “pro force” puxar todos os sabores).
      const need =
        labelTokens.length >= 3
          ? labelTokens.length
          : labelTokens.length >= 2
            ? Math.ceil(labelTokens.length * 0.85)
            : 1;
      if (hits.length < need) continue;
      const discriminative = hits.filter((t) => t.length >= 4);
      if (labelTokens.length >= 2 && discriminative.length < 1) continue;
      score = (hits.length / labelTokens.length) * 100 + discriminative.join("").length;
    }
    if (score >= 55) scored.push({ row, score, label });
  }

  scored.sort((a, b) => b.score - a.score);
  if (scored.length < 2) return [];

  // Só multi se houver ≥2 com score próximo do topo (pedido conjunto, não ruído).
  const top = scored[0].score;
  const cluster = scored.filter((s) => s.score >= top * 0.55 && s.score >= 55);
  if (cluster.length < 2) return [];

  const out = [];
  const seen = new Set();
  for (const item of cluster) {
    const id = String(item.row?.id_midia ?? item.row?.id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item.row);
  }
  return out.slice(0, 5);
}

/**
 * Gate de mídia na criação: candidato interpretado → só acervo do tenant.
 * Não usa hint composto / bag-of-words da mensagem criativa.
 *
 * @param {Record<string, unknown>} proposal
 * @param {Array<Record<string, unknown>>} midiaRows
 * @param {string} userHint
 * @param {Array<{ role: string, content: string }>} [history]
 * @param {{ entities?: Record<string, unknown> | null }} [opts]
 */
export function applyProductMediaGate(proposal, midiaRows, userHint, history = [], opts = {}) {
  const message = pickCreationUserMessage(history, userHint);
  const state = deriveCreationStateFromHistory(history || [], message);

  // Pedido com vários produtos/sabores distintos no acervo.
  // Substituição («em vez de…») não é pedido multi — resolve um só.
  const substituting = Boolean(detectProductSubstitution(message));
  const multi = substituting ? [] : collectMentionedAcervoRows(message, midiaRows);
  if (multi.length >= 2) {
    let p = proposal && typeof proposal === "object" ? { ...proposal } : {};
    p.midias_referenced = multi.slice(0, 3).map((row) => ({
      id_midia: String(row.id_midia ?? row.id ?? "").trim(),
      nome_exibicao: String(row.nome_exibicao ?? row.nome_arquivo ?? "Mídia").trim() || "Mídia",
      nome_arquivo: String(row.nome_arquivo ?? "").trim() || undefined,
      why: "PNG do acervo citado no pedido.",
    }));
    const hero = multi[0];
    p.hero_product = hero
      ? {
          id_midia: String(hero.id_midia ?? hero.id ?? "").trim(),
          nome_exibicao: String(hero.nome_exibicao ?? hero.nome_arquivo ?? "Mídia").trim() || "Mídia",
          why: "Produto principal entre os citados.",
        }
      : null;
    p.products_requested = p.midias_referenced.map((m) => m.nome_exibicao);
    p.product_media_status = "matched";
    if (!p.facts_for_image || typeof p.facts_for_image !== "object") {
      p.facts_for_image = {};
    }
    p.facts_for_image.produto_resolvido = p.midias_referenced[0]?.nome_exibicao || null;
    return { proposal: p, blocked: false };
  }

  const optsEntities =
    opts && typeof opts === "object" && opts.entities && typeof opts.entities === "object"
      ? opts.entities
      : null;

  /** @type {Record<string, unknown>} */
  const entities = optsEntities
    ? {
        produto: optsEntities.produto ?? null,
        sabor: optsEntities.sabor ?? null,
        atributos: Array.isArray(optsEntities.atributos) ? optsEntities.atributos : [],
        produto_referencia: optsEntities.produto_referencia ?? null,
      }
    : {
        produto: state.produto || null,
        sabor: state.sabor || null,
        atributos: state.sabor ? [state.sabor] : [],
        produto_referencia: null,
      };

  // Substituição: estado antigo (ex.: whey) não vence o destino interpretado.
  if (substituting) {
    const vocab = buildAcervoVocabulary(midiaRows);
    const expanded = expandSubstitutionTarget(message, vocab);
    if (expanded) {
      entities.produto = expanded;
      entities.produto_referencia = null;
    }
  }

  const candidate = buildCreationProductCandidate({
    entities,
    message,
    midiaRows,
    stateProduto: state.produto || null,
  });
  const resolved = resolveProductFromAcervo(candidate, midiaRows);

  let p = proposal && typeof proposal === "object" ? { ...proposal } : {};

  if (resolved.status === "not_requested") {
    p.product_media_status = "not_requested";
    return { proposal: p, blocked: false };
  }

  if (resolved.status === "ambiguous") {
    p.midias_referenced = [];
    p.hero_product = null;
    p.products_requested = (resolved.matches || []).map((row) =>
      String(row?.nome_exibicao ?? row?.nome_arquivo ?? "").trim(),
    );
    p.product_media_status = "ambiguous";
    p.frase_na_imagem = "";
    if (p.facts_for_image && typeof p.facts_for_image === "object") {
      delete p.facts_for_image.frase_na_imagem;
    }
    return {
      proposal: p,
      blocked: true,
      confirmation_message: resolved.ask || "Qual produto do acervo você quer na arte?",
      missing_slots: ["midia_acervo"],
    };
  }

  if (resolved.status === "missing") {
    p.midias_referenced = [];
    p.hero_product = null;
    p.products_requested = [
      candidate.nome || candidate.referencia_descritiva || (candidate.atributos || []).join(" "),
    ].filter(Boolean);
    p.product_media_status = "missing";
    p.frase_na_imagem = "";
    if (p.facts_for_image && typeof p.facts_for_image === "object") {
      delete p.facts_for_image.frase_na_imagem;
    }
    return {
      proposal: p,
      blocked: true,
      confirmation_message: resolved.ask || buildMissingProductAsk(candidate),
      missing_slots: ["midia_acervo"],
    };
  }

  const matches = resolved.matches || [];
  p.midias_referenced = matches.slice(0, 3).map((row) => ({
    id_midia: String(row.id_midia ?? row.id ?? "").trim(),
    nome_exibicao: String(row.nome_exibicao ?? row.nome_arquivo ?? "Mídia").trim() || "Mídia",
    nome_arquivo: String(row.nome_arquivo ?? "").trim() || undefined,
    why: "PNG do acervo resolvido a partir do produto interpretado.",
  }));
  const hero = matches[0];
  p.hero_product = hero
    ? {
        id_midia: String(hero.id_midia ?? hero.id ?? "").trim(),
        nome_exibicao: String(hero.nome_exibicao ?? hero.nome_arquivo ?? "Mídia").trim() || "Mídia",
        why: "Produto principal resolvido no acervo.",
      }
    : null;
  p.products_requested = p.midias_referenced.map((m) => m.nome_exibicao);
  p.product_media_status = "matched";
  if (!p.facts_for_image || typeof p.facts_for_image !== "object") {
    p.facts_for_image = {};
  }
  p.facts_for_image.produto_resolvido = p.midias_referenced[0]?.nome_exibicao || null;

  return { proposal: p, blocked: false };
}
