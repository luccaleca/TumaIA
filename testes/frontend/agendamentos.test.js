import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatarDataAgendamento,
  infoStatusAgendamento,
  ordenarAgendamentos,
  podeCancelarAgendamento,
} from "../../frontend/lib/agendamentos.js";

describe("agendamentos (tela Agendados)", () => {
  it("só dá para cancelar o que ainda está agendado", () => {
    assert.equal(podeCancelarAgendamento("agendado"), true);
    for (const s of ["publicando", "publicado", "falhou", "cancelado"]) {
      assert.equal(podeCancelarAgendamento(s), false);
    }
  });

  it("rótulo de cada status e fallback para status desconhecido", () => {
    assert.equal(infoStatusAgendamento("falhou").rotulo, "Falhou");
    assert.equal(infoStatusAgendamento("publicado").rotulo, "Publicado");
    assert.equal(infoStatusAgendamento("xyz").rotulo, "xyz");
  });

  it("próximos a publicar vêm primeiro, do mais cedo; o histórico depois, do mais recente", () => {
    const lista = [
      { id: "h-antigo", status: "publicado", agendada_para: "2026-10-01T10:00:00Z" },
      { id: "p-tarde", status: "agendado", agendada_para: "2026-10-09T10:00:00Z" },
      { id: "h-novo", status: "falhou", agendada_para: "2026-10-05T10:00:00Z" },
      { id: "p-cedo", status: "agendado", agendada_para: "2026-10-07T10:00:00Z" },
    ];
    assert.deepEqual(
      ordenarAgendamentos(lista).map((a) => a.id),
      ["p-cedo", "p-tarde", "h-novo", "h-antigo"],
    );
    assert.deepEqual(ordenarAgendamentos(null), []);
  });

  it("data inválida não quebra a tela", () => {
    assert.equal(formatarDataAgendamento("lixo"), "—");
    assert.match(formatarDataAgendamento("2026-10-06T18:30:00Z"), /\d{2}\/\d{2}\/\d{4}/);
  });
});
