import { env } from "../config.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { ensureChatWorkerReady, runChatSerialized } from "./chatPythonWorker.js";
import { detectImageGenerationIntentFromHistory } from "./chatDeliveryUi.js";
import { tryChatAcervoResponse } from "./chatAcervoResponse.js";
import { guardChatProductAnswer } from "./chatProductGuard.js";
import { sanitizeChatAnswer } from "./chatAnswerSanitizer.js";
import { analyzeChatTurn } from "./chatTurnIntent.js";
import { loadChatFacts } from "./chatFacts.js";
import { buildChatTrainingPromptBlock } from "./chatPromptBundle.js";
import { buildConversaNaturalPromptHint } from "./chatConversaNatural.js";
import { buildPerfilGeralLlmPromptBlock } from "./chatPerfilGeralThemes.js";
import { tryChatCompositeResponse } from "./chatCompositeResponse.js";
import { formatEmpresaInfoAnswer } from "./chatEmpresaResponse.js";
import { formatContextosListAnswer } from "./chatContextosResponse.js";

/**
 * Mesma lógica de `POST /ia/chat`, sem auth HTTP.
 * @param {{ question: string, history?: Array<{ role: string, content: string }>, id_empresa?: string }} input
 * @returns {Promise<{ ok: true, data: Record<string, unknown> } | { ok: false, status: number, error: string }>}
 */
