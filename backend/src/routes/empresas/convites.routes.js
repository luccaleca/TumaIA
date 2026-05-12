import { executarCriacaoConviteAdmin, executarResgateConvite } from "../../modules/empresas/empresaConvites.js";
import { db } from "../../modules/empresas/shared.js";

/**
 * POST /convites/resgatar — antes de /:idEmpresa para o Express não confundir "convites" com UUID.
 * POST /:idEmpresa/convites — cria convite (admin).
 */
export function registerConvitesRoutes(r) {
  r.post("/convites/resgatar", async (req, res) => {
    try {
      const supabase = db();
      if (!supabase) {
        res.status(503).json({ error: "Supabase não configurado" });
        return;
      }

      const out = await executarResgateConvite(supabase, req.usuario.id_usuario, req.body);
      if (!out.ok) {
        res.status(out.status).json({ error: out.error });
        return;
      }
      res.status(out.status).json(out.body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.resgatar:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.post("/:idEmpresa/convites", async (req, res) => {
    try {
      const supabase = db();
      if (!supabase) {
        res.status(503).json({ error: "Supabase não configurado" });
        return;
      }

      const out = await executarCriacaoConviteAdmin(
        supabase,
        req.params.idEmpresa,
        req.usuario.id_usuario,
        req.body,
      );
      if (!out.ok) {
        res.status(out.status).json({ error: out.error });
        return;
      }
      res.status(out.status).json(out.body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.createConvite:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });
}
