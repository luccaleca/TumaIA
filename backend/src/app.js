import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import health from "./routes/health.js";
import internal from "./routes/internal.js";
import auth from "./routes/auth.js";
import empresas from "./routes/empresas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  // Abrir /demo vai para a capa do site; o app fica em /demo/index.html (simulação após login).
  app.get(["/demo", "/demo/"], (_req, res) => {
    res.redirect(302, "/demo/site/index.html");
  });

  app.use("/demo", express.static(path.join(__dirname, "../demo")));

  app.use("/health", health);
  app.use("/auth", auth);
  app.use("/empresas", empresas);
  app.use("/internal", internal);

  return app;
}
