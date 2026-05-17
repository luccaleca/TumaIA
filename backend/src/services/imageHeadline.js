/** Frase curta que aparece NA IMAGEM (não é legenda do post). */
export const FRASE_NA_IMAGEM_MAX = 56;

const FOLLOWER_RE =
  /(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:k|mil|m|milh[oõ]es?)?\s*(?:de\s+)?seguidores?|seguidores?\s*(?:no\s+)?(?:instagram|insta)?/i;
const FOLLOWER_NUM_RE = /(\d{3,})\s*k|\b(\d{2,3})\s*mil\b|500\s*k|400\s*k|500\s*mil|400\s*mil/gi;

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
 * Gera frase padrão a partir do pedido (ex.: marco de seguidores).
 *
 * @param {Array<{ role: string, content: string }>} history
 * @param {Array<Record<string, unknown>>} [contextoRows]
 */
export function deriveFraseNaImagemFromHistory(history, contextoRows = []) {
  const userText = history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");
  const ctxText = contextoRows
    .map((r) => `${r.nome ?? ""} ${r.descricao ?? ""} ${JSON.stringify(r.dados_json ?? {})}`)
    .join(" ");
  const blob = `${userText} ${ctxText}`;

  const milestone = parseFollowerMilestone(blob);
  if (milestone) {
    return normalizeFraseNaImagem(`Parabéns pelos ${milestone}!`);
  }

  if (/dia\s+das\s+m[aã]es|mothers?\s*day/i.test(blob)) {
    return normalizeFraseNaImagem("Feliz Dia das Mães!");
  }
  if (/natal|christmas/i.test(blob)) return normalizeFraseNaImagem("Feliz Natal!");
  if (/black\s*friday/i.test(blob)) return normalizeFraseNaImagem("Black Friday");

  const ctx = contextoRows[0];
  const nome = ctx ? String(ctx.nome ?? "").trim() : "";
  if (nome && nome.length <= 40) {
    return normalizeFraseNaImagem(nome);
  }

  return null;
}

/**
 * Frase para renderizar na arte (campo explícito do Llama ou derivação).
 *
 * @param {Record<string, unknown> | null | undefined} proposal
 * @param {Array<{ role: string, content: string }>} history
 * @param {Array<Record<string, unknown>>} [contextoRows]
 */
export function resolveFraseNaImagem(proposal, history, contextoRows = []) {
  if (proposal && typeof proposal === "object") {
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
  }
  return deriveFraseNaImagemFromHistory(history, contextoRows);
}
