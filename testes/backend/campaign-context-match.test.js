import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reconcileMatchedContextoFromPedido } from "../../backend/src/services/postContextProposalService.js";
import { inferPreferredPlaybookSlug } from "../../backend/src/services/cadastroMeaningful.js";

const PEDIDO_MONSTER =
  "quero um post de promocao do produto monster, 12,99 por 8,99 , queima de estoque";

describe("campaign context match", () => {
  it("inferPreferredPlaybookSlug prioriza promoção com preço e queima de estoque", () => {
    assert.equal(inferPreferredPlaybookSlug(PEDIDO_MONSTER), "promocao");
  });

  it("reconcileMatchedContextoFromPedido não preenche matched_contexto (modelos removidos)", () => {
    const proposal = {
      intent_summary: PEDIDO_MONSTER,
      matched_contexto: {
        id_contexto_empresa: "00000000-0000-4000-8000-000000000001",
        nome: "Lançamento",
        tipo_schema: "lancamento",
        reason: "llama_errado",
      },
    };

    const out = reconcileMatchedContextoFromPedido(proposal, [], PEDIDO_MONSTER);
    assert.equal(out.matched_contexto, null);
  });
});
