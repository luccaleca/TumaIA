import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCreationProductCandidate,
  resolveProductFromAcervo,
} from "../../backend/src/services/productAcervoResolve.js";

const ACERVO = [
  { id_midia: "1", tipo: "imagem", nome_exibicao: "pizza de atum", nome_arquivo: "pizza de atum.jpg" },
  {
    id_midia: "2",
    tipo: "imagem",
    nome_exibicao: "pizza de atum com mussarela",
    nome_arquivo: "pizza de atum com mussarela.jpg",
  },
  { id_midia: "3", tipo: "imagem", nome_exibicao: "pizza de queijo", nome_arquivo: "pizza de queijo.png" },
];

function resolver(message, produto) {
  const candidato = buildCreationProductCandidate({ entities: { produto }, message, midiaRows: ACERVO });
  return resolveProductFromAcervo(candidato, ACERVO);
}

describe("produto cujo nome está dentro do nome de outro", () => {
  it("pedir «pizza de atum» pega a pizza de atum, sem perguntar qual das duas", () => {
    const r = resolver("Faz um post da pizza de atum: grande por R$ 54,90 até domingo.", "pizza de atum");
    assert.equal(r.status, "matched");
    assert.deepEqual(
      r.matches.map((m) => m.nome_exibicao),
      ["pizza de atum"],
    );
  });

  it("pedir o nome completo da maior continua pegando a maior", () => {
    const r = resolver("Faz um post da pizza de atum com mussarela por R$ 59,90", "pizza de atum com mussarela");
    assert.equal(r.status, "matched");
    assert.equal(r.matches[0].nome_exibicao, "pizza de atum com mussarela");
  });

  it("um termo só do meio («atum») continua ambíguo, porque não é o nome de nenhuma", () => {
    const r = resolver("Faz um post de atum", "atum");
    assert.equal(r.status, "ambiguous");
  });

  it("produto sem parecido segue normal", () => {
    const r = resolver("Faz um post da pizza de queijo", "pizza de queijo");
    assert.equal(r.status, "matched");
    assert.equal(r.matches[0].nome_exibicao, "pizza de queijo");
  });
});
