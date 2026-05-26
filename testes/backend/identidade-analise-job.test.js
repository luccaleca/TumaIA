import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeIdentidadeSugestaoJob,
  serializeIdentidadeAnaliseJobRow,
} from "../../backend/src/services/identidadeAnaliseJobService.js";

describe("identidadeAnaliseJobService", () => {
  it("mescla sugestão sem sobrescrever textos já preenchidos", () => {
    const merged = mergeIdentidadeSugestaoJob(
      {
        sobre_empresa: "Marca focada em performance.",
        cor_primaria: "#112233",
        id_midia_logo: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      {
        sobre_empresa: "Não deveria sobrescrever",
        tom_voz: "forte, direto",
        cor_primaria: "#FF3366",
        cor_secundaria: "#1B1B1B",
        cores_adicionais: ["#FFFFFF"],
        id_midia_referencia_analise: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
    );

    assert.equal(merged.sobre_empresa, "Marca focada em performance.");
    assert.equal(merged.tom_voz, "forte, direto");
    assert.equal(merged.id_midia_logo, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(merged.id_midia_referencia_analise, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    assert.ok(merged.cor_primaria);
  });

  it("serializa snapshot do job com progresso e completude", () => {
    const out = serializeIdentidadeAnaliseJobRow({
      id_identidade_analise_job: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "running",
      progresso_json: {
        fotoTotal: 3,
        fotoConcluidas: 1,
        fotoAtual: 2,
        fase: "foto",
        incluiSite: true,
        items: [{ id_midia: "m1", nome: "foto 1", status: "done" }],
      },
      dados_base_json: {},
      dados_resultado_json: {
        cor_primaria: "#00B341",
        estilo_visual: "premium",
        evitar: "poluição visual",
        tom_voz: "forte",
      },
      erro: null,
      data_criacao: "2026-01-01T00:00:00.000Z",
      data_atualizacao: "2026-01-01T00:00:01.000Z",
      data_inicio: "2026-01-01T00:00:02.000Z",
      data_fim: null,
    });

    assert.equal(out.id_job, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    assert.equal(out.progress.fotoTotal, 3);
    assert.equal(out.progress.incluiSite, true);
    assert.equal(out.progress.items.length, 1);
    assert.equal(out.completude.percentual, 100);
    assert.equal(out.completude.pronto_para_imagem, true);
  });
});
