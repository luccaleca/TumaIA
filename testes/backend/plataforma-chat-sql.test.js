import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateSelectOnly,
  processChatSqlMessage,
  SUGESTOES_CHAT_SQL,
} from "../../backend/src/modules/plataforma/chatSqlService.js";

describe("plataforma — Chat SQL", () => {
  it("valida e aceita somente consultas SELECT e WITH ... SELECT", () => {
    assert.equal(
      validateSelectOnly("SELECT * FROM public.empresa"),
      "SELECT * FROM public.empresa",
    );
    assert.equal(
      validateSelectOnly("WITH ativas AS (SELECT id_empresa FROM empresa) SELECT * FROM ativas;"),
      "WITH ativas AS (SELECT id_empresa FROM empresa) SELECT * FROM ativas",
    );
  });

  it("rejeita queries destrutivas de escrita ou DDL", () => {
    assert.throws(() => validateSelectOnly("DELETE FROM public.empresa"), /apenas consultas SELECT/i);
    assert.throws(() => validateSelectOnly("DROP TABLE public.empresa"), /apenas consultas SELECT/i);
    assert.throws(() => validateSelectOnly("UPDATE empresa SET ativo = false"), /apenas consultas SELECT/i);
    assert.throws(() => validateSelectOnly("INSERT INTO empresa (nome) VALUES ('x')"), /apenas consultas SELECT/i);
    assert.throws(() => validateSelectOnly("SELECT 1; SELECT 2;"), /apenas uma instrução SQL/i);
  });

  it("processa pergunta em linguagem natural sobre status de empresas", async () => {
    const res = await processChatSqlMessage({
      message: "Quantas empresas temos cadastradas e qual o status delas?",
    });
    assert.equal(res.ok, true);
    assert.ok(typeof res.answer === "string" && res.answer.length > 0);
    assert.ok(typeof res.sql === "string" && res.sql.includes("SELECT"));
    assert.ok(Array.isArray(res.columns));
    assert.ok(Array.isArray(res.rows));
    assert.ok(typeof res.executionMs === "number");
  });

  it("processa pergunta sobre usuários recentes", async () => {
    const res = await processChatSqlMessage({
      message: "Quais são os usuários cadastrados recentemente?",
    });
    assert.equal(res.ok, true);
    assert.ok(res.sql.includes("usuario"));
    assert.ok(Array.isArray(res.columns));
    assert.ok(res.columns.includes("email"));
  });

  it("processa SQL direto com segurança", async () => {
    const res = await processChatSqlMessage({
      message: "SELECT nome_fantasia, segmento, ativo FROM public.empresa LIMIT 5;",
    });
    assert.equal(res.ok, true);
    assert.ok(res.sql.includes("SELECT"));
    assert.ok(Array.isArray(res.rows));
  });

  it("exporta sugestões de perguntas para a UI", () => {
    assert.ok(Array.isArray(SUGESTOES_CHAT_SQL));
    assert.ok(SUGESTOES_CHAT_SQL.length >= 5);
  });
});
