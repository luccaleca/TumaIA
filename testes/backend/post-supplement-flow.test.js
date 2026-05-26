import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFluxImagePrompt,
  buildRawImagePrompt,
  FLUX_IMAGE_PROMPT_MAX,
} from "../../backend/src/services/imagePreviewPrompt.js";
import { buildProductLayoutSlots } from "../../backend/src/services/productSceneComposer.js";
import {
  buildMontagemResumo,
  resolvePostSupplementLinks,
  sanitizePostSupplementLinks,
} from "../../backend/src/services/postContextProposalService.js";
import { pickHeroProductMidiaId } from "../../backend/src/services/referenceMidiaRanking.js";

const CTX_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MID_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MID2_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MID3_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const FAKE = "99999999-9999-4999-8999-999999999999";

describe("post supplement — sanitizePostSupplementLinks", () => {
  const contextoRows = [{ id_contexto_empresa: CTX_ID, nome: "Marco 500k" }];
  const midiaRows = [{ id_midia: MID_ID, nome_exibicao: "Logo marca" }];

  it("mantém só ids que existem no Supabase e monta href do painel", () => {
    const raw = [
      { kind: "contexto", id: CTX_ID, label: "Ver contexto comemorativo" },
      { kind: "midia", id: MID_ID, label: "Ver mídia de referência" },
      { kind: "contexto", id: FAKE, label: "Inventado" },
      { kind: "midia", id: FAKE, label: "Também inventado" },
    ];
    const out = sanitizePostSupplementLinks(raw, contextoRows, midiaRows);
    assert.equal(out.length, 2);
    assert.equal(out[0].kind, "contexto");
    assert.equal(out[0].id, CTX_ID);
    assert.match(out[0].href, new RegExp(`contexto=${CTX_ID}`));
    assert.equal(out[1].kind, "midia");
    assert.equal(out[1].id, MID_ID);
    assert.match(out[1].href, new RegExp(`midia=${MID_ID}`));
  });

  it("ignora kind inválido ou label vazio", () => {
    const out = sanitizePostSupplementLinks(
      [
        { kind: "contexto", id: CTX_ID, label: "" },
        { kind: "outro", id: CTX_ID, label: "x" },
      ],
      contextoRows,
      midiaRows,
    );
    assert.equal(out.length, 0);
  });

  it("resolve links finais com contexto e mídias referenciadas", () => {
    const contextoRows = [{ id_contexto_empresa: CTX_ID, nome: "Dia dos Namorados" }];
    const midiaRows = [
      { id_midia: MID_ID, nome_exibicao: "Whey Baunilha Refil" },
      { id_midia: MID2_ID, nome_exibicao: "Whey Chocolate Premium" },
      { id_midia: MID3_ID, nome_exibicao: "Whey Morango PNG" },
    ];
    const proposal = {
      matched_contexto: { id_contexto_empresa: CTX_ID, nome: "Dia dos Namorados" },
      midias_referenced: [
        { id_midia: MID_ID, nome_exibicao: "Whey Baunilha Refil" },
        { id_midia: MID2_ID, nome_exibicao: "Whey Chocolate Premium" },
        { id_midia: MID3_ID, nome_exibicao: "Whey Morango PNG" },
      ],
    };

    const out = resolvePostSupplementLinks(
      [
        { kind: "contexto", id: CTX_ID, label: "Contexto duplicado enorme" },
        { kind: "midia", id: MID2_ID, label: "Chocolate duplicado" },
      ],
      proposal,
      contextoRows,
      midiaRows,
    );

    assert.equal(out.length, 4);
    assert.deepEqual(
      out.map((item) => item.id),
      [CTX_ID, MID_ID, MID2_ID, MID3_ID],
    );
    assert.equal(out[0].kind, "contexto");
    assert.equal(out[1].label, "Whey Baunilha Refil");
    assert.match(out[0].href, new RegExp(`contexto=${CTX_ID}`));
    assert.match(out[1].href, new RegExp(`midia=${MID_ID}`));
  });
});

