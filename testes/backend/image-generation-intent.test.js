import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectImageGenerationIntent,
  detectImageGenerationIntentFromHistory,
} from "../../backend/src/services/imageGenerationIntent.js";

describe("imageGenerationIntent", () => {
  it("detecta pedido explícito de imagem", () => {
    assert.equal(
      detectImageGenerationIntent("Quero um post quadrado no Instagram sobre planos TumaIA"),
      true,
    );
  });

  it("ignora mensagem curta sem tema visual", () => {
    assert.equal(detectImageGenerationIntent("oi"), false);
  });

  it("detecta confirmação curta após assistente falar de arte", () => {
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
