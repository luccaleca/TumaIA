import "dotenv/config";
import { z } from "zod";

const empty = (v) => (v === "" || v === undefined ? undefined : v);

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  INTERNAL_WEBHOOK_SECRET: z.preprocess(empty, z.string().min(1).optional()),
  SUPABASE_URL: z.preprocess(empty, z.string().url().optional()),
  SUPABASE_ANON_KEY: z.preprocess(empty, z.string().optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(empty, z.string().optional()),
  DATABASE_URL: z.preprocess(empty, z.string().optional()),
  GOOGLE_AI_API_KEY: z.preprocess(empty, z.string().optional()),
  /** Se true, POST /auth/register inclui login_probe (testa signIn logo após criar usuário). */
  AUTH_DEBUG_LOGIN_PROBE: z.preprocess(
    (v) => {
      const x = empty(v);
      if (x === undefined) return false;
      return ["true", "1", "yes"].includes(String(x).toLowerCase());
    },
    z.boolean(),
  ).default(false),
});

export const env = envSchema.parse(process.env);
