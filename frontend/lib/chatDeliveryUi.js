/** Espelha `backend/src/services/tumaInterpretation.js` */

export {
  isConversationalMessage,
  isMetaOrHypotheticalQuestion,
  hasExplicitCreateRequest,
  mentionsVisualTopic,
  detectImageGenerationIntent,
  detectImageGenerationIntentFromHistory,
} from "./tumaInterpretation.js";

/** @deprecated use detectImageGenerationIntent */
export function shouldOfferPostContext(question) {
  return detectImageGenerationIntent(question);
}
