import { Router } from "express";
import { z } from "zod";
import { env } from "../config.js";
import { DEFAULT_OLLAMA_CHAT_MODEL } from "../ollamaDefaults.js";
import { requireInternalSecret } from "../middleware/internalAuth.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { getLlamaTextUsage, recordLlamaTextCall } from "../services/llamaUsage.js";
import { llamaChatCompletionJson } from "../services/llamaOpenAiClient.js";
import { getReplicateAccount } from "../services/replicateClient.js";
import { executeFluxSchnell, fluxSchnellInputSchema } from "../services/fluxSchnellService.js";
import {
  assertReplicateBillingAllowed,
  assertReplicateBurst,
  assertReplicateDailySuccessCap,
  getReplicateImageUsage,
} from "../services/replicateUsage.js";

const r = Router();
r.use(requireInternalSecret);

function supabase() {
  return getSupabaseAdmin();
}

/** Ping simples para confirmar credenciais e conectividade. */
r.get("/supabase/ping", async (_req, res) => {
  const db = supabase();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado" });
    return;
  }
  const { data, error } = await db.from("empresa").select("id_empresa").limit(1);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true, sampleCount: data?.length ?? 0 });
});

const contextBody = z.object({
  userId: z.string().min(1),
});

const gerarConteudoBody = z.object({
  tema: z.string().min(3).max(500),
  publico: z.string().min(2).max(300).optional(),
  tom: z.string().min(2).max(100).optional(),
  objetivo: z.string().min(2).max(200).optional(),
  limiteHashtags: z.coerce.number().int().min(1).max(30).optional(),
});

async function gerarTextoLlamaJson(prompt) {
  if (!(env.LLAMA_BASE_URL?.trim() || env.LLAMA_MODEL?.trim())) {
    throw new Error("Configure LLAMA_BASE_URL e/ou LLAMA_MODEL (API OpenAI-compatível, ex. Ollama).");
  }
  return llamaChatCompletionJson(prompt, { temperature: 0.8 });
}

/**
 * Gera copy, descrição e hashtags para post.
 * Ideal para ser chamado por n8n/automação via segredo interno.
 */
r.post("/social-content", async (req, res) => {
  const parsed = gerarConteudoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const data = parsed.data;
    const limiteHashtags = data.limiteHashtags ?? 10;
    const prompt = `
Você é um estrategista de marketing digital para Instagram.
Gere conteúdo em português do Brasil no formato JSON estrito.

Contexto:
- Tema do post: ${data.tema}
- Público alvo: ${data.publico ?? "não informado"}
- Tom de voz: ${data.tom ?? "profissional e acessível"}
- Objetivo do post: ${data.objetivo ?? "engajamento e autoridade"}

Regras:
1) Retorne APENAS JSON válido.
2) Campos obrigatórios: "copy", "descricao", "hashtags".
3) "copy": legenda pronta para postar (máx. 900 caracteres).
4) "descricao": resumo curto do post para uso interno (1 a 2 frases).
5) "hashtags": array com até ${limiteHashtags} hashtags, sem espaços e iniciando com #.
`;

    const result = await gerarTextoLlamaJson(prompt);
    const normalized = {
      copy: String(result?.parsed?.copy || "").trim(),
      descricao: String(result?.parsed?.descricao || "").trim(),
      hashtags: Array.isArray(result?.parsed?.hashtags)
        ? result.parsed.hashtags.map((h) => String(h).trim()).filter(Boolean).slice(0, limiteHashtags)
        : [],
      model: result?.model || env.LLAMA_MODEL || DEFAULT_OLLAMA_CHAT_MODEL,
    };

    if (!normalized.copy || !normalized.descricao) {
      await recordLlamaTextCall({
        ok: false,
        status: 502,
        inputTokens: result?.usage?.inputTokens,
        outputTokens: result?.usage?.outputTokens,
        totalTokens: result?.usage?.totalTokens,
        model: normalized.model,
      });
      res.status(502).json({ error: "Resposta incompleta do modelo", raw: result?.parsed });
      return;
    }

    await recordLlamaTextCall({
      ok: true,
      status: 200,
      inputTokens: result?.usage?.inputTokens,
      outputTokens: result?.usage?.outputTokens,
      totalTokens: result?.usage?.totalTokens,
      model: normalized.model,
    });
    res.json(normalized);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao gerar conteúdo";
    await recordLlamaTextCall({
      ok: false,
      status: 500,
      inputTokens: err?.llmUsage?.inputTokens,
      outputTokens: err?.llmUsage?.outputTokens,
      totalTokens: err?.llmUsage?.totalTokens,
      model: err?.llmModel,
    });
    res.status(500).json({ error: message });
  }
});

