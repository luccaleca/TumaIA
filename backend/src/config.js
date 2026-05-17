import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const empty = (v) => (v === "" || v === undefined ? undefined : v);

/** `true` só com valores explícitos; vazio / inválido = `defaultVal` (fail-closed). */
function parseEnvBool(v, defaultVal = false) {
  if (v === "" || v === undefined) return defaultVal;
  const s = String(v).trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(s)) return false;
  if (["1", "true", "yes", "on"].includes(s)) return true;
  return defaultVal;
}

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  INTERNAL_WEBHOOK_SECRET: z.preprocess(empty, z.string().min(1).optional()),
  SUPABASE_URL: z.preprocess(empty, z.string().url().optional()),
  SUPABASE_ANON_KEY: z.preprocess(empty, z.string().optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(empty, z.string().optional()),
  DATABASE_URL: z.preprocess(empty, z.string().optional()),
  /** API OpenAI-compatível (ex.: Ollama `http://127.0.0.1:11434/v1`). */
  LLAMA_BASE_URL: z.preprocess(empty, z.string().url().optional()),
  LLAMA_MODEL: z.preprocess(empty, z.string().min(1).optional()),
  /** Modelo só para `post-context-proposal` (ex. `llama3.2:1b` se o 3b for lento). */
  LLAMA_PROPOSAL_MODEL: z.preprocess(empty, z.string().min(1).optional()),
  /** Modelo multimodal para análise de imagem (ex. `llava:7b` no Ollama). */
  LLAMA_VISION_MODEL: z.preprocess(empty, z.string().min(1).optional()),
  LLAMA_API_KEY: z.preprocess(empty, z.string().optional()),
  LLAMA_DAILY_TOKEN_BUDGET: z.preprocess(empty, z.coerce.number().int().positive().optional()),
  MEDIA_BUCKET: z.preprocess(empty, z.string().optional()),
  /** Loga o prompt completo de `/ia/image-preview` no stderr (só para depuração local). */
  IMAGE_PREVIEW_LOG_PROMPT: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  REPLICATE_API_TOKEN: z.preprocess(empty, z.string().min(1).optional()),
  /**
   * Só com `true`/`1`/`yes`/`on` gera imagem (rotas que debitam na Replicate).
   * Token sozinho não gasta; evita deploy com chave e esquecimento.
   */
  REPLICATE_ALLOW_BILLING: z.preprocess((v) => parseEnvBool(v, false), z.boolean()),
  /** Máx. POST que debitam Replicate por minuto (0 = sem limite). Padrão 6. */
  REPLICATE_BURST_PER_MINUTE: z.preprocess(
    (v) => (v === "" || v === undefined ? 6 : Number(v)),
    z.number().int().min(0).max(300),
  ),
  /** Máx. GET /internal/replicate/ping por minuto (0 = sem limite). Padrão 10. */
  REPLICATE_PING_PER_MINUTE: z.preprocess(
    (v) => (v === "" || v === undefined ? 10 : Number(v)),
    z.number().int().min(0).max(300),
  ),
  /** Máx. gerações com sucesso por dia (0 = ilimitado). Padrão 50. */
  REPLICATE_DAILY_SUCCESS_CAP: z.preprocess(
    (v) => (v === "" || v === undefined ? 50 : Number(v)),
    z.number().int().min(0).max(100_000),
  ),
});

export const env = envSchema.parse(process.env);
