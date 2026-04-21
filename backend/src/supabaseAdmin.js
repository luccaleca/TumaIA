import { createClient } from "@supabase/supabase-js";
import { env } from "./config.js";

/** Cliente Supabase com service role — apenas no servidor. */
export function getSupabaseAdmin() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente com anon key — só no servidor (ex.: POST /auth/login). */
export function getSupabaseAnon() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
