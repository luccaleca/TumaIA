import { createPrediction, getModelLatestVersionId, waitForPrediction } from "./replicateClient.js";
import { recordReplicateImageOutcome } from "./replicateUsage.js";
import { z } from "zod";
import { env } from "../config.js";

const OWNER = "openai";
const MODEL = "gpt-image-2";
export const MODEL_PATH = `${OWNER}/${MODEL}`;

/** Uma geração por vez (evita custo duplicado por duplo clique). */
let generationChain = Promise.resolve();

/** @type {Record<string, string>} */
const ASPECT_TO_REPLICATE = {
  "1:1": "1:1",
  "16:9": "3:2",
  "9:16": "2:3",
  "3:2": "3:2",
  "2:3": "2:3",
};

export const replicateGptImage2InputSchema = z.object({
  prompt: z.string().min(1).max(32_000),
  aspect_ratio: z
    .enum(["1:1", "16:9", "9:16", "3:2", "2:3"])
    .optional()
    .default("1:1"),
  quality: z.enum(["low", "medium", "high", "auto"]).optional().default("high"),
  number_of_images: z.coerce.number().int().min(1).max(10).optional().default(1),
  output_format: z.enum(["webp", "png", "jpeg"]).optional().default("png"),
  input_images: z.array(z.string().url()).max(4).optional(),
});

/**
 * @param {unknown} output
 * @returns {string[]}
 */
export function normalizeGptImage2Output(output) {
  if (output == null) return [];
  if (typeof output === "string" && output.trim()) return [output.trim()];
  if (Array.isArray(output)) {
    return output.filter((u) => typeof u === "string" && u.trim()).map((u) => u.trim());
  }
  return [];
}

/**
 * @param {string} token
 * @param {z.infer<typeof replicateGptImage2InputSchema>} data
 */
export async function executeReplicateGptImage2(token, data) {
  const prev = generationChain;
  let release;
  generationChain = new Promise((resolve) => {
    release = resolve;
  });
  await prev.catch(() => {});
  try {
    return await executeReplicateGptImage2Once(token, data);
  } finally {
    release();
  }
}

/**
 * @param {string} token
 * @param {z.infer<typeof replicateGptImage2InputSchema>} data
 */
async function executeReplicateGptImage2Once(token, data) {
  const aspect = ASPECT_TO_REPLICATE[data.aspect_ratio || "1:1"] || "1:1";
  const qualityRaw = String(env.REPLICATE_GPT_IMAGE_QUALITY || data.quality || "high")
    .trim()
    .toLowerCase();
  const quality = ["low", "medium", "high", "auto"].includes(qualityRaw) ? qualityRaw : "high";

  try {
    const version = await getModelLatestVersionId(token, OWNER, MODEL);
    /** @type {Record<string, unknown>} */
    const input = {
      prompt: data.prompt,
      aspect_ratio: aspect,
      quality,
      number_of_images: data.number_of_images ?? 1,
      output_format: data.output_format ?? "png",
      background: "auto",
      moderation: "auto",
    };
    if (data.input_images?.length) {
      input.input_images = data.input_images.slice(0, 4);
    }

    const created = await createPrediction(token, { version, input });
    const getUrl = created?.urls?.get;
    if (!getUrl || typeof getUrl !== "string") {
      await recordReplicateImageOutcome({
        ok: false,
        status: 502,
        model: MODEL_PATH,
        prediction_id: created?.id ?? null,
      });
      return { ok: false, status: 502, error: "Replicate não retornou urls.get", raw: created };
    }

    const waitMs = Number(env.REPLICATE_GPT_IMAGE_TIMEOUT_MS) || 300_000;
    const final = await waitForPrediction(token, getUrl, { maxWaitMs: waitMs, stepMs: 2000 });
    await recordReplicateImageOutcome({
      ok: true,
      status: 200,
      model: MODEL_PATH,
      prediction_id: final.id ?? null,
    });
    return {
      ok: true,
      prediction_id: final.id,
      status: final.status,
      output: normalizeGptImage2Output(final.output),
      model: MODEL_PATH,
    };
  } catch (err) {
    const httpStatus =
      err?.status === 402
        ? 402
        : err?.status && Number(err.status) >= 400 && Number(err.status) < 600
          ? Number(err.status)
          : 500;
    await recordReplicateImageOutcome({
      ok: false,
      status: httpStatus,
      model: MODEL_PATH,
      prediction_id: err?.prediction?.id ?? null,
    });
    return {
      ok: false,
      status: httpStatus,
      error: err instanceof Error ? err.message : "Erro ao gerar imagem",
      raw: err?.prediction ?? null,
    };
  }
}

/**
 * @param {string} raw
 */
export function friendlyReplicateGptImage2Error(raw) {
  const s = String(raw || "");
  if (/insufficient credit|billing|payment/i.test(s)) {
    return "Créditos insuficientes na Replicate. Adicione saldo no painel da Replicate.";
  }
  if (/unauthorized|invalid.*token|401/i.test(s)) {
    return "REPLICATE_API_TOKEN inválido. Configure o token de geração de imagens no servidor.";
  }
  if (/moderation|safety|policy/i.test(s)) {
    return "Pedido bloqueado pela moderação. Ajuste o texto e tente de novo.";
  }
  return s.length > 280 ? `${s.slice(0, 279)}…` : s || "Falha ao gerar imagem na Replicate.";
}
