import { env, isCloudChatLlm } from "../config.js";
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
import { formatEmpresaInfoAnswer, loadEmpresaChatFacts } from "./chatEmpresaResponse.js";
import { runNodeChatLlm, nodeChatLlmUnavailableFallback } from "./chatNodeLlmLight.js";
import {
  clipAgenteMarcaForPrompt,
  renderAgenteMarcaMarkdown,
} from "./brandAgentService.js";
import { partitionContextosIdentidade } from "../modules/empresas/identidadeMarca.js";

function userFacingChatError(err) {
  const msg = err instanceof Error ? err.message : "Erro ao consultar IA";
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(msg)) {
    return "Não consegui falar com o banco de dados agora. Confira a conexão/Supabase no backend e tente de novo.";
  }
  if (/tempo esgotado|timed?\s*out/i.test(msg)) {
    return "A IA demorou mais que o limite configurado. Aguarde e tente de novo.";
  }
  return msg;
}

/** Chat no Node (regras + LLM). Python/RAG só se TUMAIA_NODE_CHAT=false. */
export function shouldUseNodeChat(input = {}) {
  return (
    input.fast_path === true ||
    env.TUMAIA_NODE_CHAT === true ||
    env.TUMAIA_WHATSAPP_FAST_PATH === true ||
    isCloudChatLlm()
  );
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient | null} db
 * @param {string | undefined} idEmpresa
 */
