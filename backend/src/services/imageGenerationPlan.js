import { env } from "../config.js";
import { assertImageBillingAllowed } from "./imageBilling.js";
import { buildConfirmedImageIntent } from "./imageIntent.js";
import { buildFluxImagePrompt, loadContextosEmpresaAtivos, loadMidiasEmpresaResumo } from "./imagePreviewPrompt.js";
import { evaluateGptImage2ReferencesReady } from "./gptImage2ReferenceStatus.js";
import { resolveGptImage2InputImages } from "./imagePreviewReferences.js";
import { aspectRatioFromArteBrief } from "./rawImageArteBrief.js";
import { getImageProductMode, usesGptIntegratedProducts as usesIntegrated } from "./imageProductDelivery.js";

const PROMPT_EXCERPT_MAX = 320;

/**
 * Plano de geração sem chamar API paga (pré-confirmação no painel).
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {Record<string, unknown>} parsedData
 */
export async function buildImageGenerationPlan(db, parsedData) {
  const provider = env.IMAGE_PROVIDER || "replicate";
  const pipeline = env.IMAGE_PIPELINE || "raw";
  const productMode = getImageProductMode();
  const idEmpresa = parsedData.id_empresa;

  const [contextoRows, midiaRowsCatalog] = await Promise.all([
    loadContextosEmpresaAtivos(db, idEmpresa),
    loadMidiasEmpresaResumo(db, idEmpresa, 72),
  ]);

  const imageIntent = buildConfirmedImageIntent({
    history: parsedData.history,
    postContextProposal: parsedData.post_context_proposal,
    contextoRows,
    midiaRows: midiaRowsCatalog,
    focusContextoId: parsedData.focus_contexto_id,
  });

  const fromBrief = aspectRatioFromArteBrief(parsedData.post_context_proposal?.arte_brief);
  const aspect = parsedData.aspect_ratio ?? fromBrief ?? "1:1";

  const proposalMissing =
    parsedData.post_context_proposal?.product_media_status === "missing";

  let refs = {
    inputImages: undefined,
    productRefIds: [],
    productNames: [],
    productCount: 0,
    logoInReferences: false,
    composeProductAssets: false,
    referenceMeta: null,
    referenceKind: null,
    strictProductReference: false,
    productMode,
  };

  if (pipeline === "raw") {
    refs = await resolveGptImage2InputImages(
      db,
      idEmpresa,
      parsedData,
      contextoRows,
      imageIntent,
      productMode,
      { throwIfNotReady: false },
    );
  }

  const integrated =
    usesIntegrated(productMode) && (refs.productRefIds?.length || refs.inputImages?.length);
  const refStatus = evaluateGptImage2ReferencesReady(refs, { integrated });

  let blocked = refStatus.blocked;
  let blockReason = refStatus.block_reason;

  if (proposalMissing && refs.productRefIds?.length) {
    blocked = true;
    blockReason =
      "Produto pedido sem PNG no acervo. Cadastre a imagem em Mídias antes de gerar.";
  }

  const promptForProvider = buildFluxImagePrompt({
    history: parsedData.history,
    contextoRows,
    postContextProposal: imageIntent.postContextProposal,
    focusContextoId: parsedData.focus_contexto_id,
    hasReferenceImage: Boolean(refs.inputImages?.length),
    referenceKind: refs.referenceKind,
    strictProductReference: refs.strictProductReference && !integrated,
    composeProductAssets: refs.composeProductAssets,
    integratedProductGeneration: integrated,
    productNames: refs.productNames,
    productCount: refs.productCount,
    logoInReferences: refs.logoInReferences,
    aspectRatio: aspect,
    pipeline,
  });

  const promptExcerpt =
    typeof promptForProvider === "string" && promptForProvider.trim()
      ? promptForProvider.trim().slice(0, PROMPT_EXCERPT_MAX) +
        (promptForProvider.length > PROMPT_EXCERPT_MAX ? "…" : "")
      : "";

  const billing = assertImageBillingAllowed();
  const pngCount = refStatus.reference_png_count;
  const heroName =
    imageIntent?.heroProduct && typeof imageIntent.heroProduct.nome_exibicao === "string"
      ? imageIntent.heroProduct.nome_exibicao.trim()
      : refs.productNames?.[0] || null;

  return {
    ready: !blocked && billing.ok,
    blocked,
    block_reason: blockReason,
    billing_configured: billing.ok,
    billing_hint: billing.ok ? null : billing.error,
    provider,
    pipeline,
    product_mode: productMode,
    api_shape: refs.referenceMeta?.api_shape || (integrated ? "images.edit" : null),
    gpt_integrated: Boolean(integrated),
    aspect_ratio: aspect,
    reference_png_count: pngCount,
    reference_png_expected: refStatus.reference_png_expected,
    product_names: refs.productNames || [],
    product_count: refs.productCount || 0,
    logo_in_references: Boolean(refs.logoInReferences),
    compose_product_assets: Boolean(refs.composeProductAssets),
    hero_product_name: heroName,
    prompt_excerpt: promptExcerpt,
    missing_midia_urls: refStatus.missing_midia_urls,
    partial_reference_warning: refStatus.partial_reference_warning,
    charge_warning:
      "Esta ação consome créditos do plano de imagem quando a geração for confirmada.",
  };
}
