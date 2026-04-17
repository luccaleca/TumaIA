import { env } from "../config.js";

/** Rotas chamadas só pelo N8N (ou outro orquestrador); exige secret configurado. */
export function requireInternalSecret(req, res, next) {
  const expected = env.INTERNAL_WEBHOOK_SECRET;
  if (!expected) {
    res.status(503).json({ error: "INTERNAL_WEBHOOK_SECRET não configurado" });
    return;
  }
  const header = req.get("x-internal-secret");
  const bearer = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (header === expected || bearer === expected) {
    next();
    return;
  }
  res.status(401).json({ error: "Não autorizado" });
}
