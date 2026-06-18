import { z } from "zod";
import { db, getMembroAtivoEmpresa, podeGerenciarMidias } from "../../modules/empresas/shared.js";
import { isPostModeloSlug } from "../../modules/empresas/postModelosCatalog.js";
import {
  mergePostModelosWithEmpresa,
  loadEmpresaModelosPostRows,
  loadActiveModeloContextoRowsForEmpresa,
  setPostModeloAtivoForEmpresa,
} from "../../services/postModelosService.js";

const postModeloSlugParam = z.object({
  idEmpresa: z.string().uuid(),
  slug: z.string().min(1).max(80),
});

const postModeloPatchBody = z.object({
  ativo: z.boolean(),
});

const LEGADO_CONTEXTO_MSG =
  "Contextos de campanha manual foram substituídos por modelos de post. Ative ou desative em Modelos de post no painel.";

export function registerContextosRoutes(r) {
  /** Modelos de post ativos — formato legado para o chat (`contextos`). */
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
        res.status(403).json({ error: "Sem permissão para acessar modelos desta empresa" });
        return;
      }
      const contextos = await loadActiveModeloContextoRowsForEmpresa(supabase, idEmpresa.data);
      res.json({ contextos });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.listContextos:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.post("/:idEmpresa/contextos", (_req, res) => {
    res.status(410).json({ error: LEGADO_CONTEXTO_MSG });
  });

  r.patch("/:idEmpresa/contextos/:idContexto", (_req, res) => {
    res.status(410).json({ error: LEGADO_CONTEXTO_MSG });
  });

  r.delete("/:idEmpresa/contextos/:idContexto", (_req, res) => {
    res.status(410).json({ error: LEGADO_CONTEXTO_MSG });
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
        res.status(403).json({ error: "Sem permissão para acessar modelos desta empresa" });
        return;
      }
      const rows = await loadEmpresaModelosPostRows(supabase, idEmpresa.data);
      res.json({ modelos: mergePostModelosWithEmpresa(rows) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.listModelosPost:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.patch("/:idEmpresa/modelos-post/:slug", async (req, res) => {
    try {
      const p = postModeloSlugParam.safeParse(req.params);
      if (!p.success) {
        res.status(400).json({ error: p.error.flatten() });
        return;
      }
      if (!isPostModeloSlug(p.data.slug)) {
        res.status(404).json({ error: "Modelo de post não encontrado" });
        return;
      }
      const body = postModeloPatchBody.safeParse(req.body ?? {});
      if (!body.success) {
        res.status(400).json({
          error: "Payload inválido",
          details: body.error.flatten(),
        });
        return;
      }
      const supabase = db();
      if (!supabase) {
        res.status(503).json({ error: "Supabase não configurado" });
        return;
      }
      const { data: membro, error: ePerm } = await getMembroAtivoEmpresa(
        supabase,
        p.data.idEmpresa,
        req.usuario.id_usuario,
      );
      if (ePerm) {
        res.status(500).json({ error: ePerm.message });
        return;
      }
      if (!membro || !podeGerenciarMidias(membro.cargo)) {
        res.status(403).json({
          error: "Sem permissão para alterar modelos de post",
          details: { cargo_detectado: membro?.cargo ?? null },
        });
        return;
      }
      const result = await setPostModeloAtivoForEmpresa(
        supabase,
        p.data.idEmpresa,
        req.usuario.id_usuario,
        p.data.slug,
        body.data.ativo,
      );
      res.json({ modelo: result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      const status = typeof e === "object" && e && "status" in e && typeof e.status === "number" ? e.status : 500;
      console.error("empresas.patchModeloPost:", e);
      if (!res.headersSent) res.status(status).json({ error: msg });
    }
  });
}
