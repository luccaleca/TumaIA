/**
 * Generalização do resolvedor de acervo: qualquer varejo, sem regra por categoria.
 * Caminho: mensagem/entities → ProductCandidate → resolveProductFromAcervo (só mídias do tenant).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyProductMediaGate,
  buildCreationProductCandidate,
  resolveProductFromAcervo,
  toProductCandidate,
} from "../../backend/src/services/productAcervoResolve.js";
import {
  EMPRESA_ALIMENTOS,
  EMPRESA_AUTOMOTIVO,
  EMPRESA_CASA,
  EMPRESA_COSMETICOS,
  EMPRESA_ELETRONICOS,
  EMPRESA_PAPELARIA,
  EMPRESA_PET,
  EMPRESA_PRODUTO_NOVO_BASE,
  EMPRESA_ROUPAS,
  EMPRESA_SUPLEMENTOS,
  EMPRESAS_VAREJO,
  INTENCOES_COMPARTILHADAS,
  PRODUTO_C_NOVO,
  toTenantMidias,
} from "./fixtures/acervo-varejo-multiempresa.fixture.js";

function idsOf(matches) {
  return (matches || []).map((r) => String(r.id_midia ?? r.id ?? "")).sort();
}

function resolveOn(empresa, message, entities = {}) {
  const midias = toTenantMidias(empresa.midias);
  const candidate = buildCreationProductCandidate({
    message,
    midiaRows: midias,
    entities,
  });
  const resolved = resolveProductFromAcervo(candidate, midias);
  return { midias, candidate, resolved };
}

describe("acervo varejo — multiempresa / multicategoria", () => {
  it("cada empresa só resolve mídias do próprio acervo", () => {
    const cases = [
      {
        empresa: EMPRESA_SUPLEMENTOS,
        msg: "faz uma campanha do pro force de morango",
        expectId: "pf-morango",
      },
      {
        empresa: EMPRESA_ROUPAS,
        msg: "faz um anúncio dessa camiseta preta",
        expectId: "camiseta-preta",
      },
      {
        empresa: EMPRESA_COSMETICOS,
        msg: "faz uma arte desse perfume floral 100ml",
        expectId: "perfume-100ml",
      },
      {
        empresa: EMPRESA_ELETRONICOS,
        msg: "faz uma propaganda desse fone bluetooth",
        expectId: "fone-bluetooth",
      },
      {
        empresa: EMPRESA_ALIMENTOS,
        msg: "faz um post desse chocolate ao leite em promoção",
        expectId: "chocolate-leite",
      },
      {
        empresa: EMPRESA_PET,
        msg: "faz um post dessa ração cão adulto",
        expectId: "racao-cao-adulto",
      },
      {
        empresa: EMPRESA_CASA,
        msg: "faz uma divulgação desse sofá 3 lugares",
        expectId: "sofa-3-lugares",
      },
      {
        empresa: EMPRESA_AUTOMOTIVO,
        msg: "faz um anúncio desse pneu aro 16",
        expectId: "pneu-aro-16",
      },
      {
        empresa: EMPRESA_PAPELARIA,
        msg: "faz um post desse caderno universitario",
        expectId: "caderno-universitario",
      },
    ];

    for (const c of cases) {
      const { resolved, midias } = resolveOn(c.empresa, c.msg);
      assert.equal(
        resolved.status,
        "matched",
        `${c.empresa.id_empresa}: status=${resolved.status} msg=${c.msg}`,
      );
      assert.deepEqual(idsOf(resolved.matches), [c.expectId]);
      assert.ok(
        midias.some((m) => m.id_midia === c.expectId),
        "match deve existir no tenant",
      );
      // Isolamento: id não pode existir em outra empresa (exceto coincidência improvável).
      for (const outra of EMPRESAS_VAREJO) {
        if (outra.id_empresa === c.empresa.id_empresa) continue;
        const cross = resolveOn(outra, c.msg);
        assert.notEqual(
          cross.resolved.status === "matched" &&
            idsOf(cross.resolved.matches)[0] === c.expectId,
          true,
          `${c.expectId} não pode bater no acervo de ${outra.id_empresa}`,
        );
      }
    }
  });

  it("atributos genéricos (cor, volume, tamanho, modelo) entram no candidato sem regra especial", () => {
    const attrCases = [
      {
        empresa: EMPRESA_ROUPAS,
        entities: { produto: "camiseta", atributos: ["preta"] },
        msg: "quero a camiseta preta",
        expectId: "camiseta-preta",
      },
      {
        empresa: EMPRESA_CASA,
        entities: { produto: "sofa", atributos: ["3 lugares"] },
        msg: "faz com o sofá de 3 lugares",
        expectId: "sofa-3-lugares",
      },
      {
        empresa: EMPRESA_COSMETICOS,
        entities: { produto: "perfume", atributos: ["100ml"] },
        msg: "usa o perfume de 100ml",
        expectId: "perfume-100ml",
      },
      {
        empresa: EMPRESA_ELETRONICOS,
        entities: { produto: "celular", atributos: ["azul"] },
        msg: "pega o celular azul",
        expectId: "celular-azul",
      },
      {
        empresa: EMPRESA_ROUPAS,
        entities: { produto: "tenis", atributos: ["branco", "42"] },
        msg: "faz uma arte daquele tênis branco tamanho 42",
        expectId: "tenis-branco-42",
      },
      {
        empresa: EMPRESA_ALIMENTOS,
        entities: { produto: "cafe", produto_referencia: "cadastrado", atributos: ["torrado"] },
        msg: "usa o café torrado que está cadastrado",
        expectId: "cafe-torrado",
      },
      {
        empresa: EMPRESA_SUPLEMENTOS,
        entities: { produto: "creatina", atributos: ["limao"] },
        msg: "quero a creatina de limão",
        expectId: "creatina-limao",
      },
    ];

    for (const c of attrCases) {
      const { resolved, candidate } = resolveOn(c.empresa, c.msg, c.entities);
      assert.equal(
        resolved.status,
        "matched",
        `${c.empresa.categoria_exemplo}: ${c.msg} → ${resolved.status}`,
      );
      assert.deepEqual(idsOf(resolved.matches), [c.expectId]);
      assert.ok(
        candidate.nome || candidate.atributos.length || candidate.referencia_descritiva,
        "candidato não vazio",
      );
    }
  });

  it("briefing criativo não vira produto em nenhuma categoria", () => {
    for (const empresa of EMPRESAS_VAREJO) {
      const msg = "quero uma arte com espaço para chamada e clima de lançamento";
      const { resolved, candidate } = resolveOn(empresa, msg);
      assert.ok(
        resolved.status === "not_requested" ||
          (resolved.status === "missing" && !candidate.nome),
        `${empresa.id_empresa}: criativo não deve matchar (status=${resolved.status})`,
      );
      assert.equal(idsOf(resolved.matches).length, 0);
    }
  });

  it("produto inexistente → missing em qualquer tenant (não inventa mídia)", () => {
    for (const empresa of EMPRESAS_VAREJO) {
      const msg = "quero uma arte do Produto X de chocolate";
      const { resolved } = resolveOn(empresa, msg, { produto: "Produto X de chocolate" });
      assert.equal(resolved.status, "missing", empresa.id_empresa);
      assert.equal(resolved.matches.length, 0);
    }
  });

  it("ambiguidade usa nomes reais do acervo daquela empresa", () => {
    const { resolved } = resolveOn(EMPRESA_COSMETICOS, "faz uma arte do perfume floral", {
      produto: "perfume floral",
    });
    assert.equal(resolved.status, "ambiguous");
    assert.ok(resolved.matches.length >= 2);
    const labels = resolved.matches.map((m) => String(m.nome_exibicao || "")).join(" ");
    assert.match(labels, /perfume/i);
    assert.match(String(resolved.ask || ""), /mais de um|qual/i);
  });

  it("intenções compartilhadas sem produto explícito não inventam mídia de outra categoria", () => {
    for (const empresa of EMPRESAS_VAREJO) {
      const midias = toTenantMidias(empresa.midias);
      for (const intent of INTENCOES_COMPARTILHADAS) {
        const gate = applyProductMediaGate({}, midias, intent, [
          { role: "user", content: intent },
        ]);
        // Sem produto no histórico: não deve anexar mídia inventada.
        if (gate.proposal.product_media_status === "matched") {
          for (const ref of gate.proposal.midias_referenced || []) {
            assert.ok(
              midias.some((m) => m.id_midia === ref.id_midia),
              "só mídia do tenant",
            );
          }
        }
      }
    }
  });

  it("produto acabou de ser cadastrado → resolve sem regra nova de categoria", () => {
    const base = toTenantMidias(EMPRESA_PRODUTO_NOVO_BASE.midias);
    const before = resolveProductFromAcervo(
      buildCreationProductCandidate({
        message: "divulga o diffuser ultrasonic mist",
        midiaRows: base,
        entities: { produto: "diffuser ultrasonic mist" },
      }),
      base,
    );
    assert.equal(before.status, "missing");

    const afterRows = toTenantMidias([...EMPRESA_PRODUTO_NOVO_BASE.midias, PRODUTO_C_NOVO]);
    const after = resolveProductFromAcervo(
      buildCreationProductCandidate({
        message: "divulga o diffuser ultrasonic mist",
        midiaRows: afterRows,
        entities: { produto: "diffuser ultrasonic mist" },
      }),
      afterRows,
    );
    assert.equal(after.status, "matched");
    assert.deepEqual(idsOf(after.matches), ["produto-c-diffuser"]);

    const ref = resolveProductFromAcervo(
      buildCreationProductCandidate({
        message: "quero uma arte daquele produto que acabei de cadastrar, o diffuser",
        midiaRows: afterRows,
        entities: {
          produto: "diffuser",
          produto_referencia: "acabou de cadastrar",
        },
      }),
      afterRows,
    );
    assert.equal(ref.status, "matched");
    assert.deepEqual(idsOf(ref.matches), ["produto-c-diffuser"]);
  });

  it("mesmo pedido genérico em empresas diferentes não cruza acervos", () => {
    const msg = "faz uma arte mais premium desse produto cadastrado";
    for (const empresa of [EMPRESA_ROUPAS, EMPRESA_ELETRONICOS, EMPRESA_PET]) {
      const midias = toTenantMidias(empresa.midias);
      // Sem nome: not_requested ou missing — nunca mídia de outro tenant.
      const { resolved } = resolveOn(empresa, msg);
      for (const id of idsOf(resolved.matches)) {
        assert.ok(midias.some((m) => m.id_midia === id));
      }
    }
  });

  it("toProductCandidate trata atributo genérico igual (não só sabor)", () => {
    const midias = toTenantMidias(EMPRESA_ROUPAS.midias);
    const c = toProductCandidate(
      {
        produto: "camiseta",
        sabor: null,
        atributos: ["preta", "algodao"],
        estilo: ["elegante"],
        oferta: "R$79",
      },
      { acervoRows: midias },
    );
    assert.equal(c.nome, "camiseta");
    assert.ok(c.atributos.includes("preta"));
    assert.ok(c.atributos.includes("algodao"));
    assert.ok(!c.atributos.includes("elegante"));
  });
});
