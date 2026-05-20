import { env } from "../config.js";
import { wantsLogoAsHero } from "./logoReferencePolicy.js";
import { ensureReplicateImagePromptUrl } from "./replicateImagePromptPrep.js";

/** Limite por chamada Replicate (1× image_prompt + demais só texto no prompt). */
export const REFERENCE_MIDIA_MAX = 3;

const IMAGE_MIME = /^image\/(jpeg|jpe|jpg|png|gif|webp|jfif|pjpeg)$/i;
const IMAGE_EXT = /\.(jpe?g|jfif|png|gif|webp)$/i;

function isImageRow(row) {
  if (!row || String(row.tipo_midia || "").trim().toLowerCase() !== "imagem") return false;
  const mime = String(row.formato_arquivo || "").trim();
  if (IMAGE_MIME.test(mime)) return true;
  const ext = String(row.extensao ?? "").trim();
  if (ext && IMAGE_EXT.test(ext.startsWith(".") ? ext : `.${ext}`)) return true;
  const arquivo = String(row.nome_arquivo ?? "").trim().toLowerCase();
  return IMAGE_EXT.test(arquivo);
}

/**
 * Ordena linhas na mesma ordem que `ids` (UUID).
 * @param {Array<Record<string, unknown>>} rows
 * @param {string[]} ids
 */
function orderRowsLikeIds(rows, ids) {
  const map = new Map(rows.map((r) => [String(r.id_midia ?? "").trim(), r]));
  const out = [];
  for (const id of ids) {
    const row = map.get(id);
    if (row) out.push(row);
  }
  return out;
}

/**
 * URL que a Replicate consiga baixar (HTTP). Preferência: URL pública da linha;
 * senão URL assinada do Storage (service role).
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {Record<string, unknown>} row
 * @returns {Promise<string>}
 */
export async function resolveFetchableImageUrlForMidia(db, row) {
  const bucket = (env.MEDIA_BUCKET || "midias").trim();
  const path = String(row.caminho_storage ?? "").trim();
  if (!path) throw new Error("Mídia sem caminho_storage");

  const publicUrl = typeof row.url_arquivo === "string" ? row.url_arquivo.trim() : "";
  if (publicUrl.startsWith("http://") || publicUrl.startsWith("https://")) {
    return publicUrl;
  }

  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Não foi possível gerar URL assinada da mídia");
  }
  return data.signedUrl;
}

function formatMidiaRowAsText(r) {
  const nome = String(r.nome_exibicao ?? "").trim();
  const desc = String(r.descricao ?? "").trim();
  const alt = String(r.alt_text ?? "").trim();
  const parts = [nome && `nome: ${nome}`, desc && `descrição: ${desc.slice(0, 400)}`, alt && `alt: ${alt.slice(0, 200)}`].filter(Boolean);
  return parts.length ? parts.join("\n") : "";
}

/**
 * Carrega mídias da empresa por id, valida imagem e devolve URL da 1ª + texto das demais.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string[]} ids — até {@link REFERENCE_MIDIA_MAX} UUIDs (1ª = image_prompt no FLUX Pro; 2ª e 3ª = apoio textual)
 * @param {{ logoId?: string, userHint?: string, logoAsHero?: boolean }} [opts]
 * @returns {Promise<{ primaryUrl: string | null, primaryKind: 'logo' | 'product', auxiliaryReferenceText: string | null, usedIds: string[] }>}
 */
export async function resolveReferenceMidiasForReplicate(db, idEmpresa, ids, opts = {}) {
  const clean = [...new Set(ids.map((x) => String(x || "").trim()).filter(Boolean))].slice(0, REFERENCE_MIDIA_MAX);
  const logoId = String(opts.logoId || "").trim();
  const logoAsHero =
    opts.logoAsHero === true || wantsLogoAsHero(String(opts.userHint || ""));

  if (!clean.length) {
    return { primaryUrl: null, primaryKind: "product", auxiliaryReferenceText: null, usedIds: [] };
  }

  const { data, error } = await db
    .from("midia")
    .select(
      "id_midia, id_empresa, tipo_midia, formato_arquivo, extensao, nome_arquivo, caminho_storage, url_arquivo, nome_exibicao, descricao, alt_text",
    )
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .in("id_midia", clean);

  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  if (rows.length !== clean.length) {
    throw new Error("Uma ou mais mídias de referência não existem ou não pertencem a esta empresa.");
  }

  const ordered = orderRowsLikeIds(rows, clean);
  let imageRows = ordered.filter(isImageRow);
  if (!imageRows.length) {
    throw new Error("Nenhuma das mídias indicadas é imagem (jpeg/png/gif/webp) ativa.");
  }

  const isLogoRow = (row) => logoId && String(row.id_midia ?? "").trim() === logoId;
  const logoRows = imageRows.filter(isLogoRow);
  const productRows = imageRows.filter((r) => !isLogoRow(r));

  /** Por padrão logo nunca é `image_prompt` — só cantinho via prompt/identidade. */
  const primaryCandidates = logoAsHero ? imageRows : productRows.length ? productRows : logoAsHero ? logoRows : [];

  let primaryUrl = null;
  let primaryKind = "product";

  if (primaryCandidates.length) {
    const primaryRow = primaryCandidates[0];
    const rawPrimaryUrl = await resolveFetchableImageUrlForMidia(db, primaryRow);
    const primaryId = String(primaryRow.id_midia ?? "").trim();
    primaryKind = logoAsHero && isLogoRow(primaryRow) ? "logo" : "product";
    primaryUrl = await ensureReplicateImagePromptUrl(db, idEmpresa, rawPrimaryUrl, {
      idMidia: primaryId || undefined,
      kind: primaryKind,
    });
  }

  const auxRows = logoAsHero
    ? imageRows.filter((r) => String(r.id_midia) !== String(primaryCandidates[0]?.id_midia))
    : [...productRows.slice(primaryCandidates.length ? 1 : 0), ...logoRows];

  let auxiliaryReferenceText = null;
  if (auxRows.length) {
    const blocks = [];
    for (const row of auxRows) {
      const t = formatMidiaRowAsText(row);
      if (!t) continue;
      const header = isLogoRow(row)
        ? "--- Logo da marca (sempre PEQUENO num canto, ~10% da arte — nunca protagonista salvo pedido explícito) ---"
        : "--- Outro asset do acervo (apoio textual; não copiar layout) ---";
      blocks.push(`${header}\n${t}`);
    }
    auxiliaryReferenceText = blocks.length ? blocks.join("\n\n") : null;
  } else if (logoRows.length && !logoAsHero) {
    const t = formatMidiaRowAsText(logoRows[0]);
    if (t) {
      auxiliaryReferenceText =
        "--- Logo da marca (sempre PEQUENO num canto, ~10% da arte) ---\n" + t;
    }
  }

  return {
    primaryUrl,
    primaryKind,
    auxiliaryReferenceText,
    usedIds: imageRows.map((r) => String(r.id_midia)),
  };
}
