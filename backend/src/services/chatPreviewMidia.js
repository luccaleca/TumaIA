import sharp from "sharp";
import { env } from "../config.js";
import { MEDIA_BUCKET, getOrCreatePastaUploadRaiz } from "../modules/empresas/shared.js";
import { ORIGEM_UPLOAD_CHAT_PREVIEW } from "../modules/empresas/midiaOrigem.js";
import { fetchImageBuffer } from "./llamaVisionImage.js";

const PREVIEW_FETCH_MAX_BYTES = 12 * 1024 * 1024;

/**
 * @param {unknown} error
 */
function isMissingMidiaIdConversaColumn(error) {
  const msg = String(error && typeof error === "object" && "message" in error ? error.message : error ?? "")
    .toLowerCase();
  return msg.includes("id_conversa") && msg.includes("does not exist");
}

/**
 * @param {string} url
 */
export function isPersistableChatPreviewUrl(url) {
  const u = String(url || "").trim();
  return u.startsWith("https://") || u.startsWith("http://");
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idConversa
 * @param {string} idEmpresa
 * @param {string} idUsuario
 */
export async function assertChatConversaForPreview(db, idConversa, idEmpresa, idUsuario) {
  const id = String(idConversa || "").trim();
  if (!id) return { ok: false, error: "id_conversa ausente." };
  const { data, error } = await db
    .from("chat_conversa")
    .select("id_conversa, id_empresa, id_usuario")
    .eq("id_conversa", id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Conversa não encontrada." };
  if (String(data.id_usuario) !== String(idUsuario)) {
    return { ok: false, error: "Sem acesso a esta conversa." };
  }
  if (String(data.id_empresa) !== String(idEmpresa)) {
    return { ok: false, error: "Conversa não pertence a esta empresa." };
  }
  return { ok: true };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idConversa
 */
export async function purgeChatPreviewMidiasForConversa(db, idConversa) {
  const id = String(idConversa || "").trim();
  if (!id) return { removed: 0 };

  const { data: rows, error } = await db
    .from("midia")
    .select("id_midia, caminho_storage")
    .eq("id_conversa", id)
    .eq("origem_upload", ORIGEM_UPLOAD_CHAT_PREVIEW);
  if (error) {
    if (isMissingMidiaIdConversaColumn(error)) {
      console.warn(
        "[chat-preview-midia] coluna midia.id_conversa ausente — rode backend/sql/patch_midia_chat_preview.sql",
      );
      return { removed: 0, skipped: true };
    }
    throw new Error(error.message);
  }
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return { removed: 0 };

  const bucket = (env.MEDIA_BUCKET || MEDIA_BUCKET || "midias").trim();
  const paths = [
    ...new Set(list.map((r) => String(r.caminho_storage ?? "").trim()).filter(Boolean)),
  ];
  if (paths.length) {
    const { error: storageErr } = await db.storage.from(bucket).remove(paths);
    if (storageErr) {
      console.warn("[chat-preview-midia] falha ao remover storage:", storageErr.message);
    }
  }

  const { error: delErr } = await db
    .from("midia")
    .delete()
    .eq("id_conversa", id)
    .eq("origem_upload", ORIGEM_UPLOAD_CHAT_PREVIEW);
  if (delErr) {
    if (isMissingMidiaIdConversaColumn(delErr)) {
      return { removed: 0, skipped: true };
    }
    throw new Error(delErr.message);
  }

  return { removed: list.length };
}

/**
 * Baixa prévia gerada, grava no bucket e cria midia vinculada à conversa.
 *
 * @param {{
 *   db: import("@supabase/supabase-js").SupabaseClient,
 *   idEmpresa: string,
 *   idConversa: string,
 *   idUsuario: string,
 *   imageUrls: string[],
 * }} opts
 * @returns {Promise<{ image_urls: string[], image_midia_ids: string[] }>}
 */
export async function persistChatPreviewImages(opts) {
  const { db, idEmpresa, idConversa, idUsuario, imageUrls } = opts;
  const urls = (imageUrls || []).map((u) => String(u || "").trim()).filter(isPersistableChatPreviewUrl);
  if (!urls.length) {
    return { image_urls: imageUrls || [], image_midia_ids: [] };
  }

  const check = await assertChatConversaForPreview(db, idConversa, idEmpresa, idUsuario);
  if (!check.ok) {
    console.warn("[chat-preview-midia] persist ignorado:", check.error);
    return { image_urls: imageUrls || [], image_midia_ids: [] };
  }

  const idPasta = await getOrCreatePastaUploadRaiz(db, idEmpresa);
  const bucket = (env.MEDIA_BUCKET || MEDIA_BUCKET || "midias").trim();
  const outUrls = [];
  const outIds = [];

  for (let i = 0; i < urls.length; i++) {
    const sourceUrl = urls[i];
    try {
      const { buffer, mime } = await fetchImageBuffer(sourceUrl, {
        maxBytes: PREVIEW_FETCH_MAX_BYTES,
        timeoutMs: 90_000,
        retries: 2,
      });
      let largura = null;
      let altura = null;
      try {
        const meta = await sharp(buffer).metadata();
        largura = meta.width ?? null;
        altura = meta.height ?? null;
      } catch {
        /* ignore */
      }

      const ext = mime === "image/webp" ? ".webp" : mime === "image/jpeg" ? ".jpg" : ".png";
      const stamp = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
      const nomeArquivo = `chat-preview-${stamp}${ext}`;
      const caminhoStorage = `${idEmpresa}/_chat/${idConversa}/${nomeArquivo}`;

      const { error: upErr } = await db.storage.from(bucket).upload(caminhoStorage, buffer, {
        contentType: mime || "image/png",
        upsert: false,
      });
      if (upErr) throw new Error(upErr.message);

      const publicUrl = db.storage.from(bucket).getPublicUrl(caminhoStorage)?.data?.publicUrl || null;

      const row = {
        id_empresa: idEmpresa,
        id_pasta: idPasta,
        id_conversa: idConversa,
        criado_por_usuario_id: idUsuario,
        nome_arquivo: nomeArquivo,
        nome_exibicao: `Prévia do chat`,
        tipo_midia: "imagem",
        formato_arquivo: mime || "image/png",
        url_arquivo: publicUrl,
        caminho_storage: caminhoStorage,
        extensao: ext,
        tamanho_bytes: buffer.length,
        largura,
        altura,
        duracao_segundos: null,
        origem_upload: ORIGEM_UPLOAD_CHAT_PREVIEW,
        descricao: "Prévia gerada no chat TumaIA.",
        alt_text: null,
        ativo: true,
      };

      const { data: created, error: insErr } = await db.from("midia").insert(row).select("id_midia").single();
      if (insErr) {
        await db.storage.from(bucket).remove([caminhoStorage]).catch(() => {});
        throw new Error(insErr.message);
      }

      const idMidia = String(created?.id_midia ?? "").trim();
      if (idMidia && publicUrl) {
        outIds.push(idMidia);
        outUrls.push(publicUrl);
      } else if (publicUrl) {
        outUrls.push(publicUrl);
      }
    } catch (err) {
      console.warn(
        "[chat-preview-midia] falha ao persistir prévia:",
        err instanceof Error ? err.message : err,
      );
      outUrls.push(sourceUrl);
    }
  }

  return {
    image_urls: outUrls.length ? outUrls : imageUrls || [],
    image_midia_ids: outIds,
  };
}
