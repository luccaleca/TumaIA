/**
 * Ordena mídias para `image_prompt`: produto/recorte PNG primeiro; arte/post pronto por último.
 */

const PRODUCT_HINT =
  /oculos|óculos|arma(c|ç)(a|ã)o|lente|produto|png|recorte|isolad|transparent|packshot|logo|icon/i;
const POST_ART_HINT =
  /post|feed|banner|flyer|arte|comemor|400\s*k|500\s*k|seguidor|festa|natal|p[aá]scoa|black\s*friday|template|card|stories|reels|marco|milestone|somos/i;

/**
 * @param {Record<string, unknown>} row
 */
function scoreMidiaRow(row, userHint) {
  const nome = `${row.nome_exibicao ?? ""} ${row.nome_arquivo ?? ""} ${row.descricao ?? ""} ${row.alt_text ?? ""}`;
  const ext = String(row.extensao ?? row.nome_arquivo ?? "").toLowerCase();
  const mime = String(row.formato_arquivo ?? "").toLowerCase();
  const blob = `${nome} ${userHint}`.toLowerCase();

  let score = 0;
  if (mime.includes("png") || ext.endsWith(".png")) score += 40;
  if (PRODUCT_HINT.test(blob)) score += 35;
  if (POST_ART_HINT.test(blob)) score -= 50;
  if (/\.(jfif|jpe?g|webp)$/i.test(ext) && !mime.includes("png")) score += 5;
  if (String(row.tipo_midia ?? "").toLowerCase() !== "imagem") score -= 100;
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
export function rankReferenceMidiaIds(ids, rows, userHint = "", excludeIds = []) {
  const exclude = new Set((excludeIds || []).map((x) => String(x).trim()).filter(Boolean));
  const filtered = ids.filter((id) => !exclude.has(id));
  const map = new Map(rows.map((r) => [String(r.id_midia ?? "").trim(), r]));
  const scored = filtered
    .map((id) => {
      const row = map.get(id);
      if (!row) return { id, score: -999 };
      return { id, score: scoreMidiaRow(row, userHint) };
    })
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.id);
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
