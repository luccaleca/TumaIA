import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectImageGenerationIntent,
  detectImageGenerationIntentFromHistory,
  isConversationalMessage,
  isMetaOrHypotheticalQuestion,
  hasExplicitCreateRequest,
} from "../../backend/src/services/imageGenerationIntent.js";

describe("imageGenerationIntent / interpretação", () => {
  it("detecta pedido explícito de imagem", () => {
    assert.equal(
      detectImageGenerationIntent("Quero um post quadrado no Instagram sobre planos TumaIA"),
      true,
    );
    assert.equal(detectImageGenerationIntent("gera uma arte com creatina"), true);
    assert.equal(detectImageGenerationIntent("me ajuda a montar um post pro insta"), true);
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
});
