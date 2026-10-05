import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isMetaOrHypotheticalQuestion,
  hasExplicitCreateRequest,
  mentionsVisualTopic,
  detectImageGenerationIntent,
} from "../../backend/src/services/tumaInterpretation.js";

describe("tumaInterpretation", () => {
  it("cita postagem sem pedido de execução", () => {
    const q = "se eu fazer um pedido de uma postagem vc me ajuda?";
    assert.equal(mentionsVisualTopic(q), true);
    assert.equal(isMetaOrHypotheticalQuestion(q), true);
    assert.equal(hasExplicitCreateRequest(q), false);
    assert.equal(detectImageGenerationIntent(q), false);
  });

  it("pedido com verbo imperativo", () => {
    assert.equal(hasExplicitCreateRequest("quero fazer um post hoje"), true);
    assert.equal(hasExplicitCreateRequest("bora montar uma arte"), true);
  });

  it("não abre fluxo por menção a Instagram/campanha sem pedido de arte", () => {
    assert.equal(detectImageGenerationIntent("hoje tem campanha no instagram"), false);
    assert.equal(detectImageGenerationIntent("esse banner ficou bom"), false);
    assert.equal(detectImageGenerationIntent("preciso de ajuda com o feed"), false);
  });

  it("dúvida de capacidade continua conversa", () => {
    assert.equal(isMetaOrHypotheticalQuestion("você faz posts?"), true);
    assert.equal(detectImageGenerationIntent("você faz posts?"), false);
    assert.equal(detectImageGenerationIntent("pode fazer um post?"), false);
    assert.equal(detectImageGenerationIntent("o tuma gera imagens?"), false);
  });

  it("não abre fluxo por menção a comando (casos que não listamos um a um)", () => {
    const naoPedido = [
      "vi em um video que o usuario pediu gere uma imagem de uma girafa, como que a ia faz isso",
      "no tiktok o cara mandou gerar uma arte de pizza, explica o pipeline",
      "alguém disse 'gere uma imagem de um gato' — por que o modelo obedece?",
      "li um artigo sobre gerar imagem, como funciona na prática",
    ];
    for (const q of naoPedido) {
      assert.equal(detectImageGenerationIntent(q), false, q);
    }
  });

  it("o mesmo comando isolado, como pedido do usuário, abre fluxo", () => {
    assert.equal(detectImageGenerationIntent("gere uma imagem de uma girafa"), true);
    assert.equal(detectImageGenerationIntent("quero um post do whey"), true);
  });
});

describe("tumaInterpretation — imperativo «faz/faça»", () => {
  it("«faz um post…» com oferta abre o fluxo de arte", () => {
    assert.equal(
      detectImageGenerationIntent(
        "Faz um post da pizza de calabresa para a promoção de terça: 2 pizzas grandes por R$ 79",
      ),
      true,
    );
    assert.equal(detectImageGenerationIntent("Faça um post da promoção de terça"), true);
  });

  it("perguntas e hipóteses com «faz» continuam sendo conversa", () => {
    assert.equal(detectImageGenerationIntent("como faz um post?"), false);
    assert.equal(detectImageGenerationIntent("dá pra fazer um post?"), false);
    assert.equal(detectImageGenerationIntent("o que você faz?"), false);
    assert.equal(detectImageGenerationIntent("Se eu pedir um post de Dia dos Pais, como ficaria?"), false);
  });
});
