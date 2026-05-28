import { Router } from "express";
import { z } from "zod";
import { env } from "../config.js";
import { requireUserJwt } from "../middleware/requireUserJwt.js";
import { requireUsuario } from "../middleware/requireUsuario.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { ensureChatWorkerReady, runChatSerialized } from "../services/chatPythonWorker.js";
import { detectImageGenerationIntentFromHistory } from "../services/chatDeliveryUi.js";
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
import { handleImagePreview } from "./ia.imagePreview.js";

const r = Router();

const CONFIRM_IMAGE_UI = [{ id: "confirm_generate_image", label: "Gerar prévia da imagem" }];

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
    const route_image_generation =
      Boolean(parsed.data.id_empresa) &&
      Boolean(db) &&
      detectImageGenerationIntentFromHistory(parsed.data.history, parsed.data.question);

    const t0 = Date.now();
    const result = await runChatSerialized(parsed.data);
    const elapsedMs = Date.now() - t0;
    if (elapsedMs > 15_000) {
      console.info(`[ia/chat] resposta em ${Math.round(elapsedMs / 1000)}s`);
    }

    if (!result?.ok) {
      res.status(502).json({ error: result?.error || "Falha na IA" });
      return;
    }
    const answer = String(result.result || "");
    const source_documents = Array.isArray(result.source_documents) ? result.source_documents : [];

    res.json({
      answer,
      source_documents,
      ...(route_image_generation
        ? {
            route_image_generation: true,
            offer_post_context: true,
            image_provider: env.IMAGE_PROVIDER || "replicate",
            image_pipeline: env.IMAGE_PIPELINE || "raw",
          }
        : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar IA";
    const timedOut = /tempo esgotado|timed?\s*out/i.test(msg);
    res.status(timedOut ? 504 : 500).json({
      error: timedOut
        ? "A IA demorou mais que o limite configurado. Na primeira mensagem após reiniciar o backend, o índice pode levar vários minutos — aguarde e tente de novo."
        : msg,
    });
  }
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
  arte_brief: z.record(z.string(), z.unknown()).optional(),
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
  await handleImagePreview(req, res, db, assertEmpresaVinculo);
});

export default r;
