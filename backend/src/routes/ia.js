import { Router } from "express";
import { z } from "zod";
import { env } from "../config.js";
import { requireUserJwt } from "../middleware/requireUserJwt.js";
import { requireUsuario } from "../middleware/requireUsuario.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { ensureChatWorkerReady, runChatSerialized } from "../services/chatPythonWorker.js";
import { shouldOfferDeliveryButtons } from "../services/chatDeliveryUi.js";
import { executeFlux11Pro, flux11ProInputSchema } from "../services/flux11ProService.js";
import { executeFluxSchnell, fluxSchnellInputSchema } from "../services/fluxSchnellService.js";
import {
  FLUX_IMAGE_PROMPT_MAX,
  buildFluxImagePrompt,
  buildImagePreviewContextMeta,
  loadContextosEmpresaAtivos,
  loadEmpresaResumoParaImagem,
} from "../services/imagePreviewPrompt.js";
import { collectReferenceMidiaIds } from "../services/referenceMidiaFromProposal.js";
import { rankReferenceMidiaIds } from "../services/referenceMidiaRanking.js";
import { REFERENCE_MIDIA_MAX, resolveReferenceMidiasForReplicate } from "../services/referenceMidiaUrls.js";
import { partitionContextosIdentidade } from "../modules/empresas/identidadeMarca.js";
import { generatePostContextProposal } from "../services/postContextProposalService.js";
import { assertReplicateBillingAllowed, assertReplicateBurst, assertReplicateDailySuccessCap } from "../services/replicateUsage.js";

const r = Router();

const CONFIRM_IMAGE_UI = [
  { id: "confirm_generate_image", label: "Confirmar e gerar prévia da imagem (Replicate / créditos)" },
];

/** Não bloquear o chat para sempre; deve ser >= timeout do fetch Llama. */
const POST_PROPOSAL_TIMEOUT_MS = 118_000;

/**
 * @param {Parameters<typeof generatePostContextProposal>[0]} opts
 */
async function generatePostContextProposalWithTimeout(opts) {
  return Promise.race([
    generatePostContextProposal(opts),
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Tempo esgotado ao montar confirmação de contexto (Llama/Ollama).")),
        POST_PROPOSAL_TIMEOUT_MS,
      );
    }),
  ]);
}

const bodySchema = z.object({
  question: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(6000),
      }),
    )
    .max(24)
    .optional(),
  /** Empresa em sessão: validamos vínculo; a IA injeta o cadastro de ``public.empresa``. */
  id_empresa: z.string().uuid().optional(),
});

async function assertEmpresaVinculo(req, idEmpresa) {
  if (!idEmpresa) return { ok: true };
  const db = getSupabaseAdmin();
  if (!db) {
    return { ok: false, status: 503, error: "Supabase não configurado no servidor" };
  }
  const { data: vinculo, error: eV } = await db
    .from("usuario_empresa")
    .select("id")
    .eq("id_usuario", req.usuario.id_usuario)
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .maybeSingle();
  if (eV) return { ok: false, status: 500, error: eV.message };
  if (!vinculo) return { ok: false, status: 403, error: "Sem acesso a esta empresa ou vínculo inativo." };
  return { ok: true };
}

