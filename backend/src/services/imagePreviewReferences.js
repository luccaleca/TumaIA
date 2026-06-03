import {
  assertGptImage2ReferencesReady,
  orderGptImage2ReferenceIds,
} from "./gptImage2OfficialRequest.js";
import { resolveActivePedidoHint } from "./imageHeadline.js";
import { filterReferenceMidiaIdsToPedido } from "./productMentionMatch.js";
import { collectReferenceMidiaIds } from "./referenceMidiaFromProposal.js";
import { pickHeroProductMidiaId, rankReferenceMidiaIds } from "./referenceMidiaRanking.js";
import { wantsLogoAsHero } from "./logoReferencePolicy.js";
import { env } from "../config.js";
import { ensureReplicateImagePromptUrl } from "./replicateImagePromptPrep.js";
import {
  REFERENCE_MIDIA_MAX,
  resolveFetchableImageUrlForMidia,
} from "./referenceMidiaUrls.js";
import { partitionContextosIdentidade } from "../modules/empresas/identidadeMarca.js";
import {
  getImageProductMode,
  usesGptIntegratedProducts,
  usesSharpProductCollage,
} from "./imageProductDelivery.js";

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string[]} refIds
 * @param {{ prepForReplicate?: boolean, logoId?: string }} [opts]
 */
