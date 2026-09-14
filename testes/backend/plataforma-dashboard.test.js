import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApp } from "../../backend/src/app.js";
import { env } from "../../backend/src/config.js";
import { TUMA_PLATAFORMA_ALLOWLIST } from "./helpers/plataformaAllowlist.js";

describe("plataforma routes — montagem", () => {
  it("createApp registra app Express", () => {
    const app = createApp();
    assert.ok(app);
    assert.equal(typeof app.handle, "function");
  });
});

describe("requireDonoPlataforma", () => {
  it("bloqueia 403 quando usuário não é dono", async () => {
    const { requireDonoPlataforma } = await import(
      "../../backend/src/middleware/requireDonoPlataforma.js"
    );
    const req = { usuario: { email: "cliente@loja.com" } };
    let status = 0;
    let body = null;
    const res = {
      status(code) {
        status = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    };
    let nextCalled = false;
    requireDonoPlataforma(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(status, 403);
    assert.match(String(body?.error || ""), /TumaCore/i);
  });

  it("bloqueia 403 para administrador de empresa fora da allowlist", async () => {
    const { requireDonoPlataforma } = await import(
      "../../backend/src/middleware/requireDonoPlataforma.js"
    );
    const req = {
      usuario: {
        email: "admin-empresa@cliente.com",
        // cargo de empresa não concede plataforma
        cargo: "administrador",
        dono_plataforma: false,
      },
    };
    let status = 0;
    const res = {
      status(code) {
        status = code;
        return this;
      },
      json() {
        return this;
      },
    };
    let nextCalled = false;
    requireDonoPlataforma(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(status, 403);
  });

  it("libera next() para cada e-mail da allowlist configurada", async () => {
    const configured = String(env.TUMAIA_PLATAFORMA_ADMIN_EMAILS || "")
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    for (const email of TUMA_PLATAFORMA_ALLOWLIST) {
      assert.ok(
        configured.includes(email),
        `TUMAIA_PLATAFORMA_ADMIN_EMAILS deve incluir ${email}`,
      );
    }

    const { requireDonoPlataforma } = await import(
      "../../backend/src/middleware/requireDonoPlataforma.js"
    );

    for (const email of TUMA_PLATAFORMA_ALLOWLIST) {
      const req = { usuario: { email } };
      let nextCalled = false;
      let status = 0;
      const res = {
        status(code) {
          status = code;
          return this;
        },
        json() {
          return this;
        },
      };
      requireDonoPlataforma(req, res, () => {
        nextCalled = true;
      });
      assert.equal(nextCalled, true, `middleware deve liberar ${email}`);
      assert.equal(status, 0);
    }
  });
});
