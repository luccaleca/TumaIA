import {
  detectImageGenerationIntent,
  detectImageGenerationIntentFromHistory,
} from "./imageGenerationIntent.js";

/** @deprecated use detectImageGenerationIntent */
export function shouldOfferDeliveryButtons(question) {
  return detectImageGenerationIntent(question);
}

export { detectImageGenerationIntent, detectImageGenerationIntentFromHistory };
