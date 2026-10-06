/**
 * Bateria de cenários de roteamento do chat (offline, sem APIs externas).
 * Valida analyzeChatTurn + detectImageGenerationIntent* + regra de UI "LLM primeiro".
 * NÃO importa serviços de geração de imagem (gptImage2, replicate*, etc.).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

import { analyzeChatTurn } from "../../backend/src/services/chatTurnIntent.js";
import {
  detectImageGenerationIntent,
  detectImageGenerationIntentFromHistory,
} from "../../backend/src/services/imageGenerationIntent.js";
import { tryChatIdentityResponse } from "../../backend/src/services/chatIdentityResponse.js";
import { isDemoAgentMode } from "../../backend/src/services/demoAgentKnowledge.js";
import { env } from "../../backend/src/config.js";
import { CHAT_PEDIDO_AGUARDE_MSG } from "../../frontend/app/painel/chat/chatImageConfirmUtils.js";

const FY = { nomeFantasia: "FYT" };
const PLACEHOLDER_BRIEFING = CHAT_PEDIDO_AGUARDE_MSG;

/**
 * Espelho da regra em frontend/app/painel/chat/page.js (ramo sem post_supplement):
 * route_image_generation → mostra answer do LLM se não vazio; senão placeholder de briefing.
 * Não modifica page.js — helper local de teste.
 *
 * @param {{ route_image_generation?: boolean, answer?: string | null, demoAgent?: boolean, post_supplement?: object | null }} opts
 */
function resolveAssistantContentForImageRoute(opts) {
  const routeImage = Boolean(opts.route_image_generation);
  const answer = opts.answer;
  const answerTrim = typeof answer === "string" ? answer.trim() : "";
  const demoAgent = Boolean(opts.demoAgent);
  const post_supplement = opts.post_supplement ?? null;

  if (!routeImage) return answer;

  if (demoAgent && answerTrim) return answerTrim;
  if (post_supplement?.briefing_status === "collecting") return "Falta só completar o pedido:";
  if (post_supplement) return "Resumo do pedido para a arte:";
  return answerTrim || PLACEHOLDER_BRIEFING;
}

/** Garante que este arquivo de teste não puxou módulos de geração real de imagem. */
function assertNoImageGenModulesLoaded() {
  const require = createRequire(import.meta.url);
  const cacheKeys = Object.keys(require.cache || {});
  const banned = /gptImage2|replicateImage|imagePreviewInternal|grokImage|openai.*image/i;
  const hit = cacheKeys.find((k) => banned.test(k));
  assert.equal(hit, undefined, `módulo de geração de imagem carregado: ${hit}`);
}

describe("bateria roteamento — identidade / empresa sem arte", () => {
  it('1) "quem é vocês?" → identity (comportamento atual), sem arte', () => {
    const q = "quem é vocês?";
    const turn = analyzeChatTurn(q, [], FY);
    assert.equal(turn.route, "identity");
    assert.equal(turn.wantsImageRoute, false);
    assert.equal(detectImageGenerationIntent(q), false);
    assert.equal(detectImageGenerationIntentFromHistory([], q), false);
    const id = tryChatIdentityResponse(q, "FYT");
    assert.match(id || turn.identityAnswer || "", /Tuma IA/i);
  });

  it('2) "quem trabalha comigo?" → rota atual sem arte', () => {
    const q = "quem trabalha comigo?";
    const turn = analyzeChatTurn(q, [], FY);
    // Comportamento atual pós-routing: conversa aberta (llm_light), não identity.
    assert.equal(turn.route, "llm_light");
    assert.equal(turn.wantsImageRoute, false);
    assert.equal(detectImageGenerationIntent(q), false);
    assert.equal(tryChatIdentityResponse(q, "FYT"), null);
  });
});

