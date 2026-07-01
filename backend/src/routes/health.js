import { Router } from "express";
import { env } from "../config.js";

const r = Router();

async function probeSupabase() {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { configured: false, ok: false, hint: "SUPABASE_URL ou SERVICE_ROLE_KEY ausentes no .env" };
  }
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    let hint;
    if (res.status === 521) {
      hint = "Projeto Supabase pausado — reative em supabase.com/dashboard";
    } else if (!res.ok) {
      hint = `Supabase respondeu HTTP ${res.status}`;
    }
    return { configured: true, ok: res.ok, status: res.status, hint };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      hint: "Não foi possível alcançar o Supabase",
    };
  }
}

r.get("/", async (_req, res) => {
  const supabase = await probeSupabase();
  res.json({
    ok: true,
    service: "tumaia-backend",
    /** false = login, chat e WhatsApp com IA não funcionam (precisam do banco). */
    ready: !supabase.configured || supabase.ok,
    supabase,
  });
});

export default r;
