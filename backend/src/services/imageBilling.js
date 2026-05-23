import { env } from "../config.js";
import {
  assertReplicateBillingAllowed,
  assertReplicateBurst,
  assertReplicateDailySuccessCap,
  recordReplicateImageOutcome,
} from "./replicateUsage.js";

export function imageDailySuccessCap() {
  const v = env.IMAGE_DAILY_SUCCESS_CAP ?? env.REPLICATE_DAILY_SUCCESS_CAP;
  return Number(v) || 0;
}

export function imageBurstPerMinute() {
  const v = env.IMAGE_BURST_PER_MINUTE ?? env.REPLICATE_BURST_PER_MINUTE;
  return Number(v) || 0;
}

export function assertImageBillingAllowed() {
  const provider = env.IMAGE_PROVIDER || "replicate";
  if (provider === "replicate" || provider === "flux") {
    return assertReplicateBillingAllowed();
  }
  if (!env.OPENAI_ALLOW_BILLING) {
    return {
      ok: false,
      status: 503,
      error:
        "Geração de imagens (OpenAI) desligada. Defina OPENAI_ALLOW_BILLING=true e OPENAI_API_KEY no backend.",
    };
  }
  if (!(env.OPENAI_API_KEY || "").trim()) {
    return {
      ok: false,
      status: 503,
      error: "Geração de imagem não configurada (OPENAI_API_KEY).",
    };
  }
  return { ok: true };
}

export function assertImagePostBurst() {
  return assertReplicateBurst("post", imageBurstPerMinute());
}

export async function assertImageDailySuccessCap() {
  return assertReplicateDailySuccessCap(imageDailySuccessCap());
}

/**
 * @param {{ ok: boolean, model?: string, error?: string }} row
 */
export async function recordImageGenerationOutcome(row) {
  return recordReplicateImageOutcome(row);
}
