import { z } from "zod";
import {
  db,
  getMembroAtivoEmpresa,
  podeGerenciarMidias,
  updateEmpresaBody,
} from "../../modules/empresas/shared.js";
import { criarEmpresaParaUsuario } from "../../modules/empresas/empresaCriacao.js";
import { montarListaMinhasEmpresas } from "../../modules/empresas/empresaListagem.js";

export function registerEmpresaCoreRoutes(r) {
  r.get("/minhas", async (req, res) => {
    try {
      const supabase = db();
      if (!supabase) {
        res.status(503).json({ error: "Supabase não configurado" });
        return;
      }

      const { data: membros, error: e1 } = await supabase
        .from("usuario_empresa")
        .select("cargo, perfil_acesso, responsavel_operacional, receber_alertas, id_empresa")
        .eq("id_usuario", req.usuario.id_usuario)
        .eq("ativo", true);

      if (e1) {
        res.status(500).json({ error: e1.message });
        return;
      }

      const empresaIds = [...new Set((membros || []).map((m) => m.id_empresa).filter(Boolean))];
      let empresasRows = [];
      if (empresaIds.length) {
        const { data: rows, error: eEmps } = await supabase
          .from("empresa")
          .select("*")
          .in("id_empresa", empresaIds);
        if (eEmps) {
          res.status(500).json({ error: eEmps.message });
          return;
        }
        empresasRows = rows || [];
      }

      const lista = montarListaMinhasEmpresas(membros, empresasRows);

      res.json({ empresas: lista });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.minhas:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.post("/", async (req, res) => {
    try {
      const supabase = db();
      if (!supabase) {
        res.status(503).json({ error: "Supabase não configurado" });
        return;
      }

      const out = await criarEmpresaParaUsuario(supabase, req.usuario.id_usuario, req.body);
      if (!out.ok) {
        res.status(out.status).json({ error: out.error });
        return;
      }

      res.status(201).json({ empresa: out.empresa });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.create:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.patch("/:idEmpresa", async (req, res) => {
    try {
      const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
      if (!idEmpresa.success) {
        res.status(400).json({ error: "id_empresa inválido" });
        return;
      }

      const parsed = updateEmpresaBody.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
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
        res.status(403).json({ error: "Sem permissão para editar os dados desta empresa" });
        return;
      }

      const b = parsed.data;
      const row = {};
      if (b.nome_fantasia !== undefined) row.nome_fantasia = b.nome_fantasia;
      if (b.razao_social !== undefined) row.razao_social = b.razao_social ?? null;
      if (b.descricao !== undefined) row.descricao = b.descricao ?? null;
      if (b.instagram_empresa !== undefined) row.instagram_empresa = b.instagram_empresa ?? null;
      if (b.telefone_principal !== undefined) row.telefone_principal = b.telefone_principal ?? null;
      if (b.segmento !== undefined) row.segmento = b.segmento ?? null;
      if (b.cnpj !== undefined) row.cnpj = b.cnpj ?? null;
      if (b.email_principal !== undefined) row.email_principal = b.email_principal ?? null;
      if (b.nome_contato_principal !== undefined) {
        row.nome_contato_principal = b.nome_contato_principal ?? null;
      }

      const { data: updated, error: eUp } = await supabase
        .from("empresa")
        .update(row)
        .eq("id_empresa", idEmpresa.data)
        .select("*")
        .maybeSingle();

      if (eUp) {
        const msg = String(eUp.message || "");
        if (/duplicate|unique/i.test(msg) && /cnpj/i.test(msg)) {
          res.status(409).json({ error: "Já existe outra empresa com este CNPJ." });
          return;
        }
        res.status(500).json({ error: eUp.message });
        return;
      }
      if (!updated) {
        res.status(404).json({ error: "Empresa não encontrada" });
        return;
      }

      res.json({ empresa: updated });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.patchEmpresa:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });
}
