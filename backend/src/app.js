import express from "express";
import cors from "cors";
import health from "./routes/health.js";
import internal from "./routes/internal.js";
import auth from "./routes/auth.js";
import empresas from "./routes/empresas.js";
import ia from "./routes/ia.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "60mb" }));

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
  app.use("/internal", internal);

  return app;
}
