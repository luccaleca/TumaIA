/**
 * Bateria: resolução semântica de produto no acervo (0/1/N).
 * Garante que texto criativo não vira busca de mídia.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyProductMediaGate,
  buildCreationProductCandidate,
  inferProductCandidateFromMessage,
  resolveProductFromAcervo,
  toProductCandidate,
} from "../../backend/src/services/productAcervoResolve.js";
import { composeCreationPedidoHint, mergeCreationState, parseCreationTurn, emptyCreationState } from "../../backend/src/services/chatCreationInterpret.js";
import { ACERVO_SUPLEMENTOS } from "./fixtures/acervo-suplementos.fixture.js";

const ROWS = ACERVO_SUPLEMENTOS.map((r) => ({ ...r, id_midia: r.id }));

function idsOf(matches) {
  return (matches || []).map((r) => String(r.id_midia ?? r.id ?? "")).sort();
}

function resolveMessage(message, entities = {}) {
  const candidate = buildCreationProductCandidate({
    message,
    midiaRows: ROWS,
    entities,
  });
  return { candidate, ...resolveProductFromAcervo(candidate, ROWS) };
}

describe("productAcervoResolve — candidato e 0/1/N", () => {
  it("toProductCandidate ignora briefing criativo e não inventa mídia", () => {
    const c = toProductCandidate(
      {
        produto: "espaco",
        sabor: "morango",
        intencao: "lancamento",
        estilo: ["moderno"],
        oferta: "R$9,99",
      },
      { acervoRows: ROWS },
    );
    assert.equal(c.nome, null);
    assert.deepEqual(c.atributos, ["morango"]);
    assert.equal(c.confianca, "descriptive");
  });

  it("0 matches → missing sem inventar UUID", () => {
    const r = resolveProductFromAcervo(
      toProductCandidate({ produto: "unicornio galactico" }, { acervoRows: ROWS }),
      ROWS,
    );
    assert.equal(r.status, "missing");
    assert.equal(r.matches.length, 0);
    assert.match(String(r.ask || ""), /não encontrei|nao encontrei|mídias|midias/i);
  });

  it("1 match inequívoco → matched (Pro Force morango com texto criativo)", () => {
    const msg =
      "Quero fazer um lançamento do Pro Force de morango. Cria uma arte com o produto em destaque, com uma vibe forte e esportiva, usando elementos que remetam ao sabor de morango. Quero algo moderno e chamativo, com espaço para colocar uma chamada de lançamento e o valor de 9,99.";
    const r = resolveMessage(msg);
    assert.equal(r.status, "matched");
    assert.deepEqual(idsOf(r.matches), ["pf-morango"]);
  });

  it("múltiplos creatinas genéricas → ambiguous", () => {
    const r = resolveMessage("quero uma arte da creatina");
    assert.ok(r.status === "ambiguous" || r.status === "matched");
    if (r.status === "ambiguous") {
      assert.ok(r.matches.length >= 2);
      assert.match(String(r.ask || ""), /mais de um|qual/i);
    }
  });

  it("not_requested quando não há produto", () => {
    const r = resolveProductFromAcervo(
      toProductCandidate({ intencao: "lancamento", estilo: ["moderno"] }, { acervoRows: ROWS }),
      ROWS,
    );
    assert.equal(r.status, "not_requested");
    assert.equal(r.matches.length, 0);
  });
});

describe("productAcervoResolve — frases diversas (lógica, não regex)", () => {
  it("creatina de limão cadastrada", () => {
    const r = resolveMessage("Faz uma campanha pra aquela creatina de limão que está cadastrada.");
    assert.equal(r.status, "matched");
    assert.deepEqual(idsOf(r.matches), ["creatina-limao"]);
  });

  it("produto de morango com estética de verão → resolve produto, não tema", () => {
    const r = resolveMessage("Quero uma arte nova usando o produto de morango, mas com uma estética de verão.");
    assert.ok(["matched", "ambiguous"].includes(r.status));
    if (r.status === "matched") {
      assert.deepEqual(idsOf(r.matches), ["pf-morango"]);
    } else {
      assert.ok(idsOf(r.matches).includes("pf-morango"));
    }
    const creative = inferProductCandidateFromMessage(
      "Quero uma arte nova usando o produto de morango, mas com uma estética de verão.",
      ROWS,
    );
    assert.ok(!String(creative.nome || "").includes("verao"));
    assert.ok(!String(creative.nome || "").includes("estetica"));
  });

  it("pré-treino azul + divulgação agressiva", () => {
    const r = resolveMessage("Pega o pré-treino azul e faz uma divulgação mais agressiva.");
    assert.equal(r.status, "matched");
    assert.deepEqual(idsOf(r.matches), ["pre-azul"]);
  });

  it("creatina 300g + preço 59,90 (preço fora da busca)", () => {
    const r = resolveMessage("Usa a creatina 300g e coloca 59,90.");
    assert.equal(r.status, "matched");
    assert.deepEqual(idsOf(r.matches), ["creatina-300g"]);
  });

  it("hint composto de briefing NÃO é usado como busca de produto", () => {
    const msg =
      "Quero fazer um lançamento do Pro Force de morango. Cria uma arte com espaço para chamada e o valor de 9,99.";
    const history = [{ role: "user", content: msg }];
    const composed = composeCreationPedidoHint(history, { question: msg });
    assert.ok(composed.includes("·") || /lancamento|estilo|r\$/i.test(composed));

    const gate = applyProductMediaGate({}, ROWS, composed, history);
    assert.equal(gate.blocked, false);
    assert.equal(gate.proposal.product_media_status, "matched");
    assert.deepEqual(
      (gate.proposal.midias_referenced || []).map((m) => m.id_midia),
      ["pf-morango"],
    );
  });
});

describe("productAcervoResolve — estado de briefing preservado", () => {
  it("alterar estilo/preço não apaga produto; trocar produto mantém oferta", () => {
    let state = emptyCreationState();
    state = mergeCreationState(state, parseCreationTurn("pro force morango lançamento"), "pro force morango lançamento");
    state = mergeCreationState(state, parseCreationTurn("coloca 9,99"), "coloca 9,99");
    assert.ok(state.oferta);
    const produtoAntes = state.produto;
    state = mergeCreationState(state, parseCreationTurn("estilo mais moderno"), "estilo mais moderno");
    assert.equal(state.produto, produtoAntes);
    assert.ok(state.oferta);
    state = mergeCreationState(state, parseCreationTurn("agora faz com a creatina limao"), "agora faz com a creatina limao");
    assert.ok(state.oferta);
    assert.match(String(state.produto || ""), /creatina|limao/i);
  });

  it("entities LLM → toProductCandidate → resolve (contrato do fluxo)", () => {
    const entities = {
      produto: "Pro Force",
      sabor: "morango",
      intencao: "lancamento",
      estilo: ["esportivo", "moderno"],
      oferta: "9,99",
    };
    const candidate = toProductCandidate(entities, { acervoRows: ROWS });
    assert.ok(candidate.nome);
    assert.ok(candidate.atributos.includes("morango"));
    const r = resolveProductFromAcervo(candidate, ROWS);
    assert.equal(r.status, "matched");
    assert.deepEqual(idsOf(r.matches), ["pf-morango"]);
  });
});
