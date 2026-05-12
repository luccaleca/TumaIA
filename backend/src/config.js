import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const empty = (v) => (v === "" || v === undefined ? undefined : v);

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  INTERNAL_WEBHOOK_SECRET: z.preprocess(empty, z.string().min(1).optional()),
  SUPABASE_URL: z.preprocess(empty, z.string().url().optional()),
  SUPABASE_ANON_KEY: z.preprocess(empty, z.string().optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(empty, z.string().optional()),
  DATABASE_URL: z.preprocess(empty, z.string().optional()),
  GEMINI_API_KEY: z.preprocess(empty, z.string().optional()),
  GOOGLE_AI_API_KEY: z.preprocess(empty, z.string().optional()),
  GEMINI_DAILY_TOKEN_BUDGET: z.preprocess(empty, z.coerce.number().int().positive().optional()),
  MEDIA_BUCKET: z.preprocess(empty, z.string().optional()),
  REPLICATE_API_TOKEN: z.preprocess(empty, z.string().min(1).optional()),
  /** Máx. POST /internal/replicate/flux-schnell por minuto (0 = sem limite). */
  REPLICATE_BURST_PER_MINUTE: z.preprocess(empty, z.coerce.number().int().min(0).max(300).optional()),
  /** Máx. GET /internal/replicate/ping por minuto (0 = sem limite). */
  REPLICATE_PING_PER_MINUTE: z.preprocess(empty, z.coerce.number().int().min(0).max(300).optional()),
  /** Máx. gerações com sucesso por dia (0 = sem limite). Protege crédito sem lógica comercial. */
  REPLICATE_DAILY_SUCCESS_CAP: z.preprocess(empty, z.coerce.number().int().min(0).optional()),
});

export const env = envSchema.parse(process.env);