export async function processChatMessage(input) {
  const question = String(input.question || "").trim();
  const history = Array.isArray(input.history) ? input.history : [];
  const id_empresa = input.id_empresa;

  if (!question) {
    return { ok: false, status: 400, error: "question obrigatória" };
  }

  try {
    await ensureChatWorkerReady();
  } catch (err) {
    return {
      ok: false,
      status: 503,
      error:
        err instanceof Error
          ? err.message
          : "IA indisponível. Se mudou o modelo de embedding, apague backend/ia/indice_contextos e reinicie.",
    };
  }

  try {
    const db = getSupabaseAdmin();

    let facts = null;
    if (id_empresa && db) {
      facts = await loadChatFacts(db, id_empresa);
    }
    const nomeFantasia = facts?.nomeFantasia ?? null;

    const route_image_generation =
      Boolean(id_empresa) && Boolean(db) && detectImageGenerationIntentFromHistory(history, question);

    const turn = analyzeChatTurn(question, history, { nomeFantasia });

    const postExtras =
      turn.wantsImageRoute || route_image_generation
        ? {
            route_image_generation: true,
            offer_post_context: true,
            image_provider: env.IMAGE_PROVIDER || "replicate",
            image_pipeline: env.IMAGE_PIPELINE || "raw",
          }
        : {};

    if (turn.identityAnswer) {
      return {
        ok: true,
        data: {
          answer: turn.identityAnswer,
          source_documents: [],
          chat_route: "identity",
          chat_topics: turn.topics,
          ...postExtras,
        },
      };
    }

    if (turn.outOfScopeAnswer) {
      return {
        ok: true,
        data: {
          answer: turn.outOfScopeAnswer,
          source_documents: [],
          chat_route: "out_of_scope",
          chat_topics: turn.topics,
          ...postExtras,
        },
      };
    }

    if (turn.conversaNaturalAnswer) {
      return {
        ok: true,
        data: {
          answer: turn.conversaNaturalAnswer,
          source_documents: [],
          chat_route: "conversa_natural",
          chat_topics: turn.topics,
          ...postExtras,
        },
      };
    }

    const acervoBundle = facts?.acervo ?? null;

    if (id_empresa && db && facts && turn.route === "composite") {
      const compositeAnswer = await tryChatCompositeResponse({
        question,
        facts,
        idEmpresa: id_empresa,
        db,
      });
      if (compositeAnswer) {
        return {
          ok: true,
          data: {
            answer: compositeAnswer,
            source_documents: [],
            chat_route: "composite",
            chat_topics: turn.topics,
            ...postExtras,
          },
        };
      }
    }

    if (id_empresa && db && facts && turn.route === "empresa") {
      return {
        ok: true,
        data: {
          answer: formatEmpresaInfoAnswer(facts.empresa),
          source_documents: [],
          chat_route: "empresa",
          chat_topics: turn.topics,
          ...postExtras,
        },
      };
    }

    if (id_empresa && db && facts && turn.route === "contextos") {
      return {
        ok: true,
        data: {
          answer: formatContextosListAnswer(facts.contextos),
          source_documents: [],
          chat_route: "contextos",
          chat_topics: turn.topics,
          ...postExtras,
        },
      };
    }

    if (id_empresa && db && turn.route === "acervo" && turn.acervo && acervoBundle) {
      const acervoAnswer = await tryChatAcervoResponse({
        question,
        history,
        idEmpresa: id_empresa,
        db,
        midias: acervoBundle.midias,
        nomeFantasia: acervoBundle.nomeFantasia,
        classifyIntent: () => turn.acervo,
      });
      if (acervoAnswer) {
        return {
          ok: true,
          data: {
            answer: acervoAnswer,
            source_documents: [],
            acervo_query: true,
            chat_route: "acervo",
            chat_topics: turn.topics,
            ...postExtras,
          },
        };
      }
    }

    let trainingBlock =
      facts && turn.includeAcervoInPrompt
        ? buildChatTrainingPromptBlock({
            empresa: facts.empresa,
            contextos: facts.contextos,
            acervoLabels: acervoBundle?.labels ?? [],
            nomeFantasia,
          })
        : "";

    if (turn.chat_mode === "identidade") {
      trainingBlock = buildPerfilGeralLlmPromptBlock(nomeFantasia, turn.perfilGeralTheme ?? null);
    } else if (turn.chat_mode === "conversa_aberta") {
      const hint = buildConversaNaturalPromptHint(nomeFantasia);
      trainingBlock = [hint, trainingBlock].filter(Boolean).join("\n\n");
    }

    const t0 = Date.now();
    const workerTimeoutMs =
      turn.chat_mode === "conversa_aberta" ? env.CHAT_NATURAL_REQUEST_TIMEOUT_MS : undefined;
    const result = await runChatSerialized(
      {
        question,
        history,
        ...(id_empresa ? { id_empresa } : {}),
        ...(trainingBlock ? { acervo_context: trainingBlock } : {}),
        ...(turn.chat_mode ? { chat_mode: turn.chat_mode } : {}),
      },
      workerTimeoutMs ? { timeoutMs: workerTimeoutMs } : {},
    );
    const elapsedMs = Date.now() - t0;
    if (elapsedMs > 15_000) {
      console.info(`[ia/chat] resposta em ${Math.round(elapsedMs / 1000)}s`);
    }

    if (!result?.ok) {
      return { ok: false, status: 502, error: result?.error || "Falha na IA" };
    }

    let answer = String(result.result || "");
    if (acervoBundle?.midias?.length && turn.needsProductGuard) {
      answer = guardChatProductAnswer(answer, acervoBundle.midias, acervoBundle.nomeFantasia, {
        userQuestion: question,
      });
    }
    answer = sanitizeChatAnswer({
      answer,
      question,
      history,
      nomeFantasia: acervoBundle?.nomeFantasia ?? nomeFantasia,
    });
    const source_documents = Array.isArray(result.source_documents) ? result.source_documents : [];

    return {
      ok: true,
      data: {
        answer,
        source_documents,
        chat_route: turn.route,
        ...(turn.chat_mode ? { chat_mode: turn.chat_mode } : {}),
        ...(turn.topics?.length ? { chat_topics: turn.topics } : {}),
        ...(route_image_generation
          ? {
              route_image_generation: true,
              offer_post_context: true,
              image_provider: env.IMAGE_PROVIDER || "replicate",
              image_pipeline: env.IMAGE_PIPELINE || "raw",
            }
          : {}),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar IA";
    const timedOut = /tempo esgotado|timed?\s*out/i.test(msg);
    return {
      ok: false,
      status: timedOut ? 504 : 500,
      error: timedOut
        ? "A IA demorou mais que o limite configurado. Na primeira mensagem após reiniciar o backend, o índice pode levar vários minutos — aguarde e tente de novo."
        : msg,
    };
  }
}
