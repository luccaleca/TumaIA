import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POST_MODELOS_CATALOG,
  buildPlaybookDadosJson,
  getPostModeloBySlug,
  isPostModeloSlug,
  playbookSlugFromContextoRow,
  resolvePlaybookPromptFromContextoRow,
} from "../../backend/src/modules/empresas/postModelosCatalog.js";
import { mergePostModelosWithEmpresa } from "../../backend/src/services/postModelosService.js";

describe("postModelosCatalog", () => {
  it("expõe quatro modelos com slugs únicos", () => {
    assert.equal(POST_MODELOS_CATALOG.length, 4);
    const slugs = POST_MODELOS_CATALOG.map((m) => m.slug);
    assert.equal(new Set(slugs).size, 4);
    assert.ok(isPostModeloSlug("promocao"));
    assert.ok(isPostModeloSlug("produto"));
    assert.ok(isPostModeloSlug("mensagens"));
    assert.ok(!isPostModeloSlug("institucional"));
    assert.ok(!isPostModeloSlug("lifestyle"));
    assert.ok(!isPostModeloSlug("data_comemorativa"));
    assert.ok(!isPostModeloSlug("inexistente"));
  });

  it("getPostModeloBySlug retorna item com prompt_base", () => {
    const m = getPostModeloBySlug("lancamento");
    assert.ok(m);
    assert.match(m.prompt_base, /LANÇAMENTO/i);
    assert.ok(Array.isArray(m.enfase) && m.enfase.length >= 2);
  });

  it("buildPlaybookDadosJson marca playbook e copia campos", () => {
    const modelo = getPostModeloBySlug("promocao");
    const dados = buildPlaybookDadosJson(modelo);
    assert.equal(dados.playbook, true);
    assert.equal(dados.playbook_slug, "promocao");
    assert.equal(dados.tipo, "promocao");
    assert.ok(dados.prompt_base.length > 20);
  });

  it("playbookSlugFromContextoRow lê playbook_slug", () => {
    assert.equal(
      playbookSlugFromContextoRow({
        dados_json: { playbook: true, playbook_slug: "mensagens" },
      }),
      "mensagens",
    );
    assert.equal(playbookSlugFromContextoRow({ dados_json: { tipo: "promocao" } }), null);
  });

  it("playbookSlugFromContextoRow migra slug legado institucional para mensagens", () => {
    assert.equal(
      playbookSlugFromContextoRow({
        dados_json: { playbook: true, playbook_slug: "institucional" },
      }),
      "mensagens",
    );
  });

  it("playbookSlugFromContextoRow migra slugs legados para produto", () => {
    assert.equal(
      playbookSlugFromContextoRow({
        dados_json: { playbook: true, playbook_slug: "data_comemorativa" },
      }),
      "produto",
    );
    assert.equal(
      playbookSlugFromContextoRow({
        dados_json: { playbook: true, playbook_slug: "lifestyle" },
      }),
      "produto",
    );
  });

  it("resolvePlaybookPromptFromContextoRow usa dados_json ou catálogo", () => {
    const fromRow = resolvePlaybookPromptFromContextoRow({
      dados_json: {
        playbook: true,
        playbook_slug: "promocao",
        prompt_base: "Prompt custom salvo.",
      },
    });
    assert.equal(fromRow, "Prompt custom salvo.");
    const fromCatalog = resolvePlaybookPromptFromContextoRow({
      dados_json: { playbook: true, playbook_slug: "promocao", tipo: "promocao" },
    });
    assert.match(fromCatalog || "", /PROMOÇÃO/i);
  });
});

describe("mergePostModelosWithEmpresa", () => {
  it("marca ativo quando há registro boolean na empresa", () => {
    const merged = mergePostModelosWithEmpresa([
      {
        id_empresa_modelo_post: "mod-1",
        playbook_slug: "promocao",
        ativo: true,
      },
    ]);
    const promo = merged.find((m) => m.slug === "promocao");
    assert.equal(promo.ativo, true);
    assert.equal(promo.id_empresa_modelo_post, "mod-1");
    assert.equal(promo.id_contexto_empresa, "mod-1");
    const lanc = merged.find((m) => m.slug === "lancamento");
    assert.equal(lanc.ativo, false);
  });
});
