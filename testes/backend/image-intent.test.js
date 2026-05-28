import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildConfirmedImageIntent } from "../../backend/src/services/imageIntent.js";
import { buildImagePreviewContextMeta } from "../../backend/src/services/imagePreviewPrompt.js";

const CTX_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CTX_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("imageIntent", () => {
  it("prioriza o contexto selecionado no painel sobre o contexto antigo da proposta", () => {
    const history = [
      {
        role: "user",
        content: "quero uma arte de promoção com a creatina integral em foco e até 30% off",
      },
    ];
    const contextoRows = [
      { id_contexto_empresa: CTX_A, nome: "Black Friday", schema_json: { tipo: "promocao" } },
      { id_contexto_empresa: CTX_B, nome: "Academia", schema_json: { tipo: "campanha" } },
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
      focusContextoId: CTX_B,
    });

    assert.equal(intent.matchedContexto?.id_contexto_empresa, CTX_B);
    assert.equal(intent.matchedContexto?.nome, "Academia");
    assert.match(intent.selectionHint, /Academia/);
    assert.equal(intent.fraseNaImagem, "Até 30% OFF");
  });

  it("expõe frase e contexto prioritário no meta da prévia", () => {
    const history = [{ role: "user", content: "quero promoção com até 30% off" }];
    const contextoRows = [{ id_contexto_empresa: CTX_A, nome: "Black Friday", schema_json: { tipo: "promocao" } }];
    const proposal = {
      intent_summary: "arte promocional",
      frase_na_imagem: "Até 30% OFF",
      matched_contexto: {
        id_contexto_empresa: CTX_A,
        nome: "Black Friday",
        tipo_schema: "promocao",
        reason: "llm",
      },
    };

    const meta = buildImagePreviewContextMeta(
      "empresa-1",
      { nome_fantasia: "Tuma" },
      contextoRows,
      proposal,
      history,
      CTX_A,
    );

    assert.equal(meta.frase_na_imagem, "Até 30% OFF");
    assert.equal(meta.contexto_prioritario, "Black Friday");
    assert.match(meta.pedido_resumo || "", /promo/i);
  });

  it("normaliza hero_product para usar a referência confirmada do proposal", () => {
    const history = [{ role: "user", content: "deixe a creatina integral como foco principal" }];
    const proposal = {
      intent_summary: "arte promocional de creatina",
      midias_referenced: [
        {
          id_midia: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          nome_exibicao: "creatina integral",
        },
        {
          id_midia: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          nome_exibicao: "creatina growth",
        },
      ],
      hero_product: {
        id_midia: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        nome_exibicao: "creatina integral",
        reason: "pedido_destacou_item",
      },
    };

    const intent = buildConfirmedImageIntent({
      history,
      postContextProposal: proposal,
      contextoRows: [],
    });

    assert.equal(intent.heroProduct?.id_midia, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    assert.equal(intent.heroProduct?.nome_exibicao, "creatina integral");
    assert.match(intent.selectionHint, /hero: creatina integral/i);
  });

  it("ignora PNG de creatina no proposal quando o pedido atual é monster", () => {
    const history = [
      { role: "user", content: "post da creatina integral" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "quero promoção dos monster de 15 para 9 reais" },
    ];
    const midiaRows = [
      {
        id_midia: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        nome_exibicao: "Monster Energy 473ml",
        nome_arquivo: "monster.png",
      },
      {
        id_midia: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        nome_exibicao: "creatina integral",
        nome_arquivo: "creatina.png",
      },
    ];
    const proposal = {
      midias_referenced: [
        { id_midia: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", nome_exibicao: "creatina integral" },
        { id_midia: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", nome_exibicao: "Monster Energy 473ml" },
      ],
      hero_product: {
        id_midia: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        nome_exibicao: "creatina integral",
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
