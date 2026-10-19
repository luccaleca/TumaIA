import { z } from "zod";
import { db } from "../../modules/empresas/shared.js";
import { buscarPlanoAtual } from "../../modules/empresas/planoAtualService.js";

const queryPlano = z.object({
  id_empresa: z.string().uuid().optional(),
});

export function registerPlanoRoutes(r) {
  /** Plano da empresa ativa do usuário (ou da empresa pedida, se ele for membro). */
  r.get("/plano-atual", async (req, res) => {
    try {
      const query = queryPlano.safeParse(req.query);
      if (!query.success) {
        res.status(400).json({ error: "id_empresa inválido" });
        return;
      }
      const supabase = db();
      if (!supabase) {
        res.status(503).json({ error: "Supabase não configurado" });
        return;
      }
      const out = await buscarPlanoAtual(supabase, {
        idUsuario: req.usuario.id_usuario,
        idEmpresaPreferida: query.data.id_empresa ?? null,
      });
      res.json(out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.plano-atual:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });
}
