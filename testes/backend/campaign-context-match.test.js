import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPlaybookContextoRow } from "../../backend/src/services/postModelosService.js";
import { reconcileMatchedContextoFromPedido } from "../../backend/src/services/postContextProposalService.js";
import { inferPreferredPlaybookSlug } from "../../backend/src/services/cadastroMeaningful.js";

const PEDIDO_MONSTER =
  "quero um post de promocao do produto monster, 12,99 por 8,99 , queima de estoque";

function modeloRow(slug, idSuffix) {
  return buildPlaybookContextoRow({
    id_empresa_modelo_post: `00000000-0000-4000-8000-0000000000${idSuffix}`,
    playbook_slug: slug,
    ativo: true,
  });
}

describe("campaign context match", () => {
  it("inferPreferredPlaybookSlug prioriza promoção com preço e queima de estoque", () => {
    assert.equal(inferPreferredPlaybookSlug(PEDIDO_MONSTER), "promocao");
  });

  it("reconcileMatchedContextoFromPedido escolhe Promoção mesmo com Lançamento primeiro na lista", () => {
    const lancamento = modeloRow("lancamento", "01");
    const promocao = modeloRow("promocao", "02");
    const contextoRows = [lancamento, promocao];

    const proposal = {
      intent_summary: PEDIDO_MONSTER,
      matched_contexto: {
        id_contexto_empresa: lancamento.id_contexto_empresa,
        nome: "Lançamento",
        tipo_schema: "lancamento",
        reason: "llama_errado",
      },
    };

    const out = reconcileMatchedContextoFromPedido(proposal, contextoRows, PEDIDO_MONSTER);
    assert.equal(out.matched_contexto?.id_contexto_empresa, promocao.id_contexto_empresa);
    assert.equal(out.matched_contexto?.nome, "Promoção");
    assert.match(String(out.matched_contexto?.reason), /pedido_promocao/);
  });

  it("não troca lançamento quando o pedido é explícito em novidade", () => {
    const lancamento = modeloRow("lancamento", "03");
    const promocao = modeloRow("promocao", "04");
    const pedido = "arte de lancamento do novo sabor de whey";
    const proposal = {
      intent_summary: pedido,
      matched_contexto: {
        id_contexto_empresa: lancamento.id_contexto_empresa,
        nome: "Lançamento",
        tipo_schema: "lancamento",
      },
    };
    const out = reconcileMatchedContextoFromPedido(proposal, [lancamento, promocao], pedido);
    assert.equal(out.matched_contexto?.id_contexto_empresa, lancamento.id_contexto_empresa);
  });
});
