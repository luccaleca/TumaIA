import { z } from "zod";
import {
  PASTA_UPLOAD_RAIZ_NOME,
  coletarSubpastas,
  createPastaBody,
  db,
  getMembroAtivoEmpresa,
  getOrCreatePastaUploadRaiz,
  patchPastaBody,
  pastaParam,
  podeGerenciarMidias,
} from "../../modules/empresas/shared.js";

export function registerPastasRoutes(r) {
  r.get("/:idEmpresa/pastas", async (req, res) => {
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
        res.status(403).json({ error: "Sem permissão para acessar pastas desta empresa" });
        return;
      }

      const { data: pastas, error: eList } = await supabase
        .from("pasta")
        .select("*")
        .eq("id_empresa", idEmpresa.data)
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (eList) {
        res.status(500).json({ error: eList.message });
        return;
      }
      let idPastaUploadRaiz;
      try {
        idPastaUploadRaiz = await getOrCreatePastaUploadRaiz(supabase, idEmpresa.data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao garantir pasta da raiz";
        res.status(500).json({ error: msg });
        return;
      }
      res.json({
        pastas: pastas || [],
        id_pasta_upload_raiz: idPastaUploadRaiz,
        pasta_upload_raiz_nome: PASTA_UPLOAD_RAIZ_NOME,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.listPastas:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.post("/:idEmpresa/pastas", async (req, res) => {
    try {
      const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
      if (!idEmpresa.success) {
        res.status(400).json({ error: "id_empresa inválido" });
        return;
      }
      const parsed = createPastaBody.safeParse(req.body ?? {});
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
        res.status(403).json({ error: "Sem permissão para criar pasta" });
        return;
      }

      const row = {
        id_empresa: idEmpresa.data,
        id_pasta_pai: parsed.data.id_pasta_pai ?? null,
        nome: parsed.data.nome.trim(),
        ativo: true,
      };
      const { data: created, error: eCreate } = await supabase
        .from("pasta")
        .insert(row)
        .select("*")
        .single();
      if (eCreate) {
        const msg = String(eCreate.message || "");
        if (/duplicate|unique/i.test(msg)) {
          res.status(409).json({ error: "Já existe uma pasta com esse nome nesse nível" });
          return;
        }
        res.status(500).json({ error: eCreate.message });
        return;
      }
      res.status(201).json({ pasta: created });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.createPasta:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.patch("/:idEmpresa/pastas/:idPasta", async (req, res) => {
    try {
      const p = pastaParam.safeParse(req.params);
      if (!p.success) {
        res.status(400).json({ error: p.error.flatten() });
        return;
      }
      const parsed = patchPastaBody.safeParse(req.body ?? {});
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
        p.data.idEmpresa,
        req.usuario.id_usuario,
      );
      if (ePerm) {
        res.status(500).json({ error: ePerm.message });
        return;
      }
      if (!membro || !podeGerenciarMidias(membro.cargo)) {
        res.status(403).json({ error: "Sem permissão para alterar pasta" });
        return;
      }

      const { data: pastaRow, error: eFind } = await supabase
        .from("pasta")
        .select("id_pasta, id_empresa, id_pasta_pai, nome, ativo")
        .eq("id_pasta", p.data.idPasta)
        .eq("id_empresa", p.data.idEmpresa)
        .eq("ativo", true)
        .maybeSingle();
      if (eFind) {
        res.status(500).json({ error: eFind.message });
        return;
      }
      if (!pastaRow) {
        res.status(404).json({ error: "Pasta não encontrada" });
        return;
      }

      const curPai = pastaRow.id_pasta_pai ?? null;
      const wantPai = parsed.data.id_pasta_pai;
      const wantNomeIn = parsed.data.nome;
      const destPai = wantPai !== undefined ? wantPai : curPai;
      const destNome = wantNomeIn !== undefined ? wantNomeIn.trim() : pastaRow.nome;

      if (
        pastaRow.nome === PASTA_UPLOAD_RAIZ_NOME &&
        pastaRow.id_pasta_pai == null &&
        wantNomeIn !== undefined &&
        destNome !== PASTA_UPLOAD_RAIZ_NOME
      ) {
        res.status(400).json({
          error: `A pasta "${PASTA_UPLOAD_RAIZ_NOME}" na raiz não pode ser renomeada.`,
        });
        return;
      }

      const mudouPai = wantPai !== undefined && destPai !== curPai;
      const mudouNome = wantNomeIn !== undefined && destNome !== pastaRow.nome;

      if (!mudouPai && !mudouNome) {
        res.json({ pasta: pastaRow });
        return;
      }

      async function conflitoNomeEm(nomeChecar, idPastaPaiDest, excetoId) {
        let q = supabase
          .from("pasta")
          .select("id_pasta")
          .eq("id_empresa", p.data.idEmpresa)
          .eq("nome", nomeChecar)
          .eq("ativo", true)
          .neq("id_pasta", excetoId);
        q = idPastaPaiDest === null ? q.is("id_pasta_pai", null) : q.eq("id_pasta_pai", idPastaPaiDest);
        const { data: c } = await q.maybeSingle();
        return !!c;
      }

      if (!mudouPai && mudouNome) {
        if (await conflitoNomeEm(destNome, curPai, p.data.idPasta)) {
          res.status(409).json({ error: "Já existe uma pasta com esse nome nesse nível" });
          return;
        }
        const { data: atualizada, error: eUp } = await supabase
          .from("pasta")
          .update({
            nome: destNome,
            data_atualizacao: new Date().toISOString(),
          })
          .eq("id_pasta", p.data.idPasta)
          .eq("id_empresa", p.data.idEmpresa)
          .select("*")
          .single();
        if (eUp) {
          res.status(500).json({ error: eUp.message });
          return;
        }
        res.json({ pasta: atualizada });
        return;
      }

      const novoPai = destPai;
      if (novoPai === p.data.idPasta) {
        res.status(400).json({ error: "Uma pasta não pode ser pai dela mesma" });
        return;
      }

      if (novoPai) {
        const { data: paiRow, error: ePai } = await supabase
          .from("pasta")
          .select("id_pasta")
          .eq("id_pasta", novoPai)
          .eq("id_empresa", p.data.idEmpresa)
          .eq("ativo", true)
          .maybeSingle();
        if (ePai) {
          res.status(500).json({ error: ePai.message });
          return;
        }
        if (!paiRow) {
          res.status(400).json({ error: "Pasta de destino inválida" });
          return;
        }
        const { data: todas, error: eTodas } = await supabase
          .from("pasta")
          .select("id_pasta, id_pasta_pai")
          .eq("id_empresa", p.data.idEmpresa)
          .eq("ativo", true);
        if (eTodas) {
          res.status(500).json({ error: eTodas.message });
          return;
        }
        const sub = coletarSubpastas(todas || [], p.data.idPasta);
        if (sub.has(novoPai)) {
          res.status(400).json({ error: "Não é possível mover uma pasta para dentro dela mesma" });
          return;
        }
      }

      if (await conflitoNomeEm(destNome, novoPai, p.data.idPasta)) {
        res.status(409).json({ error: "Já existe uma pasta com esse nome nesse nível" });
        return;
      }

      const { data: atualizada, error: eUp } = await supabase
        .from("pasta")
        .update({
          id_pasta_pai: novoPai,
          nome: destNome,
          data_atualizacao: new Date().toISOString(),
        })
        .eq("id_pasta", p.data.idPasta)
        .eq("id_empresa", p.data.idEmpresa)
        .select("*")
        .single();
      if (eUp) {
        res.status(500).json({ error: eUp.message });
        return;
      }
      res.json({ pasta: atualizada });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.patchPasta:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.delete("/:idEmpresa/pastas/:idPasta", async (req, res) => {
    try {
      const p = pastaParam.safeParse(req.params);
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
        res.status(403).json({ error: "Sem permissão para remover pasta" });
        return;
      }

      const { count: hasFilhos, error: eFilhos } = await supabase
        .from("pasta")
        .select("id_pasta", { count: "exact", head: true })
        .eq("id_empresa", p.data.idEmpresa)
        .eq("id_pasta_pai", p.data.idPasta)
        .eq("ativo", true);
      if (eFilhos) {
        res.status(500).json({ error: eFilhos.message });
        return;
      }

      const { count: hasMidias, error: eMidias } = await supabase
        .from("midia")
        .select("id_midia", { count: "exact", head: true })
        .eq("id_empresa", p.data.idEmpresa)
        .eq("id_pasta", p.data.idPasta)
        .eq("ativo", true);
      if (eMidias) {
        res.status(500).json({ error: eMidias.message });
        return;
      }

      if ((hasFilhos || 0) > 0 || (hasMidias || 0) > 0) {
        res.status(409).json({ error: "A pasta não está vazia" });
        return;
      }

      const { error: eDelete } = await supabase
        .from("pasta")
        .update({ ativo: false })
        .eq("id_pasta", p.data.idPasta)
        .eq("id_empresa", p.data.idEmpresa)
        .eq("ativo", true);
      if (eDelete) {
        res.status(500).json({ error: eDelete.message });
        return;
      }
      res.json({ removida: true, id_pasta: p.data.idPasta });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.deletePasta:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });
}
