import { Router } from "express";
import { env } from "../config.js";
import { handleWppconnectWebhook } from "../services/whatsappBridge.js";
import {
  isWppconnectEnabled,
  wppconnectCheckSession,
} from "../services/wppconnectClient.js";

const r = Router();

function assertWebhookSecret(req, res) {
  const expected = env.WPPCONNECT_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  const header = req.get("x-wppconnect-secret");
  const query = req.query?.secret;
  if (header === expected || query === expected) return true;
  res.status(401).json({ error: "Webhook WPPConnect não autorizado." });
  return false;
}

/**
 * WPPConnect Server envia POST aqui (evento onmessage).
 * Configure em wppconnect-server: webhook.url = http://SEU_BACKEND:4000/wppconnect/webhook
 */
r.post("/webhook", (req, res) => {
  if (!assertWebhookSecret(req, res)) return;

  void (async () => {
    try {
      const out = await handleWppconnectWebhook(req.body);
      if (!out.ok) {
        res.status(out.status || 500).json({ error: out.error });
        return;
      }
      res.status(200).json(out);
    } catch (err) {
      console.error("[wppconnect/webhook]", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Erro no webhook WPPConnect.",
      });
    }
  })();
});

/** Status da integração (útil para debug local). */
r.get("/status", async (_req, res) => {
  if (!isWppconnectEnabled()) {
    res.json({
      enabled: false,
      hint: "Defina WPPCONNECT_ENABLED=true no backend/.env",
    });
    return;
  }

  const session = await wppconnectCheckSession();
  res.json({
    enabled: true,
    session: session.session,
    connected: session.ok,
    connection_status: session.status,
    error: session.error,
    webhook_path: "/wppconnect/webhook",
    auth_mode: "usuario_telefone_e_workspace",
  });
});

export default r;