/** Confirma `REPLICATE_API_TOKEN` (mesma ideia do `npm run check:replicate`). */
r.get("/replicate/ping", async (_req, res) => {
  const pingLimit = env.REPLICATE_PING_PER_MINUTE;
  const burst = assertReplicateBurst("ping", pingLimit);
  if (!burst.ok) {
    res
      .status(429)
      .set("Retry-After", String(Math.max(1, burst.retryAfterSec ?? 60)))
      .json({ error: "Muitas verificações Replicate; aguarde um instante." });
    return;
  }

  const token = env.REPLICATE_API_TOKEN;
  if (!token) {
    res.status(503).json({ error: "REPLICATE_API_TOKEN não configurado" });
    return;
  }
  try {
    const account = await getReplicateAccount(token);
    res.json({
      ok: true,
      type: account?.type ?? null,
      username: account?.username ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro Replicate";
    const status = err?.status && Number(err.status) >= 400 ? Number(err.status) : 500;
    res.status(status).json({ error: message });
  }
});

/**
 * Gera imagem com `black-forest-labs/flux-schnell` (custo por imagem na conta Replicate).
 * Chame com header `x-internal-secret` (igual às demais rotas `/internal/*`).
 */
r.post("/replicate/flux-schnell", async (req, res) => {
  const billing = assertReplicateBillingAllowed();
  if (!billing.ok) {
    res.status(billing.status).json({ error: billing.error });
    return;
  }

  const dailyCap = env.REPLICATE_DAILY_SUCCESS_CAP;
  const capCheck = await assertReplicateDailySuccessCap(dailyCap);
  if (!capCheck.ok) {
    res.status(429).json({
      error: "Limite diário de gerações Replicate atingido (sucessos). Ajuste REPLICATE_DAILY_SUCCESS_CAP ou aguarde o próximo dia.",
      successes: capCheck.successes,
      cap: capCheck.cap,
    });
    return;
  }

  const postBurstLimit = env.REPLICATE_BURST_PER_MINUTE;
  const burst = assertReplicateBurst("post", postBurstLimit);
  if (!burst.ok) {
    res
      .status(429)
      .set("Retry-After", String(Math.max(1, burst.retryAfterSec ?? 60)))
      .json({ error: "Muitas gerações por minuto; aguarde ou reduza a frequência." });
    return;
  }

  const token = env.REPLICATE_API_TOKEN;
  if (!token) {
    res.status(503).json({ error: "REPLICATE_API_TOKEN não configurado" });
    return;
  }

  const parsed = fluxSchnellInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const out = await executeFluxSchnell(token, parsed.data);
  if (!out.ok) {
    res.status(out.status || 500).json({
      error: out.error || "Erro ao gerar imagem",
      raw: out.raw,
    });
    return;
  }
  res.json({
    prediction_id: out.prediction_id,
    status: out.status,
    output: out.output,
    model: out.model,
  });
});

/** Uso local de gerações Replicate (arquivo em `ia/usage/`). */
r.get("/replicate/usage", async (_req, res) => {
  try {
    const usage = await getReplicateImageUsage();
    const cap = env.REPLICATE_DAILY_SUCCESS_CAP;
    const successes = Number(usage?.today?.successes || 0);
    res.json({
      ...usage,
      budget: {
        daily_success_cap: cap > 0 ? cap : null,
        successes_today: successes,
        remaining_successes_today: cap > 0 ? Math.max(0, cap - successes) : null,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao ler uso Replicate",
    });
  }
});

/** Contador local de uso diário de texto (Llama / API compatível) para observabilidade. */
r.get("/social-content/usage", async (_req, res) => {
  try {
    const usage = await getLlamaTextUsage();
    const budget = Number(env.LLAMA_DAILY_TOKEN_BUDGET || 0);
    const used = Number(usage?.today?.total_tokens || 0);
    const remaining = budget > 0 ? Math.max(0, budget - used) : null;
    res.json({
      ...usage,
      budget: {
        daily_token_budget: budget > 0 ? budget : null,
        used_tokens_today: used,
        remaining_tokens_today: remaining,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao ler uso de texto (Llama)",
    });
  }
});

/** Contexto da marca no Supabase — ajuste tabela/colunas ao seu schema. */
r.post("/brand-context", async (req, res) => {
  const parsed = contextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.status(501).json({
    error:
      "Rota desativada: tabela de contexto de marca antiga removida do schema.",
  });
});

const upsertContextBody = z.object({
  userId: z.string().min(1),
  context: z.record(z.unknown()),
});

/** Salva/atualiza o contexto da marca. Ideal para o painel (Next) ou setup inicial. */
r.post("/brand-context/upsert", async (req, res) => {
  const parsed = upsertContextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.status(501).json({
    error:
      "Rota desativada: tabela de contexto de marca antiga removida do schema.",
  });
});

export default r;
