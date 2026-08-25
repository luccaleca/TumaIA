import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildConfirmedImageIntent } from "../../backend/src/services/imageIntent.js";
import { buildImagePreviewContextMeta } from "../../backend/src/services/imagePreviewPrompt.js";

const CTX_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("imageIntent", () => {
  it("não usa matched_contexto (modelos de post removidos)", () => {
    const history = [
      {
        role: "user",
        content: "quero uma arte de promoção com a creatina integral em foco e até 30% off",
      },
    ];
    const contextoRows = [
      { id_contexto_empresa: CTX_A, nome: "Black Friday", schema_json: { tipo: "promocao" } },
    ];
    const proposal = {
      intent_summary: "arte promocional de creatina",
      frase_na_imagem: "Até 30% OFF",
      matched_contexto: {
        id_contexto_empresa: CTX_A,
        nome: "Black Friday",
        tipo_schema: "promocao",
        reason: "llm",
      },
    };

    const intent = buildConfirmedImageIntent({
      history,
      postContextProposal: proposal,
      contextoRows,
      focusContextoId: CTX_A,
    });

    assert.equal(intent.matchedContexto, null);
    assert.equal(intent.fraseNaImagem, "Até 30% OFF");
  });

  it("expõe frase no meta da prévia sem contexto de campanha", () => {
    const history = [{ role: "user", content: "quero promoção com até 30% off" }];
    const proposal = {
      intent_summary: "arte promocional",
      frase_na_imagem: "Até 30% OFF",
    };

    const meta = buildImagePreviewContextMeta(
      "empresa-test",
      { nome_fantasia: "FYT" },
      [],
      proposal,
      history,
    );

    assert.equal(meta.contexto_prioritario, null);
    assert.equal(meta.frase_na_imagem, "Até 30% OFF");
  });

  it("prioriza hero_product e poda midias_referenced pelo pedido", () => {
    const history = [
      {
        role: "user",
        content: "post do naked wafer dark chocolate na mesa de casa",
      },
    ];
    const midiaRows = [
      {
        id_midia: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        nome_exibicao: "naked wafer dark chocolate",
      },
      {
        id_midia: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        nome_exibicao: "creatina integral",
      },
    ];
    const proposal = {
      intent_summary: "post do naked wafer dark chocolate na mesa de casa",
      midias_referenced: [
        {
          id_midia: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          nome_exibicao: "naked wafer dark chocolate",
        },
        {
          id_midia: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          nome_exibicao: "creatina integral",
        },
      ],
      hero_product: {
        id_midia: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        nome_exibicao: "naked wafer dark chocolate",
      },
    };

    const intent = buildConfirmedImageIntent({
      history,
      postContextProposal: proposal,
      contextoRows: [],
      midiaRows,
    });

    assert.equal(intent.heroProduct?.id_midia, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    assert.equal(intent.postContextProposal.midias_referenced.length, 1);
    assert.doesNotMatch(intent.pedido, /creatina integral/i);
  });
});
