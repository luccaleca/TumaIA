import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import health from "./routes/health.js";
import internal from "./routes/internal.js";
import auth from "./routes/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.use("/demo", express.static(path.join(__dirname, "../demo")));

  app.use("/health", health);
  app.use("/auth", auth);
  app.use("/internal", internal);

  return app;
}
