import { z } from "zod";
import { db, getMembroAtivoEmpresa } from "../../modules/empresas/shared.js";

const REMOVED_MSG =
  "Modelos de post foram removidos. Use identidade da marca, mídias do acervo e o pedido no chat.";

export function registerContextosRoutes(r) {
  r.get("/:idEmpresa/contextos", async (req, res) => {
    try {
      const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
      if (!idEmpresa.success) {
        res.status(400).json({ error: "id_empresa inválido" });
        return;
      }
      const supabase = db();
      if (!supabase) {
        res.status(503).json({ error: "Supabase não configurado" });
        return;
      }
      const { data: membro, error: ePerm } = await getMembroAtivoEmpresa(
        supabase,
        idEmpresa.data,
        req.usuario.id_usuario,
      );
      if (ePerm) {
        res.status(500).json({ error: ePerm.message });
        return;
      }
      if (!membro) {
        res.status(403).json({ error: "Sem permissão para acessar esta empresa" });
        return;
      }
      res.json({ contextos: [] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.listContextos:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.post("/:idEmpresa/contextos", (_req, res) => {
    res.status(410).json({ error: REMOVED_MSG });
  });

  r.patch("/:idEmpresa/contextos/:idContexto", (_req, res) => {
    res.status(410).json({ error: REMOVED_MSG });
  });

  r.delete("/:idEmpresa/contextos/:idContexto", (_req, res) => {
    res.status(410).json({ error: REMOVED_MSG });
  });

  r.get("/:idEmpresa/modelos-post", async (req, res) => {
    try {
      const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
      if (!idEmpresa.success) {
        res.status(400).json({ error: "id_empresa inválido" });
        return;
      }
      const supabase = db();
      if (!supabase) {
        res.status(503).json({ error: "Supabase não configurado" });
        return;
      }
      const { data: membro, error: ePerm } = await getMembroAtivoEmpresa(
        supabase,
        idEmpresa.data,
        req.usuario.id_usuario,
      );
      if (ePerm) {
        res.status(500).json({ error: ePerm.message });
        return;
      }
      if (!membro) {
        res.status(403).json({ error: "Sem permissão" });
        return;
      }
      res.json({ modelos: [] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.listModelosPost:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.patch("/:idEmpresa/modelos-post/:slug", (_req, res) => {
    res.status(410).json({ error: REMOVED_MSG });
  });
}
