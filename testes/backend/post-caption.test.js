import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPostCaptionPrompt, separarHashtagsDaLegenda } from "../../backend/src/services/postCaptionService.js";

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

describe("postCaptionService — hashtags duplicadas", () => {
  const TAGS = ["#PizzariaFornoMineiro", "#PizzaDeCalabresa", "#Promocao"];

  it("tira do texto o bloco final de hashtags que também veio na lista", () => {
    const legenda =
      "Terça-feira de pizza, sim! Compre agora por R$79! #PizzariaFornoMineiro #PizzaDeCalabresa #Promocao";
    const out = separarHashtagsDaLegenda(legenda, TAGS);
    assert.equal(out.legenda, "Terça-feira de pizza, sim! Compre agora por R$79!");
    assert.deepEqual(out.hashtags, TAGS);
  });

  it("junta hashtags do texto quando a lista veio vazia, sem repetir", () => {
    const out = separarHashtagsDaLegenda("Oferta de terça #Pizza #pizza #Promo", []);
    assert.equal(out.legenda, "Oferta de terça");
    assert.deepEqual(out.hashtags, ["#Pizza", "#Promo"]);
  });

  it("não mexe em legenda sem hashtag no fim e normaliza a lista", () => {
    const out = separarHashtagsDaLegenda("Texto simples.", ["pizza", "##promo", " "]);
    assert.equal(out.legenda, "Texto simples.");
    assert.deepEqual(out.hashtags, ["#pizza", "#promo"]);
  });

  it("hashtag no meio do texto é preservada e o limite é respeitado", () => {
    const out = separarHashtagsDaLegenda("Venha de #pizza hoje!", ["#a", "#b", "#c"], 2);
    assert.equal(out.legenda, "Venha de #pizza hoje!");
    assert.deepEqual(out.hashtags, ["#a", "#b"]);
  });
});
