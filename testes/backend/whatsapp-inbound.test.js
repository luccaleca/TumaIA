import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPlausibleAuthPhone,
} from "../../backend/src/services/whatsappPhoneAuth.js";
import { telefonesUsuarioMatch } from "../../backend/src/services/whatsappUsuarioEmpresa.js";
import {
  isTelefoneUsuarioValido,
  normalizeTelefoneUsuario,
  telefoneUsuarioParaDb,
} from "../../backend/src/modules/auth/telefoneUsuario.js";
import { parseTypedDeliveryCommand } from "../../backend/src/services/chatDeliveryCommands.js";
import {
  clearAllWhatsappSessions,
  getOrCreateWhatsappSession,
} from "../../backend/src/services/whatsappSessionStore.js";

const EMPRESA_ID = "11111111-1111-4111-8111-111111111111";
const PHONE = "11999887766";

describe("telefoneUsuario", () => {
  it("normaliza para dígitos", () => {
    assert.equal(normalizeTelefoneUsuario("+55 (11) 99988-7766"), "5511999887766");
    assert.equal(normalizeTelefoneUsuario("(11) 99988-7766"), PHONE);
    assert.equal(telefoneUsuarioParaDb("(11) 99988-7766"), PHONE);
  });

  it("valida mínimo de dígitos", () => {
    assert.equal(isTelefoneUsuarioValido("11999887766"), true);
    assert.equal(isTelefoneUsuarioValido("123"), false);
  });
});

describe("isPlausibleAuthPhone", () => {
  it("aceita telefone BR e rejeita @lid", () => {
    assert.equal(isPlausibleAuthPhone("5511999887766"), true);
    assert.equal(isPlausibleAuthPhone("11999887766"), true);
    assert.equal(isPlausibleAuthPhone("169801683091677"), false);
  });
});

describe("telefonesUsuarioMatch", () => {
  it("aceita variações com/sem 55", () => {
    assert.equal(telefonesUsuarioMatch("5511999887766", "11999887766"), true);
    assert.equal(telefonesUsuarioMatch("5511888776655", PHONE), false);
  });
});

describe("chatDeliveryCommands (backend)", () => {
  it("reconhece comandos de entrega no WhatsApp", () => {
    assert.deepEqual(parseTypedDeliveryCommand("gerar imagem"), { type: "generate_image" });
  });
});

describe("whatsappSessionStore", () => {
  it("mantém histórico por telefone", () => {
    clearAllWhatsappSessions();
    getOrCreateWhatsappSession(PHONE, EMPRESA_ID).history.push({ role: "user", content: "oi" });
    assert.equal(getOrCreateWhatsappSession(PHONE, EMPRESA_ID).history.length, 1);
    clearAllWhatsappSessions();
  });
});
