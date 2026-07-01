import { Router } from "express";
import { z } from "zod";
import { requireUserJwt } from "../middleware/requireUserJwt.js";
import { requireUsuario } from "../middleware/requireUsuario.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { processChatMessage } from "../services/processChatMessage.js";
import { generatePostContextProposal } from "../services/postContextProposalService.js";
import { loadContextosEmpresaAtivos } from "../services/imagePreviewPrompt.js";
import {
  allBrandColorsFromIdentidade,
  partitionContextosIdentidade,
} from "../modules/empresas/identidadeMarca.js";
import { ARTE_FORMAT_PRESETS } from "../services/arteFormatPresets.js";
import { defaultArteBrief } from "../services/rawImageArteBrief.js";
import {
  guessImageDownloadFilename,
  isAllowedImageDownloadUrl,
} from "../services/imageDownloadUrl.js";
import { handleImagePreview, handleImageGenerationPlan } from "./ia.imagePreview.js";
import {
  CHAT_API_HISTORY_MAX,
  trimChatHistoryForApi,
} from "../services/chatHistoryLimit.js";
import { generatePostCaption } from "../services/postCaptionService.js";
import { publishToInstagramViaN8n } from "../services/instagramPublishService.js";

const r = Router();

const historyEntrySchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(6000),
});

const CONFIRM_IMAGE_UI = [{ id: "confirm_generate_image", label: "Gerar imagem" }];

export const POST_IMAGE_UI = [
  { id: "revise_image", label: "Alterar imagem" },
  { id: "generate_caption", label: "Gerar legenda" },
];

const bodySchema = z.object({
  question: z.string().trim().min(1).max(4000),
  history: z
    .array(historyEntrySchema)
    .max(CHAT_API_HISTORY_MAX * 3)
    .optional()
    .transform((arr) => trimChatHistoryForApi(arr)),
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

  const v = await assertEmpresaVinculo(req, parsed.data.id_empresa);
  if (!v.ok) {
    res.status(v.status).json({ error: v.error });
    return;
  }

  const out = await processChatMessage(parsed.data);
  if (!out.ok) {
    res.status(out.status).json({ error: out.error });
    return;
  }
  res.json(out.data);
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
    .max(CHAT_API_HISTORY_MAX * 3)
    .transform((arr) => trimChatHistoryForApi(arr) ?? []),
  id_empresa: z.string().uuid(),
  arte_brief: z.record(z.string(), z.unknown()).optional(),
  focus_contexto_id: z.string().uuid().optional(),
  reference_midia_ids: z.array(z.string().uuid()).max(4).optional(),
});

const postCaptionBodySchema = z.object({
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(8000),
      }),
    )
    .min(1)
    .max(CHAT_API_HISTORY_MAX * 3)
    .transform((arr) => trimChatHistoryForApi(arr) ?? []),
  id_empresa: z.string().uuid(),
  post_context_proposal: z.record(z.string(), z.unknown()).optional(),
  limite_hashtags: z.coerce.number().int().min(3).max(30).optional(),
});

const arteBriefDefaultsQuerySchema = z.object({
  id_empresa: z.string().uuid(),
});

/**
 * Brief inicial da arte (formato + cores da marca) — exibido no início do chat.
 */
r.get("/arte-brief-defaults", requireUserJwt, requireUsuario, async (req, res) => {
  const parsed = arteBriefDefaultsQuerySchema.safeParse(req.query);
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
    const contextoRows = await loadContextosEmpresaAtivos(db, parsed.data.id_empresa);
    const { identidadeDados } = partitionContextosIdentidade(contextoRows);
    const brandColors = identidadeDados ? allBrandColorsFromIdentidade(identidadeDados) : [];
    res.json({
      arte_brief: defaultArteBrief(brandColors),
      format_presets: ARTE_FORMAT_PRESETS,
      brand_colors: brandColors,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao carregar brief da arte",
    });
  }
});

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
    const out = await generatePostContextProposal({
      history: parsed.data.history,
      idEmpresa: parsed.data.id_empresa,
      db,
      arteBriefDraft: parsed.data.arte_brief,
      attachmentMidiaIds: parsed.data.reference_midia_ids,
      focusContextoId: parsed.data.focus_contexto_id,
    });
    const ready = out.briefing_status !== "collecting";
    res.json({
      confirmation_message: out.confirmation_message,
      links: out.links,
      post_context_proposal: out.post_context_proposal,
      briefing_status: out.briefing_status || (ready ? "ready" : "collecting"),
      missing_slots: Array.isArray(out.missing_slots) ? out.missing_slots : [],
      meta: out._meta,
      ui_actions: ready ? CONFIRM_IMAGE_UI : [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao montar confirmação de contexto";
    const status = err?.status && Number(err.status) >= 400 && Number(err.status) < 600 ? Number(err.status) : 500;
    res.status(status).json({ error: msg });
  }
});

