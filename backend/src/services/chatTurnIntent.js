/**

 * Análise da mensagem do usuário — roteamento do chat.

 */



import { classifyChatAcervoIntent } from "./chatIntent.js";

import { tryChatIdentityResponse } from "./chatIdentityResponse.js";

import {
  classifyPerfilGeralTheme,
  isPerfilGeralQuestion,
} from "./chatPerfilGeralThemes.js";

import { isIdentityOrMetaQuestion, shouldSkipAcervoBlock } from "./chatOffTopic.js";

import { detectImageGenerationIntentFromHistory } from "./chatDeliveryUi.js";

import { extractChatTopics, isCompositeChatTopics } from "./chatMessageTopics.js";

import { shouldUseCompositeResponse } from "./chatCompositeResponse.js";
import { tryChatOutOfScopeResponse } from "./chatOutOfScopeResponse.js";
import {
  tryChatConversaNaturalResponse,
  isConversaNaturalQuestion,
} from "./chatConversaNatural.js";



/**

 * @param {string} question

 * @param {Array<{ role: string, content: string }>} [history]

 * @param {{ nomeFantasia?: string | null }} [ctx]

 */

export function analyzeChatTurn(question, history = [], ctx = {}) {

  const q = String(question || "").trim();

  const nomeFantasia = ctx.nomeFantasia ?? null;

  const topics = extractChatTopics(q);

  const wantsImageRoute = detectImageGenerationIntentFromHistory(history, q);



  if (shouldUseCompositeResponse(q)) {

    return {

      route: "composite",

      topics,

      identityAnswer: null,

      acervo: null,

      chat_mode: null,

      includeAcervoInPrompt: false,

      needsProductGuard: false,

      wantsImageRoute,

    };

  }



  const identityAnswer = tryChatIdentityResponse(q, nomeFantasia);

  if (identityAnswer) {

    return {

      route: "identity",

      topics,

      identityAnswer,

      acervo: null,

      chat_mode: "identidade",

      includeAcervoInPrompt: false,

      needsProductGuard: false,

      wantsImageRoute: false,

      perfilGeralTheme: classifyPerfilGeralTheme(q),

    };

  }

  const acervoEarly = classifyChatAcervoIntent(q, history);
  if (acervoEarly.kind !== "NONE") {
    return {
      route: "acervo",
      topics,
      identityAnswer: null,
      acervo: acervoEarly,
      chat_mode: null,
      includeAcervoInPrompt: false,
      needsProductGuard: false,
      wantsImageRoute,
    };
  }

  if (isPerfilGeralQuestion(q)) {

    const perfilGeralTheme = classifyPerfilGeralTheme(q);

    return {

      route: "identity_llm",

      topics: [...topics, "PERFIL_GERAL", perfilGeralTheme || "GERAL"].filter(Boolean),

      identityAnswer: null,

      acervo: null,

      chat_mode: "identidade",

      includeAcervoInPrompt: false,

      needsProductGuard: false,

      wantsImageRoute: false,

      perfilGeralTheme,

    };

  }

  const outOfScopeAnswer = tryChatOutOfScopeResponse(q, nomeFantasia);
  if (outOfScopeAnswer) {
    return {
      route: "out_of_scope",
      topics: [...topics, "DATA_HORA"],
      identityAnswer: null,
      outOfScopeAnswer,
      acervo: null,
      chat_mode: null,
      includeAcervoInPrompt: false,
      needsProductGuard: false,
      wantsImageRoute: false,
    };
  }

  const conversaNaturalAnswer = tryChatConversaNaturalResponse(q, nomeFantasia);
  if (conversaNaturalAnswer) {
    return {
      route: "conversa_natural",
      topics: [...topics, "CONVERSA_NATURAL"],
      identityAnswer: null,
      conversaNaturalAnswer,
      acervo: null,
      chat_mode: null,
      includeAcervoInPrompt: false,
      needsProductGuard: false,
      wantsImageRoute: false,
    };
  }

  if (topics.includes("EMPRESA") && topics.length === 1) {

    return {

      route: "empresa",

      topics,

      identityAnswer: null,

      acervo: null,

      chat_mode: null,

      includeAcervoInPrompt: false,

      needsProductGuard: false,

      wantsImageRoute,

    };

  }



  if (topics.includes("CONTEXTOS") && topics.length === 1) {

    return {

      route: "contextos",

      topics,

      identityAnswer: null,

      acervo: null,

      chat_mode: null,

      includeAcervoInPrompt: false,

      needsProductGuard: false,

      wantsImageRoute,

    };

  }



  const acervo = classifyChatAcervoIntent(q, history);

  if (acervo.kind !== "NONE") {

    return {

      route: "acervo",

      topics,

      identityAnswer: null,

      acervo,

      chat_mode: null,

      includeAcervoInPrompt: false,

      needsProductGuard: false,

      wantsImageRoute,

    };

  }



  const skipAcervo = shouldSkipAcervoBlock(q);

  const conversaAberta = isConversaNaturalQuestion(q);

  let chat_mode = null;

  if (conversaAberta) {
    chat_mode = "conversa_aberta";
  } else if (isIdentityOrMetaQuestion(q)) {
    chat_mode = "identidade";
  }



  return {

    route: chat_mode ? "llm_light" : "llm_rag",

    topics,

    identityAnswer: null,

    acervo: null,

    chat_mode,

    includeAcervoInPrompt: !skipAcervo,

    needsProductGuard:

      !shouldSkipAcervoBlock(q) &&

      /\b(produto|acervo|midia|temos|tem\s+|cadastrad|whey|creatina|monster|powerade)\b/i.test(q),

    wantsImageRoute,

  };

}



export { isCompositeChatTopics, extractChatTopics };


