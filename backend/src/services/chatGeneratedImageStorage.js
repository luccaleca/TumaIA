/**
 * Prévias de imagem do chat no Supabase Storage, vinculadas à conversa.
 * Caminho: `{idEmpresa}/_chat/{idConversa}/{arquivo}.png`
 */

import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { fetchImageBuffer } from "./llamaVisionImage.js";

/** TTL para exibição no painel (renovado ao abrir a conversa). */
export const CHAT_IMAGE_SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7;

export function chatImageStoragePrefix(idEmpresa, idConversa) {
  const emp = String(idEmpresa || "").trim();
  const conv = String(idConversa || "").trim();
  if (!emp || !conv) return "";
  return `${emp}/_chat/${conv}`;
}

/** Prévias geradas no fluxo WhatsApp: `{empresa}/_whatsapp/{telefone}/`. */
export function whatsappImageStoragePrefix(idEmpresa, phone) {
  const emp = String(idEmpresa || "").trim();
  const digits = String(phone || "").replace(/\D/g, "");
  if (!emp || !digits) return "";
  return `${emp}/_whatsapp/${digits}`;
}

function mediaBucket() {
  return (env.MEDIA_BUCKET || "midias").trim();
}

/**
 * URL pública do Storage (bucket precisa permitir leitura pública para APIs externas).
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} storagePath
 */
export function publicUrlForStoragePath(db, storagePath) {
  const path = String(storagePath || "").trim();
  if (!path || !db) return null;
  const { data } = db.storage.from(mediaBucket()).getPublicUrl(path);
  const url = data?.publicUrl;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} storagePath
 */
export async function signedUrlForChatImagePath(db, storagePath) {
  const path = String(storagePath || "").trim();
  if (!path) return null;
  const { data, error } = await db.storage
    .from(mediaBucket())
    .createSignedUrl(path, CHAT_IMAGE_SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Falha ao assinar URL da prévia.");
  }
  return data.signedUrl;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string} idConversa
 * @param {string[]} imageUrls
 */
export async function persistChatGeneratedImages(db, idEmpresa, idConversa, imageUrls) {
  const prefix = chatImageStoragePrefix(idEmpresa, idConversa);
  if (!prefix) return { storage_paths: [], image_urls: [] };

  const urls = (imageUrls || []).map((u) => String(u || "").trim()).filter(Boolean);
  if (!urls.length) return { storage_paths: [], image_urls: [] };

  const bucket = mediaBucket();
  const storage_paths = [];
  const image_urls = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const { buffer } = await fetchImageBuffer(url, {
      maxBytes: 16 * 1024 * 1024,
      timeoutMs: 120_000,
      retries: 2,
    });
    const fileName = `${Date.now()}-${i}-${randomUUID().slice(0, 8)}.png`;
    const path = `${prefix}/${fileName}`;
    const { error: upErr } = await db.storage.from(bucket).upload(path, buffer, {
      contentType: "image/png",
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message || "Falha ao salvar prévia no storage.");
    storage_paths.push(path);
    image_urls.push(await signedUrlForChatImagePath(db, path));
  }

  return { storage_paths, image_urls };
}

/**
 * Salva imagens do WhatsApp no Storage e devolve paths + URLs públicas (para n8n / Instagram).
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string} phone
 * @param {string[]} imageUrls
 */
export async function persistWhatsappGeneratedImages(db, idEmpresa, phone, imageUrls) {
  const prefix = whatsappImageStoragePrefix(idEmpresa, phone);
  if (!prefix) return { storage_paths: [], public_urls: [] };

  const urls = (imageUrls || []).map((u) => String(u || "").trim()).filter(Boolean);
  if (!urls.length) return { storage_paths: [], public_urls: [] };

  const bucket = mediaBucket();
  const storage_paths = [];
  const public_urls = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const { buffer } = await fetchImageBuffer(url, {
      maxBytes: 16 * 1024 * 1024,
      timeoutMs: 120_000,
      retries: 2,
    });
    const fileName = `${Date.now()}-${i}-${randomUUID().slice(0, 8)}.png`;
    const path = `${prefix}/${fileName}`;
    const { error: upErr } = await db.storage.from(bucket).upload(path, buffer, {
      contentType: "image/png",
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message || "Falha ao salvar imagem do WhatsApp.");
    storage_paths.push(path);
    const publicUrl = publicUrlForStoragePath(db, path);
    if (publicUrl) public_urls.push(publicUrl);
  }

  return { storage_paths, public_urls };
}

/**
 * @param {unknown} meta
 * @returns {string[]}
 */
export function extractImageStoragePathsFromMeta(meta) {
  if (!meta || typeof meta !== "object") return [];
  const raw = meta.image_storage_paths;
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => String(p || "").trim()).filter(Boolean);
}

/**
 * Injeta `image_urls` frescas a partir de `image_storage_paths` no metadados da mensagem.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {Record<string, unknown> | null | undefined} meta
 */
export async function hydrateChatMessageImageMeta(db, meta) {
  if (!meta || typeof meta !== "object") return meta;
  const paths = extractImageStoragePathsFromMeta(meta);
  if (!paths.length) return meta;

  const image_urls = [];
  for (const path of paths) {
    try {
      const url = await signedUrlForChatImagePath(db, path);
      if (url) image_urls.push(url);
    } catch (err) {
      console.warn("[chat-images] assinar path:", path, err instanceof Error ? err.message : err);
    }
  }

  if (!image_urls.length) return meta;
  return { ...meta, image_urls };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string} idConversa
 */
export async function deleteChatConversationImages(db, idEmpresa, idConversa) {
  const folder = chatImageStoragePrefix(idEmpresa, idConversa);
  if (!folder) return { removed: 0 };

  const bucket = mediaBucket();
  const { data: files, error } = await db.storage.from(bucket).list(folder, { limit: 1000 });
  if (error) {
    console.warn("[chat-images] list ao apagar conversa:", error.message);
    return { removed: 0, error: error.message };
  }

  const paths = (files || [])
    .filter((item) => item?.name && item.name !== ".emptyFolderPlaceholder")
    .map((item) => `${folder}/${item.name}`);

  if (!paths.length) return { removed: 0 };

  const { error: remErr } = await db.storage.from(bucket).remove(paths);
  if (remErr) {
    console.warn("[chat-images] remove ao apagar conversa:", remErr.message);
    return { removed: 0, error: remErr.message };
  }
  return { removed: paths.length };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string} idConversa
 * @param {string} idUsuario
 */
export async function conversaPertenceAoUsuario(db, idEmpresa, idConversa, idUsuario) {
  const { data, error } = await db
    .from("chat_conversa")
    .select("id_conversa")
    .eq("id_conversa", idConversa)
    .eq("id_empresa", idEmpresa)
    .eq("id_usuario", idUsuario)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}
