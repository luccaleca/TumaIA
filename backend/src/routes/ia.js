import { Router } from "express";
import { z } from "zod";
import { requireUserJwt } from "../middleware/requireUserJwt.js";
import { requireUsuario } from "../middleware/requireUsuario.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { runChatSerialized } from "../services/chatPythonWorker.js";

const r = Router();

const bodySchema = z.object({
  question: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(6000),
      })
    )
    .max(24)
    .optional(),
  /** Empresa em sessão: validamos vínculo; a IA injeta o cadastro de ``public.empresa``. */
  id_empresa: z.string().uuid().optional(),
});

r.post("/chat", requireUserJwt, requireUsuario, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const idEmpresa = parsed.data.id_empresa;
  if (idEmpresa) {
    const db = getSupabaseAdmin();
    if (!db) {
      res.status(503).json({ error: "Supabase não configurado no servidor" });
      return;
    }
    const { data: vinculo, error: eV } = await db
      .from("usuario_empresa")
      .select("id")
      .eq("id_usuario", req.usuario.id_usuario)
      .eq("id_empresa", idEmpresa)
      .eq("ativo", true)
      .maybeSingle();
    if (eV) {
      res.status(500).json({ error: eV.message });
      return;
    }
    if (!vinculo) {
      res.status(403).json({ error: "Sem acesso a esta empresa ou vínculo inativo." });
      return;
    }
  }

  try {
    const result = await runChatSerialized(parsed.data);
    if (!result?.ok) {
      res.status(502).json({ error: result?.error || "Falha na IA" });
      return;
    }
    res.json({
      answer: String(result.result || ""),
      source_documents: Array.isArray(result.source_documents) ? result.source_documents : [],
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao consultar IA",
    });
  }
});

export default r;
