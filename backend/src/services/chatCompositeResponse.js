/**
 * Respostas compostas — várias intenções na mesma mensagem (treino «como gente»).
 */

import { extractChatTopics, isCompositeChatTopics } from "./chatMessageTopics.js";
import { classifyChatAcervoIntent } from "./chatIntent.js";
import { tryChatAcervoResponse } from "./chatAcervoResponse.js";
import { formatContextosListAnswer } from "./chatContextosResponse.js";
import { formatEmpresaInfoAnswer } from "./chatEmpresaResponse.js";

/**
 * @param {string} topic
 * @param {{ nomeFantasia?: string | null, empresa?: Record<string, unknown> | null, contextos?: unknown[] }} ctx
 */
function answerTopicFragment(topic, ctx) {
  const emp = ctx.nomeFantasia ? String(ctx.nomeFantasia).trim() : null;

  switch (topic) {
    case "SAUDACAO":
      return emp
        ? `Oi! Sou o Tuma IA, assistente de artes da ${emp}.`
        : "Oi! Sou o Tuma IA.";
    case "IDENTIDADE_QUEM":
      return emp
        ? `Sou o Tuma IA — ajudo o marketing da ${emp} com posts e artes pro Instagram.`
        : "Sou o Tuma IA — assistente de artes e posts para a empresa do painel.";
    case "IDENTIDADE_NOME":
      return emp
        ? `Meu nome é Tuma IA, da ${emp}.`
        : "Meu nome é Tuma IA.";
    case "IDENTIDADE_FUNCAO":
      return emp
        ? `Sirvo a ${emp} no marketing: produtos em Mídias, dados da empresa, contextos e posts/artes pro Instagram — com resumo no painel antes da prévia.`
        : "Sirvo o marketing da empresa: Mídias, contextos e posts/artes pro Instagram.";
    case "COMO_FUNCIONA":
      return (
        "Você conversa comigo aqui no chat; quando pedir uma arte, o painel mostra um resumo " +
        "do pedido antes de gerar a prévia. Produtos e campanhas vêm do que está cadastrado em Mídias e Contextos."
      );
    case "CRIADOR":
      return "Fui criado por Diego Suhai Navarro.";
    case "SIGNIFICADO_NOME":
      return "Tuma vem do suaíli (swahili) e significa «enviar».";
    case "EMPRESA":
      return formatEmpresaInfoAnswer(ctx.empresa ?? null);
    case "CONTEXTOS":
      return formatContextosListAnswer(ctx.contextos ?? []);
    case "AGRADECIMENTO":
      return emp
        ? `Perfeito! Quando a ${emp} precisar, é só chamar.`
        : "Perfeito! Quando quiser, pode mandar a próxima.";
    default:
      return null;
  }
}

/**
 * @param {string} question
 */
export function shouldUseCompositeResponse(question) {
  const topics = extractChatTopics(question);
  return isCompositeChatTopics(topics);
}

/**
 * @param {{
 *   question: string,
 *   facts: {
 *     nomeFantasia?: string | null,
 *     empresa?: Record<string, unknown> | null,
 *     contextos?: unknown[],
 *     acervo?: { midias: unknown[], nomeFantasia?: string | null },
 *   },
 *   idEmpresa?: string,
 *   db?: import("@supabase/supabase-js").SupabaseClient,
 * }} opts
 * @returns {Promise<string | null>}
 */
export async function tryChatCompositeResponse(opts) {
  const { question, facts, idEmpresa, db } = opts;
  const topics = extractChatTopics(question);
  if (!isCompositeChatTopics(topics)) return null;

  const ctx = {
    nomeFantasia: facts.nomeFantasia ?? null,
    empresa: facts.empresa ?? null,
    contextos: facts.contextos ?? [],
  };

  const parts = [];

  for (const topic of topics) {
    if (topic === "ACERVO_LISTA" || topic === "ACERVO_INFO") {
      if (!idEmpresa || !db || !facts.acervo) continue;
      const acervoIntent = classifyChatAcervoIntent(question);
      const acervoAnswer = await tryChatAcervoResponse({
        question,
        idEmpresa,
        db,
        midias: facts.acervo.midias,
        nomeFantasia: facts.acervo.nomeFantasia,
        classifyIntent: () => acervoIntent,
      });
      if (acervoAnswer) parts.push(acervoAnswer);
      continue;
    }

    const frag = answerTopicFragment(topic, ctx);
    if (frag) parts.push(frag);
  }

  const unique = [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
  if (unique.length < 2 && !topics.some((t) => t.startsWith("ACERVO"))) return null;

  let answer = unique.join("\n\n");

  if (
    !topics.some((t) => t.startsWith("ACERVO")) &&
    !topics.includes("AGRADECIMENTO") &&
    topics.length >= 2
  ) {
    answer += ctx.nomeFantasia
      ? `\n\nQuer listar produtos em Mídias ou montar um post?`
      : "\n\nQuer ver o acervo de produtos ou montar um post?";
  }

  return answer;
}
