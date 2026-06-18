import { Router } from "express";
import { z } from "zod";
import { requireInternalSecret } from "../middleware/internalAuth.js";
import { handleWhatsappInbound, resetWhatsappConversation } from "../services/whatsappInboundService.js";

const r = Router();
r.use(requireInternalSecret);

const messageBodySchema = z.object({
  from: z.string().min(8).max(40),
  body: z.string().trim().min(1).max(4000),
  message_id: z.string().max(120).optional(),
});

const fromBodySchema = z.object({
  from: z.string().min(8).max(40),
});

/**
 * Webhook n8n / WPPConnect → uma mensagem de texto do usuário.
 * Mantém histórico em memória por telefone e devolve texto (+ URLs de imagem quando houver).
 */
r.post("/message", async (req, res) => {
  const parsed = messageBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const out = await handleWhatsappInbound(parsed.data);
    if (!out.ok) {
      res.status(out.status || 500).json({ error: out.error || "Erro ao processar mensagem." });
      return;
    }
    res.json(out);
  } catch (err) {
    console.error("[internal/whatsapp/message]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro interno ao processar WhatsApp.",
    });
  }
});

/** Limpa histórico da sessão demo (útil para testes). */
r.post("/reset", async (req, res) => {
  const parsed = fromBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const out = resetWhatsappConversation(parsed.data.from);
  if (!out.ok) {
    res.status(out.status || 500).json({ error: out.error });
    return;
  }
  res.json(out);
});

export default r;
