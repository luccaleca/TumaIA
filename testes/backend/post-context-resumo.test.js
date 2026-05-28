import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildResumoVisual, looksLikeRawUserCopy } from "../../backend/src/services/imageHeadline.js";
import { resolvePostSupplementLinks } from "../../backend/src/services/postContextProposalService.js";
import { applyProductMediaGate } from "../../backend/src/services/productMentionMatch.js";

const PEDIDO =
  "quero um post de promoção dos monster de 15 por 9, bem chamativo, só para academias";

const MONSTER_ROW = {
  id_midia: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  nome_exibicao: "Monster Energy 473ml",
  nome_arquivo: "monster-energy-lata.png",
  tipo_midia: "imagem",
};

describe("post-context resumo e links", () => {
  it("detecta resumo visual colado no pedido literal", () => {
    assert.equal(looksLikeRawUserCopy(PEDIDO, PEDIDO), true);
    assert.equal(
      looksLikeRawUserCopy(
        "Post promocional para feed do Instagram. Público-alvo: academias. PNG do acervo: Monster.",
        PEDIDO,
      ),
      false,
    );
  });

  it("buildResumoVisual lista PNG e preço sem repetir o chat", () => {
    const proposal = {
      intent_summary: PEDIDO,
      midias_referenced: [{ id_midia: MONSTER_ROW.id_midia, nome_exibicao: "Monster Energy 473ml" }],
      hero_product: { nome_exibicao: "Monster Energy 473ml" },
    };
    const resumo = buildResumoVisual(proposal, [{ role: "user", content: PEDIDO }], PEDIDO);
    assert.ok(resumo);
    assert.doesNotMatch(resumo, /quero um post de promoção/i);
    assert.match(resumo, /Monster Energy/i);
    assert.match(resumo, /academia/i);
    assert.match(resumo, /15.*9|R\$\s*15/i);
  });

  it("resolvePostSupplementLinks inclui mídias mesmo com links vazios do modelo", () => {
    const proposal = {
      midias_referenced: [
        { id_midia: MONSTER_ROW.id_midia, nome_exibicao: "Monster Energy 473ml" },
      ],
    };
    const links = resolvePostSupplementLinks([], proposal, [], [MONSTER_ROW]);
    assert.equal(links.length, 1);
    assert.equal(links[0].kind, "midia");
    assert.equal(links[0].id, MONSTER_ROW.id_midia);
    assert.match(links[0].label, /Monster/i);
  });

  it("produto ausente no acervo bloqueia e zera midias_referenced", () => {
    const gate = applyProductMediaGate(
      {
        intent_summary: PEDIDO,
        midias_referenced: [
          {
            id_midia: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            nome_exibicao: "pro force morango",
          },
        ],
      },
      [
        {
          id_midia: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          nome_exibicao: "pro force morango",
          nome_arquivo: "pro-force.png",
          tipo_midia: "imagem",
        },
      ],
      PEDIDO,
    );
    assert.equal(gate.blocked, true);
    assert.equal(gate.proposal.product_media_status, "missing");
    assert.equal(gate.proposal.midias_referenced.length, 0);
    const resumo = buildResumoVisual(gate.proposal, [{ role: "user", content: PEDIDO }], PEDIDO);
    assert.match(resumo, /monster/i);
    assert.match(resumo, /Mídias|acervo/i);
  });
});
