import { getSupabaseAdmin } from "../supabaseAdmin.js";

/**
 * Depois de `requireUserJwt`, carrega a linha em `public.usuarios` em `req.usuario`.
 */
export async function requireUsuario(req, res, next) {
  try {
    if (!req.authUserId) {
      res.status(500).json({ error: "requireUsuario usado sem autenticação" });
      return;
    }

    const db = getSupabaseAdmin();
    if (!db) {
      res.status(503).json({ error: "Supabase não configurado no servidor" });
      return;
    }

    const { data, error } = await db
      .from("usuarios")
      .select("*")
      .eq("auth_user_id", req.authUserId)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: "Perfil de usuário não encontrado" });
      return;
    }

    req.usuario = data;
    next();
  } catch (e) {
    console.error("requireUsuario:", e);
    if (!res.headersSent) {
      res.status(500).json({
        error: e instanceof Error ? e.message : "Falha ao carregar usuário",
      });
    }
  }
}
