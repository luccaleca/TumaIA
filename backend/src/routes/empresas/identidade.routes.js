import { z } from "zod";
import {
  db,
  getMembroAtivoEmpresa,
  podeGerenciarMidias,
} from "../../modules/empresas/shared.js";
import {
  filterMidiasIdentidade,
  ORIGEM_UPLOAD_IDENTIDADE_FOTO,
  ORIGEM_UPLOAD_IDENTIDADE_LOGO,
} from "../../modules/empresas/midiaOrigem.js";
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
import {
  createIdentidadeAnaliseJob,
  findLatestIdentidadeAnaliseJob,
} from "../../services/identidadeAnaliseJobService.js";

const identidadeDadosBody = z.object({
  sobre_empresa: z.string().max(2000).optional(),
  segmento: z.string().max(200).optional(),
  tom_voz: z.string().max(500).optional(),
  estilo_visual: z.string().max(800).optional(),
  assinatura_visual: z.string().max(900).optional(),
  variacoes_campanha: z.string().max(900).optional(),
  regras_repeticao: z.string().max(900).optional(),
  estrategia_cor_campanha: z.string().max(600).optional(),
  evitar: z.string().max(800).optional(),
  publico: z.string().max(500).optional(),
  cor_primaria: z.string().max(20).optional(),
  cor_secundaria: z.string().max(20).optional(),
  cores_adicionais: z.array(z.string().max(20)).max(4).optional(),
  exemplo_frase_marca: z.string().max(120).optional(),
  site_url: z.string().max(500).optional(),
  id_midia_referencia_analise: z.string().uuid().nullable().optional(),
  id_midia_logo: z.string().uuid().nullable().optional(),
  legenda_referencia: z.string().max(2000).optional(),
});

const analisarBody = z
  .object({
    site_url: z.string().max(500).optional(),
    id_midia: z.string().uuid().optional(),
    legenda_post: z.string().max(2000).optional(),
    /** Imagem só para esta análise — não grava em Mídias. */
    image_base64: z.string().min(20).max(14_000_000).optional(),
    mime_type: z.string().max(80).optional(),
    nome_arquivo: z.string().max(260).optional(),
  })
  .refine((d) => !(d.id_midia && d.image_base64), {
    message: "Envie id_midia ou image_base64, não os dois.",
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

  r.get("/:idEmpresa/identidade/midias", async (req, res) => {
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

      const { data: midias, error: eList } = await supabase
        .from("midia")
        .select("*")
        .eq("id_empresa", idEmpresa.data)
        .eq("ativo", true)
        .order("data_criacao", { ascending: false });
      if (eList) {
        res.status(500).json({ error: eList.message });
        return;
      }
      const identidade = filterMidiasIdentidade(midias || []);
      res.json({
        midias: identidade.filter(
          (m) => String(m.origem_upload || "").trim() === ORIGEM_UPLOAD_IDENTIDADE_LOGO,
        ),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.getIdentidadeMidias:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.get("/:idEmpresa/identidade/analise-job", async (req, res) => {
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
      if (!membro || !podeGerenciarMidias(membro.cargo)) {
        res.status(403).json({ error: "Sem permissão para consultar análise da identidade" });
        return;
      }

      const job = await findLatestIdentidadeAnaliseJob(supabase, idEmpresa.data);
      res.json({ job });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.getIdentidadeAnaliseJob:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.post("/:idEmpresa/identidade/analise-job", async (req, res) => {
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
      if (!membro || !podeGerenciarMidias(membro.cargo)) {
        res.status(403).json({ error: "Sem permissão para iniciar análise da identidade" });
        return;
      }

      const out = await createIdentidadeAnaliseJob(
        supabase,
        idEmpresa.data,
        req.usuario.id_usuario,
        req.body ?? {},
      );
      if (!out.ok) {
        res.status(out.status || 500).json({
          error: out.error,
          ...(out.job ? { job: out.job } : {}),
        });
        return;
      }
      res.status(out.status || 201).json({ job: out.job });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.createIdentidadeAnaliseJob:", e);
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

  r.delete("/:idEmpresa/identidade", async (req, res) => {
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
      if (!membro || !podeGerenciarMidias(membro.cargo)) {
        res.status(403).json({ error: "Sem permissão para limpar identidade da marca" });
        return;
      }

      const existing = await findIdentidadeContextoRow(supabase, idEmpresa.data);
      if (existing?.id_contexto_empresa) {
        const { error: eCtx } = await supabase
          .from("contexto_empresa")
          .update({ ativo: false })
          .eq("id_contexto_empresa", existing.id_contexto_empresa)
          .eq("id_empresa", idEmpresa.data)
          .eq("ativo", true);
        if (eCtx) {
          res.status(500).json({ error: eCtx.message });
          return;
        }
      }

      const { error: eMidia } = await supabase
        .from("midia")
        .update({ ativo: false })
        .eq("id_empresa", idEmpresa.data)
        .eq("ativo", true)
        .in("origem_upload", [ORIGEM_UPLOAD_IDENTIDADE_FOTO, ORIGEM_UPLOAD_IDENTIDADE_LOGO]);
      if (eMidia) {
        res.status(500).json({ error: eMidia.message });
        return;
      }

      const dadosVazio = normalizeIdentidadeDados({});
      res.json({
        ok: true,
        identidade: {
          id_contexto_empresa: null,
          nome: "Identidade da marca",
          descricao: "",
          dados: dadosVazio,
          completude: identidadeCompletude(dadosVazio),
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.deleteIdentidade:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.post("/:idEmpresa/identidade/limpar-fotos-analise", async (req, res) => {
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
      if (!membro || !podeGerenciarMidias(membro.cargo)) {
        res.status(403).json({ error: "Sem permissão" });
        return;
      }

      const { error: eUp } = await supabase
        .from("midia")
        .update({ ativo: false })
        .eq("id_empresa", idEmpresa.data)
        .eq("ativo", true)
        .eq("origem_upload", ORIGEM_UPLOAD_IDENTIDADE_FOTO);
      if (eUp) {
        res.status(500).json({ error: eUp.message });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.limparFotosAnaliseIdentidade:", e);
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
        .select("nome_fantasia, descricao, segmento, site_empresa")
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
