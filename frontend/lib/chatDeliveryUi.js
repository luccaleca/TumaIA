/** Espelha o backend: intenção de gerar imagem no chat do painel. */

export {
  isConversationalMessage,
  isMetaOrHypotheticalQuestion,
  hasExplicitCreateRequest,
  mentionsVisualTopic,
  detectImageGenerationIntent,
  detectImageGenerationIntentFromHistory,
} from "./tumaInterpretation.js";
