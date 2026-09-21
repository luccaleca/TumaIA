import express from "express";
import cors from "cors";
import health from "./routes/health.js";
import internal from "./routes/internal.js";
import auth from "./routes/auth.js";
import empresas from "./routes/empresas.js";
import ia from "./routes/ia.js";
import chat from "./routes/chat.js";
import whatsappCloud from "./routes/whatsappCloud.js";
import plataforma from "./routes/plataforma.js";
import tumacoreEmpresa from "./routes/tumacoreEmpresa.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(
    express.json({
      limit: "60mb",
      verify: (req, _res, buf) => {
        if (String(req.originalUrl || req.url || "").startsWith("/whatsapp/cloud")) {
          /** @type {import("express").Request & { rawBody?: Buffer }} */ (req).rawBody = buf;
        }
      },
    }),
  );

  // Demo está temporariamente desativada enquanto o frontend em Next.js evolui.
  app.get(["/demo", "/demo/"], (_req, res) => {
    res.status(410).json({ error: "Demo desativada temporariamente. Use o frontend Next.js." });
  });
  app.get("/demo/*", (_req, res) => {
    res.status(410).json({ error: "Demo desativada temporariamente. Use o frontend Next.js." });
  });

  app.use("/health", health);
  app.use("/auth", auth);
  app.use("/empresas", empresas);
  app.use("/ia", ia);
  app.use("/chat", chat);
  app.use("/plataforma", plataforma);
  app.use("/tumacore/empresa", tumacoreEmpresa);
  app.use("/internal", internal);
  app.use("/whatsapp/cloud", whatsappCloud);

  return app;
}
