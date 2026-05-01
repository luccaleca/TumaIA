import { createClient } from "@supabase/supabase-js";
import { env } from "./config.js";

const TABLE_NAME_MAP = {
  usuarios: "usuario",
  empresas: "empresa",
  usuarios_empresa: "usuario_empresa",
  empresa_convites: "empresa_convite",
  pastas: "pasta",
  midias: "midia",
  brand_profiles: "brand_profile",
};

function remapTableName(tableName) {
  const key = String(tableName || "").trim();
  return TABLE_NAME_MAP[key] || key;
}

function wrapClientWithTableAlias(client) {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (tableName) => target.from(remapTableName(tableName));
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** Cliente Supabase com service role — apenas no servidor. */
export function getSupabaseAdmin() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return wrapClientWithTableAlias(client);
}

/** Cliente com anon key — só no servidor (ex.: POST /auth/login). */
export function getSupabaseAnon() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return wrapClientWithTableAlias(client);
}
