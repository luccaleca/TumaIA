import { z } from "zod";
import { env } from "../config.js";
import { executeFlux11Pro, flux11ProInputSchema } from "../services/flux11ProService.js";
import { executeFluxSchnell, fluxSchnellInputSchema } from "../services/fluxSchnellService.js";
import { executeGptImage2, friendlyOpenAiImageError } from "../services/gptImage2Service.js";
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
  loadContextosEmpresaAtivos,
  loadEmpresaResumoParaImagem,
} from "../services/imagePreviewPrompt.js";
import { collectReferenceMidiaIds } from "../services/referenceMidiaFromProposal.js";
import { rankReferenceMidiaIds } from "../services/referenceMidiaRanking.js";
import { wantsLogoAsHero } from "../services/logoReferencePolicy.js";
import { friendlyImageGenerationError } from "../services/replicateImagePromptPrep.js";
import {
  REFERENCE_MIDIA_MAX,
  resolveFetchableImageUrlForMidia,
  resolveReferenceMidiasForReplicate,
} from "../services/referenceMidiaUrls.js";
import { partitionContextosIdentidade } from "../modules/empresas/identidadeMarca.js";
import { FLUX_IMAGE_PROMPT_MAX } from "../services/imagePreviewPrompt.js";
import { aspectRatioFromArteBrief } from "../services/rawImageArteBrief.js";
import { composeGeneratedSceneWithProducts } from "../services/productSceneComposer.js";

const aspectRatioSchema = z.enum(["1:1", "16:9", "9:16", "3:2", "2:3"]).optional();

export const imagePreviewSchema = z.object({
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(8000),
      }),
    )
    .min(1)
    .max(36),
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
});

function normalizeImageOutputUrls(output) {
  if (output == null) return [];
  if (Array.isArray(output)) return output.filter((u) => typeof u === "string" && u.trim());
  if (typeof output === "string" && output.trim()) return [output.trim()];
  return [];
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string[]} refIds
 */
async function resolveInputImageUrlsForGpt(db, idEmpresa, refIds) {
  if (!refIds.length) return [];
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
    const url = await resolveFetchableImageUrlForMidia(db, row);
    if (url) urls.push(url);
    if (urls.length >= 4) break;
  }
  return urls;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {z.infer<typeof imagePreviewSchema>} parsed
 * @param {Array<Record<string, unknown>>} contextoRows
 */
