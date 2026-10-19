import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inferPreferredPlaybookSlug } from "../../backend/src/services/cadastroMeaningful.js";
import {
  buildWhatsappPostConfirmation,
  cortarNoFimDaPalavra,
  descreverArteParaWhatsapp,
} from "../../backend/src/services/postConfirmationWhatsapp.js";
import { buildOutboundText } from "../../backend/src/services/whatsappBridge.js";

describe("cadastroMeaningful — modelo de post", () => {
  it("modelo de produto no pedido → slug produto", () => {
    assert.equal(
      inferPreferredPlaybookSlug("postagem no modelo de produto com whey de cookie"),
      "produto",
    );
    assert.equal(
      inferPreferredPlaybookSlug(
        "quero um post com modelo de post de produto do naked wafer dark chocolate",
      ),
      "produto",
    );
  });
});

describe("postConfirmationWhatsapp", () => {
  it("monta resumo com modelo, produto e cena", () => {
    const msg = buildWhatsappPostConfirmation(
      {
        matched_contexto: { nome: "Produto" },
        hero_product: { nome_exibicao: "Whey Cookie" },
        intent_summary:
          "pessoa na academia usando whey de cookie para simbolizar força",
        montagem_resumo: "Academia · Whey · Força",
      },
      [{ kind: "contexto", id: "1", label: "Produto" }],
      { briefingStatus: "ready" },
    );
    assert.match(msg, /Modelo de post.*Produto/i);
    assert.match(msg, /Whey Cookie/i);
    assert.match(msg, /gerar imagem/i);
  });
});

const PROPOSTA_PIZZA = {
  intent_summary: "pizza · promocao · R$59 · preço em destaque",
  frase_na_imagem: "Sexta da calabresa, grande por R$ 59",
  // O texto interno do «resumo visual» é para a IA e vinha cortado no meio da palavra no WhatsApp.
  resumo_visual:
    "Post promocional para feed do Instagram do Pizza de calabresa. O PNG do acervo (Pizza de calabresa) fica centralizado na composição. Detalhes visuais de Pizza de calabresa: PNG do acervo resolvido a partir do produto interpretado.. Cenário e detalhes coerentes com um negócio de Alimentação, reforçando o produto sem poluir o centro.",
  hero_product: { nome_exibicao: "Pizza de calabresa" },
  midias_referenced: [{ id_midia: "m1", nome_exibicao: "Pizza de calabresa" }],
  arte_brief: {
    tema: "promocao · pizza · R$59 · preço em destaque",
    formato: { ratio: "1:1", label: "Post", orientation: "square" },
    cores: ["#B83A2E", "#F3E6D0"],
  },
  identidade_resumo: {
    estilo: "Rústico e acolhedor, foto de comida de perto, tons quentes, tipografia forte, foco na pizza",
    evitar: "poster genérico",
  },
};

describe("postConfirmationWhatsapp — mensagem legível", () => {
  const msg = buildWhatsappPostConfirmation(PROPOSTA_PIZZA, [], { briefingStatus: "ready" });

  it("mostra «Como vai ficar» em lista curta, com preço, cores nomeadas e clima", () => {
    assert.match(msg, /Como vai ficar/);
    assert.match(msg, /• Formato: Post quadrado \(1:1\)/);
    assert.match(msg, /• Preço: R\$ 59 em destaque/);
    assert.match(msg, /• Cores da marca: .*#B83A2E/);
    assert.match(msg, /red \(#B83A2E\)/);
    assert.match(msg, /• Clima: Rústico e acolhedor/);
  });

  it("não vaza o texto interno do resumo visual nem fala «do Pizza de calabresa»", () => {
    assert.doesNotMatch(msg, /PNG do acervo resolvido/);
    assert.doesNotMatch(msg, /produto interpretado/);
    assert.doesNotMatch(msg, /do Pizza de calabresa/);
    assert.doesNotMatch(msg, /Cenário e detalhes c\b/);
  });

  it("mantém produto e frase, e pede a ação uma única vez", () => {
    assert.match(msg, /Produto\(s\):\* Pizza de calabresa/);
    assert.match(msg, /Texto na imagem:\* Sexta da calabresa, grande por R\$ 59/);
    assert.equal((msg.match(/gerar imagem/gi) || []).length, 1);
  });
});

describe("postConfirmationWhatsapp — sem dados estruturados", () => {
  it("cai num resumo curto, sem usar o resumo interno da IA", () => {
    const msg = buildWhatsappPostConfirmation(
      {
        intent_summary: "promoção de sexta com a pizza grande e muitos detalhes ".repeat(8),
        resumo_visual: "TEXTO INTERNO DA IA que não deve aparecer",
      },
      [],
      { briefingStatus: "ready" },
    );
    assert.match(msg, /🎨 \*Cena:\*/);
    assert.doesNotMatch(msg, /TEXTO INTERNO/);
    const cena = (msg.match(/Cena:*s*(.*)/) || [])[1] || "";
    assert.ok(cena.length > 0 && cena.length <= 200, "a cena é curta");
  });
});

describe("cortarNoFimDaPalavra", () => {
  it("não corta no meio da palavra e põe reticências", () => {
    const t = cortarNoFimDaPalavra("Cenário e detalhes coerentes com um negócio de Alimentação", 30);
    assert.ok(t.endsWith("…"));
    assert.ok(t.length <= 30);
    assert.doesNotMatch(t.replace(/…$/, ""), /\s\S{1,3}$/);
  });

  it("texto curto fica igual", () => {
    assert.equal(cortarNoFimDaPalavra("Sexta de pizza", 80), "Sexta de pizza");
  });
});

describe("descreverArteParaWhatsapp", () => {
  it("proposta vazia não gera linhas", () => {
    assert.deepEqual(descreverArteParaWhatsapp({}), []);
  });
});

describe("buildOutboundText — separação do bloco de ações", () => {
  it("deixa uma linha em branco entre a resposta e as ações", () => {
    const texto = buildOutboundText({
      reply: "Imagem gerada. Veja acima.",
      hints: "\n\n*Ações:*\n• *gerar legenda* — montar legenda",
    });
    assert.match(texto, /Veja acima\.\n\n\*Ações:\*/);
    assert.doesNotMatch(texto, /acima\.\*Ações/);
  });

  it("sem ações devolve só a resposta, e não repete ações que já estão no texto", () => {
    assert.equal(buildOutboundText({ reply: "Olá" }), "Olá");
    const ja = "*Ações:*\n• *gerar legenda*";
    assert.equal(buildOutboundText({ reply: `Oi\n\n${ja}`, hints: `\n\n${ja}` }), `Oi\n\n${ja}`);
  });
});
