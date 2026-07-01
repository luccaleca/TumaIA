import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { fetchImageBuffer } from "./llamaVisionImage.js";
import { publicUrlForStoragePath } from "./chatGeneratedImageStorage.js";

function mediaBucket() {
  return (env.MEDIA_BUCKET || "midias").trim();
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {{ idEmpresa: string, imageStoragePath?: string, imageUrl?: string }} input
 */
async function ensurePublicImageUrl(db, input) {
  const path = String(input.imageStoragePath || "").trim();
  if (path) {
    const publicUrl = publicUrlForStoragePath(db, path);
    if (!publicUrl) {
      throw new Error("Não foi possível montar URL pública da imagem no Storage.");
    }
    return { image_url: publicUrl, storage_path: path };
  }

  const remoteUrl = String(input.imageUrl || "").trim();
  if (!remoteUrl) {
    throw new Error("Informe image_storage_path ou image_url.");
  }

  const { buffer } = await fetchImageBuffer(remoteUrl, {
    maxBytes: 16 * 1024 * 1024,
    timeoutMs: 90_000,
    retries: 1,
  });
  const emp = String(input.idEmpresa || "").trim();
  const storagePath = `${emp}/_instagram-publish/${Date.now()}-${randomUUID().slice(0, 8)}.png`;
  const { error } = await db.storage.from(mediaBucket()).upload(storagePath, buffer, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) throw new Error(error.message || "Falha ao salvar imagem para publicação.");

  const publicUrl = publicUrlForStoragePath(db, storagePath);
  if (!publicUrl) {
    throw new Error("URL pública indisponível após salvar a imagem no Storage.");
  }
  return { image_url: publicUrl, storage_path: storagePath };
}

/**
 * Publica no Instagram via webhook n8n (container + media_publish).
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {{
 *   idEmpresa: string,
 *   caption: string,
 *   imageStoragePath?: string,
 *   imageUrl?: string,
 *   clientId?: string,
 * }} input
 */
export async function publishToInstagramViaN8n(db, input) {
  const webhookUrl =
    env.N8N_INSTAGRAM_WEBHOOK_URL?.trim() || process.env.N8N_INSTAGRAM_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return { ok: false, status: 503, error: "N8N_INSTAGRAM_WEBHOOK_URL não configurado no servidor." };
  }
  if (!db) {
    return { ok: false, status: 503, error: "Supabase não configurado." };
  }

  const caption = String(input.caption || "").trim();
  if (!caption) {
    return { ok: false, status: 400, error: "Legenda obrigatória para publicar no Instagram." };
  }

  let resolved;
  try {
    resolved = await ensurePublicImageUrl(db, {
      idEmpresa: input.idEmpresa,
      imageStoragePath: input.imageStoragePath,
      imageUrl: input.imageUrl,
    });
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: err instanceof Error ? err.message : "Falha ao preparar imagem para publicação.",
    };
  }

  if (!resolved.image_url.startsWith("http")) {
    return { ok: false, status: 400, error: "image_url precisa ser uma URL pública http(s)." };
  }

  const payload = {
    client_id: String(input.clientId || env.N8N_INSTAGRAM_CLIENT_ID || "tumaia").trim() || "tumaia",
    image_url: resolved.image_url,
    caption,
    id_empresa: input.idEmpresa,
  };

  console.info(
    `[instagram] chamando n8n client_id=${payload.client_id} image=${resolved.image_url.slice(0, 120)} caption_len=${caption.length}`,
  );

  const timeoutMs = Number(env.N8N_INSTAGRAM_TIMEOUT_MS) || 90_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  let raw = "";
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    raw = await response.text();
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "Tempo esgotado aguardando o n8n publicar no Instagram."
        : err instanceof Error
          ? err.message
          : "Erro de rede ao chamar n8n.";
    return { ok: false, status: 502, error: msg };
  } finally {
    clearTimeout(timer);
  }

  let parsed = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = { message: raw };
  }

  const body =
    parsed?.body && typeof parsed.body === "object" && !Array.isArray(parsed.body)
      ? parsed.body
      : parsed;

  const success =
    body?.success === true ||
    (response.ok && typeof body?.instagram_media_id === "string" && body.instagram_media_id.trim());

  if (!response.ok || !success) {
    const errMsg =
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.error === "string" && body.error) ||
      (typeof parsed?.message === "string" && parsed.message) ||
      (!raw.trim() && response.ok
        ? "n8n respondeu HTTP 200 sem confirmar a publicação (corpo vazio). No workflow, o último nó deve devolver JSON com success: true e instagram_media_id."
        : `n8n respondeu HTTP ${response.status}`);
    console.warn(
      `[instagram] falha n8n status=${response.status} image=${resolved.image_url.slice(0, 120)} body=${raw.slice(0, 500) || "(vazio)"}`,
    );
    return {
      ok: false,
      status: response.status >= 400 ? response.status : 502,
      error: errMsg,
      image_url: resolved.image_url,
      n8n_response: body,
    };
  }

  console.info(
    `[instagram] publicado via n8n empresa=${input.idEmpresa} media=${body.instagram_media_id || "?"}`,
  );

  return {
    ok: true,
    image_url: resolved.image_url,
    storage_path: resolved.storage_path,
    instagram_media_id: body.instagram_media_id || null,
    message: body.message || "Post publicado no Instagram com sucesso.",
    n8n_response: body,
  };
}
