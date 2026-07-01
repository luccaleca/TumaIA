import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractExplicitSceneFromPedido,
  resolveActivePedidoHint,
  synthesizeResumoVisual,
} from "../../backend/src/services/imageHeadline.js";

const PEDIDO =
  "quero um post com modelo de post de produto do naked wafer dark chocolate e naked wafer cinnamon, a ideia é fazer ele em cima da mesa de uma casa e uma pessoa indo comer";

describe("post briefing — cena e pedido", () => {
  it("extrai cenário da frase «a ideia é…»", () => {
    const scene = extractExplicitSceneFromPedido(PEDIDO);
    assert.match(scene, /mesa/i);
    assert.match(scene, /pessoa/i);
  });

  it("resolveActivePedidoHint ignora «não está correto»", () => {
    const history = [
      { role: "user", content: PEDIDO },
      { role: "assistant", content: "Confira se entendi certo" },
      { role: "user", content: "não está correto" },
    ];
    assert.match(resolveActivePedidoHint(history, { question: "não está correto" }), /naked wafer/i);
  });

  it("resumo visual prioriza cenário do cliente no modelo Produto", () => {
    const resumo = synthesizeResumoVisual(
      {
        matched_contexto: { nome: "Produto" },
        midias_referenced: [
          { nome_exibicao: "naked-wafer-dark-chocolate.png" },
          { nome_exibicao: "naked-wafer-cinnamon.png" },
        ],
        intent_summary: PEDIDO,
      },
      PEDIDO,
    );
    assert.match(resumo, /Arte de produto/i);
    assert.match(resumo, /Cenário pedido pelo cliente/i);
    assert.match(resumo, /mesa/i);
    assert.doesNotMatch(resumo, /lançamento/i);
    assert.doesNotMatch(resumo, /academia/i);
  });
});
