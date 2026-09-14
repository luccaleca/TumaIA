import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { resolveTumaCoreEmpresaAutorizada } from "../modules/tumacore/empresaAuth.js";

/**
 * Depois de requireUserJwt + requireUsuario: administrador de empresa ativo.
 * Define `req.tumacoreEmpresa = { id_empresa, empresa, cargo }`.
 * Não usa id_empresa de query/body/params para autorização.
 */
export async function requireTumaCoreEmpresa(req, res, next) {
  try {
    const db = getSupabaseAdmin();
    if (!db) {
      res.status(503).json({ error: "Supabase não configurado no servidor" });
      return;
    }

    const out = await resolveTumaCoreEmpresaAutorizada(db, req.usuario);
    if (!out.ok) {
      res.status(out.status || 403).json({
        error: out.error || "Acesso restrito ao TumaCore Empresa.",
      });
      return;
    }

    req.tumacoreEmpresa = {
      id_empresa: out.id_empresa,
      empresa: out.empresa,
      cargo: out.cargo,
    };
    next();
  } catch (e) {
    console.error("requireTumaCoreEmpresa:", e);
    if (!res.headersSent) {
      res.status(500).json({
        error: e instanceof Error ? e.message : "Falha ao autorizar TumaCore Empresa",
      });
    }
  }
}
