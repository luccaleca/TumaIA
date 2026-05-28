import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyProductMediaGate,
  extractProductMentions,
  filterReferenceMidiaIdsToPedido,
  parseProductMentionSpec,
  pruneProposalMidiasToPedido,
  scoreRowProductMention,
  narrowImageRowsByProductMention,
  reconcileProposalMidias,
} from "../../backend/src/services/productMentionMatch.js";
import {
  buildResumoVisual,
  deriveFraseNaImagemFromHistory,
  resolveActivePedidoHint,
} from "../../backend/src/services/imageHeadline.js";
import { pickBestProductMidiaId } from "../../backend/src/services/referenceMidiaRanking.js";
import { ACERVO_SUPLEMENTOS } from "./fixtures/acervo-suplementos.fixture.js";

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
  {
    id_midia: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    nome_exibicao: "creatina growth",
    nome_arquivo: "creatina-growth.png",
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

  it("resolveActivePedidoHint usa só a última mensagem do cliente", () => {
    const history = [
      { role: "user", content: "quero post da creatina integral em promoção" },
      { role: "assistant", content: "ok" },
      { role: "user", content: PEDIDO_MONSTER },
    ];
    const hint = resolveActivePedidoHint(history);
    assert.match(hint, /monster/i);
    assert.doesNotMatch(hint, /creatina integral/i);
  });

  it("pedido com creatina integral específica não inclui creatina growth", () => {
    const pedido =
      "quero promoção da creatina integral com 30% off, foco na creatina integral para academias";
    const spec = parseProductMentionSpec(pedido);
    assert.equal(spec.mode, "specific");
    assert.ok(spec.specificPhrases.some((p) => /creatina integral/.test(p)));
    const { pool, mode } = narrowImageRowsByProductMention(ROWS, pedido);
    assert.equal(mode, "specific");
    assert.equal(pool.length, 1);
    assert.equal(pool[0].id_midia, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  });

  it("pedido genérico de creatina pode trazer todas as creatinas do acervo", () => {
    const pedido = "quero um post promocional de creatina bem chamativo";
    const spec = parseProductMentionSpec(pedido);
    assert.equal(spec.mode, "generic");
    const { pool, mode } = narrowImageRowsByProductMention(ROWS, pedido);
    assert.equal(mode, "generic");
    assert.ok(pool.length >= 2);
    assert.ok(pool.some((r) => /integral/i.test(String(r.nome_exibicao))));
    assert.ok(pool.some((r) => /growth/i.test(String(r.nome_exibicao))));
  });

  it("pedido citando creatinas integral e growth traz só as duas", () => {
    const pedido = "arte com as creatinas integral e growth em promoção";
    const { pool } = narrowImageRowsByProductMention(ROWS, pedido);
    assert.equal(pool.length, 2);
    const ids = pool.map((r) => r.id_midia);
    assert.ok(ids.includes("cccccccc-cccc-4ccc-8ccc-cccccccccccc"));
    assert.ok(ids.includes("dddddddd-dddd-4ddd-8ddd-dddddddddddd"));
    assert.equal(ids.includes("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), false);
  });

  it("resolveActivePedidoHint ignora intent_summary antigo quando há mensagem nova", () => {
    const history = [
      { role: "user", content: "post creatina" },
      { role: "user", content: PEDIDO_MONSTER },
    ];
    const hint = resolveActivePedidoHint(history, {
      proposal: { intent_summary: "promoção creatina integral" },
    });
    assert.match(hint, /monster/i);
    assert.doesNotMatch(hint, /creatina integral/i);
  });

  it("pruneProposalMidiasToPedido remove creatina quando pedido é monster", () => {
    const pruned = pruneProposalMidiasToPedido(
      {
        midias_referenced: [
          { id_midia: ROWS[2].id_midia, nome_exibicao: "creatina integral" },
          { id_midia: ROWS[1].id_midia, nome_exibicao: "Monster Energy 473ml" },
        ],
        hero_product: { id_midia: ROWS[2].id_midia, nome_exibicao: "creatina integral" },
      },
      ROWS,
      PEDIDO_MONSTER,
    );
    assert.equal(pruned.midias_referenced.length, 1);
    assert.equal(pruned.midias_referenced[0].id_midia, ROWS[1].id_midia);
    assert.equal(pruned.hero_product?.id_midia, ROWS[1].id_midia);
  });

  it("filterReferenceMidiaIdsToPedido descarta id de produto errado", () => {
    const filtered = filterReferenceMidiaIdsToPedido(
      [ROWS[2].id_midia, ROWS[1].id_midia],
      ROWS,
      PEDIDO_MONSTER,
    );
    assert.deepEqual(filtered, [ROWS[1].id_midia]);
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

describe("productMentionMatch — especificidade estrita", () => {
  it("pro force morango não puxa outros sabores da linha", () => {
    const { pool } = narrowImageRowsByProductMention(ACERVO_SUPLEMENTOS, "pro force morango");
    assert.equal(pool.length, 1);
    assert.equal(pool[0].id, "pf-morango");
  });

  it("naked wafer dark chocolate não puxa outras barras", () => {
    const { pool } = narrowImageRowsByProductMention(
      ACERVO_SUPLEMENTOS,
      "promo naked wafer dark chocolate",
    );
    assert.equal(pool.length, 1);
    assert.equal(pool[0].id, "barra-dark");
  });

  it("tudo de cookie com barrinha naked não expande linha inteira de barras", () => {
    const { pool } = narrowImageRowsByProductMention(
      ACERVO_SUPLEMENTOS,
      "quero post de tudo de cookie, entao whey e pro force e barrinha de proteina naked",
    );
    const ids = pool.map((r) => r.id).sort();
    assert.deepEqual(ids, ["pf-cookies", "whey-cookies"]);
  });

  it("todos os pro force ainda retorna a linha completa", () => {
    const { pool } = narrowImageRowsByProductMention(
      ACERVO_SUPLEMENTOS,
      "quero post de todos os pro force",
    );
    assert.equal(pool.length, 5);
  });
});
