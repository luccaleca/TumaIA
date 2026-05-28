import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildComposeSceneResumo,
  synthesizeComposeSceneResumo,
} from "../../backend/src/services/imageHeadline.js";
import {
  buildComposeBackgroundDirectives,
  buildFluxImagePrompt,
  buildRawImagePrompt,
} from "../../backend/src/services/imagePreviewPrompt.js";

const PEDIDO_MONSTER =
  "quero fazer um post de promoção dos monster que temos , de 15 reais para 9, faça bem chamativo , so para as academias";

const PROPOSAL_MONSTER = {
  intent_summary: PEDIDO_MONSTER,
  midias_referenced: [{ id_midia: "m1", nome_exibicao: "Monster Energy 473ml" }],
  hero_product: { id_midia: "m1", nome_exibicao: "Monster Energy 473ml" },
  resumo_visual:
    "Post promocional. PNG do acervo na composição: Monster Energy 473ml. Produto em destaque no centro: Monster Energy 473ml.",
};

describe("etapa 4 — fundo para colagem (composeProductAssets)", () => {
  it("buildComposeBackgroundDirectives proíbe placeholder e define zonas", () => {
    const d = buildComposeBackgroundDirectives({
      productCount: 2,
      heroProductName: "Monster Energy 473ml",
    });
    assert.match(d, /MODO FUNDO PARA COLAGEM/i);
    assert.match(d, /PROIBIDO/i);
    assert.match(d, /retângulo branco|placeholder|mockup/i);
    assert.match(d, /dois vãos/i);
    assert.match(d, /Monster Energy/i);
    assert.match(d, /superfície.*contínua/i);
  });

  it("synthesizeComposeSceneResumo não pede desenhar embalagem", () => {
    const resumo = synthesizeComposeSceneResumo(PROPOSAL_MONSTER, PEDIDO_MONSTER);
    assert.match(resumo, /colagem posterior|Reservar espaço vazio/i);
    assert.match(resumo, /Não desenhar embalagens|Não desenhar/i);
    assert.doesNotMatch(resumo, /PNG do acervo na composição/i);
    assert.match(resumo, /proibido retângulo branco|silhueta de pote/i);
    assert.match(resumo, /R\$\s*15.*9|de R\$ 15 por R\$ 9/i);
  });

  it("buildRawImagePrompt em modo compose usa diretrizes fortes e resumo de cenário", () => {
    const p = buildRawImagePrompt(
      [{ role: "user", content: PEDIDO_MONSTER }],
      PROPOSAL_MONSTER,
      { estilo_visual: "energético, premium" },
      {
        composeProductAssets: true,
        productCount: 1,
        imageIntent: {
          pedido: PEDIDO_MONSTER,
          heroProduct: { nome_exibicao: "Monster Energy 473ml" },
          fraseNaImagem: "",
          postContextProposal: PROPOSAL_MONSTER,
        },
      },
    );
    assert.match(p, /MODO FUNDO PARA COLAGEM/i);
    assert.match(p, /PROIBIDO.*mockup|jar vazio|retângulo branco/i);
    assert.match(p, /somente fundo — produtos reais entram depois/i);
    assert.match(p, /colagem posterior/i);
    assert.doesNotMatch(p, /PNG do acervo na composição/i);
    assert.match(p, /Reforce: nenhum objeto de produto/i);
  });

  it("buildFluxImagePrompt raw repassa composeProductAssets", () => {
    const p = buildFluxImagePrompt({
      history: [{ role: "user", content: PEDIDO_MONSTER }],
      contextoRows: [],
      postContextProposal: PROPOSAL_MONSTER,
      composeProductAssets: true,
      productCount: 3,
      pipeline: "raw",
    });
    assert.match(p, /três vãos no terço inferior/i);
    assert.match(p, /inserção posterior|colagem posterior|colados depois/i);
  });

  it("modo compose difere do modo com referência estrita de produto", () => {
    const compose = buildRawImagePrompt(
      [{ role: "user", content: PEDIDO_MONSTER }],
      PROPOSAL_MONSTER,
      null,
      { composeProductAssets: true, productCount: 1 },
    );
    const strict = buildRawImagePrompt(
      [{ role: "user", content: PEDIDO_MONSTER }],
      PROPOSAL_MONSTER,
      null,
      { strictProductReference: true },
    );
    assert.match(compose, /MODO FUNDO PARA COLAGEM/i);
    assert.match(strict, /preservar RIGOROSAMENTE o design real/i);
    assert.doesNotMatch(compose, /preservar RIGOROSAMENTE/i);
  });

  it("buildComposeSceneResumo ignora resumo_visual antigo que pedia PNG desenhado", () => {
    const resumo = buildComposeSceneResumo(PROPOSAL_MONSTER, [{ role: "user", content: PEDIDO_MONSTER }]);
    assert.doesNotMatch(resumo, /PNG do acervo na composição/i);
    assert.match(resumo, /colagem/i);
  });
});
