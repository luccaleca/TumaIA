import { z } from "zod";
import { montarListaMembrosComUsuarios } from "../../modules/empresas/empresaListagem.js";
import { db, membroParam, patchMembroBody, perfilAcessoPorCargo, getMembroAtivoEmpresa } from "../../modules/empresas/shared.js";

export function registerMembrosRoutes(r) {
  r.get("/:idEmpresa/membros", async (req, res) => {
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

      const { data: membroAtual, error: ePerm } = await supabase
        .from("usuario_empresa")
        .select("id")
        .eq("id_empresa", idEmpresa.data)
        .eq("id_usuario", req.usuario.id_usuario)
        .eq("ativo", true)
        .maybeSingle();

      if (ePerm) {
        res.status(500).json({ error: ePerm.message });
        return;
      }

      if (!membroAtual) {
        res.status(403).json({ error: "Sem permissão para listar membros desta empresa" });
        return;
      }

      const { data: membros, error: eList } = await supabase
        .from("usuario_empresa")
        .select("id_usuario, cargo, perfil_acesso, responsavel_operacional, receber_alertas, ativo")
        .eq("id_empresa", idEmpresa.data)
        .eq("ativo", true);

      if (eList) {
        res.status(500).json({ error: eList.message });
        return;
      }

      const idsUsuarios = [...new Set((membros || []).map((m) => m.id_usuario).filter(Boolean))];
      let usuariosRows = [];
      if (idsUsuarios.length) {
        const { data: rows, error: eUsers } = await supabase
          .from("usuario")
          .select("id_usuario, nome, email")
          .in("id_usuario", idsUsuarios);
        if (eUsers) {
          res.status(500).json({ error: eUsers.message });
          return;
        }
        usuariosRows = rows || [];
      }

      const lista = montarListaMembrosComUsuarios(membros, usuariosRows);

      res.json({ membros: lista });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.membros:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.patch("/:idEmpresa/membros/:idUsuario", async (req, res) => {
    try {
      const p = membroParam.safeParse(req.params);
      if (!p.success) {
        res.status(400).json({ error: p.error.flatten() });
        return;
      }
      const b = patchMembroBody.safeParse(req.body ?? {});
      if (!b.success) {
        res.status(400).json({ error: b.error.flatten() });
        return;
      }

      const supabase = db();
      if (!supabase) {
        res.status(503).json({ error: "Supabase não configurado" });
        return;
      }

      const { data: admin, error: ePerm } = await getMembroAtivoEmpresa(
        supabase,
        p.data.idEmpresa,
        req.usuario.id_usuario,
      );

      if (ePerm) {
        res.status(500).json({ error: ePerm.message });
        return;
      }
      if (!admin || admin.cargo !== "administrador") {
        res.status(403).json({ error: "Sem permissão para gerenciar membros" });
        return;
      }

      const { data: updated, error: eUp } = await supabase
        .from("usuario_empresa")
        .update({
          cargo: b.data.cargo,
          perfil_acesso: perfilAcessoPorCargo(b.data.cargo),
        })
        .eq("id_empresa", p.data.idEmpresa)
        .eq("id_usuario", p.data.idUsuario)
        .eq("ativo", true)
        .select("id_usuario, cargo, perfil_acesso, ativo")
        .maybeSingle();

      if (eUp) {
        res.status(500).json({ error: eUp.message });
        return;
      }
      if (!updated) {
        res.status(404).json({ error: "Membro não encontrado" });
        return;
      }

      res.json({ membro: updated });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.patchMembro:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.delete("/:idEmpresa/membros/:idUsuario", async (req, res) => {
    try {
      const p = membroParam.safeParse(req.params);
      if (!p.success) {
        res.status(400).json({ error: p.error.flatten() });
        return;
      }

      if (p.data.idUsuario === req.usuario.id_usuario) {
        res.status(400).json({ error: "Você não pode remover a si mesmo" });
        return;
      }

      const supabase = db();
      if (!supabase) {
        res.status(503).json({ error: "Supabase não configurado" });
        return;
      }

      const { data: admin, error: ePerm } = await getMembroAtivoEmpresa(
        supabase,
        p.data.idEmpresa,
        req.usuario.id_usuario,
      );

      if (ePerm) {
        res.status(500).json({ error: ePerm.message });
        return;
      }
      if (!admin || admin.cargo !== "administrador") {
        res.status(403).json({ error: "Sem permissão para gerenciar membros" });
        return;
      }

      const { data: updated, error: eUp } = await supabase
        .from("usuario_empresa")
        .update({ ativo: false })
        .eq("id_empresa", p.data.idEmpresa)
        .eq("id_usuario", p.data.idUsuario)
        .eq("ativo", true)
        .select("id_usuario, ativo")
        .maybeSingle();

      if (eUp) {
        res.status(500).json({ error: eUp.message });
        return;
      }
      if (!updated) {
        res.status(404).json({ error: "Membro não encontrado" });
        return;
      }

      res.json({ removido: true, id_usuario: updated.id_usuario });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.deleteMembro:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });
}
