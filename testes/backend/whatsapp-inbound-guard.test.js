import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInboundGuard } from "../../backend/src/services/whatsappInboundGuard.js";

const AGORA = Date.parse("2026-10-19T19:00:00.000Z");
const segundos = (msAtras) => String(Math.floor((AGORA - msAtras) / 1000));
const MIN = 60_000;

function guard(opts = {}) {
  return createInboundGuard({ now: () => AGORA, ...opts });
}

describe("whatsappInboundGuard — mensagens velhas", () => {
  it("aceita mensagem recente", () => {
    assert.deepEqual(guard().check({ message_id: "a", timestamp: segundos(5_000) }), { ok: true });
  });

  it("descarta mensagem mais velha que o limite (a Meta reentrega eventos de dias atrás)", () => {
    const r = guard().check({ message_id: "velha", timestamp: segundos(14 * 24 * 60 * MIN) });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "stale");
    assert.ok(r.idadeMs > 10 * MIN);
  });

  it("o limite é configurável e 0 desliga o filtro de idade", () => {
    const antiga = { message_id: "x", timestamp: segundos(60 * MIN) };
    assert.equal(guard({ maxAgeMs: 2 * 60 * MIN }).check(antiga).ok, true);
    assert.equal(guard({ maxAgeMs: 30 * MIN }).check(antiga).ok, false);
    assert.equal(guard({ maxAgeMs: 0 }).check(antiga).ok, true);
  });

  it("sem horário válido ou com horário no futuro, não descarta", () => {
    const g = guard();
    assert.equal(g.check({ message_id: "1", timestamp: "" }).ok, true);
    assert.equal(g.check({ message_id: "2", timestamp: "lixo" }).ok, true);
    assert.equal(g.check({ message_id: "3", timestamp: String(Math.floor(AGORA / 1000) + 3600) }).ok, true);
  });
});

describe("whatsappInboundGuard — mensagens repetidas", () => {
  it("a mesma mensagem reentregue só passa uma vez", () => {
    const g = guard();
    const msg = { message_id: "wamid.1", timestamp: segundos(1_000) };
    assert.equal(g.check(msg).ok, true);
    const segunda = g.check(msg);
    assert.equal(segunda.ok, false);
    assert.equal(segunda.reason, "duplicate");
  });

  it("mensagens diferentes não se bloqueiam, mesmo com o mesmo texto", () => {
    const g = guard();
    assert.equal(g.check({ message_id: "wamid.1", timestamp: segundos(1_000) }).ok, true);
    assert.equal(g.check({ message_id: "wamid.2", timestamp: segundos(1_000) }).ok, true);
  });

  it("mensagem sem id não é bloqueada como repetida", () => {
    const g = guard();
    assert.equal(g.check({ timestamp: segundos(1_000) }).ok, true);
    assert.equal(g.check({ timestamp: segundos(1_000) }).ok, true);
  });

  it("depois do prazo guardado, o id é esquecido", () => {
    let agora = AGORA;
    const g = createInboundGuard({ now: () => agora, ttlMs: 1000, maxAgeMs: 0 });
    assert.equal(g.check({ message_id: "z" }).ok, true);
    assert.equal(g.check({ message_id: "z" }).ok, false);
    agora += 2000;
    assert.equal(g.check({ message_id: "z" }).ok, true);
  });

  it("não cresce sem limite: ao passar do máximo, esquece o mais antigo", () => {
    const g = guard({ maxEntries: 3, maxAgeMs: 0 });
    for (const id of ["a", "b", "c", "d"]) g.check({ message_id: id });
    assert.equal(g.check({ message_id: "a" }).ok, true, "«a» já saiu da memória");
    assert.equal(g.check({ message_id: "d" }).ok, false, "«d» ainda está guardado");
  });

  it("mensagem descartada por ser velha não ocupa memória de repetidas", () => {
    const g = guard();
    const velha = { message_id: "v", timestamp: segundos(60 * MIN) };
    assert.equal(g.check(velha).reason, "stale");
    assert.equal(g.check(velha).reason, "stale");
  });
});
