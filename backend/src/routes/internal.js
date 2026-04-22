import { Router } from "express";
import { z } from "zod";
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

export default r;
