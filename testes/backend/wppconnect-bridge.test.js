import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWppconnectWebhookMessage } from "../../backend/src/services/wppconnectWebhookParser.js";
import request from "supertest";
import { createApp } from "../../backend/src/app.js";

describe("wppconnectWebhookParser", () => {
  it("parseia evento onmessage padrão", () => {
    const out = parseWppconnectWebhookMessage({
      event: "onmessage",
      session: "tumaia",
      from: "5511999887766@c.us",
      body: "quero um post de promoção",
      type: "chat",
      fromMe: false,
      isGroupMsg: false,
      id: "ABC123",
    });
    assert.ok(out);
    assert.equal(out.from, "5511999887766");
    assert.equal(out.chat_id, "5511999887766@c.us");
    assert.equal(out.body, "quero um post de promoção");
    assert.equal(out.message_id, "ABC123");
  });

  it("prefere telefone em sender.id quando from é @lid", () => {
    const out = parseWppconnectWebhookMessage({
      event: "onmessage",
      from: "123456789@lid",
      sender: { id: "5511999887766@c.us" },
      body: "oi",
      type: "chat",
      fromMe: false,
    });
    assert.ok(out);
    assert.equal(out.from, "5511999887766");
    assert.equal(out.chat_id, "5511999887766@c.us");
  });

  it("não usa dígitos de @lid como telefone de auth", () => {
    const out = parseWppconnectWebhookMessage({
      event: "onmessage",
      from: "169801683091677@lid",
      body: "oi",
      type: "chat",
      fromMe: false,
    });
    assert.ok(out);
    assert.equal(out.from, "");
    assert.equal(out.chat_id, "169801683091677@lid");
  });

  it("ignora mensagens enviadas pelo próprio bot", () => {
    const out = parseWppconnectWebhookMessage({
      event: "onmessage",
      from: "5511999887766@c.us",
      body: "eco",
      type: "chat",
      fromMe: true,
    });
    assert.ok(out);
    assert.equal(out.from_me, true);
  });

  it("ignora eventos que não são mensagem", () => {
    assert.equal(parseWppconnectWebhookMessage({ event: "onack" }), null);
  });
});

describe("HTTP /wppconnect", () => {
  const app = createApp();
  const wppEnabled = process.env.WPPCONNECT_ENABLED === "true";

  it("GET /status reflete WPPCONNECT_ENABLED do ambiente", async () => {
    const res = await request(app).get("/wppconnect/status");
    assert.equal(res.status, 200);
    assert.equal(res.body.enabled, wppEnabled);
  });

  it("POST /webhook responde conforme WPPCONNECT_ENABLED", async () => {
    const res = await request(app)
      .post("/wppconnect/webhook")
      .send({
        event: "onmessage",
        from: "5511999887766@c.us",
        body: "oi",
        type: "chat",
      });
    assert.equal(res.status, wppEnabled ? 200 : 503);
  });
});
