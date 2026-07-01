/**
 * Cliente HTTP mínimo para api.replicate.com (predictions + polling).
 * @see https://replicate.com/docs/reference/http
 */

const BASE = "https://api.replicate.com/v1";

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
const PREDICTION_POLL_FETCH_TIMEOUT_MS = 60_000;

/**
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} [timeoutMs]
 */
async function replicateFetch(url, init, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Replicate: tempo esgotado (${Math.round(timeoutMs / 1000)}s)`);
    }
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

/** @param {string} token */
export function replicateHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * @param {string} token
 * @param {string} owner
 * @param {string} name
 * @returns {Promise<string>} latest_version.id
 */
export async function getModelLatestVersionId(token, owner, name) {
  const res = await replicateFetch(`${BASE}/models/${owner}/${name}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Replicate GET models/${owner}/${name}: ${res.status} ${raw}`);
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("Replicate retornou corpo inválido ao buscar versão do modelo");
  }
  const id = json?.latest_version?.id;
  if (!id) throw new Error("Replicate: resposta sem latest_version.id");
  return String(id);
}

/**
 * @param {string} token
 * @param {{ version: string, input: Record<string, unknown> }} body
 */
export async function createPrediction(token, { version, input }) {
  const res = await replicateFetch(
    `${BASE}/predictions`,
    {
      method: "POST",
      headers: replicateHeaders(token),
      body: JSON.stringify({ version, input }),
    },
    45_000,
  );
  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(`Replicate POST predictions: ${res.status} ${raw}`);
    err.status = res.status;
    err.body = raw;
    throw err;
  }
  return JSON.parse(raw);
}

/**
 * POST /models/{owner}/{name}/predictions (sem precisar do version id).
 * @param {string} token
 * @param {string} owner
 * @param {string} name
 * @param {Record<string, unknown>} input
 */
export async function createModelPrediction(token, owner, name, input) {
  const res = await replicateFetch(
    `${BASE}/models/${owner}/${name}/predictions`,
    {
      method: "POST",
      headers: replicateHeaders(token),
      body: JSON.stringify({ input }),
    },
    45_000,
  );
  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(`Replicate POST models/${owner}/${name}/predictions: ${res.status} ${raw}`);
    err.status = res.status;
    err.body = raw;
    throw err;
  }
  return JSON.parse(raw);
}

/**
 * @param {string} token
 * @param {string} getUrl urls.get da prediction criada
 * @param {{ maxWaitMs?: number, stepMs?: number }} [opts]
 */
export async function waitForPrediction(token, getUrl, opts = {}) {
  const maxWaitMs = opts.maxWaitMs ?? 120_000;
  const stepMs = opts.stepMs ?? 1500;
  const t0 = Date.now();
  for (;;) {
    const res = await replicateFetch(
      getUrl,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      PREDICTION_POLL_FETCH_TIMEOUT_MS,
    );
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`Replicate GET prediction: ${res.status} ${raw}`);
    }
    const p = JSON.parse(raw);
    const st = String(p.status || "");
    if (st === "succeeded") return p;
    if (st === "failed" || st === "canceled") {
      const err = new Error(p.error ? JSON.stringify(p.error) : `Prediction ${st}`);
      err.prediction = p;
      throw err;
    }
    if (Date.now() - t0 > maxWaitMs) {
      const err = new Error("Timeout aguardando prediction na Replicate");
      err.prediction = p;
      throw err;
    }
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

/**
 * Confirma token (equivalente ao script check-replicate).
 * @param {string} token
 */
export async function getReplicateAccount(token) {
  const res = await replicateFetch(`${BASE}/account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(`Replicate GET account: ${res.status} ${raw}`);
    err.status = res.status;
    throw err;
  }
  return JSON.parse(raw);
}
