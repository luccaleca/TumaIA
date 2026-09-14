import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDonoPlataforma,
  parsePlataformaAdminEmails,
  withDonoPlataformaFlag,
} from "../../backend/src/modules/auth/plataformaAdmin.js";
import {
  TUMA_PLATAFORMA_ALLOWLIST,
  TUMA_PLATAFORMA_ALLOWLIST_CSV as ALLOWLIST_CSV,
} from "./helpers/plataformaAllowlist.js";

describe("plataformaAdmin — dono da plataforma (TumaCore)", () => {
  it("parseia allowlist por vírgula", () => {
    assert.deepEqual(parsePlataformaAdminEmails("a@x.com, B@Y.COM ;c@z.com"), [
      "a@x.com",
      "b@y.com",
      "c@z.com",
    ]);
  });

  it("reconhece cada um dos cinco e-mails privilegiados", () => {
    for (const email of TUMA_PLATAFORMA_ALLOWLIST) {
      assert.equal(
        isDonoPlataforma({ email }, ALLOWLIST_CSV),
        true,
        `esperado dono: ${email}`,
      );
      assert.equal(
        withDonoPlataformaFlag({ email, nome: "Tuma" }, ALLOWLIST_CSV).dono_plataforma,
        true,
        `flag dono_plataforma para ${email}`,
      );
    }
  });

  it("reconhece privilegiado com variação de maiúsculas", () => {
    assert.equal(
      isDonoPlataforma(
        { email: "LuccaProgramacao@Gmail.COM" },
        ALLOWLIST_CSV,
      ),
      true,
    );
  });

  it("nega usuário comum fora da allowlist", () => {
    assert.equal(
      isDonoPlataforma({ email: "cliente@loja.com" }, ALLOWLIST_CSV),
      false,
    );
    assert.equal(
      isDonoPlataforma({ email: "luccaleca@gmail.com" }, ALLOWLIST_CSV),
      false,
    );
  });

  it("não autoriza por domínio de e-mail", () => {
    assert.equal(
      isDonoPlataforma({ email: "qualquer@tumaia.com" }, ALLOWLIST_CSV),
      false,
    );
    assert.equal(
      isDonoPlataforma({ email: "staff@gmail.com" }, ALLOWLIST_CSV),
      false,
    );
  });

  it("libera por flag dono_plataforma mesmo fora da lista", () => {
    const u = { email: "cliente@loja.com", dono_plataforma: true };
    assert.equal(isDonoPlataforma(u, ""), true);
  });

  it("ignora flag dono_plataforma falsa / string do cliente", () => {
    assert.equal(
      isDonoPlataforma(
        { email: "cliente@loja.com", dono_plataforma: false },
        ALLOWLIST_CSV,
      ),
      false,
    );
    assert.equal(
      isDonoPlataforma(
        { email: "cliente@loja.com", dono_plataforma: "true" },
        ALLOWLIST_CSV,
      ),
      false,
    );
  });

  it("nega sem e-mail e sem flag", () => {
    assert.equal(isDonoPlataforma({ nome: "X" }, ALLOWLIST_CSV), false);
    assert.equal(isDonoPlataforma(null, ALLOWLIST_CSV), false);
  });

  it("withDonoPlataformaFlag anexa boolean sem apagar campos", () => {
    const out = withDonoPlataformaFlag(
      { id_usuario: "1", email: "a@b.com", nome: "A" },
      "a@b.com",
    );
    assert.equal(out.dono_plataforma, true);
    assert.equal(out.nome, "A");
    assert.equal(out.id_usuario, "1");
  });

  it("withDonoPlataformaFlag marca false para cliente", () => {
    const out = withDonoPlataformaFlag(
      { id_usuario: "2", email: "cliente@loja.com", nome: "Cliente" },
      ALLOWLIST_CSV,
    );
    assert.equal(out.dono_plataforma, false);
  });
});
