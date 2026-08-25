import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectImageGenerationIntent,
  detectImageGenerationIntentFromHistory,
  isConversationalMessage,
  isMetaOrHypotheticalQuestion,
  hasExplicitCreateRequest,
  isImageRevisionRequest,
} from "../../backend/src/services/imageGenerationIntent.js";

describe("imageGenerationIntent / interpretação", () => {
  it("detecta pedido explícito de imagem", () => {
    assert.equal(
      detectImageGenerationIntent("Quero um post quadrado no Instagram sobre planos TumaIA"),
      true,
    );
    assert.equal(detectImageGenerationIntent("gera uma arte com creatina"), true);
    assert.equal(detectImageGenerationIntent("me ajuda a montar um post pro insta"), true);
    assert.equal(
      detectImageGenerationIntent(
        "eu gostaria de uma postagem no modelo de produto com o whey de cookie, pode fazer uma pessoa usando ele na academia",
      ),
      true,
    );
  });

  it("ignora cumprimento e pergunta sobre o bot", () => {
    assert.equal(detectImageGenerationIntent("oi"), false);
    assert.equal(isConversationalMessage("quem é vc"), true);
    assert.equal(detectImageGenerationIntent("quem é vc"), false);
    assert.equal(detectImageGenerationIntent("o que você faz"), false);
  });

  it("não confunde dúvida hipotética com pedido só por citar postagem", () => {
    const hipotetica = "se eu fazer um pedido de uma postagem vc me ajuda?";
    assert.equal(isMetaOrHypotheticalQuestion(hipotetica), true);
    assert.equal(hasExplicitCreateRequest(hipotetica), false);
    assert.equal(detectImageGenerationIntent(hipotetica), false);
    assert.equal(detectImageGenerationIntent("dá pra fazer um post?"), false);
    assert.equal(detectImageGenerationIntent("posso pedir uma arte?"), false);
    assert.equal(detectImageGenerationIntent("como faço um post no instagram?"), false);
    assert.equal(detectImageGenerationIntent("pode fazer um post?"), false);
  });

  it("não roteia por resposta genérica do assistente nem por pedido antigo no histórico", () => {
    const history = [
      { role: "user", content: "gera uma arte com creatina max" },
      {
        role: "assistant",
        content: "Posso ajudar com artes e posts para Instagram quando você quiser.",
      },
    ];
    assert.equal(detectImageGenerationIntentFromHistory(history, "quem é vc"), false);
    assert.equal(
      detectImageGenerationIntent(
        "Posso ajudar com artes e posts para Instagram quando você quiser.",
      ),
      false,
    );
  });

  it("detecta confirmação curta após assistente oferecer montar arte", () => {
    const history = [
      { role: "user", content: "me ajuda com marketing" },
      {
        role: "assistant",
        content: "Posso montar uma arte para o Instagram com seus planos.",
      },
    ];
    assert.equal(detectImageGenerationIntentFromHistory(history, "sim, gera"), true);
  });

  it("detecta pedido após listagem de modelos de post", () => {
    const history = [
      { role: "user", content: "quais modelos de post temos?" },
      {
        role: "assistant",
        content:
          "Temos 3 modelos de post ativos:\n\n• Produto\n\nUse no chat qual tipo combina — eu monto a arte com o layout desse modelo.",
      },
    ];
    const pedido =
      "postagem no modelo de produto com whey de cookie, pessoa na academia usando o produto";
    assert.equal(detectImageGenerationIntentFromHistory(history, pedido), true);
  });

  it("pedido de alterar prévia não abre fluxo de briefing", () => {
    const q = "Quero alterar a imagem: incluir preço 1 por 99,99";
    assert.equal(isImageRevisionRequest(q), true);
    assert.equal(detectImageGenerationIntent(q), false);
  });

  it("atalhos digitados pós-prévia não abrem fluxo de briefing", () => {
    assert.equal(detectImageGenerationIntent("Gerar legenda"), false);
    assert.equal(detectImageGenerationIntent("Publicar no Instagram"), false);
    assert.equal(detectImageGenerationIntent("Quero alterar a legenda: mais curta"), false);
  });

  it("correção após resumo de confirmação reabre briefing", () => {
    const history = [
      {
        role: "user",
        content:
          "quero um post com modelo de post de produto do naked wafer dark chocolate, ideia é mesa de casa e pessoa comendo",
      },
      {
        role: "assistant",
        content:
          "*Confira se entendi certo:*\n📋 *Modelo de post:* Lançamento\n\nEstá certo? Digite *gerar imagem*",
      },
    ];
    assert.equal(detectImageGenerationIntentFromHistory(history, "não está correto"), true);
  });
});
