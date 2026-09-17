import { env } from "../config.js";
import {
  assertReplicateBillingAllowed,
  assertReplicateBurst,
  assertReplicateDailySuccessCap,
  recordReplicateImageOutcome,
} from "./replicateUsage.js";
import { resolveGrokImageApiKey, looksLikeCrsrPrefixedApiKey } from "./grokImageService.js";

export function imageDailySuccessCap() {
  const v = env.IMAGE_DAILY_SUCCESS_CAP ?? env.REPLICATE_DAILY_SUCCESS_CAP;
  return Number(v) || 0;
}

export function imageBurstPerMinute() {
  const v = env.IMAGE_BURST_PER_MINUTE ?? env.REPLICATE_BURST_PER_MINUTE;
  return Number(v) || 0;
}

export function assertImageBillingAllowed() {
  const provider = env.IMAGE_PROVIDER || "grok";

  if (provider === "grok") {
    if (!env.GROK_ALLOW_BILLING) {
      return {
        ok: false,
        status: 503,
        error:
          "Geração de imagens (Grok Imagine) desligada. Defina GROK_ALLOW_BILLING=true e XAI_API_KEY.",
      };
    }
    if (!resolveGrokImageApiKey()) {
      const hasCrsrOnly = looksLikeCrsrPrefixedApiKey(env.CHAT_CLOUD_API_KEY || "");
      return {
        ok: false,
        status: 503,
        error: hasCrsrOnly
          ? "CHAT_CLOUD_API_KEY (crsr_) não gera imagem na xAI. Defina XAI_API_KEY ou IMAGE_PROVIDER=replicate."
          : "Geração Grok Imagine sem XAI_API_KEY. Ou use IMAGE_PROVIDER=replicate.",
      };
    }
    return { ok: true };
  }

  if (provider === "replicate") {
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
