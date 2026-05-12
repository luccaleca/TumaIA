import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../../backend/src/app.js";

const app = createApp();

describe("HTTP /auth — validação de payload (sem Supabase)", () => {

  it("POST /auth/register retorna 400 quando o body não passa no schema", async () => {
    const res = await request(app)
      .post("/auth/register")
      .set("Content-Type", "application/json")
      .send({ nome: "", email: "a@b.co", senha: "12345678" });

    assert.equal(res.status, 400);
    assert.ok(res.body && typeof res.body === "object");
    assert.ok("error" in res.body);
  });

  it("POST /auth/register retorna 400 quando faltam campos obrigatórios", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "so@email.com" });

    assert.equal(res.status, 400);
    assert.ok(res.body?.error);
  });

  it("POST /auth/login retorna 400 quando o body não passa no schema", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: "ok@exemplo.com" });

    assert.equal(res.status, 400);
    assert.ok(res.body?.error);
  });

  it("POST /auth/login retorna 400 para senha vazia após trim", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "ok@exemplo.com", senha: "   " });

    assert.equal(res.status, 400);
  });
});
