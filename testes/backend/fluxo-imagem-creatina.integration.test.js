import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generatePostContextProposal } from "../../backend/src/services/postContextProposalService.js";
import { buildConfirmedImageIntent } from "../../backend/src/services/imageIntent.js";
import {
  buildFluxImagePrompt,
  buildImagePreviewContextMeta,
} from "../../backend/src/services/imagePreviewPrompt.js";
import { collectReferenceMidiaIds } from "../../backend/src/services/referenceMidiaFromProposal.js";
import {
  filterReferenceMidiaIdsToPedido,
  narrowImageRowsByProductMention,
  parseProductMentionSpec,
} from "../../backend/src/services/productMentionMatch.js";
import {
  pickBestProductMidiaId,
  pickHeroProductMidiaId,
  rankReferenceMidiaIds,
} from "../../backend/src/services/referenceMidiaRanking.js";
import { orderGptImage2ReferenceIds } from "../../backend/src/services/gptImage2OfficialRequest.js";
import { getImageProductMode, usesGptIntegratedProducts } from "../../backend/src/services/imageProductDelivery.js";
import { partitionContextosIdentidade } from "../../backend/src/modules/empresas/identidadeMarca.js";
import { resolveActivePedidoHint } from "../../backend/src/services/imageHeadline.js";
import { createMockEmpresaDb } from "./helpers/mockEmpresaDb.js";

const EMPRESA_ID = "11111111-1111-4111-8111-111111111111";
const CTX_IDENTIDADE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CTX_PROMO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MID_CREATINA_INTEGRAL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MID_CREATINA_GROWTH = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MID_MONSTER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const MID_LOGO = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const PEDIDO_CREATINA =
  "quero um post de promoção da creatina integral com até 30% de desconto, bem chamativo, foco na creatina integral para as academias";

function creatinaFixtures() {
  const contextoRows = [
    {
      id_contexto_empresa: CTX_IDENTIDADE,
      id_empresa: EMPRESA_ID,
      nome: "Identidade da marca",
      ativo: true,
      schema_json: { tipo: "identidade_marca" },
      dados_json: {
        tipo: "identidade_marca",
        cor_primaria: "#6B2D9E",
        cor_secundaria: "#00E676",
        cores_adicionais: ["#0F172A"],
        estilo_visual: "energético, premium, academias",
        tom_voz: "motivador",
        evitar: "layout genérico; cores fora da paleta",
        id_midia_logo: MID_LOGO,
      },
    },
    {
      id_contexto_empresa: CTX_PROMO,
      id_empresa: EMPRESA_ID,
      nome: "Promo Academias",
      descricao: "Campanhas com desconto para academias parceiras",
      ativo: true,
      schema_json: { tipo: "promocao" },
      dados_json: { tipo: "promocao" },
    },
  ];

  const midiaRows = [
    {
      id_midia: MID_CREATINA_INTEGRAL,
      id_empresa: EMPRESA_ID,
      nome_exibicao: "creatina integral",
      nome_arquivo: "creatina-integral.png",
      tipo_midia: "imagem",
      formato_arquivo: "image/png",
      extensao: ".png",
      ativo: true,
    },
    {
      id_midia: MID_CREATINA_GROWTH,
      id_empresa: EMPRESA_ID,
      nome_exibicao: "creatina growth",
      nome_arquivo: "creatina-growth.png",
      tipo_midia: "imagem",
      formato_arquivo: "image/png",
      extensao: ".png",
      ativo: true,
    },
    {
      id_midia: MID_MONSTER,
      id_empresa: EMPRESA_ID,
      nome_exibicao: "Monster Energy 473ml",
      nome_arquivo: "monster-energy.png",
      tipo_midia: "imagem",
      formato_arquivo: "image/png",
      extensao: ".png",
      ativo: true,
    },
    {
      id_midia: MID_LOGO,
      id_empresa: EMPRESA_ID,
      nome_exibicao: "Logo Tuma Suplementos",
      nome_arquivo: "logo-tuma.png",
      tipo_midia: "imagem",
      formato_arquivo: "image/png",
      extensao: ".png",
      ativo: true,
      origem_upload: "identidade_marca_logo",
    },
  ];

  const empresaRow = {
    id_empresa: EMPRESA_ID,
    nome_fantasia: "Tuma Suplementos",
    segmento: "suplementos",
    descricao: "Loja para academias",
  };

  return { contextoRows, midiaRows, empresaRow };
}

