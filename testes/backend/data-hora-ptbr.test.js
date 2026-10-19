import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { interpretarDataHoraBrasil, rotuloBrasilia } from "../../backend/src/services/dataHoraPtBr.js";

// Quarta, 21/10/2026, 15:00 em Brasília (= 18:00 UTC).
const AGORA = new Date("2026-10-21T18:00:00.000Z");
const ok = (txt) => interpretarDataHoraBrasil(txt, AGORA);
const isoBR = (r) => new Date(r.instante.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 16);

describe("interpretarDataHoraBrasil — formatos de dia", () => {
  it("amanhã 18h", () => {
    const r = ok("amanhã 18h");
    assert.equal(r.ok, true);
    assert.equal(isoBR(r), "2026-10-22T18:00");
    assert.equal(r.iso, "2026-10-22T21:00:00.000Z");
  });

  it("hoje, com hora ainda por vir", () => {
    assert.equal(isoBR(ok("hoje 20:15")), "2026-10-21T20:15");
  });

  it("data dd/mm e dd/mm/aaaa", () => {
    assert.equal(isoBR(ok("25/10 14:30")), "2026-10-25T14:30");
    assert.equal(isoBR(ok("5/11/2026 9h")), "2026-11-05T09:00");
    assert.equal(isoBR(ok("05/11/26 9h")), "2026-11-05T09:00");
  });

  it("dia da semana: a próxima ocorrência", () => {
    assert.equal(isoBR(ok("sexta 9h")), "2026-10-23T09:00");
    assert.equal(isoBR(ok("Sábado-feira às 10")), "2026-10-24T10:00");
    assert.equal(isoBR(ok("segunda 8h")), "2026-10-26T08:00");
  });

  it("o dia da semana de hoje: hoje se o horário ainda vem, senão a semana que vem", () => {
    assert.equal(isoBR(ok("quarta 18h")), "2026-10-21T18:00");
    assert.equal(isoBR(ok("quarta 9h")), "2026-10-28T09:00");
    assert.equal(isoBR(ok("terça 9h")), "2026-10-27T09:00");
  });

  it("vira o mês e o ano corretamente", () => {
    const r = interpretarDataHoraBrasil("amanhã 10h", new Date("2026-12-31T20:00:00.000Z"));
    assert.equal(isoBR(r), "2027-01-01T10:00");
  });
});

describe("interpretarDataHoraBrasil — formatos de hora", () => {
  it("18h, 18h30, 18:30, 9 horas e «às 18»", () => {
    assert.equal(isoBR(ok("amanhã 18h")), "2026-10-22T18:00");
    assert.equal(isoBR(ok("amanhã 18h30")), "2026-10-22T18:30");
    assert.equal(isoBR(ok("amanhã 18:30")), "2026-10-22T18:30");
    assert.equal(isoBR(ok("amanhã 9 horas")), "2026-10-22T09:00");
    assert.equal(isoBR(ok("amanhã às 18")), "2026-10-22T18:00");
  });
});

describe("interpretarDataHoraBrasil — recusas com mensagem clara", () => {
  it("sem texto, sem hora, sem dia", () => {
    assert.match(ok("").motivo, /quando publicar/);
    assert.match(ok("amanhã").motivo, /Faltou a hora/);
    assert.match(ok("18h").motivo, /Faltou o dia/);
  });

  it("horário que já passou ou muito perto", () => {
    assert.match(ok("hoje 9h").motivo, /já passou/);
    assert.match(ok("hoje 15h").motivo, /já passou/);
    assert.match(ok("21/10 8h").motivo, /já passou/);
  });

  it("data e hora que não existem", () => {
    assert.match(ok("31/02 10h").motivo, /não existe/);
    assert.match(ok("amanhã 25h").motivo, /hora não existe/);
    assert.match(ok("amanhã 10:75").motivo, /hora não existe/);
  });

  it("o relógio do cliente é o de Brasília, não o UTC", () => {
    // 02:00 UTC de quinta ainda é quarta, 23h, em Brasília: «amanhã» é quinta 22/10, e não sexta.
    const r = interpretarDataHoraBrasil("amanhã 8h", new Date("2026-10-22T02:00:00.000Z"));
    assert.equal(r.ok, true);
    assert.equal(r.iso, "2026-10-22T11:00:00.000Z");
    assert.equal(r.rotulo, "quinta, 22/10 às 08:00");
  });
});

describe("rotuloBrasilia", () => {
  it("escreve o dia da semana, a data e a hora no horário de Brasília", () => {
    assert.equal(rotuloBrasilia(new Date("2026-10-23T12:00:00.000Z")), "sexta, 23/10 às 09:00");
  });
});
