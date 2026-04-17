import { Router } from "express";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config.js";
import { requireInternalSecret } from "../middleware/internalAuth.js";

const r = Router();
r.use(requireInternalSecret);

function supabase() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Ping simples para confirmar credenciais e conectividade. */
r.get("/supabase/ping", async (_req, res) => {
  const db = supabase();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado" });
    return;
  }
  const { data, error } = await db.from("brand_profiles").select("id").limit(1);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true, sampleCount: data?.length ?? 0 });
});

const contextBody = z.object({
  userId: z.string().min(1),
});

/** Contexto da marca no Supabase — ajuste tabela/colunas ao seu schema. */
r.post("/brand-context", async (req, res) => {
  const parsed = contextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const db = supabase();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado" });
    return;
  }

  const { data, error } = await db
    .from("brand_profiles")
    .select("context, updated_at")
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ context: data?.context ?? null });
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
  const db = supabase();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado" });
    return;
  }

  const { data, error } = await db
    .from("brand_profiles")
    .upsert(
      {
        user_id: parsed.data.userId,
        context: parsed.data.context,
      },
      { onConflict: "user_id" },
    )
    .select("user_id, updated_at")
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true, profile: data ?? null });
});

const generateBody = z.object({
  prompt: z.string().min(1),
  brandContext: z.record(z.unknown()).optional(),
});

r.post("/gemini/generate-text", async (req, res) => {
  const parsed = generateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (!env.GOOGLE_AI_API_KEY) {
    res.status(503).json({ error: "GOOGLE_AI_API_KEY não configurado" });
    return;
  }

  const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const system =
    "Você ajuda a criar posts para Instagram para PMEs: legenda curta, tom profissional, sugestão de hashtags por nicho.";
  const user = JSON.stringify({
    pedido: parsed.data.prompt,
    marca: parsed.data.brandContext ?? {},
  });

  try {
    const result = await model.generateContent(`${system}\n\n${user}`);
    const text = result.response.text();
    res.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro Gemini";
    res.status(500).json({ error: msg });
  }
});

export default r;
