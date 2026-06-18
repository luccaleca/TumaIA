import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPostCaptionPrompt } from "../../backend/src/services/postCaptionService.js";

describe("postCaptionService — prompt", () => {
  it("inclui preços obrigatórios e pede legenda + hashtags", () => {
    const prompt = buildPostCaptionPrompt({
      history: [
        {
          role: "user",
          content: "promo creatina dia dos namorados, 1 por 99,99 e 2 por 149,99",
        },
        { role: "user", content: "pode criar usando todas as creatinas" },
      ],
      proposal: {
        intent_summary: "promo creatina dia dos namorados",
        midias_referenced: [{ nome_exibicao: "creatina growth" }],
      },
      nomeFantasia: "Loja Demo",
      limiteHashtags: 10,
    });
    assert.match(prompt, /99,99/);
    assert.match(prompt, /149,99/);
    assert.match(prompt, /"legenda"/);
    assert.match(prompt, /"hashtags"/);
    assert.match(prompt, /creatina growth/);
  });
});
