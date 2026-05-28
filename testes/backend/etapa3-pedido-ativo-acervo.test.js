import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildConfirmedImageIntent } from "../../backend/src/services/imageIntent.js";
import { resolveActivePedidoHint } from "../../backend/src/services/imageHeadline.js";
import { collectReferenceMidiaIds } from "../../backend/src/services/referenceMidiaFromProposal.js";
import { rankReferenceMidiaIds } from "../../backend/src/services/referenceMidiaRanking.js";
import {
  applyProductMediaGate,
  filterReferenceMidiaIdsToPedido,
  pruneProposalMidiasToPedido,
  reconcileProposalMidias,
} from "../../backend/src/services/productMentionMatch.js";

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

function historyCreatinaDepoisMonster() {
  return [
    { role: "user", content: "quero um post da creatina integral com até 30% off" },
    { role: "assistant", content: "Entendi, vou montar a proposta." },
    { role: "user", content: PEDIDO_MONSTER },
  ];
}

/** Simula o fluxo da prévia: IDs da proposta → filtro por pedido → ranking. */
function simulatePreviewReferenceIds(proposal, midiaRows, pedidoHint) {
  const fromProposal = collectReferenceMidiaIds(proposal, []);
  let refIds = filterReferenceMidiaIdsToPedido(fromProposal, midiaRows, pedidoHint);
  refIds = rankReferenceMidiaIds(refIds, midiaRows, pedidoHint);
  return refIds;
}

describe("etapa 3 — pedido ativo e acervo", () => {
  it("resolveActivePedidoHint ignora intent_summary antigo da proposta", () => {
    const hint = resolveActivePedidoHint(historyCreatinaDepoisMonster(), {
      proposal: { intent_summary: "arte promocional de creatina integral com desconto" },
    });
    assert.match(hint, /monster/i);
    assert.doesNotMatch(hint, /creatina integral/i);
  });

  it("hint poluído (histórico inteiro) favoreceria creatina; pedido ativo escolhe monster", () => {
    const pollutedHint = historyCreatinaDepoisMonster()
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" ")
      .slice(-600);
    const activeHint = resolveActivePedidoHint(historyCreatinaDepoisMonster());

    const idsPolluted = rankReferenceMidiaIds(
      ROWS.map((r) => r.id_midia),
      ROWS,
      pollutedHint,
    );
    const idsActive = rankReferenceMidiaIds(ROWS.map((r) => r.id_midia), ROWS, activeHint);

    assert.equal(idsActive[0], ROWS[1].id_midia);
    assert.notEqual(idsPolluted[0], idsActive[0], "histórico misturado não deve definir o ranking");
  });

  it("applyProductMediaGate com histórico antigo mantém só monster no acervo", () => {
    const gate = applyProductMediaGate(
      {
        intent_summary: "arte de creatina integral",
        midias_referenced: [
          { id_midia: ROWS[2].id_midia, nome_exibicao: "creatina integral" },
          { id_midia: ROWS[1].id_midia, nome_exibicao: "Monster Energy 473ml" },
        ],
        hero_product: { id_midia: ROWS[2].id_midia, nome_exibicao: "creatina integral" },
      },
      ROWS,
      resolveActivePedidoHint(historyCreatinaDepoisMonster(), {
        proposal: { intent_summary: "arte de creatina integral" },
      }),
      historyCreatinaDepoisMonster(),
    );

    assert.equal(gate.blocked, false);
    assert.equal(gate.proposal.product_media_status, "matched");
    assert.equal(gate.proposal.midias_referenced.length, 1);
    assert.equal(gate.proposal.midias_referenced[0].id_midia, ROWS[1].id_midia);
    assert.equal(gate.proposal.hero_product?.id_midia, ROWS[1].id_midia);
  });

  it("reconcile + prune remove pro force e creatina quando pedido é monster", () => {
    const pedido = resolveActivePedidoHint(historyCreatinaDepoisMonster());
    let proposal = reconcileProposalMidias(
      {
        midias_referenced: [
          { id_midia: ROWS[0].id_midia, nome_exibicao: "pro force morango" },
          { id_midia: ROWS[2].id_midia, nome_exibicao: "creatina integral" },
        ],
      },
      ROWS,
      pedido,
    );
    proposal = pruneProposalMidiasToPedido(proposal, ROWS, pedido);

    assert.equal(proposal.midias_referenced.length, 1);
    assert.equal(proposal.midias_referenced[0].id_midia, ROWS[1].id_midia);
  });

  it("simulação da prévia: refs da proposta viram só monster", () => {
    const pedido = resolveActivePedidoHint(historyCreatinaDepoisMonster());
    const proposal = pruneProposalMidiasToPedido(
      {
        hero_product: { id_midia: ROWS[2].id_midia, nome_exibicao: "creatina integral" },
        midias_referenced: [
          { id_midia: ROWS[2].id_midia, nome_exibicao: "creatina integral" },
          { id_midia: ROWS[1].id_midia, nome_exibicao: "Monster Energy 473ml" },
        ],
      },
      ROWS,
      pedido,
    );

    const refIds = simulatePreviewReferenceIds(proposal, ROWS, pedido);
    assert.deepEqual(refIds, [ROWS[1].id_midia]);
  });

  it("buildConfirmedImageIntent alinha hero e midias ao pedido atual", () => {
    const intent = buildConfirmedImageIntent({
      history: historyCreatinaDepoisMonster(),
      postContextProposal: {
        intent_summary: "creatina integral em promoção",
        midias_referenced: [
          { id_midia: ROWS[2].id_midia, nome_exibicao: "creatina integral" },
          { id_midia: ROWS[1].id_midia, nome_exibicao: "Monster Energy 473ml" },
        ],
        hero_product: { id_midia: ROWS[2].id_midia, nome_exibicao: "creatina integral" },
      },
      contextoRows: [],
      midiaRows: ROWS,
    });

    assert.match(intent.pedido, /monster/i);
    assert.equal(intent.heroProduct?.id_midia, ROWS[1].id_midia);
    assert.equal(intent.postContextProposal.midias_referenced.length, 1);
    assert.doesNotMatch(intent.selectionHint, /creatina integral/i);
  });

  it("sem monster no acervo bloqueia mesmo com creatina cadastrada", () => {
    const semMonster = ROWS.filter((r) => r.id_midia !== ROWS[1].id_midia);
    const gate = applyProductMediaGate(
      { midias_referenced: [{ id_midia: ROWS[2].id_midia, nome_exibicao: "creatina integral" }] },
      semMonster,
      PEDIDO_MONSTER,
      historyCreatinaDepoisMonster(),
    );
    assert.equal(gate.blocked, true);
    assert.equal(gate.proposal.midias_referenced.length, 0);
  });
});
