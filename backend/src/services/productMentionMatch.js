/**
 * Vincula produtos do acervo ao que o cliente citou no pedido (ex.: "monster" ≠ "pro force morango").
 */


const PRODUCT_MENTION_STOP = new Set([
  "com",
  "para",
  "uma",
  "uns",
  "umas",
  "arte",
  "post",
  "postagem",
  "foto",
  "quero",
  "usar",
  "sera",
  "seria",
  "mais",
  "muito",
  "promo",
  "promocao",
  "promocional",
  "dia",
  "dos",
  "das",
  "de",
  "do",
  "da",
  "e",
  "ou",
  "na",
  "no",
  "em",
  "por",
  "pra",
  "fazer",
  "faca",
  "faça",
  "bem",
  "so",
  "só",
  "que",
  "temos",
  "tem",
  "reais",
  "real",
  "chamativo",
  "chamativa",
  "academia",
  "academias",
  "somente",
  "apenas",
  "sobre",
  "tipo",
  "essa",
  "esse",
  "isso",
  "aqui",
  "agora",
  "hoje",
]);

/** Marcas / linhas comuns (multi-palavra primeiro). */
const BRAND_PHRASE_PATTERNS = [
  /\bpro\s*force\b/gi,
  /\bmonster(?:\s+energy)?\b/gi,
  /\bblack\s*skull\b/gi,
  /\bintegral\s*medica\b/gi,
  /\bgrowth\s*supplements?\b/gi,
  /\bmax\s*titanium\b/gi,
  /\bdark\s*lab\b/gi,
  /\boptimum\s*nutrition\b/gi,
  /\bdux\s*nutrition\b/gi,
];

export function normalizeProductSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function buildMidiaSearchBlob(row) {
  return normalizeProductSearchText(
    `${row?.nome_exibicao ?? ""} ${row?.nome_arquivo ?? ""} ${row?.descricao ?? ""} ${row?.alt_text ?? ""}`,
  );
}

/**
 * Termos de produto explícitos no pedido do cliente.
 * @param {string} userHint
 * @returns {string[]}
 */
export function extractProductMentions(userHint) {
  const hint = normalizeProductSearchText(userHint);
  const mentions = new Set();

  for (const re of BRAND_PHRASE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(hint)) !== null) {
      const term = normalizeProductSearchText(m[0]).replace(/\s+/g, " ").trim();
      if (term.length >= 3) mentions.add(term);
    }
  }

  const tokens = [...new Set(hint.match(/[a-z0-9]+/g) || [])].filter(
    (token) => token.length >= 4 && !PRODUCT_MENTION_STOP.has(token),
  );
  for (const token of tokens) {
    mentions.add(token);
  }

  return [...mentions];
}

/**
 * @param {Record<string, unknown>} row
 * @param {string[]} mentions
 */
export function scoreRowProductMention(row, mentions) {
  if (!mentions?.length) return 0;
  const blob = buildMidiaSearchBlob(row);
  if (!blob.trim()) return 0;

  let score = 0;
  for (const term of mentions) {
    const t = normalizeProductSearchText(term).replace(/\s+/g, " ").trim();
    if (!t) continue;

    if (t.includes(" ") && blob.includes(t)) {
      score += 120 + t.length;
      continue;
    }

    if (blob.includes(t)) {
      score += 80 + Math.min(20, t.length);
      continue;
    }

    if (t.length >= 5 && !t.endsWith("s") && blob.includes(`${t}s`)) {
      score += 70 + t.length;
      continue;
    }
    if (t.endsWith("s") && t.length >= 5) {
      const singular = t.slice(0, -1);
      if (blob.includes(singular)) {
        score += 70 + singular.length;
        continue;
      }
    }

    if (t.length >= 6) {
      const stem = t.slice(0, Math.max(5, Math.floor(t.length * 0.75)));
      if (stem.length >= 5 && blob.includes(stem)) {
        score += 35;
      }
    }
  }
  return score;
}

/**
 * @param {Array<Record<string, unknown>>} imageRows
 * @param {string} userHint
 * @param {number} [minScore]
 */
export function narrowImageRowsByProductMention(imageRows, userHint, minScore = 35) {
  const rows = Array.isArray(imageRows) ? imageRows : [];
  const mentions = extractProductMentions(userHint);
  if (!mentions.length) {
    return { pool: rows, mentions, strict: false };
  }
  const pool = rows.filter((row) => scoreRowProductMention(row, mentions) >= minScore);
  return { pool, mentions, strict: true };
}

