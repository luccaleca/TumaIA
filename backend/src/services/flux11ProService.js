import { createPrediction, getModelLatestVersionId, waitForPrediction } from "./replicateClient.js";
import { recordReplicateImageOutcome } from "./replicateUsage.js";
import { z } from "zod";

const OWNER = "black-forest-labs";
const MODEL = "flux-1.1-pro";
const MODEL_PATH = `${OWNER}/${MODEL}`;

/** Mesmos aspectos usados no Schnell; Pro aceita "custom" com width/height — não usamos aqui. */
export const flux11ProInputSchema = z.object({
  prompt: z.string().min(3).max(4000),
  /** URL http(s) acessível pela Replicate (ex.: signed URL do Supabase). */
  image_prompt: z.string().url(),
  aspect_ratio: z
    .enum(["1:1", "16:9", "21:9", "2:3", "3:2", "4:5", "5:4", "9:16", "9:21"])
    .optional()
    .default("1:1"),
  output_format: z.enum(["webp", "jpg", "png"]).optional().default("png"),
  output_quality: z.coerce.number().int().min(1).max(100).optional().default(85),
  safety_tolerance: z.coerce.number().int().min(1).max(6).optional().default(2),
  prompt_upsampling: z.coerce.boolean().optional().default(false),
});

let generationChain = Promise.resolve();

/**
 * FLUX 1.1 Pro com `image_prompt` (Redux) — referência visual + texto.
 * @param {string} token
 * @param {z.infer<typeof flux11ProInputSchema>} data
 */
export async function executeFlux11Pro(token, data) {
  const prev = generationChain;
  let release;
  generationChain = new Promise((resolve) => {
    release = resolve;
  });
  await prev.catch(() => {});
  try {
    return await executeFlux11ProOnce(token, data);
  } finally {
    release();
  }
}

/**
 * @param {string} token
 * @param {z.infer<typeof flux11ProInputSchema>} data
 */
async function executeFlux11ProOnce(token, data) {
  try {
    const version = await getModelLatestVersionId(token, OWNER, MODEL);
    const created = await createPrediction(token, {
      version,
      input: {
        prompt: data.prompt,
        image_prompt: data.image_prompt,
        aspect_ratio: data.aspect_ratio,
        output_format: data.output_format,
        output_quality: data.output_quality,
        safety_tolerance: data.safety_tolerance,
        prompt_upsampling: data.prompt_upsampling,
      },
    });
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
    const final = await waitForPrediction(token, getUrl, { maxWaitMs: 180_000, stepMs: 2000 });
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
      output: final.output,
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
      error: err instanceof Error ? err.message : "Erro ao gerar imagem (FLUX 1.1 Pro)",
    };
  }
}
