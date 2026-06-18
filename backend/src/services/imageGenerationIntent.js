/**
 * Detecta pedido de arte / imagem / post visual no texto do usuário.
 * Lógica de interpretação em `tumaInterpretation.js`.
 */

export {
  isConversationalMessage,
  isMetaOrHypotheticalQuestion,
  hasExplicitCreateRequest,
  mentionsVisualTopic,
  isImageRevisionRequest,
  isPostDeliveryTypedCommand,
  detectImageGenerationIntent,
  detectImageGenerationIntentFromHistory,
} from "./tumaInterpretation.js";
