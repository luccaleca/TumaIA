import { getSupabaseAdmin } from "../supabaseAdmin.js";

/**
 * Valida JWT do Supabase (Authorization: Bearer) e define req.authUserId.
 */
export async function requireUserJwt(req, res, next) {
  try {
    const header = req.get("authorization");
    const token = header?.replace(/^Bearer\s+/i, "")?.trim();

    if (!token) {
      res.status(401).json({ error: "Authorization Bearer ausente" });
      return;
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      res.status(503).json({ error: "Supabase não configurado no servidor" });
      return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Token inválido ou expirado" });
      return;
    }

    req.authUserId = user.id;
    next();
  } catch (e) {
    console.error("requireUserJwt:", e);
    if (!res.headersSent) {
      res.status(500).json({
        error: e instanceof Error ? e.message : "Falha ao validar token",
      });
    }
  }
}