describe("post supplement — buildFluxImagePrompt com proposta", () => {
  it("buildMontagemResumo gera rótulo curto e direto", () => {
    const resumo = buildMontagemResumo({
      montagem_resumo: "foto com crianina integral e growth",
      matched_contexto: { nome: "Promoção" },
      midias_referenced: [
        { id_midia: MID_ID, nome_exibicao: "creatina integral" },
        { id_midia: MID2_ID, nome_exibicao: "creatina growth" },
        { id_midia: MID3_ID, nome_exibicao: "creatina max" },
      ],
    });
    assert.match(resumo, /creatina|creatinas/i);
    assert.match(resumo, /promo/i);
    assert.doesNotMatch(resumo, /crianina/i);
    assert.ok(resumo.split(/\s+/).length <= 3);
  });

  it("inclui identidade da marca no pipeline raw", () => {
    const proposal = {
      intent_summary: "Post 500k seguidores",
      facts_for_image: { seguidores: "500k" },
    };
    const prompt = buildFluxImagePrompt({
      history: [{ role: "user", content: "Quero um post comemorando 500 mil seguidores." }],
      contextoRows: [
        {
          nome: "Identidade da marca",
          schema_json: { tipo: "identidade_marca" },
          dados_json: {
            tipo: "identidade_marca",
            cor_primaria: "#00B341",
            estilo_visual: "limpo, premium",
            tom_voz: "confiante",
          },
        },
        { id_contexto_empresa: CTX_ID, nome: "Data comemorativa", dados_json: { tipo: "data_comemorativa" } },
      ],
      postContextProposal: proposal,
    });
    assert.match(prompt, /500k seguidores/i);
    assert.match(prompt, /Identidade da marca/i);
    assert.match(prompt, /#00B341/);
    assert.match(prompt, /limpo, premium/i);
    assert.doesNotMatch(prompt, /Brand identity|Client request/i);
  });

  it("buildRawImagePrompt inclui identidade quando configurada", () => {
    const p = buildRawImagePrompt(
      [{ role: "user", content: "Post planos TumaIA" }],
      { intent_summary: "Post planos Starter Pro Business" },
      {
        cor_primaria: "#6B2D9E",
        estilo_visual: "moderno",
        tom_voz: "profissional",
      },
    );
    assert.match(p, /Post planos Starter Pro Business/);
    assert.match(p, /Identidade da marca/i);
    assert.match(p, /#6B2D9E/);
  });

  it("buildRawImagePrompt repete intent_summary sem identidade", () => {
    const p = buildRawImagePrompt(
      [{ role: "user", content: "Post planos TumaIA" }],
      { intent_summary: "Post planos Starter Pro Business" },
    );
    assert.equal(p, "Post planos Starter Pro Business");
  });

  it("buildRawImagePrompt reforça fidelidade ao produto quando há referência do acervo", () => {
    const p = buildRawImagePrompt(
      [{ role: "user", content: "Promoção de whey" }],
      { intent_summary: "Promoção de whey de chocolate" },
      { estilo_visual: "premium" },
      { strictProductReference: true },
    );
    assert.match(p, /preservar RIGOROSAMENTE o design real da embalagem/i);
    assert.match(p, /NÃO redesenhar/i);
  });

  it("buildRawImagePrompt pode pedir somente fundo para composição posterior", () => {
    const p = buildRawImagePrompt(
      [{ role: "user", content: "Promoção de whey dia dos namorados" }],
      { intent_summary: "Promoção dia dos namorados com 3 wheys" },
      { estilo_visual: "premium" },
      { composeProductAssets: true, productCount: 3 },
    );
    assert.match(p, /SOMENTE o fundo\/cenário\/layout/i);
    assert.match(p, /Não renderize nenhum pote, embalagem, rótulo/i);
    assert.match(p, /inserção posterior de 3 produtos reais/i);
  });

  it("buildRawImagePrompt deixa a frase explícita sobrescrever o texto do brief", () => {
    const p = buildRawImagePrompt(
      [{ role: "user", content: "quero arte de black friday" }],
      {
        frase_na_imagem: "Até 40% OFF",
        arte_brief: {
          tema: "Black Friday whey",
          titulo: "Texto antigo",
          subtitulo: "Sub antigo",
          texto: "Texto antigo maior",
        },
      },
      { estilo_visual: "premium" },
    );
    assert.match(p, /O ÚNICO texto legível na imagem deve ser exatamente esta frase/i);
    assert.match(p, /Até 40% OFF/);
    assert.doesNotMatch(p, /Título na imagem: «Texto antigo»/i);
    assert.doesNotMatch(p, /Texto na imagem: «Texto antigo maior»/i);
  });

  it("buildRawImagePrompt aceita limpar todo o texto da arte", () => {
    const p = buildRawImagePrompt(
      [{ role: "user", content: "quero arte clean pro whey" }],
      {
        frase_na_imagem: "",
        arte_brief: {
          tema: "Arte clean whey",
          titulo: "Titulo que nao deve voltar",
          texto: "Texto que nao deve voltar",
        },
      },
      { estilo_visual: "clean" },
    );
    assert.match(p, /Não renderize texto legível na imagem/i);
    assert.doesNotMatch(p, /Título na imagem:/i);
    assert.doesNotMatch(p, /Texto na imagem:/i);
  });

  it("modo full ainda monta seções longas", () => {
    const prompt = buildFluxImagePrompt({
      history: [{ role: "user", content: "Post institucional" }],
      contextoRows: [],
      postContextProposal: { intent_summary: "Post institucional" },
      pipeline: "standard",
      promptStyle: "full",
      postContextProposal: { intent_summary: "Post institucional" },
    });
    assert.match(prompt, /Client request/);
    assert.match(prompt, /Brand identity|Professional marketing/i);
  });
});

describe("productSceneComposer — buildProductLayoutSlots", () => {
  it("destaca o produto central quando há três packshots", () => {
    const slots = buildProductLayoutSlots(3, 1024, 1024);
    assert.equal(slots.length, 3);
    assert.ok(slots[1].width > slots[0].width);
    assert.ok(slots[1].width > slots[2].width);
    assert.equal(slots[1].x, 0.5);
  });

  it("usa um produto maior em layouts verticais", () => {
    const slots = buildProductLayoutSlots(1, 900, 1600);
    assert.equal(slots.length, 1);
    assert.ok(slots[0].width >= 0.5);
    assert.ok(slots[0].bottom <= 0.05);
  });

  it("pode subir o produto central quando o cenário pede apoio no centro", () => {
    const slots = buildProductLayoutSlots(3, 1024, 1024, {
      heroBottom: 0.18,
      heroPreferred: true,
    });
    assert.equal(slots[1].x, 0.5);
    assert.ok(slots[1].bottom >= 0.17);
    assert.ok(slots[1].bottom > slots[0].bottom);
  });
});

describe("referenceMidiaRanking — foco explícito", () => {
  it("respeita o item principal pedido pelo usuário", () => {
    const rows = [
      {
        id_midia: MID_ID,
        tipo_midia: "imagem",
        nome_exibicao: "creatina growth",
        nome_arquivo: "creatina-growth.png",
        formato_arquivo: "image/png",
      },
      {
        id_midia: MID2_ID,
        tipo_midia: "imagem",
        nome_exibicao: "creatina max",
        nome_arquivo: "creatina-max.png",
        formato_arquivo: "image/png",
      },
      {
        id_midia: MID3_ID,
        tipo_midia: "imagem",
        nome_exibicao: "creatina integral",
        nome_arquivo: "creatina-integral.png",
        formato_arquivo: "image/png",
      },
    ];
    const hero = pickHeroProductMidiaId(
      rows,
      "quero uma arte com as 3 creatinas, mas deixe a creatina integral como foco principal no meio",
    );
    assert.equal(hero, MID3_ID);
  });
});
