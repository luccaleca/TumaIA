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
