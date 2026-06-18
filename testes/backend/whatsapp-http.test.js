import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../../backend/src/app.js";

const app = createApp();
const SECRET = process.env.INTERNAL_WEBHOOK_SECRET || "test-internal-secret-for-whatsapp";

describe("HTTP /internal/whatsapp", () => {
  it("POST /message rejeita sem segredo interno", async () => {
    const res = await request(app)
      .post("/internal/whatsapp/message")
      .send({ from: "5511999887766", body: "oi" });
    assert.ok([401, 503].includes(res.status));
  });

  it("POST /message retorna 400 com body inválido", async () => {
    const res = await request(app)
      .post("/internal/whatsapp/message")
      .set("x-internal-secret", SECRET)
      .send({ from: "5511999887766" });
    assert.equal(res.status, 400);
  });

  it("POST /message retorna 403 quando telefone não cadastrado (ou 503/500 sem DB)", async () => {
    const res = await request(app)
      .post("/internal/whatsapp/message")
      .set("x-internal-secret", SECRET)
      .send({ from: "5511999887766", body: "quero um post de promoção" });
    assert.ok([403, 503, 500].includes(res.status));
    assert.ok(res.body?.error);
  });
});
