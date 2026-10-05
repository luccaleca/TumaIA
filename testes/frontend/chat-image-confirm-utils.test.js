import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aplicarEdicaoNoSuplemento, descreverComoFicaAArte, FRASE_NA_ARTE_MAX } from "../../frontend/app/painel/chat/chatImageConfirmUtils.js";

const PROPOSTA = {
  intent_summary: "pizza · promocao · R$79 · preço em destaque",
  frase_na_imagem: "Terça da pizza",
  midias_referenced: [{ id_midia: "m1", nome_exibicao: "Pizza de calabresa", nome_arquivo: "pizza 2.png" }],
  arte_brief: {
    tema: "promocao · pizza · R$79 · preço em destaque",
    formato: { ratio: "1:1", label: "Post", orientation: "square" },
    cores: ["#B83A2E", "#F3E6D0"],
    texto: "Terça da pizza",
    observacoes: "preço em destaque",
  },
};

const porRotulo = (itens, rotulo) => itens.find((i) => i.rotulo === rotulo);

describe("descreverComoFicaAArte", () => {
  it("descreve formato, produto, texto, preço e cores em linguagem simples", () => {
    const itens = descreverComoFicaAArte(PROPOSTA);
    assert.match(porRotulo(itens, "Formato").texto, /quadrado.*1:1/i);
    assert.match(porRotulo(itens, "Produto").texto, /Pizza de calabresa/);
    assert.equal(porRotulo(itens, "Texto na arte").texto, "«Terça da pizza»");
    assert.match(porRotulo(itens, "Preço").texto, /R\$ 79/);
    assert.deepEqual(porRotulo(itens, "Cores").cores, ["#B83A2E", "#F3E6D0"]);
  });

  it("não repete «preço em destaque» como estilo quando o preço já tem linha própria", () => {
    assert.equal(porRotulo(descreverComoFicaAArte(PROPOSTA), "Estilo"), undefined);
  });

  it("ignora cores inválidas e proposta vazia", () => {
    const itens = descreverComoFicaAArte({ arte_brief: { cores: ["vermelho", "#12"] } });
    assert.equal(porRotulo(itens, "Cores"), undefined);
    assert.deepEqual(descreverComoFicaAArte(null), []);
  });
});

describe("descreverComoFicaAArte — identidade da marca", () => {
  it("mostra clima e o que evitar quando a proposta traz a identidade", () => {
    const itens = descreverComoFicaAArte({
      ...PROPOSTA,
      identidade_resumo: { estilo: "Rústico e acolhedor", evitar: "poster genérico, neon" },
    });
    assert.equal(porRotulo(itens, "Clima da marca").texto, "Rústico e acolhedor");
    assert.equal(porRotulo(itens, "Evitar").texto, "poster genérico, neon");
  });

  it("não cria linhas de marca quando a identidade não veio", () => {
    const itens = descreverComoFicaAArte(PROPOSTA);
    assert.equal(porRotulo(itens, "Clima da marca"), undefined);
    assert.equal(porRotulo(itens, "Evitar"), undefined);
  });
});

describe("aplicarEdicaoNoSuplemento", () => {
  const SUPLEMENTO = {
    confirmation_message: "Revise o resumo.",
    links: [],
    post_context_proposal: {
      ...PROPOSTA,
      frase_na_imagem: "Terça da pizza, 2 grandes por R$ 79",
      resumo_visual: "Post promocional com preço R$79 em destaque",
    },
  };

  it("troca o preço antigo pelo novo em frase, tema e resumo", () => {
    const novo = aplicarEdicaoNoSuplemento(SUPLEMENTO, {
      frase: "Terça da pizza, 2 grandes por R$ 89",
      detalhes: "fundo mais claro",
    });
    const p = novo.post_context_proposal;
    assert.equal(p.frase_na_imagem, "Terça da pizza, 2 grandes por R$ 89");
    assert.equal(p.facts_for_image.frase_na_imagem, "Terça da pizza, 2 grandes por R$ 89");
    assert.match(p.intent_summary, /R\$89/);
    assert.doesNotMatch(p.intent_summary, /R\$79/);
    assert.match(p.arte_brief.tema, /R\$89/);
    assert.doesNotMatch(p.resumo_visual, /R\$79/);
    assert.equal(p.arte_brief.texto, "Terça da pizza, 2 grandes por R$ 89");
    assert.equal(p.arte_brief.observacoes, "fundo mais claro");
  });

  it("não mexe no preço quando só o texto muda, e não altera o original", () => {
    const antes = JSON.stringify(SUPLEMENTO);
    const novo = aplicarEdicaoNoSuplemento(SUPLEMENTO, { frase: "Terça da pizza, 2 grandes por R$ 79" });
    assert.match(novo.post_context_proposal.intent_summary, /R\$79/);
    assert.equal(JSON.stringify(SUPLEMENTO), antes);
  });

  it("respeita o limite da frase e só aceita cores válidas", () => {
    const novo = aplicarEdicaoNoSuplemento(SUPLEMENTO, {
      frase: "x".repeat(200),
      cores: ["#112233", "azul", "#zzz"],
    });
    assert.ok(novo.post_context_proposal.frase_na_imagem.length <= FRASE_NA_ARTE_MAX);
    assert.deepEqual(novo.post_context_proposal.arte_brief.cores, ["#112233"]);
  });

  it("frase vazia mantém a frase anterior", () => {
    const novo = aplicarEdicaoNoSuplemento(SUPLEMENTO, { frase: "  ", detalhes: "" });
    assert.equal(novo.post_context_proposal.frase_na_imagem, "Terça da pizza, 2 grandes por R$ 79");
  });
});

describe("aplicarEdicaoNoSuplemento — ajustes para o backend", () => {
  const BASE = {
    links: [],
    post_context_proposal: {
      intent_summary: "pizza · promocao · R$49",
      frase_na_imagem: "Quinta da pizza, grande por R$ 49",
      arte_brief: { tema: "promocao · pizza · R$49", cores: ["#B83A2E"] },
    },
  };

  it("registra o que mudou em ajustes_do_cliente, com o preço original", () => {
    const novo = aplicarEdicaoNoSuplemento(BASE, {
      frase: "Quinta da pizza, grande por R$ 59.",
      detalhes: "fundo mais claro",
      cores: ["#112233"],
    });
    const a = novo.post_context_proposal.ajustes_do_cliente;
    assert.equal(a.preco_de, "R$ 49");
    assert.equal(a.preco_para, "R$ 59");
    assert.equal(a.detalhes, "fundo mais claro");
    assert.deepEqual(a.cores, ["#112233"]);
  });

  it("depois de duas edições o preço «de» continua sendo o da mensagem original", () => {
    const primeira = aplicarEdicaoNoSuplemento(BASE, { frase: "Quinta da pizza, grande por R$ 59" });
    const segunda = aplicarEdicaoNoSuplemento(primeira, { frase: "Quinta da pizza, grande por R$ 69" });
    const a = segunda.post_context_proposal.ajustes_do_cliente;
    assert.equal(a.preco_de, "R$ 49");
    assert.equal(a.preco_para, "R$ 69");
  });

  it("voltar ao preço original limpa a troca", () => {
    const primeira = aplicarEdicaoNoSuplemento(BASE, { frase: "Quinta da pizza, grande por R$ 59" });
    const volta = aplicarEdicaoNoSuplemento(primeira, { frase: "Quinta da pizza, grande por R$ 49" });
    assert.equal(volta.post_context_proposal.ajustes_do_cliente.preco_de, "");
  });
});
