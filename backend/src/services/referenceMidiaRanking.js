/**
 * Ordena mídias para `image_prompt`: produto/recorte PNG primeiro; arte/post pronto por último.
 */

import { wantsLogoAsHero } from "./logoReferencePolicy.js";

const PRODUCT_HINT =
  /oculos|óculos|arma(c|ç)(a|ã)o|lente|produto|whey|creatina|suplement|png|recorte|isolad|transparent|packshot|pote|embalagem/i;
const POST_ART_HINT =
  /post|feed|banner|flyer|arte|comemor|400\s*k|500\s*k|seguidor|festa|natal|p[aá]scoa|black\s*friday|template|card|stories|reels|marco|milestone|somos/i;
const FOCUS_HINT =
  /foco principal|principal|produto principal|item principal|hero|destaque principal|mais em evid[eê]ncia|em foco|ao centro|no centro|centro|no meio|meio/i;
const GENERIC_PRODUCT_WORDS = new Set([
  "creatina",
  "whey",
  "suplemento",
  "suplementar",
  "alimentar",
  "monohidratada",
  "monohidratado",
  "po",
  "pote",
  "embalagem",
  "produto",
  "integralmedica",
  "integralmedicao",
  "nutricao",
  "nutrition",
]);

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRowSearchBlob(row) {
  return normalizeSearchText(
    `${row.nome_exibicao ?? ""} ${row.nome_arquivo ?? ""} ${row.descricao ?? ""} ${row.alt_text ?? ""}`,
  );
}

function buildSpecificRowTerms(row) {
  const blob = buildRowSearchBlob(row);
  const tokens = [...new Set(blob.match(/[a-z0-9]+/g) || [])].filter(
    (token) => token.length >= 3 && !GENERIC_PRODUCT_WORDS.has(token),
  );
  const phrases = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const phrase = `${tokens[i]} ${tokens[i + 1]}`;
    if (phrase.length >= 7) phrases.push(phrase);
  }
  return [...new Set([...phrases, ...tokens])];
}

function scoreExplicitHeroMatch(row, userHint) {
  const hint = normalizeSearchText(userHint);
  if (!hint.trim()) return 0;
  const hasFocusHint = FOCUS_HINT.test(hint);
  const terms = buildSpecificRowTerms(row);
  if (!terms.length) return 0;
  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    const focusRe = new RegExp(
      `(?:${escapeRegex(term)}).{0,36}(?:foco principal|principal|hero|destaque|evidencia|em foco|centro|meio)|(?:foco principal|principal|hero|destaque|evidencia|em foco|centro|meio).{0,36}(?:${escapeRegex(term)})`,
      "i",
    );
    if (focusRe.test(hint)) {
      score = Math.max(score, 240 + term.length);
      continue;
    }
    if (hasFocusHint && hint.includes(term)) {
      score = Math.max(score, 140 + term.length);
      continue;
    }
    if (term.includes(" ") && hint.includes(term)) {
      score = Math.max(score, 70 + term.length);
      continue;
    }
    if (hint.includes(term)) {
      score += 12 + Math.min(12, term.length);
    }
  }
  return score;
}

/**
 * @param {Record<string, unknown>} row
 */
function scoreMidiaRow(row, userHint, logoId = "") {
  const id = String(row.id_midia ?? "").trim();
  const nome = `${row.nome_exibicao ?? ""} ${row.nome_arquivo ?? ""} ${row.descricao ?? ""} ${row.alt_text ?? ""}`;
  const ext = String(row.extensao ?? row.nome_arquivo ?? "").toLowerCase();
  const mime = String(row.formato_arquivo ?? "").toLowerCase();
  const blob = `${nome} ${userHint}`.toLowerCase();

  let score = 0;
  if (logoId && id === logoId) {
    if (wantsLogoAsHero(userHint)) score += 50;
    else score -= 95;
  }
  if (mime.includes("png") || ext.endsWith(".png")) score += 40;
  if (PRODUCT_HINT.test(blob)) score += 35;
  if (POST_ART_HINT.test(blob)) score -= 50;
  if (/\.(jfif|jpe?g|webp)$/i.test(ext) && !mime.includes("png")) score += 5;
  if (String(row.tipo_midia ?? "").toLowerCase() !== "imagem") score -= 100;
  score += scoreExplicitHeroMatch(row, userHint);
  return score;
}

/**
 * Reordena UUIDs: melhor candidato a asset de produto primeiro.
 *
 * @param {string[]} ids
 * @param {Array<Record<string, unknown>>} rows — linhas do Supabase para esses ids
 * @param {string} [userHint] — última mensagem do cliente / histórico curto
 * @param {string[]} [excludeIds] — nunca usar como referência visual (ex.: post só para identidade)
 * @returns {string[]}
 */
export function rankReferenceMidiaIds(ids, rows, userHint = "", excludeIds = [], logoId = "") {
  const exclude = new Set((excludeIds || []).map((x) => String(x).trim()).filter(Boolean));
  const filtered = ids.filter((id) => !exclude.has(id));
  const map = new Map(rows.map((r) => [String(r.id_midia ?? "").trim(), r]));
  const logo = String(logoId || "").trim();
  const scored = filtered
    .map((id, index) => {
      const row = map.get(id);
      if (!row) return { id, score: -999, index };
      return { id, score: scoreMidiaRow(row, userHint, logo), index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((s) => s.id);
}

/**
 * Item explicitamente pedido como protagonista/centro da arte.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} userHint
 * @returns {string | null}
 */
export function pickHeroProductMidiaId(rows, userHint = "") {
  let bestId = null;
  let bestScore = 0;
  for (const row of rows || []) {
    const score = scoreExplicitHeroMatch(row, userHint);
    const id = String(row?.id_midia ?? "").trim();
    if (id && score > bestScore) {
      bestId = id;
      bestScore = score;
    }
  }
  return bestScore > 0 ? bestId : null;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} userHint
 * @returns {string | null}
 */
export function pickBestProductMidiaId(rows, userHint = "") {
  if (!rows.length) return null;
  const ids = rows.map((r) => String(r.id_midia ?? "").trim()).filter(Boolean);
  const ranked = rankReferenceMidiaIds(ids, rows, userHint);
  const best = ranked[0];
  const row = rows.find((r) => String(r.id_midia) === best);
  if (row && scoreMidiaRow(row, userHint) < 0) return null;
  return best || null;
}
