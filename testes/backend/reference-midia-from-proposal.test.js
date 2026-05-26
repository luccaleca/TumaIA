import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectReferenceMidiaIds } from "../../backend/src/services/referenceMidiaFromProposal.js";

describe("referenceMidiaFromProposal", () => {
  it("prioriza hero_product antes das demais referências", () => {
    const ids = collectReferenceMidiaIds(
      {
        hero_product: {
          id_midia: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          nome_exibicao: "creatina integral",
          reason: "pedido_destacou_item",
        },
        midias_referenced: [
          { id_midia: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", nome_exibicao: "creatina growth" },
          { id_midia: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", nome_exibicao: "creatina integral" },
        ],
      },
      [],
    );

    assert.deepEqual(ids, [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ]);
  });
});
