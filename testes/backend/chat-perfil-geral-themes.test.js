import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PERFIL_GERAL_THEMES,
  classifyPerfilGeralTheme,
} from "../../backend/src/services/chatPerfilGeralThemes.js";
import { generatePerfilGeralQuestionCatalog } from "../../backend/scripts/lib/perfilGeralQuestionCatalog.mjs";

describe("perfil geral — catálogo de temas", () => {
  it("define pelo menos 30 famílias de tema", () => {
    assert.ok(PERFIL_GERAL_THEMES.length >= 30);
  });

  it("gera 1000+ perguntas de treino", () => {
    const catalog = generatePerfilGeralQuestionCatalog(1000);
    assert.ok(catalog.length >= 1000);
    const cats = new Set(catalog.map((c) => c.categoria));
    assert.ok(cats.size >= 25);
  });

  it("classifica temas variados (não só criador)", () => {
    assert.equal(classifyPerfilGeralTheme("você é burro"), "PROVOCACAO_INSULTO");
    assert.equal(classifyPerfilGeralTheme("qual modelo voce usa"), "TECNOLOGIA_MODELO");
    assert.equal(classifyPerfilGeralTheme("você grava a conversa"), "PRIVACIDADE_DADOS");
    assert.equal(classifyPerfilGeralTheme("o que você não pode fazer"), "LIMITES_CAPACIDADE");
  });
});
