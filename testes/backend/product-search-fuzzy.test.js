import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyProductMediaGate,
  checkProductMediaAvailability,
  compactProductKey,
  narrowImageRowsByProductMention,
  parseProductMentionSpec,
  scorePhraseAgainstBlob,
  scoreRowSpecificPhrase,
} from "../../backend/src/services/productMentionMatch.js";
import { pickBestProductMidiaId } from "../../backend/src/services/referenceMidiaRanking.js";

const PRO_FORCE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const ROWS = [
  {
    id_midia: PRO_FORCE_ID,
    nome_exibicao: "pro force morango",
    nome_arquivo: "pro-force-morango.png",
    tipo_midia: "imagem",
    extensao: ".png",
  },
  {
    id_midia: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    nome_exibicao: "Monster Energy 473ml",
    nome_arquivo: "monster-energy.png",
    tipo_midia: "imagem",
    extensao: ".png",
  },
];

const ROW_FILENAME_ONLY = {
  id_midia: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  nome_exibicao: "Morango 900g",
  nome_arquivo: "proforce-morango-refil.png",
  tipo_midia: "imagem",
  extensao: ".png",
};

const PEDIDOS_PRO_FORCE = [
  "quero um post da pro force bem chamativo",
  "promocao pro force morango",
  "proforce no feed",
  "pro-force em destaque",
  "pro  force", // espaço duplo
  "arte com PRO FORCE",
  "quero a pro force de morango",
];

describe("productSearchFuzzy — pro force", () => {
  for (const pedido of PEDIDOS_PRO_FORCE) {
    it(`encontra pro force no acervo: «${pedido.slice(0, 48)}…»`, () => {
      const spec = parseProductMentionSpec(pedido);
      assert.equal(spec.mode, "specific", `modo para: ${pedido}`);
      assert.ok(
        spec.terms.some((t) => t.includes("pro force")),
        `termos: ${spec.terms.join(", ")}`,
      );
      const { pool, mode } = narrowImageRowsByProductMention(ROWS, pedido);
      assert.equal(mode, "specific");
      assert.equal(pool.length, 1, `pool vazio para: ${pedido}`);
      assert.equal(pool[0].id_midia, PRO_FORCE_ID);
    });
  }

  it("compactProductKey iguala pro-force, pro force e proforce", () => {
    assert.equal(compactProductKey("pro-force"), compactProductKey("pro force"));
    assert.equal(compactProductKey("proforce"), compactProductKey("pro force"));
  });

  it("scorePhraseAgainstBlob acha pro force só no nome_arquivo tokenizado", () => {
    const blob = `${ROWS[0].nome_exibicao} ${ROWS[0].nome_arquivo}`;
    assert.ok(scorePhraseAgainstBlob(blob, "pro force") >= 35);
    assert.ok(scorePhraseAgainstBlob(blob, "proforce") >= 35);
    assert.ok(scorePhraseAgainstBlob(blob, "pro-force") >= 35);
  });

  it("nome genérico + arquivo proforce ainda encontra", () => {
    const { pool } = narrowImageRowsByProductMention([ROW_FILENAME_ONLY], "post da proforce");
    assert.equal(pool.length, 1);
    assert.equal(pool[0].id_midia, ROW_FILENAME_ONLY.id_midia);
  });

  it("gate não bloqueia quando pro force está no acervo", () => {
    const gate = applyProductMediaGate(
      { intent_summary: "post pro force" },
      ROWS,
      "quero arte da pro force",
      [{ role: "user", content: "quero arte da pro force" }],
    );
    assert.equal(gate.blocked, false);
    assert.equal(gate.proposal.product_media_status, "matched");
    assert.equal(gate.proposal.midias_referenced.length, 1);
  });

  it("checkProductMediaAvailability confirma match", () => {
    const check = checkProductMediaAvailability("pro force", ROWS);
    assert.equal(check.missing, false);
    assert.equal(check.matchedRows.length, 1);
  });

  it("pickBestProductMidiaId escolhe pro force e não monster", () => {
    const id = pickBestProductMidiaId(ROWS, "pro force promo");
    assert.equal(id, PRO_FORCE_ID);
  });

  it("typo leve (1 letra) em token longo ainda pontua", () => {
    const row = { nome_exibicao: "proforce morango", nome_arquivo: "x.png", tipo_midia: "imagem" };
    const score = scoreRowSpecificPhrase(row, "proforca");
    assert.ok(score >= 35, `score typo=${score}`);
  });
});
