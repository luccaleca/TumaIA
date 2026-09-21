import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { fetchImageBuffer } from "./llamaVisionImage.js";
import { publicUrlForStoragePath } from "./chatGeneratedImageStorage.js";

function mediaBucket() {
  return (env.MEDIA_BUCKET || "midias").trim();
}

function graphApiVersion() {
  return String(env.INSTAGRAM_GRAPH_API_VERSION || "v21.0").trim() || "v21.0";
}

function graphBaseUrl() {
  return `https://graph.facebook.com/${graphApiVersion()}`;
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
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 */
async function fetchJson(url, init = {}, timeoutMs = 60_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { message: raw };
    }
    return { response, raw, parsed };
  } finally {
    clearTimeout(timer);
  }
}

function graphErrorMessage(parsed, fallback) {
  const err = parsed?.error;
  if (err && typeof err === "object") {
    const msg = String(err.message || "").trim();
    const code = err.code != null ? ` (code ${err.code})` : "";
    if (msg) return `${msg}${code}`;
  }
  if (typeof parsed?.message === "string" && parsed.message.trim()) return parsed.message.trim();
  return fallback;
}

/**
 * Aguarda o container de mídia ficar pronto para publish.
 * @param {string} creationId
 * @param {string} accessToken
 * @param {number} timeoutMs
 */
export async function waitForInstagramContainerReady(creationId, accessToken, timeoutMs = 90_000) {
  const id = String(creationId || "").trim();
  const token = String(accessToken || "").trim();
  if (!id || !token) throw new Error("creation_id e access_token obrigatórios.");

  const started = Date.now();
  let delayMs = 1_500;
  while (Date.now() - started < timeoutMs) {
    const url =
      `${graphBaseUrl()}/${encodeURIComponent(id)}` +
      `?fields=status_code,status` +
      `&access_token=${encodeURIComponent(token)}`;
    const { response, parsed } = await fetchJson(url, { method: "GET" }, 30_000);
    if (!response.ok) {
      throw new Error(graphErrorMessage(parsed, `Falha ao consultar status do container (${response.status}).`));
    }
    const status = String(parsed?.status_code || "").trim().toUpperCase();
    if (status === "FINISHED") return parsed;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(
        graphErrorMessage(parsed, `Container Instagram em estado ${status || "ERROR"}.`),
      );
    }
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(delayMs + 500, 4_000);
  }
  throw new Error("Tempo esgotado aguardando o Instagram processar a imagem.");
}

/**
 * Publica feed image no Instagram via Meta Graph API.
 *
 * Fluxo: create media container → wait FINISHED → media_publish.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {{
 *   idEmpresa: string,
 *   caption: string,
 *   imageStoragePath?: string,
 *   imageUrl?: string,
 * }} input
 */
export async function publishToInstagram(db, input) {
  const accessToken = String(
    env.INSTAGRAM_GRAPH_ACCESS_TOKEN || process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN || "",
  ).trim();
  const igUserId = String(
    env.INSTAGRAM_BUSINESS_ACCOUNT_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "",
  ).trim();
  if (!accessToken || !igUserId) {
    return {
      ok: false,
      status: 503,
      error:
        "Publicação Instagram sem credenciais. Defina INSTAGRAM_GRAPH_ACCESS_TOKEN e INSTAGRAM_BUSINESS_ACCOUNT_ID no backend/.env.",
    };
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

  const timeoutMs = Number(env.INSTAGRAM_PUBLISH_TIMEOUT_MS) || 120_000;
  const createUrl = `${graphBaseUrl()}/${encodeURIComponent(igUserId)}/media`;
  const createBody = new URLSearchParams({
    image_url: resolved.image_url,
    caption,
    access_token: accessToken,
  });

  console.info(
    `[instagram] criando container ig_user=${igUserId} image=${resolved.image_url.slice(0, 120)} caption_len=${caption.length}`,
  );

  let createRes;
  try {
    createRes = await fetchJson(
      createUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: createBody.toString(),
      },
      Math.min(timeoutMs, 60_000),
    );
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "Tempo esgotado criando mídia no Instagram."
        : err instanceof Error
          ? err.message
          : "Erro de rede ao chamar a Meta Graph API.";
    return { ok: false, status: 502, error: msg, image_url: resolved.image_url };
  }

  const creationId = String(createRes.parsed?.id || "").trim();
  if (!createRes.response.ok || !creationId) {
    const errMsg = graphErrorMessage(
      createRes.parsed,
      `Meta Graph API respondeu HTTP ${createRes.response.status} ao criar o container.`,
    );
    console.warn(`[instagram] falha create status=${createRes.response.status} body=${createRes.raw.slice(0, 400)}`);
    return {
      ok: false,
      status: createRes.response.status >= 400 ? createRes.response.status : 502,
      error: errMsg,
      image_url: resolved.image_url,
      graph_response: createRes.parsed,
    };
  }

  try {
    await waitForInstagramContainerReady(creationId, accessToken, timeoutMs);
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : "Falha ao processar mídia no Instagram.",
      image_url: resolved.image_url,
      creation_id: creationId,
    };
  }

  const publishUrl = `${graphBaseUrl()}/${encodeURIComponent(igUserId)}/media_publish`;
  const publishBody = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  let publishRes;
  try {
    publishRes = await fetchJson(
      publishUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: publishBody.toString(),
      },
      Math.min(timeoutMs, 60_000),
    );
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "Tempo esgotado publicando no Instagram."
        : err instanceof Error
          ? err.message
          : "Erro de rede ao publicar no Instagram.";
    return {
      ok: false,
      status: 502,
      error: msg,
      image_url: resolved.image_url,
      creation_id: creationId,
    };
  }

  const mediaId = String(publishRes.parsed?.id || "").trim();
  if (!publishRes.response.ok || !mediaId) {
    const errMsg = graphErrorMessage(
      publishRes.parsed,
      `Meta Graph API respondeu HTTP ${publishRes.response.status} ao publicar.`,
    );
    console.warn(
      `[instagram] falha publish status=${publishRes.response.status} body=${publishRes.raw.slice(0, 400)}`,
    );
    return {
      ok: false,
      status: publishRes.response.status >= 400 ? publishRes.response.status : 502,
      error: errMsg,
      image_url: resolved.image_url,
      creation_id: creationId,
      graph_response: publishRes.parsed,
    };
  }

  console.info(`[instagram] publicado empresa=${input.idEmpresa} media=${mediaId}`);

  return {
    ok: true,
    image_url: resolved.image_url,
    storage_path: resolved.storage_path,
    instagram_media_id: mediaId,
    creation_id: creationId,
    message: "Post publicado no Instagram com sucesso.",
  };
}