describe("bateria roteamento — acervo sem arte", () => {
  it('3a) "quais produtos temos?" → acervo, sem intent de imagem', () => {
    const q = "quais produtos temos?";
    const turn = analyzeChatTurn(q, [], FY);
    assert.equal(turn.route, "acervo");
    assert.equal(turn.acervo?.kind, "LISTAR_PRODUTOS");
    assert.equal(turn.wantsImageRoute, false);
    assert.equal(detectImageGenerationIntent(q), false);
  });

  it('3b) "mostra mídias" → acervo, sem intent de imagem', () => {
    const q = "mostra mídias";
    const turn = analyzeChatTurn(q, [], FY);
    assert.equal(turn.route, "acervo");
    assert.ok(turn.acervo?.kind === "LISTAR_PRODUTOS" || turn.acervo?.kind === "LISTAR_MIDIAS");
    assert.equal(turn.wantsImageRoute, false);
    assert.equal(detectImageGenerationIntent(q), false);
  });
});

describe("bateria roteamento — entrega / conversa sem arte", () => {
  it('4) "como vocês entregam?" → conversa (llm_light|conversa_natural), sem wantsImageRoute', () => {
    const q = "como vocês entregam?";
    const turn = analyzeChatTurn(q, [], FY);
    assert.ok(
      turn.route === "llm_light" || turn.route === "conversa_natural",
      `route inesperado: ${turn.route}`,
    );
    assert.equal(turn.wantsImageRoute, false);
    assert.equal(detectImageGenerationIntent(q), false);
  });
});

describe("bateria roteamento — intent de imagem simulado (sem API)", () => {
  it('5a) "cria um post" → detectImage + wantsImageRoute (só flags)', () => {
    const q = "cria um post";
    assert.equal(detectImageGenerationIntent(q), true);
    const turn = analyzeChatTurn(q, [], FY);
    assert.equal(turn.wantsImageRoute, true);
    assertNoImageGenModulesLoaded();
  });

  it('5b) "gera uma arte" → detectImage + wantsImageRoute (só flags)', () => {
    const q = "gera uma arte";
    assert.equal(detectImageGenerationIntent(q), true);
    const turn = analyzeChatTurn(q, [], FY);
    assert.equal(turn.wantsImageRoute, true);
    assertNoImageGenModulesLoaded();
  });
});

describe("bateria roteamento — thread contínua (não gruda arte)", () => {
  it("6) empresa → imagem simulada → produtos: cada turno independente", () => {
    const history = [];

    const t1 = analyzeChatTurn("fala sobre a empresa", history, FY);
    assert.equal(t1.route, "empresa");
    assert.equal(t1.wantsImageRoute, false);
    assert.equal(detectImageGenerationIntent("fala sobre a empresa"), false);
    history.push(
      { role: "user", content: "fala sobre a empresa" },
      { role: "assistant", content: "A FYT é a empresa do workspace." },
    );

    const t2 = analyzeChatTurn("gera uma arte", history, FY);
    assert.equal(detectImageGenerationIntent("gera uma arte"), true);
    assert.equal(t2.wantsImageRoute, true);
    history.push(
      { role: "user", content: "gera uma arte" },
      {
        role: "assistant",
        content: "Preparando resumo… (flags only — sem geração real)",
      },
    );

    const t3 = analyzeChatTurn("quais produtos temos?", history, FY);
    assert.equal(t3.route, "acervo");
    assert.equal(t3.acervo?.kind, "LISTAR_PRODUTOS");
    assert.equal(t3.wantsImageRoute, false);
    assert.equal(detectImageGenerationIntent("quais produtos temos?"), false);
    assert.equal(
      detectImageGenerationIntentFromHistory(history, "quais produtos temos?"),
      false,
    );
  });
});

describe("bateria roteamento — cadastro / mídia ≠ arte", () => {
  it('7) "cadastra produto" / "adiciona mídia" → detectImage false', () => {
    assert.equal(detectImageGenerationIntent("cadastra produto"), false);
    assert.equal(detectImageGenerationIntent("adiciona mídia"), false);
    assert.equal(analyzeChatTurn("cadastra produto", [], FY).wantsImageRoute, false);
    assert.equal(analyzeChatTurn("adiciona mídia", [], FY).wantsImageRoute, false);
  });
});

describe("bateria roteamento — preview vs consulta de foto", () => {
  it('8a) "quero ver como fica" → intent imagem explícito true', () => {
    const q = "quero ver como fica";
    // Expectativa de produto: frase de preview visual abre fluxo de arte.
    assert.equal(detectImageGenerationIntent(q), true);
    assert.equal(analyzeChatTurn(q, [], FY).wantsImageRoute, true);
  });

  it('8b) "Tem foto do produto X?" → acervo / não imagem', () => {
    const q = "Tem foto do produto X?";
    const turn = analyzeChatTurn(q, [], FY);
    assert.equal(turn.route, "acervo");
    assert.equal(detectImageGenerationIntent(q), false);
    assert.equal(turn.wantsImageRoute, false);
  });
});

