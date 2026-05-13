import { Router } from "express";
import { z } from "zod";
import { env } from "../config.js";
import { requireUserJwt } from "../middleware/requireUserJwt.js";
import { requireUsuario } from "../middleware/requireUsuario.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { runChatSerialized } from "../services/chatPythonWorker.js";
import { DELIVERY_UI_ACTIONS, shouldOfferDeliveryButtons } from "../services/chatDeliveryUi.js";
import { executeFluxSchnell, fluxSchnellInputSchema } from "../services/fluxSchnellService.js";
import { assertReplicateBurst, assertReplicateDailySuccessCap } from "../services/replicateUsage.js";

const r = Router();

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

  const v = await assertEmpresaVinculo(req, parsed.data.id_empresa);
  if (!v.ok) {
    res.status(v.status).json({ error: v.error });
    return;
  }

  try {
    const result = await runChatSerialized(parsed.data);
    if (!result?.ok) {
      res.status(502).json({ error: result?.error || "Falha na IA" });
      return;
    }
    const answer = String(result.result || "");
    const source_documents = Array.isArray(result.source_documents) ? result.source_documents : [];
    const ui_actions = shouldOfferDeliveryButtons(parsed.data.question) ? DELIVERY_UI_ACTIONS : undefined;
    res.json({
      answer,
      source_documents,
      ...(ui_actions ? { ui_actions } : {}),
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
    .max(30),
  id_empresa: z.string().uuid().optional(),
  aspect_ratio: fluxSchnellInputSchema.shape.aspect_ratio.optional(),
});

function normalizeFluxOutputUrls(output) {
  if (output == null) return [];
  if (Array.isArray(output)) return output.filter((u) => typeof u === "string" && u.trim());
  if (typeof output === "string" && output.trim()) return [output.trim()];
  return [];
}

function buildImagePromptFromHistory(history) {
  const tail = history.slice(-10);
  const block = tail
    .map((m) => `${m.role === "user" ? "Cliente" : "Assistente"}: ${String(m.content).slice(0, 700)}`)
    .join("\n")
    .slice(0, 1700);
  return `Professional marketing key visual for social media (single image). Brazilian Portuguese brand context. Clean composition, high quality, avoid unreadable small text overlays.\n\nConversation context:\n${block}`;
}

/**
 * Prévia FLUX autenticada (JWT). Mesmos limites de rajada/dia que `/internal/replicate/flux-schnell`.
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

  const dailyCap = env.REPLICATE_DAILY_SUCCESS_CAP ?? 0;
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

  const postBurstLimit = env.REPLICATE_BURST_PER_MINUTE ?? 15;
  const burst = assertReplicateBurst("post", postBurstLimit);
  if (!burst.ok) {
    res
      .status(429)
      .set("Retry-After", String(Math.max(1, burst.retryAfterSec ?? 60)))
      .json({ error: "Muitas gerações por minuto; aguarde um instante." });
    return;
  }

  const token = env.REPLICATE_API_TOKEN;
  if (!token) {
    res.status(503).json({ error: "Geração de imagem não configurada no servidor (REPLICATE_API_TOKEN)." });
    return;
  }

  const prompt = buildImagePromptFromHistory(parsed.data.history);
  const fluxInput = fluxSchnellInputSchema.parse({
    prompt,
    aspect_ratio: parsed.data.aspect_ratio,
    num_outputs: 1,
    output_format: "png",
    output_quality: 80,
  });

  const out = await executeFluxSchnell(token, fluxInput);
  if (!out.ok) {
    res.status(out.status || 500).json({ error: out.error || "Falha na geração", raw: out.raw });
    return;
  }

  const image_urls = normalizeFluxOutputUrls(out.output);
  res.json({
    prediction_id: out.prediction_id,
    status: out.status,
    model: out.model,
    image_urls,
  });
});

export default r;
