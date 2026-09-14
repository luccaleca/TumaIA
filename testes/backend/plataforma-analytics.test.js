import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  brazilDowHourFromIso,
  dayKeyFromIso,
  previousDashboardRange,
  resolveDashboardRange,
} from "../../backend/src/modules/plataforma/dateRange.js";
import { listSqlPresets, SQL_PRESETS } from "../../backend/src/modules/plataforma/sqlPresets.js";

describe("plataforma dateRange — helpers analytics", () => {
  it("previousDashboardRange para 7 dias", () => {
    const range = resolveDashboardRange({ period: 7 });
    const prev = previousDashboardRange(range);
    assert.ok(prev.startIso);
    assert.ok(prev.endIsoExclusive);
    assert.equal(prev.endIsoExclusive, range.startIso);
  });

  it("dayKeyFromIso extrai YYYY-MM-DD", () => {
    assert.equal(dayKeyFromIso("2026-09-09T12:00:00.000Z"), "2026-09-09");
  });

  it("brazilDowHourFromIso devolve slot", () => {
    const slot = brazilDowHourFromIso("2026-09-09T15:30:00.000-03:00");
    assert.ok(slot);
    assert.ok(slot.dow >= 0 && slot.dow <= 6);
    assert.ok(slot.hour >= 0 && slot.hour <= 23);
  });
});

describe("plataforma sqlPresets", () => {
  it("lista presets conhecidos", () => {
    const { presets } = listSqlPresets();
    assert.ok(presets.length >= 6);
    assert.ok(SQL_PRESETS.some((p) => p.id === "empresas_ativas"));
    assert.ok(SQL_PRESETS.some((p) => p.id === "assinaturas"));
  });
});
