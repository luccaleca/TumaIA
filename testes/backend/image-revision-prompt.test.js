import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildImageRevisionPrompt } from "../../backend/src/services/imagePreviewPrompt.js";

describe("buildImageRevisionPrompt", () => {
  it("prioriza alteração pedida e preços do histórico", () => {
    const prompt = buildImageRevisionPrompt({
      instructions: "incluir preço 1 por 99,99 e 2 por 149,99",
      history: [
        {
          role: "user",
          content: "post creatina dia dos namorados 1 por 99,99 e 2 por 149,99",
        },
      ],
      proposal: {},
      imageIntent: { fraseNaImagem: "Dia dos Namorados" },
    });
    assert.match(prompt, /Alterações solicitadas: incluir preço/i);
    assert.match(prompt, /99,99/);
    assert.match(prompt, /Mantenha composição/i);
    assert.match(prompt, /Dia dos Namorados/);
  });
});