async function resolveGptImage2InputImages(db, idEmpresa, parsed, contextoRows) {
  const fromBody = (parsed.reference_midia_ids || []).map((x) => String(x).trim()).filter(Boolean);
  const fromProposal = collectReferenceMidiaIds(parsed.post_context_proposal, parsed.post_supplement_links);
  let refIds = [...new Set([...fromBody, ...fromProposal])].slice(0, REFERENCE_MIDIA_MAX);
  const userHint = parsed.history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ")
    .slice(-400);
  const { identidadeDados } = partitionContextosIdentidade(contextoRows);
  const logoId = identidadeDados?.id_midia_logo ? String(identidadeDados.id_midia_logo).trim() : "";
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
      productCount: 0,
    };
  }

  const { data: midiaRows } = await db
    .from("midia")
    .select("id_midia, nome_exibicao, nome_arquivo, descricao, alt_text, tipo_midia, formato_arquivo, extensao")
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .in("id_midia", refIds);
  if (Array.isArray(midiaRows) && midiaRows.length) {
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
  const logoRows = orderedRows.filter((row) => isLogoRow(row));
  const composeProductAssets = productRows.length > 0;
  const inputImageIds = composeProductAssets ? logoRows.map((row) => String(row.id_midia)).slice(0, 1) : refIds;
  const inputImages = await resolveInputImageUrlsForGpt(db, idEmpresa, inputImageIds);
  const primaryRow = orderedRows[0] || null;
  const referenceKind = primaryRow && isLogoRow(primaryRow) ? "logo" : "product";
  const strictProductReference = productRows.length > 0;
  const productRefIds = productRows.map((row) => String(row.id_midia)).filter(Boolean);

  if (!inputImages.length) {
    return {
      inputImages: undefined,
      referenceMeta: {
        mode: "replicate/gpt-image-2",
        reference_input_images: refIds,
        compose_product_assets: composeProductAssets,
        composed_product_ids: productRefIds,
      },
      referenceKind,
      strictProductReference,
      composeProductAssets,
      productRefIds,
      productCount: productRefIds.length,
    };
  }
  return {
    inputImages,
    referenceMeta: {
      mode: "replicate/gpt-image-2",
      reference_input_images: refIds,
      compose_product_assets: composeProductAssets,
      composed_product_ids: productRefIds,
    },
    referenceKind,
    strictProductReference,
    composeProductAssets,
    productRefIds,
    productCount: productRefIds.length,
  };
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {(req: import("express").Request, idEmpresa: string) => Promise<{ ok: boolean, status?: number, error?: string }>} assertEmpresaVinculo
 */
export async function handleImagePreview(req, res, db, assertEmpresaVinculo) {
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
  const idEmpresa = parsed.data.id_empresa;

  let empresaRow;
  let contextoRows;
  try {
    [empresaRow, contextoRows] = await Promise.all([
      loadEmpresaResumoParaImagem(db, idEmpresa),
      loadContextosEmpresaAtivos(db, idEmpresa),
    ]);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao carregar contextos da empresa",
    });
    return;
  }

  const prompt = buildFluxImagePrompt({
    history: parsed.data.history,
    contextoRows,
    postContextProposal: parsed.data.post_context_proposal,
    hasReferenceImage: false,
  });

  if (env.IMAGE_PREVIEW_LOG_PROMPT) {
    console.info(
      `[ia/image-preview] provider=${provider} pipeline=${pipeline} len=${prompt.length}\n`,
      prompt,
    );
  }

  const fromBrief = aspectRatioFromArteBrief(parsed.data.post_context_proposal?.arte_brief);
  const aspect = parsed.data.aspect_ratio ?? fromBrief ?? "1:1";
  let out;
  let referenceMeta = null;
  let composedProductIds = [];

  if (provider === "openai") {
    const apiKey = (env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      res.status(503).json({ error: "OPENAI_API_KEY não configurada." });
      return;
    }
    out = await executeGptImage2(apiKey, {
      prompt,
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
    referenceMeta = { mode: "openai/gpt-image-2", pipeline };
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
      const refs = await resolveGptImage2InputImages(db, idEmpresa, parsed.data, contextoRows);
      inputImages = refs.inputImages;
      composedProductIds = refs.productRefIds || [];
      if (refs.referenceMeta) referenceMeta = refs.referenceMeta;
      if (inputImages?.length || refs.composeProductAssets) {
        promptForProvider = buildFluxImagePrompt({
          history: parsed.data.history,
          contextoRows,
          postContextProposal: parsed.data.post_context_proposal,
          hasReferenceImage: Boolean(inputImages?.length),
          referenceKind: refs.referenceKind,
          strictProductReference: refs.strictProductReference,
          composeProductAssets: refs.composeProductAssets,
          productCount: refs.productCount,
          pipeline,
        });
      }
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Referência de mídia inválida",
      });
      return;
    }

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
      parsed.data.post_context_proposal,
      parsed.data.post_supplement_links,
    );
    let refIds = [...new Set([...fromBody, ...fromProposal])].slice(0, REFERENCE_MIDIA_MAX);
    const userHint = parsed.data.history
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" ")
      .slice(-400);
    const { identidadeDados } = partitionContextosIdentidade(contextoRows);
    const logoId = identidadeDados?.id_midia_logo ? String(identidadeDados.id_midia_logo).trim() : "";
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
          const excludeRefIds = identidadeDados?.id_midia_referencia_analise
            ? [String(identidadeDados.id_midia_referencia_analise)]
            : [];
          refIds = rankReferenceMidiaIds(refIds, midiaRows, userHint, excludeRefIds, logoId);
        }
        const resolved = await resolveReferenceMidiasForReplicate(db, idEmpresa, refIds, {
          logoId,
          userHint,
          logoAsHero: wantsLogoAsHero(userHint),
        });
        primaryRefUrl = resolved.primaryUrl;
        primaryRefKind = resolved.primaryKind === "logo" ? "logo" : "product";
        if (primaryRefUrl) {
          fluxPrompt = buildFluxImagePrompt({
            history: parsed.data.history,
            contextoRows,
            postContextProposal: parsed.data.post_context_proposal,
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
  if (provider === "replicate" && pipeline === "raw" && composedProductIds.length && image_urls.length) {
    try {
      image_urls = await Promise.all(
        image_urls.map((url, idx) =>
          composeGeneratedSceneWithProducts(db, idEmpresa, url, composedProductIds, idx),
        ),
      );
      if (referenceMeta && typeof referenceMeta === "object") {
        referenceMeta = { ...referenceMeta, composed_preview: true };
      }
    } catch (err) {
      console.warn(
        "[ia/image-preview] falha ao compor produtos reais:",
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
    parsed.data.post_context_proposal,
    parsed.data.history,
  );

  res.json({
    prediction_id: out.prediction_id ?? null,
    status: out.status ?? "succeeded",
    model: out.model,
    image_urls,
    contexto_geracao,
    ...(referenceMeta ? { image_generation: referenceMeta } : {}),
  });
}
