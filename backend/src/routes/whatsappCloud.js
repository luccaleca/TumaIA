import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { env } from "../config.js";
import { handleWhatsappCloudWebhook } from "../services/whatsappBridge.js";
import {
  isWhatsappCloudConfigured,
  isWhatsappCloudEnabled,
  whatsappCloudCheckPhone,
} from "../services/whatsappCloudClient.js";

const r = Router();

/**
 * Verificação do webhook (Meta → GET hub.challenge).
 */
r.get("/webhook", (req, res) => {
  const mode = String(req.query["hub.mode"] || "");
  const token = String(req.query["hub.verify_token"] || "");
  const challenge = String(req.query["hub.challenge"] || "");
  const expected = String(env.WHATSAPP_CLOUD_VERIFY_TOKEN || "").trim();

  if (mode === "subscribe" && expected && token === expected) {
    res.status(200).type("text/plain").send(challenge);
    return;
  }
  res.status(403).json({ error: "Verificação do webhook WhatsApp Cloud recusada." });
});

/**
 * @param {import("express").Request} req
 */
function assertCloudSignature(req) {
  const secret = env.WHATSAPP_CLOUD_APP_SECRET?.trim();
  if (!secret) return true;
  const header = String(req.get("x-hub-signature-256") || "");
  const match = /^sha256=(.+)$/i.exec(header);
  if (!match) return false;
  const raw = req.rawBody;
  if (!raw || !Buffer.isBuffer(raw)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const got = match[1];
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(got, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Eventos inbound (Meta → POST).
 */
r.post("/webhook", (req, res) => {
  if (!isWhatsappCloudEnabled()) {
    res.status(503).json({ error: "WHATSAPP_CLOUD_ENABLED não está ativo." });
    return;
  }
  if (!assertCloudSignature(req)) {
    res.status(401).json({ error: "Assinatura do webhook inválida." });
    return;
  }

  void (async () => {
    try {
      const out = await handleWhatsappCloudWebhook(req.body);
      if (!out.ok) {
        res.status(out.status || 500).json({ error: out.error });
        return;
      }
      res.status(200).json(out);
    } catch (err) {
      console.error("[whatsapp-cloud/webhook]", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Erro no webhook Cloud.",
      });
    }
  })();
});

r.get("/status", async (_req, res) => {
  if (!isWhatsappCloudEnabled()) {
    res.json({
      enabled: false,
      configured: isWhatsappCloudConfigured(),
      hint: "Defina WHATSAPP_CLOUD_ENABLED=true no backend/.env",
    });
    return;
  }

  const phone = await whatsappCloudCheckPhone();
  res.json({
    enabled: true,
    configured: isWhatsappCloudConfigured(),
    webhook_path: "/whatsapp/cloud/webhook",
    phone_number_id: env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || null,
    waba_id: env.WHATSAPP_CLOUD_WABA_ID || null,
    connected: Boolean(phone.ok),
    display_phone_number: phone.display_phone_number || null,
    status: phone.status || null,
    platform_type: phone.platform_type || null,
    error: phone.error,
    verify_token_set: Boolean(env.WHATSAPP_CLOUD_VERIFY_TOKEN?.trim()),
    hint: phone.ok
      ? "Exponha esta URL com HTTPS (ngrok/tunnel) no painel Meta → Webhooks."
      : phone.error || "Número Cloud não CONNECTED — confira Phone number ID e token.",
  });
});

export default r;
