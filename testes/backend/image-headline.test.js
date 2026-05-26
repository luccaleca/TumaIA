import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveFraseNaImagemFromHistory,
  extractFraseFromUserText,
  resolveFraseNaImagem,
} from "../../backend/src/services/imageHeadline.js";

describe("imageHeadline — frase na imagem", () => {
  it("não puxa 500k do nome do contexto se o pedido recente é promo", () => {
    const history = [
      { role: "user", content: "quero comemorar 500 mil seguidores no insta" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "agora quero arte black friday do whey até 40% off" },
    ];
    const proposal = { frase_na_imagem: "Parabéns pelos 500k!" };
    const contextoRows = [{ nome: "Marco 500k seguidores", dados_json: { tipo: "data_comemorativa" } }];
    const frase = resolveFraseNaImagem(proposal, history, contextoRows);
    assert.ok(frase);
    assert.match(frase, /40%|Black Friday|Promo/i);
    assert.doesNotMatch(frase, /500\s*k/i);
  });

  it("usa 500k só quando o pedido recente menciona seguidores", () => {
    const history = [{ role: "user", content: "post para 500k seguidores no instagram" }];
    const frase = deriveFraseNaImagemFromHistory(history, []);
    assert.equal(frase, "Parabéns pelos 500k!");
  });

  it("extrai frase após dois-pontos", () => {
    const frase = extractFraseFromUserText(
      "Post quadrado para Instagram, fundo na cor da marca, frase: TumaIA entende seu negócio",
    );
    assert.equal(frase, "TumaIA entende seu negócio");
  });

  it("sugere frase curta quando o pedido fala em porcentagem de desconto", () => {
    const history = [
      {
        role: "user",
        content:
          "quero uma foto das 3 creatinas growth max e integral, com a integral em foco e promoção de 30% de desconto bem em evidência",
      },
    ];
    const frase = deriveFraseNaImagemFromHistory(history, []);
    assert.equal(frase, "Até 30% OFF");
  });

  it("ignora linha automática de confirmação do painel", () => {
    const history = [
      { role: "user", content: "arte promo whey" },
      { role: "user", content: "Confirmar e gerar prévia da imagem." },
    ];
    const frase = deriveFraseNaImagemFromHistory(history, []);
    assert.ok(frase);
    assert.match(frase, /Promo/i);
  });
});