export async function resolveInputImageUrlsForGpt(db, idEmpresa, refIds, opts = {}) {
  if (!refIds.length) return [];
  const prepForReplicate = opts.prepForReplicate === true;
  const logoId = String(opts.logoId || "").trim();
  const { data, error } = await db
    .from("midia")
    .select("id_midia, tipo_midia, formato_arquivo, extensao, nome_arquivo, caminho_storage, url_arquivo")
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .in("id_midia", refIds);
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  const urls = [];
  for (const id of refIds) {
    const row = rows.find((r) => String(r.id_midia) === id);
    if (!row) continue;
    let url = await resolveFetchableImageUrlForMidia(db, row);
    if (url && prepForReplicate) {
      try {
        const rowId = String(row.id_midia ?? id).trim();
        url = await ensureReplicateImagePromptUrl(db, idEmpresa, url, {
          idMidia: rowId,
          kind: logoId && rowId === logoId ? "logo" : "product",
        });
      } catch (prepErr) {
        console.warn(
          `[image-preview] prep referência ${id}:`,
          prepErr instanceof Error ? prepErr.message : prepErr,
        );
      }
    }
    if (url) urls.push(url);
    if (urls.length >= 4) break;
  }
  return urls;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {{
 *   history: Array<{ role: string, content: string }>,
 *   post_context_proposal?: Record<string, unknown>,
 *   post_supplement_links?: Array<{ kind: string, id: string }>,
 *   reference_midia_ids?: string[],
 * }} parsed
 * @param {Array<Record<string, unknown>>} contextoRows
 * @param {Record<string, unknown> | null} [imageIntent]
 * @param {string} [productMode]
 * @param {{ throwIfNotReady?: boolean }} [opts]
 */
export async function resolveGptImage2InputImages(
  db,
  idEmpresa,
  parsed,
  contextoRows,
  imageIntent = null,
  productMode = getImageProductMode(),
  opts = {},
) {
  const integrated = usesGptIntegratedProducts(productMode);
  const fromBody = (parsed.reference_midia_ids || []).map((x) => String(x).trim()).filter(Boolean);
  const fromProposal = collectReferenceMidiaIds(
    imageIntent?.postContextProposal || parsed.post_context_proposal,
    parsed.post_supplement_links,
  );
  let refIds = [...new Set([...fromBody, ...fromProposal])].slice(0, REFERENCE_MIDIA_MAX);
  const userHint =
    (imageIntent && typeof imageIntent.pedido === "string" && imageIntent.pedido.trim()) ||
    resolveActivePedidoHint(parsed.history, {
      proposal: imageIntent?.postContextProposal || parsed.post_context_proposal,
    });
  const { identidadeDados } = partitionContextosIdentidade(contextoRows);
  const logoId = identidadeDados?.id_midia_logo ? String(identidadeDados.id_midia_logo).trim() : "";
  const logoAsHero = wantsLogoAsHero(userHint);
  if (logoId && !refIds.includes(logoId)) {
    refIds = [...refIds, logoId].slice(0, REFERENCE_MIDIA_MAX);
  }
  if (!refIds.length) {
    return {
      inputImages: undefined,
      referenceMeta: null,
      referenceKind: null,
      strictProductReference: false,
      composeProductAssets: false,
      productRefIds: [],
      heroProductId: null,
      productCount: 0,
      productNames: [],
      productMode,
      logoInReferences: false,
    };
  }

  const { data: midiaRows } = await db
    .from("midia")
    .select("id_midia, nome_exibicao, nome_arquivo, descricao, alt_text, tipo_midia, formato_arquivo, extensao")
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .in("id_midia", refIds);
  if (Array.isArray(midiaRows) && midiaRows.length) {
    refIds = filterReferenceMidiaIdsToPedido(refIds, midiaRows, userHint);
    const excludeRefIds = identidadeDados?.id_midia_referencia_analise
      ? [String(identidadeDados.id_midia_referencia_analise)]
      : [];
    refIds = rankReferenceMidiaIds(refIds, midiaRows, userHint, excludeRefIds, logoId);
  }
  const orderedRows = refIds
    .map((id) => (Array.isArray(midiaRows) ? midiaRows.find((r) => String(r.id_midia) === id) : null))
    .filter(Boolean);
  const isLogoRow = (row) => logoId && String(row?.id_midia ?? "").trim() === logoId;
  const productRows = orderedRows.filter((row) => !isLogoRow(row));
  const composeProductAssets = usesSharpProductCollage(productMode) && productRows.length > 0;
  const productRefIds = productRows.map((row) => String(row.id_midia)).filter(Boolean);
  const proposalHeroId =
    imageIntent?.heroProduct && typeof imageIntent.heroProduct.id_midia === "string"
      ? imageIntent.heroProduct.id_midia.trim()
      : "";
  const heroProductId =
    (proposalHeroId && productRows.some((row) => String(row.id_midia ?? "").trim() === proposalHeroId)
      ? proposalHeroId
      : "") || pickHeroProductMidiaId(productRows, userHint);
  const inputImageIds = integrated && productRows.length
    ? orderGptImage2ReferenceIds(productRefIds, {
        heroProductId,
        logoId,
        logoAsHero,
      })
    : logoAsHero
      ? refIds
      : composeProductAssets
        ? []
        : refIds.filter((id) => id !== logoId);
  const logoInReferences = Boolean(logoId && inputImageIds.includes(logoId));
  const productNames = productRows
    .map((row) => String(row.nome_exibicao ?? row.nome_arquivo ?? "").trim())
    .filter(Boolean);
  const prepForReplicate = (env.IMAGE_PROVIDER || "replicate") === "replicate";
  const inputImages = await resolveInputImageUrlsForGpt(db, idEmpresa, inputImageIds, {
    prepForReplicate,
    logoId,
  });
  const primaryRow =
    (inputImageIds.length
      ? orderedRows.find((row) => inputImageIds.includes(String(row.id_midia ?? "").trim()))
      : orderedRows[0]) || null;
  const referenceKind = logoAsHero && primaryRow && isLogoRow(primaryRow) ? "logo" : "product";
  const strictProductReference = productRows.length > 0 && !composeProductAssets && !integrated;

  if (!inputImages.length) {
    return {
      inputImages: undefined,
      referenceMeta: {
        mode: "replicate/gpt-image-2",
        reference_input_images: refIds,
        compose_product_assets: composeProductAssets,
        composed_product_ids: productRefIds,
        composed_hero_product_id: heroProductId,
        composed_logo_id: logoAsHero ? null : logoId || null,
        product_mode: productMode,
        gpt_integrated: integrated && productRefIds.length > 0,
      },
      referenceKind,
      strictProductReference: strictProductReference && !integrated,
      composeProductAssets,
      productRefIds,
      heroProductId,
      productCount: productRefIds.length,
      productNames,
      productMode,
      logoInReferences,
    };
  }
  const out = {
    inputImages,
    referenceMeta: {
      mode: "gpt-image-2/images.edits",
      reference_input_images: inputImageIds,
      compose_product_assets: composeProductAssets,
      composed_product_ids: productRefIds,
      composed_hero_product_id: heroProductId,
      composed_logo_id: logoInReferences ? null : logoAsHero ? null : logoId || null,
      product_mode: productMode,
      gpt_integrated: integrated && productRefIds.length > 0,
      logo_in_references: logoInReferences,
      api_shape: "images.edit",
    },
    referenceKind,
    strictProductReference,
    composeProductAssets,
    productRefIds,
    heroProductId,
    productCount: productRefIds.length,
    productNames,
    productMode,
    logoInReferences,
  };
  if (integrated && opts.throwIfNotReady !== false) {
    assertGptImage2ReferencesReady(out);
  }
  return out;
}
