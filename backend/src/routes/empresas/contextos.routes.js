import { z } from "zod";
import {
  contextoBody,
  contextoParam,
  db,
  getMembroAtivoEmpresa,
  normalizeContextoPayload,
  podeGerenciarMidias,
  resolverTipoETemplate,
} from "../../modules/empresas/shared.js";

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
        res.status(403).json({ error: "Sem permissão para acessar contextos desta empresa" });
        return;
      }
      const { data: rows, error: eList } = await supabase
        .from("contexto_empresa")
        .select(
          "id_contexto_empresa, nome, descricao, schema_json, dados_json, data_criacao, data_atualizacao",
        )
        .eq("id_empresa", idEmpresa.data)
        .eq("ativo", true)
        .order("data_criacao", { ascending: false });
      if (eList) {
        res.status(500).json({ error: eList.message });
        return;
      }
      res.json({ contextos: rows || [] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.listContextos:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.post("/:idEmpresa/contextos", async (req, res) => {
    try {
      const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
      if (!idEmpresa.success) {
        res.status(400).json({ error: "id_empresa inválido" });
        return;
      }
      const body = contextoBody.safeParse(req.body ?? {});
      if (!body.success) {
        res.status(400).json({
          error: "Payload de contexto invalido",
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
        idEmpresa.data,
        req.usuario.id_usuario,
      );
      if (ePerm) {
        res.status(500).json({ error: ePerm.message });
        return;
      }
      if (!membro || !podeGerenciarMidias(membro.cargo)) {
        res.status(403).json({
          error: "Sem permissão para criar contexto",
          details: {
            cargo_detectado: membro?.cargo ?? null,
          },
        });
        return;
      }
      const payload = normalizeContextoPayload(body.data);
      const resolved = await resolverTipoETemplate(supabase, payload.tipo);
      const { data: created, error: eInsert } = await supabase
        .from("contexto_empresa")
        .insert({
          id_empresa: idEmpresa.data,
          id_tipo_contexto: resolved.idTipoContexto,
          id_template: resolved.idTemplate,
          criado_por_usuario_id: req.usuario.id_usuario,
          nome: payload.nome || `${resolved.nomeTipoContexto} ${new Date().toLocaleDateString("pt-BR")}`,
          descricao: payload.descricao,
          schema_json: {
            tipo: payload.tipo,
            versao: 1,
          },
          dados_json: {
            tipo: payload.tipo,
            ...payload.dados,
          },
          ativo: true,
        })
        .select(
          "id_contexto_empresa, nome, descricao, schema_json, dados_json, data_criacao, data_atualizacao",
        )
        .single();
      if (eInsert) {
        res.status(500).json({ error: eInsert.message });
        return;
      }
      res.status(201).json({ contexto: created });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.createContexto:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.patch("/:idEmpresa/contextos/:idContexto", async (req, res) => {
    try {
      const p = contextoParam.safeParse(req.params);
      if (!p.success) {
        res.status(400).json({ error: p.error.flatten() });
        return;
      }
      const body = contextoBody.safeParse(req.body ?? {});
      if (!body.success) {
        res.status(400).json({
          error: "Payload de contexto invalido",
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
          error: "Sem permissão para editar contexto",
          details: {
            cargo_detectado: membro?.cargo ?? null,
          },
        });
        return;
      }
      const payload = normalizeContextoPayload(body.data);
      const resolved = await resolverTipoETemplate(supabase, payload.tipo);
      const { data: updated, error: eUp } = await supabase
        .from("contexto_empresa")
        .update({
          id_tipo_contexto: resolved.idTipoContexto,
          id_template: resolved.idTemplate,
          nome: payload.nome || `${resolved.nomeTipoContexto} ${new Date().toLocaleDateString("pt-BR")}`,
          descricao: payload.descricao,
          schema_json: {
            tipo: payload.tipo,
            versao: 1,
          },
          dados_json: {
            tipo: payload.tipo,
            ...payload.dados,
          },
        })
        .eq("id_contexto_empresa", p.data.idContexto)
        .eq("id_empresa", p.data.idEmpresa)
        .eq("ativo", true)
        .select(
          "id_contexto_empresa, nome, descricao, schema_json, dados_json, data_criacao, data_atualizacao",
        )
        .maybeSingle();
      if (eUp) {
        res.status(500).json({ error: eUp.message });
        return;
      }
      if (!updated) {
        res.status(404).json({ error: "Contexto não encontrado" });
        return;
      }
      res.json({ contexto: updated });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.patchContexto:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.delete("/:idEmpresa/contextos/:idContexto", async (req, res) => {
    try {
      const p = contextoParam.safeParse(req.params);
      if (!p.success) {
        res.status(400).json({ error: p.error.flatten() });
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
          error: "Sem permissão para remover contexto",
          details: {
            cargo_detectado: membro?.cargo ?? null,
          },
        });
        return;
      }
      const { data: removed, error: eDel } = await supabase
        .from("contexto_empresa")
        .update({ ativo: false })
        .eq("id_contexto_empresa", p.data.idContexto)
        .eq("id_empresa", p.data.idEmpresa)
        .eq("ativo", true)
        .select("id_contexto_empresa")
        .maybeSingle();
      if (eDel) {
        res.status(500).json({ error: eDel.message });
        return;
      }
      if (!removed) {
        res.status(404).json({ error: "Contexto não encontrado" });
        return;
      }
      res.json({ removido: true, id_contexto_empresa: removed.id_contexto_empresa });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.deleteContexto:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });
}
