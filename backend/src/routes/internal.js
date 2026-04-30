import { Router } from "express";
import { z } from "zod";
import { env } from "../config.js";
import { requireInternalSecret } from "../middleware/internalAuth.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { getGeminiTextUsage, recordGeminiTextCall } from "../services/geminiUsage.js";

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
