import { z } from "zod";
import { env } from "../config.js";
import { executeFlux11Pro, flux11ProInputSchema } from "../services/flux11ProService.js";
import { executeFluxSchnell, fluxSchnellInputSchema } from "../services/fluxSchnellService.js";
import {
  executeGptImage2WithReferences,
  friendlyOpenAiImageError,
} from "../services/gptImage2Service.js";
import {
  executeReplicateGptImage2,
  friendlyReplicateGptImage2Error,
  replicateGptImage2InputSchema,
} from "../services/replicateGptImage2Service.js";
import {
  assertImageBillingAllowed,
  assertImageDailySuccessCap,
  assertImagePostBurst,
} from "../services/imageBilling.js";
import {
  buildFluxImagePrompt,
  buildImagePreviewContextMeta,
  buildImageRevisionPrompt,
  buildRefineComposedImagePrompt,
  loadContextosEmpresaAtivos,
  loadEmpresaResumoParaImagem,
  loadMidiasEmpresaResumo,
} from "../services/imagePreviewPrompt.js";
import {
  getImageProductMode,
  usesGptIntegratedProducts,
  usesGptRefineAfterCollage,
  usesSharpProductCollage,
} from "../services/imageProductDelivery.js";
import { resolveGptImage2InputImages } from "../services/imagePreviewReferences.js";
import { buildImageGenerationPlan } from "../services/imageGenerationPlan.js";
import {
  buildQualityRejectionUserMessage,
  isImagePreviewQualityReviewEnabled,
  reviewImagePreviewBeforeDelivery,
} from "../services/imagePreviewQualityReview.js";
import { resolveFraseNaImagem } from "../services/imageHeadline.js";
import { resolveActivePedidoHint } from "../services/imageHeadline.js";
import { buildConfirmedImageIntent } from "../services/imageIntent.js";
import { wantsLogoAsHero } from "../services/logoReferencePolicy.js";
import { friendlyImageGenerationError } from "../services/replicateImagePromptPrep.js";
import { resolveReferenceMidiasForReplicate } from "../services/referenceMidiaUrls.js";
import { partitionContextosIdentidade } from "../modules/empresas/identidadeMarca.js";
import { FLUX_IMAGE_PROMPT_MAX } from "../services/imagePreviewPrompt.js";
import { aspectRatioFromArteBrief } from "../services/rawImageArteBrief.js";
import { composeGeneratedSceneWithProducts } from "../services/productSceneComposer.js";
import { persistChatPreviewImages } from "../services/chatPreviewMidia.js";
import {
  CHAT_API_HISTORY_MAX,
  trimChatHistoryForApi,
} from "../services/chatHistoryLimit.js";

const aspectRatioSchema = z.enum(["1:1", "16:9", "9:16", "3:2", "2:3"]).optional();

const imagePreviewHistoryEntrySchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8000),
});

export const imagePreviewSchema = z.object({
  history: z
    .array(imagePreviewHistoryEntrySchema)
    .min(1)
    .max(CHAT_API_HISTORY_MAX * 3)
    .transform((arr) => trimChatHistoryForApi(arr) ?? []),
  id_empresa: z.string().uuid(),
  aspect_ratio: aspectRatioSchema,
  post_context_proposal: z.record(z.string(), z.unknown()).optional(),
  post_supplement_links: z
    .array(
      z.object({
        kind: z.enum(["contexto", "midia"]),
        id: z.string().uuid(),
      }),
    )
    .max(8)
    .optional(),
  reference_midia_ids: z.array(z.string().uuid()).max(3).optional(),
  focus_contexto_id: z.string().uuid().optional(),
  id_conversa: z.string().uuid().optional(),
  /** Edição incremental: prévia anterior + o que mudar (GPT Image 2 images/edits). */
  revision_source_url: z.string().url().max(4000).optional(),
  revision_instructions: z.string().trim().min(3).max(2000).optional(),
}).superRefine((data, ctx) => {
  const hasUrl = Boolean(String(data.revision_source_url || "").trim());
  const hasInstr = Boolean(String(data.revision_instructions || "").trim());
  if (hasUrl !== hasInstr) {
    ctx.addIssue({
      code: "custom",
      message: "revision_source_url e revision_instructions devem ser enviados juntos",
      path: ["revision_source_url"],
    });
  }
});

