import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aplicarEdicaoNaProposta,
  interpretarAjustesDoWhatsapp,
  interpretarCores,
} from "../../backend/src/services/ajustesDoCliente.js";
import { formatBrandIdentityForProductPrompt } from "../../backend/src/modules/empresas/identidadeMarca.js";
import { buildIntegratedProductImagePrompt } from "../../backend/src/services/imagePreviewPrompt.js";
import { ajustarResumoPeloWhatsapp } from "../../backend/src/services/whatsappInboundService.js";

const MARCA = { nome_fantasia: "Pizzaria", cor_primaria: "#B83A2E", cor_secundaria: "#F3E6D0", estilo_visual: "Rústico e acolhedor" };
const PROPOSTA = {
  intent_summary: "pizza · promocao · R$59 · preço em destaque",
  frase_na_imagem: "Sexta da calabresa, grande por R$ 59",
  arte_brief: { tema: "promocao · pizza · R$59", cores: ["#B83A2E", "#F3E6D0"], observacoes: "preço em destaque" },
};
const HISTORY = [{ role: "user", content: "Faz um post da pizza de calabresa: grande por R$ 59. Frase: Sexta da calabresa, grande por R$ 59" }];

describe("interpretarCores", () => {
  it("entende nomes em português, códigos hex e junções com «e»", () => {
    assert.deepEqual(interpretarCores("azul e branco").cores, ["#1E6FFF", "#FFFFFF"]);
    assert.deepEqual(interpretarCores("Vermelho, #00ff00").cores, ["#D32F2F", "#00FF00"]);
    assert.deepEqual(interpretarCores("azul escuro").cores, ["#0A1F44"]);
  });

  it("ignora acento e maiúscula, e avisa o que não entendeu", () => {
    const r = interpretarCores("Azul Marinho e xuxu");
    assert.deepEqual(r.cores, ["#0A1F44"]);
    assert.deepEqual(r.naoEntendidas, ["xuxu"]);
  });

  it("não repete cor e limita a 5", () => {
    assert.equal(interpretarCores("azul, azul, azul").cores.length, 1);
    assert.equal(interpretarCores("azul, verde, rosa, preto, branco, cinza, roxo").cores.length, 5);
  });
});

describe("interpretarAjustesDoWhatsapp", () => {
  it("lê texto, cores e detalhes, um por linha", () => {
    const r = interpretarAjustesDoWhatsapp(
      "texto: Sexta da calabresa, 3 por R$ 59\ncores: azul e branco\ndetalhes: fundo mais claro",
    );
    assert.equal(r.frase, "Sexta da calabresa, 3 por R$ 59");
    assert.deepEqual(r.cores, ["#1E6FFF", "#FFFFFF"]);
    assert.equal(r.detalhes, "fundo mais claro");
  });

  it("aceita «frase:» e «cor:» e ignora maiúsculas", () => {
    const r = interpretarAjustesDoWhatsapp("FRASE: Oferta\nCor: verde");
    assert.equal(r.frase, "Oferta");
    assert.deepEqual(r.cores, ["#2E7D32"]);
  });

  it("mensagem comum, sem campo no começo da linha, não é um ajuste", () => {
    assert.equal(interpretarAjustesDoWhatsapp("gerar imagem"), null);
    assert.equal(interpretarAjustesDoWhatsapp("quero uma pizza de texto: bonita? não"), null);
  });
});