describe("bateria UI — LLM primeiro quando route_image_generation", () => {
  it("9) answer não vazio → content = answer; vazio → placeholder", () => {
    const llm = "Aqui está o briefing da arte com whey.";
    assert.equal(
      resolveAssistantContentForImageRoute({
        route_image_generation: true,
        answer: llm,
      }),
      llm,
    );
    assert.equal(
      resolveAssistantContentForImageRoute({
        route_image_generation: true,
        answer: "   ",
      }),
      PLACEHOLDER_BRIEFING,
    );
    assert.equal(
      resolveAssistantContentForImageRoute({
        route_image_generation: true,
        answer: "",
      }),
      PLACEHOLDER_BRIEFING,
    );
    assert.equal(
      resolveAssistantContentForImageRoute({
        route_image_generation: false,
        answer: llm,
      }),
      llm,
    );
  });

  it("9b) demo agent com answer → mantém LLM; sem answer → placeholder", () => {
    const llm = "Vou montar a arte no formato 1:1.";
    assert.equal(
      resolveAssistantContentForImageRoute({
        route_image_generation: true,
        answer: llm,
        demoAgent: true,
      }),
      llm,
    );
    assert.equal(
      resolveAssistantContentForImageRoute({
        route_image_generation: true,
        answer: "",
        demoAgent: true,
      }),
      PLACEHOLDER_BRIEFING,
    );
  });
});

describe("bateria roteamento — demo on/off não inverte intent", () => {
  it("10a) processo atual: acervo sem arte; cria post com intent", () => {
    assert.equal(isDemoAgentMode(), env.CHAT_DEMO_AGENT === true);

    const acervo = analyzeChatTurn("quais produtos temos?", [], FY);
    assert.equal(acervo.route, "acervo");
    assert.equal(acervo.wantsImageRoute, false);
    assert.equal(detectImageGenerationIntent("quais produtos temos?"), false);

    const post = analyzeChatTurn("cria um post", [], FY);
    assert.equal(detectImageGenerationIntent("cria um post"), true);
    assert.equal(post.wantsImageRoute, true);
  });

  it("10b) CHAT_DEMO_AGENT true e false: mesmos flags de intent (subprocess)", () => {
    const probe = `
      import { analyzeChatTurn } from ${JSON.stringify(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend/src/services/chatTurnIntent.js"),
      )};
      import { detectImageGenerationIntent } from ${JSON.stringify(
        path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          "../../backend/src/services/imageGenerationIntent.js",
        ),
      )};
      import { isDemoAgentMode } from ${JSON.stringify(
        path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          "../../backend/src/services/demoAgentKnowledge.js",
        ),
      )};
      const fy = { nomeFantasia: "FYT" };
      const acervo = analyzeChatTurn("quais produtos temos?", [], fy);
      const post = analyzeChatTurn("cria um post", [], fy);
      console.log(JSON.stringify({
        demo: isDemoAgentMode(),
        acervoRoute: acervo.route,
        acervoWants: acervo.wantsImageRoute,
        acervoDetect: detectImageGenerationIntent("quais produtos temos?"),
        postWants: post.wantsImageRoute,
        postDetect: detectImageGenerationIntent("cria um post"),
      }));
    `;

    for (const flag of ["true", "false"]) {
      const r = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
        encoding: "utf8",
        env: { ...process.env, CHAT_DEMO_AGENT: flag },
        cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
      });
      assert.equal(r.status, 0, r.stderr || r.stdout);
      const line = (r.stdout || "").trim().split("\n").filter(Boolean).at(-1);
      const data = JSON.parse(line);
      assert.equal(data.demo, flag === "true");
      assert.equal(data.acervoRoute, "acervo");
      assert.equal(data.acervoWants, false);
      assert.equal(data.acervoDetect, false);
      assert.equal(data.postWants, true);
      assert.equal(data.postDetect, true);
    }
  });
});