/**
 * Espelha resolveGptImage2InputImages (sem URLs) para validar refs da prévia.
 */
function simulatePreviewComposition(proposal, midiaRows, imageIntent, logoId) {
  const pedido = imageIntent.pedido;
  const fromProposal = collectReferenceMidiaIds(proposal, []);
  let refIds = filterReferenceMidiaIdsToPedido(fromProposal, midiaRows, pedido);
  refIds = rankReferenceMidiaIds(refIds, midiaRows, pedido, [], logoId);
  const productRefIds = refIds.filter((id) => id !== logoId);
  const heroProductId = pickHeroProductMidiaId(
    productRefIds.map((id) => midiaRows.find((r) => r.id_midia === id)).filter(Boolean),
    pedido,
  );
  const productMode = getImageProductMode();
  const integrated = usesGptIntegratedProducts(productMode);
  const gptInputIds = integrated
    ? orderGptImage2ReferenceIds(productRefIds, { heroProductId, logoId, logoAsHero: false })
    : productRefIds;

  return {
    refIds,
    productRefIds,
    heroProductId,
    composeProductAssets: integrated ? false : productRefIds.length > 0,
    gpt_input_ids: gptInputIds,
    product_mode: productMode,
    api_shape: integrated ? "images.edit" : "collage",
  };
}

function buildFlowReport(steps) {
  return JSON.stringify(steps, null, 2);
}

