import { createPrediction, getModelLatestVersionId, waitForPrediction } from "./replicateClient.js";
import { recordReplicateImageOutcome } from "./replicateUsage.js";
import { z } from "zod";

const OWNER = "black-forest-labs";
const MODEL = "flux-schnell";
const MODEL_PATH = `${OWNER}/${MODEL}`;

export const fluxSchnellInputSchema = z.object({
  prompt: z.string().min(3).max(2000),
  num_outputs: z.coerce.number().int().min(1).max(4).optional().default(1),
  aspect_ratio: z
    .enum(["1:1", "16:9", "21:9", "2:3", "3:2", "4:5", "5:4", "9:16", "9:21"])
    .optional()
    .default("1:1"),
  output_format: z.enum(["webp", "jpg", "png"]).optional().default("png"),
  output_quality: z.coerce.number().int().min(1).max(100).optional().default(80),
});

/**
 * Uma geração FLUX Schnell; registra sucesso/falha em `replicateUsage`.
 * @param {string} token
 * @param {z.infer<typeof fluxSchnellInputSchema>} data — já validado
 */
export async function executeFluxSchnell(token, data) {
  try {
    const version = await getModelLatestVersionId(token, OWNER, MODEL);
    const created = await createPrediction(token, {
      version,
      input: {
        prompt: data.prompt,
        num_outputs: data.num_outputs,
        aspect_ratio: data.aspect_ratio,
        output_format: data.output_format,
        output_quality: data.output_quality,
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
    const final = await waitForPrediction(token, getUrl);
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
      error: err instanceof Error ? err.message : "Erro ao gerar imagem",
    };
  }
}
