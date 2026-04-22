import express from "express";
import cors from "cors";
import health from "./routes/health.js";
import internal from "./routes/internal.js";
import auth from "./routes/auth.js";
import empresas from "./routes/empresas.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "60mb" }));

  app.use("/health", health);
  app.use("/auth", auth);
  app.use("/empresas", empresas);
  app.use("/internal", internal);

  return app;
}