async function tryLoadNomeFantasia(db, idEmpresa) {
  if (!db || !idEmpresa) return null;
  try {
    const empresa = await Promise.race([
      loadEmpresaChatFacts(db, idEmpresa),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), 2500);
      }),
    ]);
    return String(empresa?.nome_fantasia ?? "").trim() || null;
  } catch (err) {
    console.warn(
      "[ia/chat] cadastro da empresa indisponível:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function buildDirectTurnResponse(turn, postExtras) {
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
  return null;
}

const CLOUD_LLM_ROUTES = new Set(["llm_light", "llm_rag", "identity_llm"]);

/**
 * @param {{ ok?: boolean, cloud_session_mode?: string }} llm
 * @param {{ route?: string }} [turn]
 */
function buildCloudResponseMeta(llm, turn = {}) {
  const chatRoute = llm.ok
    ? llm.cloud_session_mode === "session_reuse"
      ? "cloud_agent_session"
      : turn.route === "llm_rag"
        ? "cloud_agent_raw"
        : "cloud_agent_raw"
    : "cloud_agent_fallback";
  return {
    chat_route: chatRoute,
    chat_engine: "cloud_agent",
    chat_source: "cloud",
  };
}

/**
 * Cloud: pula Supabase/acervo quando a resposta virá do agente (mais rápido).
 * @param {{
 *   question: string,
 *   history: Array<{ role: string, content: string }>,
 *   id_empresa?: string,
 *   chat_session_id?: string,
 * }} input
 * @param {ReturnType<typeof analyzeChatTurn>} turn
 * @param {Record<string, unknown>} postExtras
 */
async function tryCloudLlmFastPath(input, turn, postExtras) {
  if (!isCloudChatLlm() || !CLOUD_LLM_ROUTES.has(turn.route)) {
    return null;
  }

  const t0 = Date.now();
  const llm = await runNodeChatLlm({
    question: input.question,
    history: input.history,
    chat_mode: turn.chat_mode,
    nomeFantasia: null,
    sessionKey: input.chat_session_id || input.id_empresa || null,
  });
  const elapsedMs = Date.now() - t0;
  if (elapsedMs > 8_000) {
    console.info(`[ia/chat] cloud fast-path em ${Math.round(elapsedMs / 1000)}s`);
  }

  const answer = llm.ok
    ? String(llm.text || "")
    : nodeChatLlmUnavailableFallback(null);

  const sanitized = sanitizeChatAnswer({
    answer,
    question: input.question,
    history: input.history,
    nomeFantasia: null,
  });

  const chatMeta = buildCloudResponseMeta(llm, turn);

  return {
    ok: true,
    data: {
      answer: sanitized,
      source_documents: [],
      ...chatMeta,
      ...(turn.chat_mode ? { chat_mode: turn.chat_mode } : {}),
      ...(turn.topics?.length ? { chat_topics: turn.topics } : {}),
      ...postExtras,
    },
  };
}

/**
 * Mesma lógica de `POST /ia/chat`, sem auth HTTP.
 * @param {{ question: string, history?: Array<{ role: string, content: string }>, id_empresa?: string, chat_session_id?: string, fast_path?: boolean }} input
 * @returns {Promise<{ ok: true, data: Record<string, unknown> } | { ok: false, status: number, error: string }>}
 */
export async function processChatMessage(input) {
  const question = String(input.question || "").trim();
  const history = Array.isArray(input.history) ? input.history : [];
  const id_empresa = input.id_empresa;
  const fastPath = shouldUseNodeChat(input);

  if (!question) {
    return { ok: false, status: 400, error: "question obrigatória" };
  }

  const dbEarly = getSupabaseAdmin();
  const route_image_generation_early =
    Boolean(id_empresa) && Boolean(dbEarly) && detectImageGenerationIntentFromHistory(history, question);

  if (route_image_generation_early) {
    return {
      ok: true,
      data: {
        answer: "",
        source_documents: [],
        chat_route: "post_briefing",
        route_image_generation: true,
        offer_post_context: true,
        image_provider: env.IMAGE_PROVIDER || "replicate",
        image_pipeline: env.IMAGE_PIPELINE || "raw",
      },
    };
  }

  try {
    const db = getSupabaseAdmin();
    const turnQuick = analyzeChatTurn(question, history, { nomeFantasia: null });
    const route_image_generation_quick =
      Boolean(id_empresa) && Boolean(db) && detectImageGenerationIntentFromHistory(history, question);
    const postExtrasQuick =
      turnQuick.wantsImageRoute || route_image_generation_quick
        ? {
            route_image_generation: true,
            offer_post_context: true,
            image_provider: env.IMAGE_PROVIDER || "replicate",
            image_pipeline: env.IMAGE_PIPELINE || "raw",
          }
        : {};

    let directQuick = buildDirectTurnResponse(turnQuick, postExtrasQuick);
    if (directQuick && turnQuick.route === "identity" && id_empresa && db) {
      const nomeFantasiaQuick = await tryLoadNomeFantasia(db, id_empresa);
      if (nomeFantasiaQuick) {
        const turnNamed = analyzeChatTurn(question, history, { nomeFantasia: nomeFantasiaQuick });
        directQuick = buildDirectTurnResponse(turnNamed, postExtrasQuick) || directQuick;
      }
    }
    if (directQuick) return directQuick;

    const cloudFast = await tryCloudLlmFastPath(
      {
        question,
        history,
        id_empresa,
        chat_session_id: input.chat_session_id,
      },
      turnQuick,
      postExtrasQuick,
    );
    if (cloudFast) return cloudFast;

    let facts = null;
    if (id_empresa && db) {
      try {
        facts = await loadChatFacts(db, id_empresa);
      } catch (err) {
        console.warn("[ia/chat] facts indisponíveis:", err instanceof Error ? err.message : err);
      }
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

    const directTurn = buildDirectTurnResponse(turn, postExtras);
    if (directTurn) return directTurn;

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

    if (facts?.contextos?.length) {
      const { identidadeDados } = partitionContextosIdentidade(facts.contextos);
      if (identidadeDados) {
        const agenteMd = clipAgenteMarcaForPrompt(
          renderAgenteMarcaMarkdown(identidadeDados, facts.empresa),
        );
        if (agenteMd) {
          trainingBlock = [agenteMd, trainingBlock].filter(Boolean).join("\n\n");
        }
      }
    }

    if (turn.chat_mode === "identidade") {
      trainingBlock = buildPerfilGeralLlmPromptBlock(nomeFantasia, turn.perfilGeralTheme ?? null);
    } else if (turn.chat_mode === "conversa_aberta") {
      const hint = buildConversaNaturalPromptHint(nomeFantasia);
      trainingBlock = [hint, trainingBlock].filter(Boolean).join("\n\n");
    }

    if (fastPath || isCloudChatLlm()) {
      const t0 = Date.now();
      const llm = await runNodeChatLlm({
        question,
        history,
        trainingBlock,
        chat_mode: turn.chat_mode,
        nomeFantasia,
        sessionKey: input.chat_session_id || id_empresa || null,
      });
      const elapsedMs = Date.now() - t0;
      if (elapsedMs > 8_000) {
        const label = isCloudChatLlm() ? "agente cloud" : "fast-path Ollama";
        console.info(`[ia/chat] ${label} em ${Math.round(elapsedMs / 1000)}s`);
      }

      let answer = llm.ok
        ? String(llm.text || "")
        : nodeChatLlmUnavailableFallback(acervoBundle?.nomeFantasia ?? nomeFantasia);

      if (llm.ok && acervoBundle?.midias?.length && turn.needsProductGuard) {
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

      const chatMeta = isCloudChatLlm()
        ? buildCloudResponseMeta(llm, turn)
        : {
            chat_route:
              turn.route === "llm_rag"
                ? "node_llm_context"
                : llm.ok
                  ? "node_llm_light"
                  : "node_llm_fallback",
            chat_engine: "node_ollama",
            chat_source: "ollama",
          };

      return {
        ok: true,
        data: {
          answer,
          source_documents: [],
          ...chatMeta,
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
    const msg = userFacingChatError(err);
    const timedOut = /tempo esgotado|timed?\s*out/i.test(err instanceof Error ? err.message : "");
    return {
      ok: false,
      status: timedOut ? 504 : 500,
      error: msg,
    };
  }
}
