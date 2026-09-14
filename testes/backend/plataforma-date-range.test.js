import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countDaysInclusive,
  resolveDashboardRange,
  shiftYmd,
} from "../../backend/src/modules/plataforma/dateRange.js";

describe("plataforma dateRange", () => {
  it("resolve period 7 como últimos 7 dias civis", () => {
    const r = resolveDashboardRange({ period: "7" });
    assert.equal(r.period, 7);
    assert.equal(r.isRolling24h, false);
    assert.equal(countDaysInclusive(r.from, r.to), 7);
    assert.match(r.label, /7 dias/i);
  });

  it("period 1 usa janela rolante de 24h", () => {
    const r = resolveDashboardRange({ period: 1 });
    assert.equal(r.period, 1);
    assert.equal(r.isRolling24h, true);
    assert.ok(new Date(r.endIsoExclusive) > new Date(r.startIso));
  });

  it("aceita from/to customizado", () => {
    const r = resolveDashboardRange({ from: "2026-01-01", to: "2026-01-10" });
    assert.equal(r.mode, "custom");
    assert.equal(r.from, "2026-01-01");
    assert.equal(r.to, "2026-01-10");
    assert.equal(countDaysInclusive(r.from, r.to), 10);
  });

  it("shiftYmd avança e retrocede", () => {
    assert.equal(shiftYmd("2026-01-10", -1), "2026-01-09");
    assert.equal(shiftYmd("2026-01-10", 1), "2026-01-11");
  });
});