function normalizeImageOutputUrls(output) {
  if (output == null) return [];
  if (Array.isArray(output)) return output.filter((u) => typeof u === "string" && u.trim());
  if (typeof output === "string" && output.trim()) return [output.trim()];
  return [];
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {(req: import("express").Request, idEmpresa: string) => Promise<{ ok: boolean, status?: number, error?: string }>} assertEmpresaVinculo
 */
export async function handleImagePreview(req, res, db, assertEmpresaVinculo) {
  const startedAt = Date.now();
  const parsed = imagePreviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const v = await assertEmpresaVinculo(req, parsed.data.id_empresa);
  if (!v.ok) {
    res.status(v.status).json({ error: v.error });
    return;
  }

  const billing = assertImageBillingAllowed();
  if (!billing.ok) {
    res.status(billing.status).json({ error: billing.error });
    return;
  }

  const capCheck = await assertImageDailySuccessCap();
  if (!capCheck.ok) {
    res.status(429).json({
      error:
        "Limite diário de gerações de imagem atingido. Tente outro dia ou peça ao administrador para ajustar o teto.",
      successes: capCheck.successes,
      cap: capCheck.cap,
    });
    return;
  }

  const burst = assertImagePostBurst();
  if (!burst.ok) {
    res
      .status(429)
      .set("Retry-After", String(Math.max(1, burst.retryAfterSec ?? 60)))
      .json({ error: "Muitas gerações por minuto; aguarde um instante." });
    return;
  }

  const provider = env.IMAGE_PROVIDER || "replicate";
  const pipeline = env.IMAGE_PIPELINE || "raw";
  const productMode = getImageProductMode();
  const idEmpresa = parsed.data.id_empresa;

  let empresaRow;
  let contextoRows;
  let midiaRowsCatalog;
  try {
    [empresaRow, contextoRows, midiaRowsCatalog] = await Promise.all([
      loadEmpresaResumoParaImagem(db, idEmpresa),
      loadContextosEmpresaAtivos(db, idEmpresa),
      loadMidiasEmpresaResumo(db, idEmpresa, 72),
    ]);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao carregar contextos da empresa",
    });
    return;
  }

  const imageIntent = buildConfirmedImageIntent({
    history: parsed.data.history,
    postContextProposal: parsed.data.post_context_proposal,
    contextoRows,
    midiaRows: midiaRowsCatalog,
    focusContextoId: parsed.data.focus_contexto_id,
  });
  const prompt = buildFluxImagePrompt({
    history: parsed.data.history,
    contextoRows,
    postContextProposal: imageIntent.postContextProposal,
    focusContextoId: parsed.data.focus_contexto_id,
    hasReferenceImage: false,
  });
  const previewUserHint =
    imageIntent.pedido ||
    resolveActivePedidoHint(parsed.data.history, { proposal: imageIntent.postContextProposal });
  const { identidadeDados } = partitionContextosIdentidade(contextoRows);
  const logoId = identidadeDados?.id_midia_logo ? String(identidadeDados.id_midia_logo).trim() : "";
  const logoAsHero = wantsLogoAsHero(imageIntent.selectionHint || previewUserHint);

  if (env.IMAGE_PREVIEW_LOG_PROMPT) {
    console.info(
      `[ia/image-preview] provider=${provider} pipeline=${pipeline} len=${prompt.length}\n`,
      prompt,
    );
  }

  const fromBrief = aspectRatioFromArteBrief(parsed.data.post_context_proposal?.arte_brief);
  const aspect = parsed.data.aspect_ratio ?? fromBrief ?? "1:1";
  const revisionUrl = String(parsed.data.revision_source_url || "").trim();
  const revisionInstructions = String(parsed.data.revision_instructions || "").trim();
  const isPreviewRevision = Boolean(revisionUrl && revisionInstructions);
  let out;
  let referenceMeta = null;
  let composedProductIds = [];
  let heroProductId = null;
  let previewProductNames = [];

  if (isPreviewRevision) {
    if (provider !== "openai" && provider !== "replicate") {
      res.status(503).json({
        error: "Alteração de prévia requer GPT Image 2 (IMAGE_PROVIDER openai ou replicate).",
      });
      return;
    }
    const revisePrompt = buildImageRevisionPrompt({
      instructions: revisionInstructions,
      history: parsed.data.history,
      proposal: imageIntent.postContextProposal,
      imageIntent,
    });
    if (provider === "openai") {
      const apiKey = (env.OPENAI_API_KEY || "").trim();
      if (!apiKey) {
        res.status(503).json({ error: "OPENAI_API_KEY não configurada." });
        return;
      }
      out = await executeGptImage2WithReferences(apiKey, {
        prompt: revisePrompt,
        input_images: [revisionUrl],
        aspect_ratio: aspect,
        quality: env.OPENAI_IMAGE_QUALITY,
      });
      if (!out.ok) {
        res.status(out.status || 500).json({
          error: friendlyOpenAiImageError(out.error),
          raw: out.raw,
        });
        return;
      }
      referenceMeta = {
        mode: "openai/gpt-image-2-revision",
        pipeline: "revision",
        preview_revision: true,
        api: out.api || "images/edits",
      };
    } else {
      const token = (env.REPLICATE_API_TOKEN || "").trim();
      if (!token) {
        res.status(503).json({ error: "REPLICATE_API_TOKEN não configurado." });
        return;
      }
      out = await executeReplicateGptImage2(
        token,
        replicateGptImage2InputSchema.parse({
          prompt: revisePrompt,
          aspect_ratio: aspect,
          quality: env.REPLICATE_GPT_IMAGE_QUALITY,
          output_format: "png",
          input_images: [revisionUrl],
        }),
      );
      if (!out.ok) {
        res.status(out.status || 500).json({
          error: friendlyReplicateGptImage2Error(out.error),
          raw: out.raw,
        });
        return;
      }
      referenceMeta = {
        mode: "replicate/gpt-image-2-revision",
        pipeline: "revision",
        preview_revision: true,
      };
    }
  } else if (provider === "openai") {
    const apiKey = (env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      res.status(503).json({ error: "OPENAI_API_KEY não configurada." });
      return;
    }
    let promptForProvider = prompt;
    let inputImages;
    if (pipeline === "raw") {
      try {
        const refs = await resolveGptImage2InputImages(
          db,
          idEmpresa,
          parsed.data,
          contextoRows,
          imageIntent,
          productMode,
        );
        composedProductIds = refs.productRefIds || [];
        heroProductId = refs.heroProductId || null;
        previewProductNames = refs.productNames || [];
        inputImages = refs.inputImages;
        referenceMeta = refs.referenceMeta || { mode: "openai/gpt-image-2", pipeline, product_mode: productMode };
        const integrated =
          usesGptIntegratedProducts(productMode) && (composedProductIds.length || inputImages?.length);
        promptForProvider = buildFluxImagePrompt({
          history: parsed.data.history,
          contextoRows,
          postContextProposal: imageIntent.postContextProposal,
          focusContextoId: parsed.data.focus_contexto_id,
          hasReferenceImage: Boolean(inputImages?.length),
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
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Referência de mídia inválida",
        });
        return;
      }
    }
    out = await executeGptImage2WithReferences(apiKey, {
      prompt: promptForProvider,
      input_images: inputImages,
      aspect_ratio: aspect,
      quality: env.OPENAI_IMAGE_QUALITY,
    });
    if (!out.ok) {
      res.status(out.status || 500).json({
        error: friendlyOpenAiImageError(out.error),
        raw: out.raw,
      });
      return;
    }
    if (!referenceMeta) {
      referenceMeta = {
        mode: "openai/gpt-image-2",
        pipeline,
        product_mode: productMode,
        api: out.api || "images/generations",
      };
    }
  } else if (provider === "replicate") {
    const token = (env.REPLICATE_API_TOKEN || "").trim();
    if (!token) {
      res.status(503).json({
        error: "REPLICATE_API_TOKEN não configurado. Configure a geração de imagens no servidor.",
      });
      return;
    }

    let inputImages;
    let promptForProvider = prompt;
    try {
      const refs = await resolveGptImage2InputImages(
        db,
        idEmpresa,
        parsed.data,
        contextoRows,
        imageIntent,
        productMode,
      );
      inputImages = refs.inputImages;
      composedProductIds = refs.productRefIds || [];
      heroProductId = refs.heroProductId || null;
      previewProductNames = refs.productNames || [];
      if (refs.referenceMeta) referenceMeta = refs.referenceMeta;
      const integrated =
        usesGptIntegratedProducts(productMode) && (composedProductIds.length || inputImages?.length);
      if (inputImages?.length || refs.composeProductAssets || integrated) {
        promptForProvider = buildFluxImagePrompt({
          history: parsed.data.history,
          contextoRows,
          postContextProposal: imageIntent.postContextProposal,
          focusContextoId: parsed.data.focus_contexto_id,
          hasReferenceImage: Boolean(inputImages?.length),
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
      }
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Referência de mídia inválida",
      });
      return;
    }

    console.info(
      `[ia/image-preview] replicate refs=${inputImages?.length ?? 0} produtos=${composedProductIds.length} hero=${heroProductId || "—"}`,
    );
    out = await executeReplicateGptImage2(
      token,
      replicateGptImage2InputSchema.parse({
        prompt: promptForProvider,
        aspect_ratio: aspect,
        quality: env.REPLICATE_GPT_IMAGE_QUALITY,
        output_format: "png",
        ...(inputImages?.length ? { input_images: inputImages } : {}),
      }),
    );
    if (!out.ok) {
      console.warn(
        `[ia/image-preview] replicate falhou em ${Date.now() - startedAt}ms:`,
        out.error || out.status,
      );
      res.status(out.status || 500).json({
        error: friendlyReplicateGptImage2Error(out.error),
        raw: out.raw,
      });
      return;
    }
    if (!referenceMeta) {
      referenceMeta = { mode: "replicate/gpt-image-2", pipeline };
    }
  } else {
    const token = env.REPLICATE_API_TOKEN;
    if (!token) {
      res.status(503).json({ error: "REPLICATE_API_TOKEN não configurado." });
      return;
    }

    const fromBody = (parsed.data.reference_midia_ids || []).map((x) => String(x).trim()).filter(Boolean);
    const fromProposal = collectReferenceMidiaIds(
      imageIntent.postContextProposal,
      parsed.data.post_supplement_links,
    );
    let refIds = [...new Set([...fromBody, ...fromProposal])].slice(0, REFERENCE_MIDIA_MAX);
    let primaryRefUrl = null;
    let primaryRefKind = "product";
    let fluxPrompt = prompt;

    if (refIds.length) {
      try {
        const { data: midiaRows } = await db
          .from("midia")
          .select(
            "id_midia, nome_exibicao, nome_arquivo, descricao, alt_text, tipo_midia, formato_arquivo, extensao",
          )
          .eq("id_empresa", idEmpresa)
          .eq("ativo", true)
          .in("id_midia", refIds);
        if (Array.isArray(midiaRows) && midiaRows.length) {
          refIds = filterReferenceMidiaIdsToPedido(refIds, midiaRows, previewUserHint);
          const excludeRefIds = identidadeDados?.id_midia_referencia_analise
            ? [String(identidadeDados.id_midia_referencia_analise)]
            : [];
          refIds = rankReferenceMidiaIds(refIds, midiaRows, previewUserHint, excludeRefIds, logoId);
        }
        const resolved = await resolveReferenceMidiasForReplicate(db, idEmpresa, refIds, {
          logoId,
          userHint: imageIntent.selectionHint || previewUserHint,
          logoAsHero,
        });
        primaryRefUrl = resolved.primaryUrl;
        primaryRefKind = resolved.primaryKind === "logo" ? "logo" : "product";
        if (primaryRefUrl) {
          fluxPrompt = buildFluxImagePrompt({
            history: parsed.data.history,
            contextoRows,
            postContextProposal: imageIntent.postContextProposal,
            focusContextoId: parsed.data.focus_contexto_id,
            hasReferenceImage: true,
            referenceKind: primaryRefKind,
            pipeline: "standard",
          });
          if (resolved.auxiliaryReferenceText) {
            fluxPrompt = (fluxPrompt + `\n\n${resolved.auxiliaryReferenceText}`).slice(
              0,
              FLUX_IMAGE_PROMPT_MAX,
            );
          }
          referenceMeta = {
            mode: "flux-1.1-pro-reference",
            reference_midia_ids: resolved.usedIds,
          };
        }
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Referência de mídia inválida",
        });
        return;
      }
    }

    const runSchnell = () =>
      executeFluxSchnell(
        token,
        fluxSchnellInputSchema.parse({
          prompt: fluxPrompt,
          aspect_ratio: aspect,
          num_outputs: 1,
          output_format: "png",
          output_quality: 80,
        }),
      );

    if (primaryRefUrl) {
      out = await executeFlux11Pro(
        token,
        flux11ProInputSchema.parse({
          prompt: fluxPrompt,
          image_prompt: primaryRefUrl,
          aspect_ratio: aspect,
          output_format: "png",
          output_quality: 85,
          image_prompt_strength: primaryRefKind === "logo" ? 0.12 : 0.22,
        }),
      );
      if (!out.ok && /256\s*x\s*256|at least 256/i.test(String(out.error || ""))) {
        out = await runSchnell();
        referenceMeta = { ...referenceMeta, fallback: "schnell_sem_referencia_pixels" };
      }
    } else {
      out = await runSchnell();
      referenceMeta = { mode: "flux-schnell", pipeline: "standard" };
    }

    if (!out.ok) {
      res.status(out.status || 500).json({
        error: friendlyImageGenerationError(out.error),
        raw: out.raw,
      });
      return;
    }
  }

  let image_urls = normalizeImageOutputUrls(out.output);
  const gptRawProvider = provider === "replicate" || provider === "openai";
  if (!isPreviewRevision && pipeline === "raw" && gptRawProvider && image_urls.length) {
    try {
      if (usesSharpProductCollage(productMode) && composedProductIds.length) {
        const hasComposedAssets = Boolean(composedProductIds.length || (logoId && !logoAsHero));
        image_urls = await Promise.all(
          image_urls.map((url, idx) =>
            composeGeneratedSceneWithProducts(db, idEmpresa, url, composedProductIds, idx, {
              heroProductId,
              logoId: logoId && !logoAsHero ? logoId : null,
            }),
          ),
        );
        if (hasComposedAssets && referenceMeta && typeof referenceMeta === "object") {
          referenceMeta = {
            ...referenceMeta,
            composed_preview: true,
            composed_logo: Boolean(logoId && !logoAsHero),
            product_mode: productMode,
          };
        }
      }

      if (usesGptRefineAfterCollage(productMode) && image_urls.length) {
        const refinePrompt = buildRefineComposedImagePrompt(imageIntent);
        let refineOut = null;
        if (provider === "openai") {
          const apiKey = (env.OPENAI_API_KEY || "").trim();
          refineOut = await executeGptImage2WithReferences(apiKey, {
            prompt: refinePrompt,
            input_images: image_urls.slice(0, 1),
            aspect_ratio: aspect,
            quality: env.OPENAI_IMAGE_QUALITY,
          });
        } else if (provider === "replicate") {
          const token = (env.REPLICATE_API_TOKEN || "").trim();
          refineOut = await executeReplicateGptImage2(
            token,
            replicateGptImage2InputSchema.parse({
              prompt: refinePrompt,
              aspect_ratio: aspect,
              quality: env.REPLICATE_GPT_IMAGE_QUALITY,
              output_format: "png",
              input_images: image_urls.slice(0, 1),
            }),
          );
        }
        if (refineOut?.ok) {
          const refined = normalizeImageOutputUrls(refineOut.output);
          if (refined.length) image_urls = refined;
          if (referenceMeta && typeof referenceMeta === "object") {
            referenceMeta = { ...referenceMeta, gpt_refined: true, product_mode: productMode };
          }
        }
      }
    } catch (err) {
      console.warn(
        "[ia/image-preview] falha na pós-composição:",
        err instanceof Error ? err.message : err,
      );
      if (referenceMeta && typeof referenceMeta === "object") {
        referenceMeta = { ...referenceMeta, composed_preview: false, composed_preview_error: true };
      }
    }
  }
  const contexto_geracao = buildImagePreviewContextMeta(
    idEmpresa,
    empresaRow,
    contextoRows,
    imageIntent.postContextProposal,
    parsed.data.history,
    parsed.data.focus_contexto_id,
  );

  let qualityReview = null;
  if (image_urls.length && isImagePreviewQualityReviewEnabled()) {
    const heroRow =
      heroProductId && Array.isArray(midiaRowsCatalog)
        ? midiaRowsCatalog.find((r) => String(r.id_midia ?? "").trim() === heroProductId)
        : null;
    const heroName = heroRow
      ? String(heroRow.nome_exibicao ?? heroRow.nome_arquivo ?? "").trim()
      : imageIntent?.heroProduct?.nome_exibicao || null;
    try {
      qualityReview = await reviewImagePreviewBeforeDelivery(image_urls[0], {
        productNames: previewProductNames,
        heroProductName: heroName,
        fraseNaImagem: resolveFraseNaImagem(imageIntent.postContextProposal, parsed.data.history),
        productCount: composedProductIds?.length || 0,
        composeProductAssets: Boolean(referenceMeta?.compose_product_assets),
      });
    } catch (err) {
      console.warn(
        "[ia/image-preview] revisão de qualidade indisponível — entregando prévia mesmo assim:",
        err instanceof Error ? err.message : err,
      );
      qualityReview = {
        approved: true,
        skipped: true,
        reviewer: "ollama_vision_unavailable",
        summary: err instanceof Error ? err.message : String(err),
      };
    }

    if (!qualityReview.approved) {
      console.info(
        `[ia/image-preview] revisão reprovou em ${Date.now() - startedAt}ms issues=${(qualityReview.issues || []).join(",")}`,
      );
      res.status(422).json({
        error: buildQualityRejectionUserMessage(qualityReview.issues, qualityReview.summary),
        quality_review: qualityReview,
        image_urls: [],
        rejected_preview: true,
      });
      return;
    }
  }

  console.info(
    `[ia/image-preview] ok em ${Date.now() - startedAt}ms urls=${image_urls.length} review=${qualityReview?.approved ?? "n/a"}`,
  );

  let image_midia_ids = [];
  const idConversa = String(parsed.data.id_conversa || "").trim();
  const idUsuario = req.usuario?.id_usuario;
  if (idConversa && idUsuario && image_urls.length) {
    try {
      const persisted = await persistChatPreviewImages({
        db,
        idEmpresa,
        idConversa,
        idUsuario,
        imageUrls: image_urls,
      });
      image_urls = persisted.image_urls;
      image_midia_ids = persisted.image_midia_ids;
    } catch (err) {
      console.warn(
        "[ia/image-preview] persistência da prévia no storage falhou — entregando URLs originais:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  res.json({
    prediction_id: out.prediction_id ?? null,
    status: out.status ?? "succeeded",
    model: out.model,
    image_urls,
    ...(image_midia_ids.length ? { image_midia_ids } : {}),
    contexto_geracao,
    ...(referenceMeta
      ? {
          image_generation: {
            ...referenceMeta,
            ...(qualityReview ? { quality_review: qualityReview } : {}),
          },
        }
      : qualityReview
        ? { image_generation: { quality_review: qualityReview } }
        : {}),
  });
}

/**
 * Plano de geração (sem API paga) — resumo antes de confirmar no painel.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {(req: import("express").Request, idEmpresa: string) => Promise<{ ok: boolean, status?: number, error?: string }>} assertEmpresaVinculo
 */
export async function handleImageGenerationPlan(req, res, db, assertEmpresaVinculo) {
  const parsed = imagePreviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const v = await assertEmpresaVinculo(req, parsed.data.id_empresa);
  if (!v.ok) {
    res.status(v.status).json({ error: v.error });
    return;
  }

  try {
    const generation_plan = await buildImageGenerationPlan(db, parsed.data);
    res.json({ generation_plan });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao montar plano de geração",
    });
  }
}