/**
 * @param {string[]} mentions
 */
export function buildMissingProductMediaMessage(mentions) {
  const labels = (mentions || []).slice(0, 3).map((m) => `«${m}»`).join(", ");
  const mais = mentions.length > 3 ? ` (+${mentions.length - 3})` : "";
  return (
    `Não encontrei ${labels}${mais} no acervo de Mídias desta empresa. ` +
    `Para montar a arte com o produto certo, cadastre a foto em Painel → Mídias ` +
    `(nome do arquivo ou título parecido com o que você pediu) e volte ao chat. ` +
    `Se o produto ainda não existir, envie a embalagem/foto primeiro ou peça uma arte só com texto e cenário.`
  );
}

/**
 * @param {string} userHint
 * @param {Array<Record<string, unknown>>} midiaRows
 */
export function checkProductMediaAvailability(userHint, midiaRows) {
  const mentions = extractProductMentions(userHint);
  if (!mentions.length) {
    return { strict: false, mentions: [], matchedRows: [], missing: false };
  }
  const imageRows = (Array.isArray(midiaRows) ? midiaRows : []).filter(
    (row) => String(row.tipo_midia ?? "").trim().toLowerCase() === "imagem",
  );
  const { pool, strict } = narrowImageRowsByProductMention(imageRows, userHint);
  return {
    strict,
    mentions,
    matchedRows: pool,
    missing: strict && pool.length === 0,
  };
}

/**
 * Remove referências que não batem com o produto pedido; tenta auto-match no acervo.
 *
 * @param {Record<string, unknown>} proposal
 * @param {Array<Record<string, unknown>>} midiaRows
 * @param {string} userHint
 * @returns {Record<string, unknown>}
 */
export function reconcileProposalMidias(proposal, midiaRows, userHint) {
  const p = proposal && typeof proposal === "object" ? { ...proposal } : {};
  const mentions = extractProductMentions(userHint);
  if (!mentions.length) return p;

  const rows = Array.isArray(midiaRows) ? midiaRows : [];
  const byId = new Map(rows.map((r) => [String(r.id_midia ?? "").trim(), r]));
  const rawRefs = Array.isArray(p.midias_referenced) ? p.midias_referenced : [];

  const kept = rawRefs.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const id = typeof item.id_midia === "string" ? item.id_midia.trim() : "";
    const row = id ? byId.get(id) : null;
    if (!row) return false;
    return scoreRowProductMention(row, mentions) >= 35;
  });

  if (kept.length) {
    p.midias_referenced = kept.slice(0, 3);
    return p;
  }

  const { pool } = narrowImageRowsByProductMention(
    rows.filter((r) => String(r.tipo_midia ?? "").trim().toLowerCase() === "imagem"),
    userHint,
  );
  const sorted = pool
    .map((row) => ({ row, score: scoreRowProductMention(row, mentions) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  p.midias_referenced = sorted.map(({ row, score }) => ({
    id_midia: String(row.id_midia ?? "").trim(),
    nome_exibicao: String(row.nome_exibicao ?? row.nome_arquivo ?? "Mídia").trim() || "Mídia",
    why:
      score >= 35
        ? `Acervo: nome/arquivo contém "${mentions.slice(0, 2).join('" / "')}" como no pedido.`
        : "Referência alinhada ao pedido.",
  }));

  return p;
}

/**
 * @param {Record<string, unknown>} proposal
 * @param {Array<Record<string, unknown>>} midiaRows
 * @param {string} userHint
 * @param {Array<{ role: string, content: string }>} [history]
 */
export function applyProductMediaGate(proposal, midiaRows, userHint, history = []) {
  let p = reconcileProposalMidias(proposal, midiaRows, userHint);
  const check = checkProductMediaAvailability(userHint, midiaRows);

  if (!check.missing) {
    p.product_media_status = check.mentions.length ? "matched" : "not_requested";
    if (check.mentions.length) p.products_requested = check.mentions;
    return { proposal: p, blocked: false };
  }

  p.midias_referenced = [];
  p.hero_product = null;
  p.products_requested = check.mentions;
  p.product_media_status = "missing";
  p.frase_na_imagem = "";
  if (p.facts_for_image && typeof p.facts_for_image === "object") {
    delete p.facts_for_image.frase_na_imagem;
  }

  return {
    proposal: p,
    blocked: true,
    confirmation_message: buildMissingProductMediaMessage(check.mentions),
    missing_slots: ["midia_acervo"],
  };
}