r.post("/chat", requireUserJwt, requireUsuario, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  let v;
  try {
    const out = await Promise.all([
      assertEmpresaVinculo(req, parsed.data.id_empresa),
      ensureChatWorkerReady(),
    ]);
    v = out[0];
  } catch (err) {
    console.error("[ia/chat] worker não subiu:", err instanceof Error ? err.message : err);
    res.status(503).json({
      error:
        err instanceof Error
          ? err.message
          : "IA indisponível. Se mudou o modelo de embedding, apague backend/ia/indice_contextos e reinicie.",
    });
    return;
  }
  if (!v.ok) {
    res.status(v.status).json({ error: v.error });
    return;
  }

  try {
    const db = getSupabaseAdmin();
    const llamaPostContextOk = Boolean(env.LLAMA_BASE_URL?.trim() || env.LLAMA_MODEL?.trim());
    const needsPostSupplement =
      shouldOfferDeliveryButtons(parsed.data.question) &&
      Boolean(parsed.data.id_empresa) &&
      Boolean(db) &&
      llamaPostContextOk;

    const result = await runChatSerialized(parsed.data);

    if (!result?.ok) {
      res.status(502).json({ error: result?.error || "Falha na IA" });
      return;
    }
    const answer = String(result.result || "");
    const source_documents = Array.isArray(result.source_documents) ? result.source_documents : [];

    /** O painel chama `POST /ia/post-context-proposal` em seguida (Ollama pode levar ~1–2 min). */
    const offer_post_context = needsPostSupplement;

    res.json({
      answer,
      source_documents,
      ...(offer_post_context ? { offer_post_context: true } : {}),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao consultar IA",
    });
  }
});

const imagePreviewSchema = z.object({
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(8000),
      }),
    )
    .min(1)
    .max(36),
  /** Obrigatório: contextos e cadastro vêm desta empresa (vínculo validado). */
  id_empresa: z.string().uuid(),
  aspect_ratio: fluxSchnellInputSchema.shape.aspect_ratio.optional(),
  /** Preenchido pelo painel após o passo "Confirmar contexto" (alinha imagem ao que foi combinado). */
  post_context_proposal: z.record(z.string(), z.unknown()).optional(),
  /** Links do `post_supplement` (kind midia) — usados se `reference_midia_ids` vier vazio. */
  post_supplement_links: z
    .array(
      z.object({
        kind: z.enum(["contexto", "midia"]),
        id: z.string().uuid(),
      }),
    )
    .max(8)
    .optional(),
  /**
   * Mídias de imagem do acervo (UUID) para referência visual na Replicate.
   * A primeira vira `image_prompt` no FLUX 1.1 Pro (composição); a segunda entra como texto no prompt.
   */
  reference_midia_ids: z.array(z.string().uuid()).max(3).optional(),
});

const postContextProposalBodySchema = z.object({
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
});

function normalizeFluxOutputUrls(output) {
  if (output == null) return [];
  if (Array.isArray(output)) return output.filter((u) => typeof u === "string" && u.trim());
  if (typeof output === "string" && output.trim()) return [output.trim()];
  return [];
}

/**
 * Llama (API OpenAI-compatível) + Supabase: mensagem de confirmação do tipo de post alinhada a `contexto_empresa` e referências de `midia`.
 */