describe("fluxo completo — pedido creatina integral", () => {
  it("proposta → confirmação → prompt → refs usam marca, campanha e PNG certo", async (t) => {
    const { contextoRows, midiaRows, empresaRow } = creatinaFixtures();
    const db = createMockEmpresaDb({ contextoRows, midiaRows, empresaRow });
    const history = [{ role: "user", content: PEDIDO_CREATINA }];

    const steps = { pedido: PEDIDO_CREATINA };

    // 1) Proposta de confirmação (pipeline raw)
    const proposalOut = await generatePostContextProposal({
      history,
      idEmpresa: EMPRESA_ID,
      db,
    });
    steps.proposta = {
      briefing_status: proposalOut.briefing_status,
      blocked: proposalOut.briefing_status === "collecting" && proposalOut.missing_slots?.includes("midia_acervo"),
      confirmation_message: proposalOut.confirmation_message,
      links: (proposalOut.links || []).map((l) => ({ kind: l.kind, id: l.id, label: l.label })),
      meta: proposalOut._meta,
    };

    assert.equal(proposalOut.briefing_status, "ready", "briefing deve estar pronto");
    assert.equal(proposalOut.post_context_proposal?.product_media_status, "matched");

    const p = proposalOut.post_context_proposal;
    const refIds = (p.midias_referenced || []).map((r) => r.id_midia);
    steps.proposta.modo_produto = parseProductMentionSpec(PEDIDO_CREATINA).mode;
    steps.proposta.midias_referenced = p.midias_referenced;
    steps.proposta.hero_product = p.hero_product;
    steps.proposta.matched_contexto = p.matched_contexto;
    steps.proposta.resumo_visual = p.resumo_visual;
    steps.proposta.frase_na_imagem = p.frase_na_imagem;
    steps.proposta.arte_brief_cores = p.arte_brief?.cores;

    assert.equal(steps.proposta.modo_produto, "specific", "pedido cita creatina integral explicitamente");
    assert.equal(refIds.length, 1, "só a creatina pedida, não outras do acervo");
    assert.ok(refIds.includes(MID_CREATINA_INTEGRAL), "deve referenciar creatina integral");
    assert.equal(refIds.includes(MID_CREATINA_GROWTH), false, "não deve puxar creatina growth sem citar");
    assert.equal(refIds.includes(MID_MONSTER), false, "não deve puxar Monster");
    assert.equal(p.hero_product?.id_midia, MID_CREATINA_INTEGRAL);
    assert.match(String(p.resumo_visual ?? ""), /creatina/i);
    assert.doesNotMatch(String(p.resumo_visual ?? ""), /monster/i);

    const linkMidiaIds = (proposalOut.links || []).filter((l) => l.kind === "midia").map((l) => l.id);
    assert.deepEqual(linkMidiaIds, [MID_CREATINA_INTEGRAL]);

    // 2) Intenção confirmada + contexto de geração
    const imageIntent = buildConfirmedImageIntent({
      history,
      postContextProposal: p,
      contextoRows,
      midiaRows,
      focusContextoId: CTX_PROMO,
    });
    steps.intencao = {
      pedido: imageIntent.pedido,
      fraseNaImagem: imageIntent.fraseNaImagem,
      matchedContexto: imageIntent.matchedContexto?.nome,
      heroProduct: imageIntent.heroProduct,
      midias_count: imageIntent.postContextProposal.midias_referenced?.length,
    };

    assert.match(imageIntent.pedido, /creatina integral/i);
    assert.equal(imageIntent.matchedContexto, null);
    assert.equal(imageIntent.heroProduct?.id_midia, MID_CREATINA_INTEGRAL);

    const { identidadeDados } = partitionContextosIdentidade(contextoRows);
    const meta = buildImagePreviewContextMeta(
      EMPRESA_ID,
      empresaRow,
      contextoRows,
      imageIntent.postContextProposal,
      history,
      CTX_PROMO,
    );
    steps.meta_geracao = meta;

    assert.match(meta.pedido_resumo || "", /creatina/i);
    assert.equal(meta.contexto_prioritario, null);

    // 3) Prompt enviado ao gerador (sem chamar Replicate)
    const prompt = buildFluxImagePrompt({
      history,
      contextoRows,
      postContextProposal: imageIntent.postContextProposal,
      focusContextoId: CTX_PROMO,
      integratedProductGeneration: true,
      productNames: ["creatina integral"],
      logoInReferences: true,
      aspectRatio: "1:1",
      productCount: 1,
      pipeline: "raw",
    });
    steps.prompt = {
      length: prompt.length,
      trechos: {
        creatina: /creatina/i.test(prompt),
        official_shape: /reference pictures/i.test(prompt),
        promo_academias: /academia/i.test(prompt),
        logo_watermark: /watermark/i.test(prompt),
        sem_monster: !/monster/i.test(prompt),
        sem_colagem_sharp: !/MODO FUNDO PARA COLAGEM/i.test(prompt),
      },
    };

    assert.match(prompt, /creatina/i);
    assert.match(prompt, /reference pictures/i);
    assert.match(prompt, /academia/i);
    assert.match(prompt, /watermark/i);
    assert.doesNotMatch(prompt, /MODO FUNDO PARA COLAGEM/i);
    assert.doesNotMatch(prompt, /monster/i);

    // 4) Composição planejada (PNG + logo)
    const logoId = identidadeDados?.id_midia_logo ? String(identidadeDados.id_midia_logo) : "";
    const compose = simulatePreviewComposition(
      imageIntent.postContextProposal,
      midiaRows,
      imageIntent,
      logoId,
    );
    steps.composicao_planejada = compose;

    assert.deepEqual(compose.productRefIds, [MID_CREATINA_INTEGRAL]);
    assert.equal(compose.productRefIds.includes(MID_MONSTER), false);
    assert.equal(compose.heroProductId, MID_CREATINA_INTEGRAL);
    assert.equal(compose.composeProductAssets, false);
    assert.equal(compose.api_shape, "images.edit");
    assert.ok(compose.gpt_input_ids.includes(MID_CREATINA_INTEGRAL));
    assert.ok(compose.gpt_input_ids.includes(logoId));
    assert.equal(logoId, MID_LOGO);

    // 5) Acervo: só creatinas no pool estrito do pedido
    const { pool, strict } = narrowImageRowsByProductMention(
      midiaRows.filter((r) => r.tipo_midia === "imagem"),
      resolveActivePedidoHint(history),
    );
    steps.acervo_filtro = {
      strict,
      mode: parseProductMentionSpec(resolveActivePedidoHint(history)).mode,
      pool_ids: pool.map((r) => r.id_midia),
      best_id: pickBestProductMidiaId(pool, resolveActivePedidoHint(history)),
    };
    assert.equal(strict, true);
    assert.equal(steps.acervo_filtro.mode, "specific");
    assert.deepEqual(steps.acervo_filtro.pool_ids, [MID_CREATINA_INTEGRAL]);
    assert.equal(steps.acervo_filtro.best_id, MID_CREATINA_INTEGRAL);

    t.diagnostic(buildFlowReport(steps));
  });
});
