import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildResumoVisual,
  collectMandatoryImageFacts,
  deriveFraseNaImagemFromHistory,
  extractFraseFromUserText,
  extractPromoPricing,
  mergeMandatoryFactsIntoResumo,
  resolveFraseNaImagem,
  synthesizeResumoVisual,
} from "../../backend/src/services/imageHeadline.js";
import { describeAmbienteFromCadastro } from "../../backend/src/services/visualResumoFromCadastro.js";

describe("imageHeadline — frase na imagem", () => {
  it("não puxa 500k do nome do contexto se o pedido recente é promo", () => {
    const history = [
      { role: "user", content: "quero comemorar 500 mil seguidores no insta" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "agora quero arte black friday do whey até 40% off" },
    ];
    const proposal = { frase_na_imagem: "Parabéns pelos 500k!" };
    const contextoRows = [{ nome: "Marco 500k seguidores", dados_json: { tipo: "data_comemorativa" } }];
    const frase = resolveFraseNaImagem(proposal, history, contextoRows);
    assert.ok(frase);
    assert.match(frase, /40%|Black Friday|Promo/i);
    assert.doesNotMatch(frase, /500\s*k/i);
  });

  it("usa 500k só quando o pedido recente menciona seguidores", () => {
    const history = [{ role: "user", content: "post para 500k seguidores no instagram" }];
    const frase = deriveFraseNaImagemFromHistory(history, []);
    assert.equal(frase, "Parabéns pelos 500k!");
  });

  it("extrai frase após dois-pontos", () => {
    const frase = extractFraseFromUserText(
      "Post quadrado para Instagram, fundo na cor da marca, frase: TumaIA entende seu negócio",
    );
    assert.equal(frase, "TumaIA entende seu negócio");
  });

  it("sugere frase curta quando o pedido fala em porcentagem de desconto", () => {
    const history = [
      {
        role: "user",
        content:
          "quero uma foto das 3 creatinas growth max e integral, com a integral em foco e promoção de 30% de desconto bem em evidência",
      },
    ];
    const frase = deriveFraseNaImagemFromHistory(history, []);
    assert.equal(frase, "Até 30% OFF");
  });

  it("resumo visual não repete o pedido literal do cliente", () => {
    const intent =
      "Academia Promo. quero um post de promoção dos monster de 15 por 9, bem chamativo, só para academias";
    const proposal = {
      intent_summary: intent,
      midias_referenced: [
        { id_midia: "m1", nome_exibicao: "Monster Energy Lata" },
      ],
      hero_product: { nome_exibicao: "Monster Energy Lata" },
    };
    const resumo = buildResumoVisual(proposal, [], intent);
    assert.ok(resumo);
    assert.doesNotMatch(resumo, /quero um post de promoção/i);
    assert.match(resumo, /Monster Energy Lata/i);
    assert.match(resumo, /academia/i);
    assert.match(resumo, /15.*9|R\$\s*15.*R\$\s*9/i);
  });

  it("synthesizeResumoVisual lista PNGs do acervo", () => {
    const resumo = synthesizeResumoVisual(
      {
        intent_summary: "promo monster",
        midias_referenced: [{ nome_exibicao: "Monster Verde" }, { nome_exibicao: "Monster Rosa" }],
      },
      "promo monster",
    );
    assert.match(resumo, /Monster Verde/);
    assert.match(resumo, /Monster Rosa/);
    assert.match(resumo, /PNG|centralizado|Monster/i);
  });

  it("extrai 12,99 por 8,99 sem confundir com 99 por 8", () => {
    const pricing = extractPromoPricing(
      "post de promocao do produto monster, 12,99 por 8,99 , queima de estoque",
    );
    assert.ok(pricing);
    assert.match(pricing.display, /12,99/);
    assert.match(pricing.display, /8,99/);
    assert.doesNotMatch(pricing.display, /99 por R\$ 8[^,]/);
  });

  it("extrai preços em faixa (1 por 99,99 e 2 por 149,99)", () => {
    const pricing = extractPromoPricing(
      "promoção de creatina para dia dos namorados, 1 por 99,99 e 2 por 149,99",
    );
    assert.ok(pricing);
    assert.equal(pricing.kind, "tiered");
    assert.match(pricing.display, /99,99/);
    assert.match(pricing.display, /149,99/);
  });

  it("mantém preço da 1ª mensagem quando a 2ª só pede tema", () => {
    const history = [
      {
        role: "user",
        content:
          "promoção de creatina para dia dos namorados, 1 por 99,99 e 2 por 149,99",
      },
      {
        role: "user",
        content:
          "pode criar a mensagem, quero utilizar todas as creatinas e dar enfase ao dia dos namorados",
      },
    ];
    const facts = collectMandatoryImageFacts(history, {});
    assert.match(String(facts.precos_promocao), /99,99/);
    assert.match(String(facts.precos_promocao), /149,99/);
    assert.equal(facts.ocasiao, "Dia dos Namorados");

    const resumo = buildResumoVisual(
      {
        intent_summary: history[1].content,
        midias_referenced: [
          { nome_exibicao: "creatina growth" },
          { nome_exibicao: "creatina integral" },
          { nome_exibicao: "creatina max" },
        ],
        resumo_visual:
          "Arte romântica para Dia dos Namorados com as três creatinas do acervo em destaque.",
      },
      history,
      history[1].content,
    );
    assert.match(resumo, /tipográfico|99,99/i);
    assert.match(resumo, /149,99/);
  });

  it("mergeMandatoryFactsIntoResumo não duplica bloco obrigatório", () => {
    const merged = mergeMandatoryFactsIntoResumo(
      "OBRIGATÓRIO na tipografia: 1 por R$ 99,99 | 2 por R$ 149,99.",
      [{ role: "user", content: "1 por 99,99 e 2 por 149,99" }],
      {},
    );
    assert.equal((merged.match(/OBRIGATÓRIO/g) || []).length, 1);
  });

  it("describeAmbienteFromCadastro usa metadados do produto cadastrado", () => {
    const ambiente = describeAmbienteFromCadastro(
      { segmento: "Papelaria" },
      null,
      [{ nome_exibicao: "Caderno universitário", descricao: "Capa dura espiral" }],
    );
    assert.match(ambiente, /Papelaria/i);
    assert.match(ambiente, /Caderno universitário|Capa dura/i);
  });

  it("ignora linha automática de confirmação do painel", () => {
    const history = [
      { role: "user", content: "arte promo whey" },
      { role: "user", content: "Confirmar e gerar prévia da imagem." },
    ];
    const frase = deriveFraseNaImagemFromHistory(history, []);
    assert.notEqual(frase, "Promoção");
    assert.ok(frase === null || !/^promoção$/i.test(frase));
  });
});
