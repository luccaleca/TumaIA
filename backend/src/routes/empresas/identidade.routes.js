import { z } from "zod";
import {
  db,
  getMembroAtivoEmpresa,
  podeGerenciarMidias,
} from "../../modules/empresas/shared.js";
import {
  identidadeCompletude,
  identidadeFromContextoRow,
  normalizeIdentidadeDados,
} from "../../modules/empresas/identidadeMarca.js";
import {
  analisarIdentidadeMarca,
  findIdentidadeContextoRow,
  upsertIdentidadeMarca,
} from "../../services/identidadeMarcaService.js";

const identidadeDadosBody = z.object({
  sobre_empresa: z.string().max(2000).optional(),
  segmento: z.string().max(200).optional(),
  tom_voz: z.string().max(500).optional(),
  estilo_visual: z.string().max(800).optional(),
  evitar: z.string().max(800).optional(),
  publico: z.string().max(500).optional(),
  cor_primaria: z.string().max(20).optional(),
  cor_secundaria: z.string().max(20).optional(),
  exemplo_frase_marca: z.string().max(120).optional(),
  site_url: z.string().max(500).optional(),
  id_midia_referencia_analise: z.string().uuid().nullable().optional(),
  legenda_referencia: z.string().max(2000).optional(),
});

const analisarBody = z.object({
  site_url: z.string().max(500).optional(),
  id_midia: z.string().uuid().optional(),
  legenda_post: z.string().max(2000).optional(),
});

export function registerIdentidadeRoutes(r) {
  r.get("/:idEmpresa/identidade", async (req, res) => {
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

      const row = await findIdentidadeContextoRow(supabase, idEmpresa.data);
      const identidade = identidadeFromContextoRow(row);
      const dadosVazio = normalizeIdentidadeDados({});
      res.json({
        identidade: identidade || {
          id_contexto_empresa: null,
          nome: "Identidade da marca",
          descricao: "",
          dados: dadosVazio,
          completude: identidadeCompletude(dadosVazio),
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.getIdentidade:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.put("/:idEmpresa/identidade", async (req, res) => {
    try {
      const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
      if (!idEmpresa.success) {
        res.status(400).json({ error: "id_empresa inválido" });
        return;
      }
      const body = identidadeDadosBody.safeParse(req.body ?? {});
      if (!body.success) {
        res.status(400).json({ error: body.error.flatten() });
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
      if (!membro || !podeGerenciarMidias(membro.cargo)) {
        res.status(403).json({ error: "Sem permissão para editar identidade da marca" });
        return;
      }

      const existing = await findIdentidadeContextoRow(supabase, idEmpresa.data);
      const prev =
        existing?.dados_json && typeof existing.dados_json === "object" ? existing.dados_json : {};
      const merged = normalizeIdentidadeDados({ ...prev, ...body.data });

      const saved = await upsertIdentidadeMarca(
        supabase,
        idEmpresa.data,
        req.usuario.id_usuario,
        merged,
      );
      res.json({ identidade: identidadeFromContextoRow(saved) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.putIdentidade:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.post("/:idEmpresa/identidade/analisar", async (req, res) => {
    try {
      const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
      if (!idEmpresa.success) {
        res.status(400).json({ error: "id_empresa inválido" });
        return;
      }
      const body = analisarBody.safeParse(req.body ?? {});
      if (!body.success) {
        res.status(400).json({ error: body.error.flatten() });
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
      if (!membro || !podeGerenciarMidias(membro.cargo)) {
        res.status(403).json({ error: "Sem permissão para analisar identidade" });
        return;
      }

      const { data: empresaRow } = await supabase
        .from("empresa")
        .select("nome_fantasia, descricao, segmento")
        .eq("id_empresa", idEmpresa.data)
        .maybeSingle();

      const out = await analisarIdentidadeMarca(supabase, idEmpresa.data, body.data, empresaRow);
      res.json(out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.analisarIdentidade:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });
}
