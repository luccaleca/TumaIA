import express from "express";
import cors from "cors";
import health from "./routes/health.js";
import internal from "./routes/internal.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.use("/health", health);
  app.use("/internal", internal);

  return app;
}
