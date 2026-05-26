import { z } from "zod";
import {
  db,
  empresaFotoPerfilBody,
  getMembroAtivoEmpresa,
  podeGerenciarMidias,
  updateEmpresaBody,
} from "../../modules/empresas/shared.js";
import {
  criarEmpresaParaUsuario,
  montarRowPatchEmpresa,
} from "../../modules/empresas/empresaCriacao.js";
import {
  aplicarFotoPerfilEmpresa,
  removerFotoPerfilEmpresa,
} from "../../modules/empresas/empresaFotoPerfil.js";
import {
  desativarEmpresa,
  sairDaEmpresa,
} from "../../modules/empresas/empresaDesativacao.js";
import { montarListaMinhasEmpresas } from "../../modules/empresas/empresaListagem.js";
import { resolveIdEmpresaUltimaUsuario } from "../../modules/auth/usuarioEmpresaUltimaService.js";

const desativarEmpresaBody = z.object({
  confirmacao_nome: z.string().min(1).max(200),
});

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

      let id_empresa_ultima = null;
      try {
        id_empresa_ultima = await resolveIdEmpresaUltimaUsuario(
          supabase,
          req.usuario.id_usuario,
          empresaIds,
        );
      } catch (err) {
        console.warn("empresas.minhas id_empresa_ultima:", err);
      }

      res.json({ empresas: lista, id_empresa_ultima });
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

  r.post("/:idEmpresa/foto-perfil", async (req, res) => {
    try {
      const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
      if (!idEmpresa.success) {
        res.status(400).json({ error: "id_empresa inválido" });
        return;
      }
      const parsed = empresaFotoPerfilBody.safeParse(req.body ?? {});
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
        res.status(403).json({ error: "Sem permissão para alterar a foto da empresa" });
        return;
      }
      let buffer;
      try {
        buffer = Buffer.from(parsed.data.base64_data, "base64");
      } catch {
        res.status(400).json({ error: "base64_data inválido" });
        return;
      }
      if (!buffer.length) {
        res.status(400).json({ error: "Arquivo vazio" });
        return;
      }
      try {
        const empresa = await aplicarFotoPerfilEmpresa(
          supabase,
          idEmpresa.data,
          buffer,
          parsed.data.mime_type,
        );
        res.json({ empresa });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao enviar foto";
        res.status(400).json({ error: msg });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.fotoPerfilUpload:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.delete("/:idEmpresa/foto-perfil", async (req, res) => {
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
        res.status(403).json({ error: "Sem permissão para remover a foto da empresa" });
        return;
      }
      try {
        const empresa = await removerFotoPerfilEmpresa(supabase, idEmpresa.data);
        res.json({ empresa });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao remover foto";
        res.status(500).json({ error: msg });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.fotoPerfilDelete:", e);
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

      const row = montarRowPatchEmpresa(parsed.data);

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

  r.post("/:idEmpresa/sair", async (req, res) => {
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

      const out = await sairDaEmpresa(supabase, idEmpresa.data, req.usuario.id_usuario);
      if (!out.ok) {
        res.status(out.status).json({ error: out.error });
        return;
      }
      res.json({ saiu: true, nome_fantasia: out.nome_fantasia });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.sair:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.post("/:idEmpresa/desativar", async (req, res) => {
    try {
      const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
      if (!idEmpresa.success) {
        res.status(400).json({ error: "id_empresa inválido" });
        return;
      }
      const parsed = desativarEmpresaBody.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const supabase = db();
      if (!supabase) {
        res.status(503).json({ error: "Supabase não configurado" });
        return;
      }

      const out = await desativarEmpresa(
        supabase,
        idEmpresa.data,
        req.usuario.id_usuario,
        parsed.data.confirmacao_nome,
      );
      if (!out.ok) {
        res.status(out.status).json({ error: out.error });
        return;
      }
      res.json({
        desativada: true,
        id_empresa: out.id_empresa,
        nome_fantasia: out.nome_fantasia,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.desativar:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });
}