/** Legenda + hashtags após prévia da imagem. */
r.post("/post-caption", requireUserJwt, requireUsuario, async (req, res) => {
  const parsed = postCaptionBodySchema.safeParse(req.body);
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
    const out = await generatePostCaption({
      history: parsed.data.history,
      idEmpresa: parsed.data.id_empresa,
      db,
      postContextProposal: parsed.data.post_context_proposal,
      limiteHashtags: parsed.data.limite_hashtags,
    });
    res.json(out);
  } catch (err) {
    const status =
      err?.status && Number(err.status) >= 400 && Number(err.status) < 600 ? Number(err.status) : 500;
    res.status(status).json({
      error: err instanceof Error ? err.message : "Erro ao gerar legenda",
    });
  }
});

const imageDownloadQuerySchema = z.object({
  url: z.string().url().max(4000),
});

/** Proxy de download da prévia (URLs externas com CORS restrito). */
r.get("/image-download", requireUserJwt, requireUsuario, async (req, res) => {
  const parsed = imageDownloadQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "URL inválida." });
    return;
  }
  const target = parsed.data.url;
  if (!isAllowedImageDownloadUrl(target)) {
    res.status(400).json({ error: "Origem da imagem não permitida para download." });
    return;
  }
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 60_000);
  try {
    const upstream = await fetch(target, { signal: controller.signal });
    clearTimeout(tid);
    if (!upstream.ok) {
      res.status(502).json({ error: "Não foi possível buscar a imagem na origem." });
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    const type = upstream.headers.get("content-type") || "image/png";
    const filename = guessImageDownloadFilename(target);
    res.setHeader("Content-Type", type.split(";")[0].trim() || "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(buf);
  } catch (err) {
    clearTimeout(tid);
    const msg = err instanceof Error ? err.message : "Erro ao baixar imagem";
    res.status(500).json({ error: msg });
  }
});

/** Prévia de imagem: GPT Image 2 (padrão) ou FLUX legado (`IMAGE_PROVIDER=replicate`). */
r.post("/image-preview", requireUserJwt, requireUsuario, async (req, res) => {
  const db = getSupabaseAdmin();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado no servidor" });
    return;
  }
  try {
    await handleImagePreview(req, res, db, assertEmpresaVinculo);
  } catch (err) {
    if (res.headersSent) {
      console.error("[ia/image-preview] erro após resposta:", err);
      return;
    }
    console.error("[ia/image-preview] erro não tratado:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro interno ao gerar a prévia.",
    });
  }
});

/** Plano de geração (sem cobrar): referências, prompt resumido e bloqueios antes de `/image-preview`. */
r.post("/image-preview/plan", requireUserJwt, requireUsuario, async (req, res) => {
  const db = getSupabaseAdmin();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado no servidor" });
    return;
  }
  await handleImageGenerationPlan(req, res, db, assertEmpresaVinculo);
});

const publishInstagramBodySchema = z.object({
  id_empresa: z.string().uuid(),
  caption: z.string().trim().min(1).max(2200),
  image_storage_path: z.string().trim().min(3).max(500).optional(),
  image_url: z.string().url().max(4000).optional(),
  client_id: z.string().trim().min(1).max(64).optional(),
}).superRefine((data, ctx) => {
  if (!data.image_storage_path?.trim() && !data.image_url?.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Informe image_storage_path ou image_url",
      path: ["image_storage_path"],
    });
  }
});

/** Publica post no Instagram via n8n (imagem pública no Supabase + legenda). */
r.post("/publish-instagram", requireUserJwt, requireUsuario, async (req, res) => {
  const parsed = publishInstagramBodySchema.safeParse(req.body);
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
    const out = await publishToInstagramViaN8n(db, {
      idEmpresa: parsed.data.id_empresa,
      caption: parsed.data.caption,
      imageStoragePath: parsed.data.image_storage_path,
      imageUrl: parsed.data.image_url,
      clientId: parsed.data.client_id,
    });
    if (!out.ok) {
      res.status(out.status || 500).json({ error: out.error, ...(out.n8n_response ? { n8n: out.n8n_response } : {}) });
      return;
    }
    res.json({
      success: true,
      message: out.message,
      instagram_media_id: out.instagram_media_id,
      image_url: out.image_url,
      storage_path: out.storage_path,
    });
  } catch (err) {
    console.error("[ia/publish-instagram]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao publicar no Instagram.",
    });
  }
});

export default r;
