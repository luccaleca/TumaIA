import path from "node:path";
import { z } from "zod";
import {
  MEDIA_BUCKET,
  db,
  getMembroAtivoEmpresa,
  getOrCreatePastaUploadRaiz,
  midiaParam,
  patchMidiaBody,
  podeGerenciarMidias,
  safeExt,
  uploadMidiaBody,
} from "../../modules/empresas/shared.js";

export function registerMidiasRoutes(r) {
  r.get("/:idEmpresa/midias", async (req, res) => {
    try {
      const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
      if (!idEmpresa.success) {
        res.status(400).json({ error: "id_empresa inválido" });
        return;
      }
      const q = z
        .object({
          id_pasta: z.string().uuid().optional(),
        })
        .safeParse(req.query);
      if (!q.success) {
        res.status(400).json({ error: q.error.flatten() });
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
        res.status(403).json({ error: "Sem permissão para acessar mídias desta empresa" });
        return;
      }

      let query = supabase
        .from("midia")
        .select("*")
        .eq("id_empresa", idEmpresa.data)
        .eq("ativo", true)
        .order("data_criacao", { ascending: false });
      if (q.data.id_pasta) query = query.eq("id_pasta", q.data.id_pasta);
      const { data: midias, error: eList } = await query;
      if (eList) {
        res.status(500).json({ error: eList.message });
        return;
      }
      res.json({ midias: midias || [] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.listMidias:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.post("/:idEmpresa/midias/upload-base64", async (req, res) => {
    try {
      const idEmpresa = z.string().uuid().safeParse(req.params.idEmpresa);
      if (!idEmpresa.success) {
        res.status(400).json({ error: "id_empresa inválido" });
        return;
      }
      const parsed = uploadMidiaBody.safeParse(req.body ?? {});
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
        res.status(403).json({ error: "Sem permissão para enviar mídia" });
        return;
      }

      const b = parsed.data;
      let idPastaDestino = b.id_pasta ?? null;
      if (!idPastaDestino) {
        try {
          idPastaDestino = await getOrCreatePastaUploadRaiz(supabase, idEmpresa.data);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro ao resolver pasta de destino";
          res.status(500).json({ error: msg });
          return;
        }
      }

      const buffer = Buffer.from(b.base64_data, "base64");
      if (!buffer.length) {
        res.status(400).json({ error: "base64_data inválido" });
        return;
      }
      const ext = safeExt(b.nome_arquivo);
      const stamp = Date.now();
      const slug = b.nome_arquivo.replace(/[^a-zA-Z0-9._-]/g, "_");
      const caminhoStorage = `${idEmpresa.data}/${idPastaDestino}/${stamp}_${slug}`;

      const { error: eUpload } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(caminhoStorage, buffer, {
          contentType: b.mime_type,
          upsert: false,
        });
      if (eUpload) {
        res.status(500).json({ error: `Falha no upload storage: ${eUpload.message}` });
        return;
      }

      const publicUrl = supabase.storage
        .from(MEDIA_BUCKET)
        .getPublicUrl(caminhoStorage)?.data?.publicUrl;

      const row = {
        id_empresa: idEmpresa.data,
        id_pasta: idPastaDestino,
        criado_por_usuario_id: req.usuario.id_usuario,
        nome_arquivo: b.nome_arquivo,
        nome_exibicao: b.nome_exibicao?.trim() || b.nome_arquivo,
        tipo_midia: b.tipo_midia,
        formato_arquivo: b.mime_type,
        url_arquivo: publicUrl || null,
        caminho_storage: caminhoStorage,
        extensao: ext,
        tamanho_bytes: buffer.length,
        largura: null,
        altura: null,
        duracao_segundos: null,
        origem_upload: "upload_manual",
        descricao: b.descricao ?? null,
        alt_text: b.alt_text ?? null,
        ativo: true,
      };

      const { data: created, error: eInsert } = await supabase
        .from("midia")
        .insert(row)
        .select("*")
        .single();
      if (eInsert) {
        await supabase.storage.from(MEDIA_BUCKET).remove([caminhoStorage]);
        res.status(500).json({ error: eInsert.message });
        return;
      }

      res.status(201).json({ midia: created });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.uploadMidiaBase64:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.delete("/:idEmpresa/midias/:idMidia", async (req, res) => {
    try {
      const p = midiaParam.safeParse(req.params);
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
        res.status(403).json({ error: "Sem permissão para remover mídia" });
        return;
      }

      const { data: midia, error: eFind } = await supabase
        .from("midia")
        .select("id_midia, caminho_storage")
        .eq("id_midia", p.data.idMidia)
        .eq("id_empresa", p.data.idEmpresa)
        .eq("ativo", true)
        .maybeSingle();
      if (eFind) {
        res.status(500).json({ error: eFind.message });
        return;
      }
      if (!midia) {
        res.status(404).json({ error: "Mídia não encontrada" });
        return;
      }

      const { error: eSoft } = await supabase
        .from("midia")
        .update({ ativo: false })
        .eq("id_midia", p.data.idMidia)
        .eq("id_empresa", p.data.idEmpresa);
      if (eSoft) {
        res.status(500).json({ error: eSoft.message });
        return;
      }

      if (midia.caminho_storage) {
        await supabase.storage.from(MEDIA_BUCKET).remove([midia.caminho_storage]);
      }
      res.json({ removido: true, id_midia: p.data.idMidia });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.deleteMidia:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });

  r.patch("/:idEmpresa/midias/:idMidia", async (req, res) => {
    try {
      const p = midiaParam.safeParse(req.params);
      if (!p.success) {
        res.status(400).json({ error: p.error.flatten() });
        return;
      }
      const parsed = patchMidiaBody.safeParse(req.body ?? {});
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
        res.status(403).json({ error: "Sem permissão para alterar mídia" });
        return;
      }

      const wantPasta = parsed.data.id_pasta;
      const wantNomeRaw = parsed.data.nome_exibicao;

      const { data: midia, error: eFind } = await supabase
        .from("midia")
        .select("*")
        .eq("id_midia", p.data.idMidia)
        .eq("id_empresa", p.data.idEmpresa)
        .eq("ativo", true)
        .maybeSingle();
      if (eFind) {
        res.status(500).json({ error: eFind.message });
        return;
      }
      if (!midia?.caminho_storage) {
        res.status(404).json({ error: "Mídia não encontrada" });
        return;
      }

      const nomeExFinal =
        wantNomeRaw !== undefined ? wantNomeRaw.trim() : midia.nome_exibicao;
      const mudouNome = wantNomeRaw !== undefined && nomeExFinal !== midia.nome_exibicao;
      const mudouPasta = wantPasta !== undefined && wantPasta !== midia.id_pasta;

      if (!mudouPasta && !mudouNome) {
        res.json({ midia });
        return;
      }

      if (!mudouPasta && mudouNome) {
        const { data: atualizada, error: eUp } = await supabase
          .from("midia")
          .update({
            nome_exibicao: nomeExFinal,
            data_atualizacao: new Date().toISOString(),
          })
          .eq("id_midia", p.data.idMidia)
          .eq("id_empresa", p.data.idEmpresa)
          .select("*")
          .single();
        if (eUp) {
          res.status(500).json({ error: eUp.message });
          return;
        }
        res.json({ midia: atualizada });
        return;
      }

      const novaPasta = wantPasta;
      const { data: pastaDest, error: ePasta } = await supabase
        .from("pasta")
        .select("id_pasta")
        .eq("id_pasta", novaPasta)
        .eq("id_empresa", p.data.idEmpresa)
        .eq("ativo", true)
        .maybeSingle();
      if (ePasta) {
        res.status(500).json({ error: ePasta.message });
        return;
      }
      if (!pastaDest) {
        res.status(400).json({ error: "Pasta de destino inválida" });
        return;
      }

      const baseName = path.basename(midia.caminho_storage);
      const novoCaminho = `${p.data.idEmpresa}/${novaPasta}/${baseName}`;

      const { error: eMove } = await supabase.storage
        .from(MEDIA_BUCKET)
        .move(midia.caminho_storage, novoCaminho);
      if (eMove) {
        res.status(500).json({ error: `Falha ao mover no storage: ${eMove.message}` });
        return;
      }

      const publicUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(novoCaminho)?.data?.publicUrl;

      const { data: atualizada, error: eUp } = await supabase
        .from("midia")
        .update({
          id_pasta: novaPasta,
          caminho_storage: novoCaminho,
          url_arquivo: publicUrl || null,
          nome_exibicao: nomeExFinal,
          data_atualizacao: new Date().toISOString(),
        })
        .eq("id_midia", p.data.idMidia)
        .eq("id_empresa", p.data.idEmpresa)
        .select("*")
        .single();
      if (eUp) {
        await supabase.storage.from(MEDIA_BUCKET).move(novoCaminho, midia.caminho_storage);
        res.status(500).json({ error: eUp.message });
        return;
      }
      res.json({ midia: atualizada });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("empresas.patchMidia:", e);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });
}