r.post("/post-context-proposal", requireUserJwt, requireUsuario, async (req, res) => {
  const parsed = postContextProposalBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const v = await assertEmpresaVinculo(req, parsed.data.id_empresa);
  if (!v.ok) {
    res.status(v.status).json({ error: v.error });
    return;
  }

  const db = getSupabaseAdmin();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado no servidor" });
    return;
  }

  try {
    const out = await generatePostContextProposalWithTimeout({
      history: parsed.data.history,
      idEmpresa: parsed.data.id_empresa,
      db,
    });
    res.json({
      confirmation_message: out.confirmation_message,
      links: out.links,
      post_context_proposal: out.post_context_proposal,
      meta: out._meta,
      ui_actions: CONFIRM_IMAGE_UI,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao montar confirmação de contexto";
    const status = err?.status && Number(err.status) >= 400 && Number(err.status) < 600 ? Number(err.status) : 500;
    res.status(status).json({ error: msg });
  }
});

/**
 * Prévia FLUX autenticada (JWT). Exige `id_empresa`, carrega `contexto_empresa` ativo + resumo de `empresa` no Supabase e injeta no prompt (além do `history`). Exige `REPLICATE_ALLOW_BILLING=true` e token; mesmos limites que `/internal/replicate/flux-schnell`.
 */
r.post("/image-preview", requireUserJwt, requireUsuario, async (req, res) => {
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

  const billing = assertReplicateBillingAllowed();
  if (!billing.ok) {
    res.status(billing.status).json({ error: billing.error });
    return;
  }

  const dailyCap = env.REPLICATE_DAILY_SUCCESS_CAP;
  const capCheck = await assertReplicateDailySuccessCap(dailyCap);
  if (!capCheck.ok) {
    res.status(429).json({
      error:
        "Limite diário de gerações de imagem atingido. Tente outro dia ou peça ao administrador para ajustar o teto.",
      successes: capCheck.successes,
      cap: capCheck.cap,
    });
    return;
  }

  const token = env.REPLICATE_API_TOKEN;
  if (!token) {
    res.status(503).json({ error: "Geração de imagem não configurada no servidor (REPLICATE_API_TOKEN)." });
    return;
  }

  const idEmpresa = parsed.data.id_empresa;
  const db = getSupabaseAdmin();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado no servidor" });
    return;
  }

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
  const excludeRefIds = identidadeDados?.id_midia_referencia_analise
    ? [String(identidadeDados.id_midia_referencia_analise)]
    : [];

  let referenceMeta = null;
  /** @type {string | null} */
  let primaryRefUrl = null;

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
        refIds = rankReferenceMidiaIds(refIds, midiaRows, userHint, excludeRefIds);
      }
    } catch {
      /* segue ordem original */
    }
  }

  let prompt = buildFluxImagePrompt({
    history: parsed.data.history,
    empresaRow,
    contextoRows,
    postContextProposal: parsed.data.post_context_proposal,
    hasReferenceImage: false,
  });

  if (refIds.length) {
    try {
      const resolved = await resolveReferenceMidiasForReplicate(db, idEmpresa, refIds);
      primaryRefUrl = resolved.primaryUrl;
      if (primaryRefUrl) {
        prompt = buildFluxImagePrompt({
          history: parsed.data.history,
          empresaRow,
          contextoRows,
          postContextProposal: parsed.data.post_context_proposal,
          hasReferenceImage: true,
        });
        if (resolved.auxiliaryReferenceText) {
          const add = `\n\n=== Outros assets do acervo (só contexto; não copiar layout) ===\n${resolved.auxiliaryReferenceText}`;
          prompt = (prompt + add).slice(0, FLUX_IMAGE_PROMPT_MAX);
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

  if (env.IMAGE_PREVIEW_LOG_PROMPT) {
    console.info("[ia/image-preview] prompt length=", prompt.length, "\n", prompt);
  }

  const postBurstLimit = env.REPLICATE_BURST_PER_MINUTE;
  const burst = assertReplicateBurst("post", postBurstLimit);
  if (!burst.ok) {
    res
      .status(429)
      .set("Retry-After", String(Math.max(1, burst.retryAfterSec ?? 60)))
      .json({ error: "Muitas gerações por minuto; aguarde um instante." });
    return;
  }

  const aspect = parsed.data.aspect_ratio ?? "1:1";
  let out;

  if (primaryRefUrl) {
    const fluxProInput = flux11ProInputSchema.parse({
      prompt,
      image_prompt: primaryRefUrl,
      aspect_ratio: aspect,
      output_format: "png",
      output_quality: 85,
      image_prompt_strength: 0.22,
    });
    out = await executeFlux11Pro(token, fluxProInput);
  } else {
    const fluxInput = fluxSchnellInputSchema.parse({
      prompt,
      aspect_ratio: aspect,
      num_outputs: 1,
      output_format: "png",
      output_quality: 80,
    });
    out = await executeFluxSchnell(token, fluxInput);
  }

  if (!out.ok) {
    res.status(out.status || 500).json({ error: out.error || "Falha na geração", raw: out.raw });
    return;
  }

  const image_urls = normalizeFluxOutputUrls(out.output);
  const contexto_geracao = buildImagePreviewContextMeta(
    idEmpresa,
    empresaRow,
    contextoRows,
    parsed.data.post_context_proposal,
    parsed.data.history,
  );
  res.json({
    prediction_id: out.prediction_id,
    status: out.status,
    model: out.model,
    image_urls,
    contexto_geracao,
    ...(referenceMeta ? { image_generation: referenceMeta } : {}),
  });
});

export default r;
