import { Router } from "express";
import { z } from "zod";
import { env } from "../config.js";
import { requireInternalSecret } from "../middleware/internalAuth.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { getGeminiTextUsage, recordGeminiTextCall } from "../services/geminiUsage.js";
import {
  createPrediction,
  getModelLatestVersionId,
  getReplicateAccount,
  waitForPrediction,
} from "../services/replicateClient.js";
import {
  assertReplicateBurst,
  assertReplicateDailySuccessCap,
  getReplicateImageUsage,
  recordReplicateImageOutcome,
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

const fluxSchnellBody = z.object({
  prompt: z.string().min(3).max(2000),
  num_outputs: z.coerce.number().int().min(1).max(4).optional().default(1),
  aspect_ratio: z
    .enum([
      "1:1",
      "16:9",
      "21:9",
      "2:3",
      "3:2",
      "4:5",
      "5:4",
      "9:16",
      "9:21",
    ])
    .optional()
    .default("1:1"),
  output_format: z.enum(["webp", "jpg", "png"]).optional().default("png"),
  output_quality: z.coerce.number().int().min(1).max(100).optional().default(80),
});

const gerarConteudoBody = z.object({
  tema: z.string().min(3).max(500),
  publico: z.string().min(2).max(300).optional(),
  tom: z.string().min(2).max(100).optional(),
  objetivo: z.string().min(2).max(200).optional(),
  limiteHashtags: z.coerce.number().int().min(1).max(30).optional(),
});

async function gerarTextoGemini(prompt) {
  const apiKey = env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Configure GEMINI_API_KEY (ou GOOGLE_AI_API_KEY)");
  }

  const model = "gemini-2.5-flash";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const detail = payload?.error?.message || `Falha HTTP ${response.status}`;
    throw new Error(detail);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Resposta vazia do Gemini");

  const usageMetadata = payload?.usageMetadata || {};
  const usage = {
    inputTokens: Number(usageMetadata.promptTokenCount || 0),
    outputTokens: Number(usageMetadata.candidatesTokenCount || 0),
    totalTokens: Number(usageMetadata.totalTokenCount || 0),
  };
  const resolvedModel = payload?.modelVersion || model;

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const parseError = new Error("Gemini retornou JSON inválido");
    parseError.geminiUsage = usage;
    parseError.geminiModel = resolvedModel;
    throw parseError;
  }

  return {
    parsed,
    usage,
    model: resolvedModel,
  };
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

    const result = await gerarTextoGemini(prompt);
    const normalized = {
      copy: String(result?.parsed?.copy || "").trim(),
      descricao: String(result?.parsed?.descricao || "").trim(),
      hashtags: Array.isArray(result?.parsed?.hashtags)
        ? result.parsed.hashtags.map((h) => String(h).trim()).filter(Boolean).slice(0, limiteHashtags)
        : [],
      model: result?.model || "gemini-2.5-flash",
    };

    if (!normalized.copy || !normalized.descricao) {
      await recordGeminiTextCall({
        ok: false,
        status: 502,
        inputTokens: result?.usage?.inputTokens,
        outputTokens: result?.usage?.outputTokens,
        totalTokens: result?.usage?.totalTokens,
        model: normalized.model,
      });
      res.status(502).json({ error: "Resposta incompleta do Gemini", raw: result?.parsed });
      return;
    }

    await recordGeminiTextCall({
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
    await recordGeminiTextCall({
      ok: false,
      status: 500,
      inputTokens: err?.geminiUsage?.inputTokens,
      outputTokens: err?.geminiUsage?.outputTokens,
      totalTokens: err?.geminiUsage?.totalTokens,
      model: err?.geminiModel,
    });
    res.status(500).json({ error: message });
  }
});

/** Confirma `REPLICATE_API_TOKEN` (mesma ideia do `npm run check:replicate`). */
r.get("/replicate/ping", async (_req, res) => {
  const pingLimit = env.REPLICATE_PING_PER_MINUTE ?? 30;
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
  const dailyCap = env.REPLICATE_DAILY_SUCCESS_CAP ?? 0;
  const capCheck = await assertReplicateDailySuccessCap(dailyCap);
  if (!capCheck.ok) {
    res.status(429).json({
      error: "Limite diário de gerações Replicate atingido (sucessos). Ajuste REPLICATE_DAILY_SUCCESS_CAP ou aguarde o próximo dia.",
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
      .json({ error: "Muitas gerações por minuto; aguarde ou reduza a frequência." });
    return;
  }

  const token = env.REPLICATE_API_TOKEN;
  if (!token) {
    res.status(503).json({ error: "REPLICATE_API_TOKEN não configurado" });
    return;
  }

  const parsed = fluxSchnellBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const owner = "black-forest-labs";
  const model = "flux-schnell";

  try {
    const version = await getModelLatestVersionId(token, owner, model);
    const created = await createPrediction(token, {
      version,
      input: {
        prompt: parsed.data.prompt,
        num_outputs: parsed.data.num_outputs,
        aspect_ratio: parsed.data.aspect_ratio,
        output_format: parsed.data.output_format,
        output_quality: parsed.data.output_quality,
      },
    });
    const getUrl = created?.urls?.get;
    if (!getUrl || typeof getUrl !== "string") {
      await recordReplicateImageOutcome({
        ok: false,
        status: 502,
        model: `${owner}/${model}`,
        prediction_id: created?.id ?? null,
      });
      res.status(502).json({ error: "Replicate não retornou urls.get", raw: created });
      return;
    }
    const final = await waitForPrediction(token, getUrl);
    await recordReplicateImageOutcome({
      ok: true,
      status: 200,
      model: `${owner}/${model}`,
      prediction_id: final.id ?? null,
    });
    res.json({
      prediction_id: final.id,
      status: final.status,
      output: final.output,
      model: `${owner}/${model}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao gerar imagem";
    const httpStatus =
      err?.status === 402
        ? 402
        : err?.status && Number(err.status) >= 400 && Number(err.status) < 600
          ? Number(err.status)
          : 500;
    await recordReplicateImageOutcome({
      ok: false,
      status: httpStatus,
      model: `${owner}/${model}`,
      prediction_id: err?.prediction?.id ?? null,
    });
    res.status(httpStatus).json({ error: message });
  }
});

/** Uso local de gerações Replicate (arquivo em `ia/usage/`, como o Gemini). */
r.get("/replicate/usage", async (_req, res) => {
  try {
    const usage = await getReplicateImageUsage();
    const cap = Number(env.REPLICATE_DAILY_SUCCESS_CAP ?? 0);
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

/** Contador local de uso diário do Gemini texto (rota interna para observabilidade). */
r.get("/social-content/usage", async (_req, res) => {
  try {
    const usage = await getGeminiTextUsage();
    const budget = Number(env.GEMINI_DAILY_TOKEN_BUDGET || 0);
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
      error: err instanceof Error ? err.message : "Erro ao ler uso Gemini",
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