describe("aplicarEdicaoNaProposta", () => {
  it("troca o preço em todos os campos e mantém o resto ao mudar só o texto", () => {
    const n = aplicarEdicaoNaProposta(PROPOSTA, { frase: "Sexta da calabresa, grande por R$ 69" });
    assert.match(n.intent_summary, /R\$69/);
    assert.match(n.arte_brief.tema, /R\$69/);
    assert.equal(n.ajustes_do_cliente.preco_de, "R$ 59");
    assert.equal(n.ajustes_do_cliente.preco_para, "R$ 69");
    assert.deepEqual(n.arte_brief.cores, ["#B83A2E", "#F3E6D0"]);
    assert.equal(n.ajustes_do_cliente.cores_alteradas, false);
  });

  it("trocar as cores marca «cores_alteradas»; desfazer volta ao normal", () => {
    const trocada = aplicarEdicaoNaProposta(PROPOSTA, { cores: ["#1E6FFF", "#FFFFFF"] });
    assert.equal(trocada.ajustes_do_cliente.cores_alteradas, true);
    assert.deepEqual(trocada.arte_brief.cores, ["#1E6FFF", "#FFFFFF"]);
    const desfeita = aplicarEdicaoNaProposta(trocada, { cores: ["#f3e6d0", "#b83a2e"] });
    assert.equal(desfeita.ajustes_do_cliente.cores_alteradas, false);
  });

  it("ajustes seguidos se acumulam e o original não é alterado", () => {
    const antes = JSON.stringify(PROPOSTA);
    const um = aplicarEdicaoNaProposta(PROPOSTA, { detalhes: "fundo mais claro" });
    const dois = aplicarEdicaoNaProposta(um, { cores: ["#1E6FFF"] });
    assert.equal(dois.ajustes_do_cliente.detalhes, "fundo mais claro");
    assert.equal(dois.ajustes_do_cliente.cores_alteradas, true);
    assert.equal(JSON.stringify(PROPOSTA), antes);
  });
});

describe("a cor do cliente vale só no post dele; sem troca, a marca manda", () => {
  it("sem troca de cores: o prompt usa a paleta da marca e não menciona a do cliente", () => {
    const prompt = buildIntegratedProductImagePrompt(HISTORY, PROPOSTA, MARCA, { productNames: ["Pizza"] });
    assert.match(prompt, /Brand color palette: .*#B83A2E/);
    assert.doesNotMatch(prompt, /chosen by the client/);
    assert.match(prompt, /the brand identity wins\./);
  });

  it("com troca de cores: a paleta do cliente substitui a da marca, só naquele post", () => {
    const proposta = aplicarEdicaoNaProposta(PROPOSTA, { cores: ["#1E6FFF", "#FFFFFF"] });
    const prompt = buildIntegratedProductImagePrompt(HISTORY, proposta, MARCA, { productNames: ["Pizza"] });
    assert.match(prompt, /Color palette for THIS post \(chosen by the client.*blue \(#1E6FFF\), white \(#FFFFFF\)/);
    assert.doesNotMatch(prompt, /Brand color palette/);
    assert.match(prompt, /except for the color palette that the client chose for this post/);
    assert.doesNotMatch(prompt, /#B83A2E/);
    assert.match(prompt, /NEVER changes the product packaging/);
  });

  it("o formatador ignora cores inválidas do cliente e cai na paleta da marca", () => {
    const bloco = formatBrandIdentityForProductPrompt(MARCA, undefined, { coresDoCliente: ["azul", "#12"] });
    assert.match(bloco, /Brand color palette/);
  });
});

describe("ajustarResumoPeloWhatsapp", () => {
  const sessao = (extra = {}) => ({
    phone: "5511000000000",
    id_empresa: "e1",
    estado: "ready_for_image",
    history: [],
    post_context_proposal: PROPOSTA,
    post_supplement_links: [],
    ...extra,
  });

  it("aplica o ajuste na proposta da sessão e devolve o resumo atualizado", () => {
    const s = sessao();
    const r = ajustarResumoPeloWhatsapp(s, "cores: azul e branco\ntexto: Sexta da calabresa, grande por R$ 69");
    assert.match(r.reply, /Atualizei o resumo/);
    assert.match(r.reply, /Cores deste post/);
    assert.match(r.reply, /R\$ 69/);
    assert.equal(r.estado, "ready_for_image");
    assert.equal(s.post_context_proposal.ajustes_do_cliente.cores_alteradas, true);
  });

  it("não age fora do estado «ready_for_image» nem com mensagem comum", () => {
    assert.equal(ajustarResumoPeloWhatsapp(sessao({ estado: "has_image" }), "cores: azul"), null);
    assert.equal(ajustarResumoPeloWhatsapp(sessao({ estado: "idle", post_context_proposal: null }), "cores: azul"), null);
    assert.equal(ajustarResumoPeloWhatsapp(sessao(), "gerar imagem"), null);
  });

  it("cor desconhecida: avisa e não altera a proposta", () => {
    const s = sessao();
    const r = ajustarResumoPeloWhatsapp(s, "cores: xuxu");
    assert.match(r.reply, /Não reconheci a cor «xuxu»/);
    assert.equal(s.post_context_proposal, PROPOSTA);
  });
});
