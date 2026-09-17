/**
 * Contratos arquiteturais de produto/mídia + regressões dos 5 failures do estresse.
 * Sem hardcode de marca/categoria — só estrutura do fluxo.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyProductMediaGate,
  buildCreationProductCandidate,
  isReliableProductMediaCandidate,
  resolveProductFromAcervo,
  toProductCandidate,
} from "../../backend/src/services/productAcervoResolve.js";
import {
  emptyCreationState,
  isCreationFlowMetaUtterance,
  looksLikeProductCandidate,
  mergeCreationState,
  parseCreationTurn,
} from "../../backend/src/services/chatCreationInterpret.js";
import {
  EMPRESA_ALIMENTOS,
  EMPRESA_COSMETICOS,
  EMPRESA_ELETRONICOS,
  EMPRESA_ROUPAS,
  toTenantMidias,
} from "./fixtures/acervo-varejo-multiempresa.fixture.js";

function idsOf(matches) {
  return (matches || []).map((r) => String(r.id_midia ?? r.id ?? "")).sort();
}

describe("contrato — sem matched por inferência frouxa", () => {
  it("isReliableProductMediaCandidate rejeita demonstrativo e atributo solto", () => {
    const midias = toTenantMidias(EMPRESA_ROUPAS.midias);
    assert.equal(
      isReliableProductMediaCandidate(
        { nome: "disso", atributos: [], referencia_descritiva: null, confianca: "named" },
        midias,
      ),
      false,
    );
    assert.equal(
      isReliableProductMediaCandidate(
        { nome: null, atributos: ["preta"], referencia_descritiva: null, confianca: "descriptive" },
        midias,
      ),
      false,
    );
    assert.equal(
      isReliableProductMediaCandidate(
        toProductCandidate({ produto: "camiseta preta" }, { acervoRows: midias }),
        midias,
      ),
      true,
    );
  });

  it("criativo sem produto → not_requested (nunca matched)", () => {
    const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
    for (const msg of [
      "faz uma divulgação bonita",
      "quero uma campanha premium",
      "faz uma arte de verão",
      "faz uma arte disso",
    ]) {
      const candidate = buildCreationProductCandidate({
        message: msg,
        midiaRows: midias,
        entities: {},
      });
      const resolved = resolveProductFromAcervo(candidate, midias);
      assert.notEqual(
        resolved.status,
        "matched",
        `${msg} não pode matchar mídia (status=${resolved.status})`,
      );
      assert.equal(resolved.matches.length, 0);
    }
  });

  it("gate com mensagem criativa não anexa midias_referenced", () => {
    const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
    const msg = "faz uma divulgação bonita";
    const gate = applyProductMediaGate({}, midias, msg, [{ role: "user", content: msg }]);
    assert.notEqual(gate.proposal.product_media_status, "matched");
    assert.equal((gate.proposal.midias_referenced || []).length, 0);
  });
});

describe("contrato — follow-up herda state.produto", () => {
  it("preço/estilo sozinhos preservam mídia do produto do estado", () => {
    const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
    const history = [
      { role: "user", content: "quero" },
      { role: "user", content: "uma arte" },
      { role: "user", content: "desse fone bluetooth" },
      { role: "user", content: "com preço" },
      { role: "user", content: "59,90" },
    ];
    const msg = "mais premium";
    const candidate = buildCreationProductCandidate({
      message: msg,
      midiaRows: midias,
      entities: { produto: null, estilo: ["premium"] },
      stateProduto: "fone bluetooth",
    });
    const resolved = resolveProductFromAcervo(candidate, midias);
    assert.equal(resolved.status, "matched");
    assert.deepEqual(idsOf(resolved.matches), ["fone-bluetooth"]);

    const gate = applyProductMediaGate({}, midias, msg, [...history, { role: "user", content: msg }]);
    // deriveCreationStateFromHistory deve ter acumulado fone; gate não pode inventar outro.
    if (gate.proposal.product_media_status === "matched") {
      assert.deepEqual(
        (gate.proposal.midias_referenced || []).map((m) => m.id_midia),
        ["fone-bluetooth"],
      );
    }
  });

  it("pedido com notebook no estado não resolve outro eletrônico por inferência", () => {
    const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
    const msg = "coloca o notebook 14 no escritório e faz uma divulgação dele";
    const candidate = buildCreationProductCandidate({
      message: msg,
      midiaRows: midias,
      entities: { produto: "notebook 14", cenario: "escritorio" },
      stateProduto: "notebook 14",
    });
    const resolved = resolveProductFromAcervo(candidate, midias);
    assert.equal(resolved.status, "matched");
    assert.deepEqual(idsOf(resolved.matches), ["notebook-14"]);
  });
});

describe("contrato — meta de fluxo não vira produto", () => {
  it("isCreationFlowMetaUtterance reconhece fechamento sem mercadoria", () => {
    assert.equal(isCreationFlowMetaUtterance("ok pode montar o resumo"), true);
    assert.equal(isCreationFlowMetaUtterance("beleza, confirma"), true);
    assert.equal(isCreationFlowMetaUtterance("faz post do cafe torrado"), false);
    assert.equal(looksLikeProductCandidate("ok resumo"), false);
    assert.equal(looksLikeProductCandidate("disso"), false);
  });

  it("merge preserva produto após «ok pode montar o resumo»", () => {
    let state = emptyCreationState();
    state = mergeCreationState(state, parseCreationTurn("o café torrado"), "o café torrado");
    state = mergeCreationState(state, parseCreationTurn("preço 24,90"), "preço 24,90");
    assert.match(String(state.produto), /cafe|café/i);

    state = mergeCreationState(
      state,
      parseCreationTurn("ok pode montar o resumo"),
      "ok pode montar o resumo",
    );
    assert.match(String(state.produto), /cafe|café/i);
    assert.ok(!/ok|resumo/i.test(String(state.produto)));
  });
});

describe("regressão — 5 failures do estresse conversacional", () => {
  it("R1 mensagens quebradas acumulam fone bluetooth", () => {
    const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
    const steps = ["quero", "uma arte", "desse fone bluetooth", "com preço", "59,90", "mais premium"];
    let state = emptyCreationState();
    const history = [];
    for (const msg of steps) {
      const turn = parseCreationTurn(msg);
      state = mergeCreationState(state, turn, msg);
      history.push({ role: "user", content: msg });
    }
    assert.match(String(state.produto), /fone|bluetooth/i);

    const candidate = buildCreationProductCandidate({
      message: "mais premium",
      midiaRows: midias,
      entities: { produto: state.produto, estilo: ["premium"] },
      stateProduto: state.produto,
    });
    const resolved = resolveProductFromAcervo(candidate, midias);
    assert.equal(resolved.status, "matched");
    assert.deepEqual(idsOf(resolved.matches), ["fone-bluetooth"]);
  });

  it("R2 notebook no escritório → notebook-14 (não celular)", () => {
    const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
    const msg = "coloca o notebook 14 no escritório e faz uma divulgação dele";
    const resolved = resolveProductFromAcervo(
      buildCreationProductCandidate({
        message: msg,
        midiaRows: midias,
        entities: { produto: "notebook 14" },
      }),
      midias,
    );
    assert.equal(resolved.status, "matched");
    assert.deepEqual(idsOf(resolved.matches), ["notebook-14"]);
  });

  it("R3 divulgação bonita sem produto → não matched", () => {
    const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
    const msg = "faz uma divulgação bonita";
    const resolved = resolveProductFromAcervo(
      buildCreationProductCandidate({ message: msg, midiaRows: midias, entities: {} }),
      midias,
    );
    assert.notEqual(resolved.status, "matched");
    assert.equal(resolved.matches.length, 0);
  });

  it("R4 conversa natural: fechamento não apaga café torrado", () => {
    const midias = toTenantMidias(EMPRESA_ALIMENTOS.midias);
    const steps = [
      "quero divulgar um produto",
      "o café torrado",
      "clima de inverno",
      "preço 24,90",
      "mais aconchegante",
      "fundo de cozinha",
      "ok pode montar o resumo",
    ];
    let state = emptyCreationState();
    for (const msg of steps) {
      state = mergeCreationState(state, parseCreationTurn(msg), msg);
    }
    assert.match(String(state.produto), /cafe|café/i);
    const resolved = resolveProductFromAcervo(
      buildCreationProductCandidate({
        message: "ok pode montar o resumo",
        midiaRows: midias,
        entities: {},
        stateProduto: state.produto,
      }),
      midias,
    );
    assert.equal(resolved.status, "matched");
    assert.deepEqual(idsOf(resolved.matches), ["cafe-torrado"]);
  });

  it("R5 «faz uma arte disso» não resolve mídia arbitrária", () => {
    const midias = toTenantMidias(EMPRESA_ROUPAS.midias);
    const msg = "faz uma arte disso";
    const resolved = resolveProductFromAcervo(
      buildCreationProductCandidate({
        message: msg,
        midiaRows: midias,
        entities: { produto: "disso" },
      }),
      midias,
    );
    assert.notEqual(resolved.status, "matched");
    assert.equal(resolved.matches.length, 0);

    const gate = applyProductMediaGate({}, midias, msg, [{ role: "user", content: msg }], {
      entities: { produto: "disso" },
    });
    assert.notEqual(gate.proposal.product_media_status, "matched");
    assert.equal((gate.proposal.midias_referenced || []).length, 0);
  });
});

describe("contrato — menção explícita ainda resolve", () => {
  it("label completo na mensagem continua matched", () => {
    const midias = toTenantMidias(EMPRESA_COSMETICOS.midias);
    const msg = "faz uma arte do perfume floral 100ml";
    const resolved = resolveProductFromAcervo(
      buildCreationProductCandidate({ message: msg, midiaRows: midias, entities: {} }),
      midias,
    );
    assert.equal(resolved.status, "matched");
    assert.deepEqual(idsOf(resolved.matches), ["perfume-100ml"]);
  });

  it("entities alucinadas fora da mensagem nao vencem o label da mensagem", () => {
    const midias = toTenantMidias(EMPRESA_ELETRONICOS.midias);
    const msg = "desse fone bluetooth";
    const resolved = resolveProductFromAcervo(
      buildCreationProductCandidate({
        message: msg,
        midiaRows: midias,
        entities: { produto: "celular azul" },
      }),
      midias,
    );
    assert.equal(resolved.status, "matched");
    assert.deepEqual(idsOf(resolved.matches), ["fone-bluetooth"]);
  });

  it("entities parciais «camiseta» não vencem label completo «camiseta preta» na mensagem", () => {
    const midias = toTenantMidias(EMPRESA_ROUPAS.midias);
    const msg = "faz uma arte da camiseta preta";
    const resolved = resolveProductFromAcervo(
      buildCreationProductCandidate({
        message: msg,
        midiaRows: midias,
        entities: { produto: "camiseta" },
      }),
      midias,
    );
    assert.equal(resolved.status, "matched");
    assert.deepEqual(idsOf(resolved.matches), ["camiseta-preta"]);
  });
});
