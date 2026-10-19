import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendWhatsappTurn,
  clearAllWhatsappSessions,
  getOrCreateWhatsappSession,
  patchWhatsappSession,
} from "../../backend/src/services/whatsappSessionStore.js";

const PIZZARIA = "11111111-1111-4111-8111-111111111111";
const WAY_BEER = "22222222-2222-4222-8222-222222222222";
const PHONE = "5511900000000";

afterEach(() => clearAllWhatsappSessions());

describe("sessão do WhatsApp e troca de empresa", () => {
  it("na mesma empresa, a sessão continua e guarda o histórico", () => {
    const a = getOrCreateWhatsappSession(PHONE, PIZZARIA);
    appendWhatsappTurn(a, "oi", "Oi! Sou o Tuma IA, assistente da Pizzaria.");
    const b = getOrCreateWhatsappSession(PHONE, PIZZARIA);
    assert.equal(b, a);
    assert.equal(b.history.length, 2);
  });

  it("ao trocar de empresa, recomeça do zero e não leva o histórico da marca anterior", () => {
    const antiga = getOrCreateWhatsappSession(PHONE, WAY_BEER);
    appendWhatsappTurn(antiga, "oi", "Oi! Sou o Tuma IA, assistente de criação de artes da Way Beer.");
    patchWhatsappSession(antiga, {
      estado: "ready_for_image",
      post_context_proposal: { intent_summary: "cervejas" },
      last_caption: "legenda da Way Beer #WayBeer",
    });

    const nova = getOrCreateWhatsappSession(PHONE, PIZZARIA);
    assert.notEqual(nova, antiga);
    assert.equal(nova.id_empresa, PIZZARIA);
    assert.deepEqual(nova.history, []);
    assert.equal(nova.estado, "idle");
    assert.equal(nova.post_context_proposal, null);
    assert.equal(nova.last_caption, null);
  });

  it("depois da troca, a sessão nova é a que continua valendo", () => {
    getOrCreateWhatsappSession(PHONE, WAY_BEER);
    const nova = getOrCreateWhatsappSession(PHONE, PIZZARIA);
    appendWhatsappTurn(nova, "faz um post", "ok");
    const outraVez = getOrCreateWhatsappSession(PHONE, PIZZARIA);
    assert.equal(outraVez, nova);
    assert.equal(outraVez.history.length, 2);
  });

  it("telefones diferentes têm sessões separadas, cada um na sua empresa", () => {
    const a = getOrCreateWhatsappSession("5511900000001", PIZZARIA);
    const b = getOrCreateWhatsappSession("5511900000002", WAY_BEER);
    assert.notEqual(a, b);
    assert.equal(a.id_empresa, PIZZARIA);
    assert.equal(b.id_empresa, WAY_BEER);
  });
});
