import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPlaybookContextoRow,
  mergePostModelosWithEmpresa,
} from "../../backend/src/services/postModelosService.js";
import { POST_MODELO_SLUGS } from "../../backend/src/modules/empresas/postModelosCatalog.js";

describe("postModelosService", () => {
  it("buildPlaybookContextoRow monta linha compatível com contexto_empresa", () => {
    const row = buildPlaybookContextoRow({
      id_empresa_modelo_post: "11111111-1111-4111-8111-111111111111",
      playbook_slug: "mensagens",
      ativo: true,
      data_criacao: "2026-01-01T00:00:00.000Z",
    });
    assert.ok(row);
    assert.equal(row.id_contexto_empresa, "11111111-1111-4111-8111-111111111111");
    assert.equal(row.nome, "Mensagens");
    assert.equal(row.dados_json.playbook_slug, "mensagens");
    assert.match(row.dados_json.prompt_base, /MENSAGENS/i);
  });

  it("buildPlaybookContextoRow retorna null se inativo", () => {
    assert.equal(
      buildPlaybookContextoRow({
        id_empresa_modelo_post: "x",
        playbook_slug: "promocao",
        ativo: false,
      }),
      null,
    );
  });

  it("mergePostModelosWithEmpresa ignora slug desconhecido", () => {
    const merged = mergePostModelosWithEmpresa([
      { id_empresa_modelo_post: "a", playbook_slug: "inexistente", ativo: true },
    ]);
    assert.equal(merged.every((m) => !m.ativo), true);
  });

  it("mergePostModelosWithEmpresa expõe id mesmo com modelo desligado", () => {
    const merged = mergePostModelosWithEmpresa([
      { id_empresa_modelo_post: "mod-2", playbook_slug: "lancamento", ativo: false },
    ]);
    const lanc = merged.find((m) => m.slug === "lancamento");
    assert.equal(lanc.ativo, false);
    assert.equal(lanc.id_empresa_modelo_post, "mod-2");
  });

  it("POST_MODELO_SLUGS cobre os quatro modelos do catálogo", () => {
    assert.deepEqual(POST_MODELO_SLUGS, ["promocao", "lancamento", "produto", "mensagens"]);
  });
});
