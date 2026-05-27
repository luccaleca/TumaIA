import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyProductMediaGate,
  extractProductMentions,
  scoreRowProductMention,
  narrowImageRowsByProductMention,
  reconcileProposalMidias,
} from "../../backend/src/services/productMentionMatch.js";
import { buildResumoVisual, deriveFraseNaImagemFromHistory } from "../../backend/src/services/imageHeadline.js";
import { pickBestProductMidiaId } from "../../backend/src/services/referenceMidiaRanking.js";

const PEDIDO_MONSTER =
  "quero fazer um post de promoção dos monster que temos , de 15 reais para 9, faça bem chamativo , so para as academias";

const ROWS = [
  {
    id_midia: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    nome_exibicao: "pro force morango",
    nome_arquivo: "pro-force-morango.png",
    tipo_midia: "imagem",
    extensao: ".png",
  },
  {
    id_midia: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    nome_exibicao: "Monster Energy 473ml",
    nome_arquivo: "monster-energy-lata.png",
    tipo_midia: "imagem",
    extensao: ".png",
  },
  {
    id_midia: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    nome_exibicao: "creatina integral",
    nome_arquivo: "creatina-integral.png",
    tipo_midia: "imagem",
    extensao: ".png",
  },
];

describe("productMentionMatch", () => {
  it("extrai monster do pedido e ignora palavras de promoção", () => {
    const mentions = extractProductMentions(PEDIDO_MONSTER);
    assert.ok(mentions.includes("monster"));
    assert.equal(mentions.includes("morango"), false);
    assert.equal(mentions.includes("academias"), false);
  });

  it("pontua monster na mídia certa e não na pro force morango", () => {
    const mentions = extractProductMentions(PEDIDO_MONSTER);
    const proForce = scoreRowProductMention(ROWS[0], mentions);
    const monster = scoreRowProductMention(ROWS[1], mentions);
    assert.ok(monster > proForce);
    assert.equal(proForce, 0);
  });

  it("pickBestProductMidiaId escolhe monster quando pedido", () => {
    const id = pickBestProductMidiaId(ROWS, PEDIDO_MONSTER);
    assert.equal(id, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("reconcileProposalMidias remove pro force escolhido pelo modelo", () => {
    const proposal = reconcileProposalMidias(
      {
        midias_referenced: [
          {
            id_midia: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            nome_exibicao: "pro force morango",
            why: "errado",
          },
        ],
      },
      ROWS,
      PEDIDO_MONSTER,
    );
    assert.equal(proposal.midias_referenced.length, 1);
    assert.equal(proposal.midias_referenced[0].id_midia, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("sem produto no acervo não força item aleatório", () => {
    const { pool, strict } = narrowImageRowsByProductMention(
      [ROWS[0], ROWS[2]],
      PEDIDO_MONSTER,
    );
    assert.equal(strict, true);
    assert.equal(pool.length, 0);
    assert.equal(pickBestProductMidiaId([ROWS[0], ROWS[2]], PEDIDO_MONSTER), null);
  });

  it("applyProductMediaGate avisa quando produto pedido não está no acervo", () => {
    const gate = applyProductMediaGate(
      {
        intent_summary: PEDIDO_MONSTER,
        midias_referenced: [{ id_midia: ROWS[0].id_midia, nome_exibicao: "pro force morango" }],
      },
      [ROWS[0]],
      PEDIDO_MONSTER,
      [{ role: "user", content: PEDIDO_MONSTER }],
    );
    assert.equal(gate.blocked, true);
    assert.match(gate.confirmation_message, /Mídias/i);
    assert.equal(gate.proposal.midias_referenced.length, 0);
    assert.ok(gate.proposal.products_requested?.some((p) => /monster/i.test(p)));
  });

  it("não deriva só Promoção como frase da imagem", () => {
    const frase = deriveFraseNaImagemFromHistory(
      [{ role: "user", content: PEDIDO_MONSTER }],
      [],
    );
    assert.notEqual(frase, "Promoção");
    const resumo = buildResumoVisual({ intent_summary: PEDIDO_MONSTER }, [], PEDIDO_MONSTER);
    assert.match(resumo, /monster/i);
  });
});
