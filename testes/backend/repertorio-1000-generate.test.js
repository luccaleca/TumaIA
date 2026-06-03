import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateRepertorioCatalog } from "../../backend/scripts/lib/repertorioCatalog.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("repertório 1000", () => {
  it("catálogo gera pelo menos 1000 perguntas únicas", () => {
    const cat = generateRepertorioCatalog(1000);
    assert.ok(cat.length >= 1000, `esperado >= 1000, obteve ${cat.length}`);
    const uniq = new Set(cat.map((c) => c.pergunta.toLowerCase()));
    assert.equal(uniq.size, cat.length);
  });

  it("arquivos de saída existem após geração", () => {
    const json = path.join(ROOT, "docs/ia/repertorio-1000.json");
    const amostra = path.join(
      ROOT,
      "backend/ia/python/conversa/instrucoes/treino_repertorio_amostra.txt",
    );
    if (!fs.existsSync(json)) {
      console.warn("rode: npm run repertorio:1000");
      return;
    }
    const report = JSON.parse(fs.readFileSync(json, "utf8"));
    assert.ok(report.total >= 1000);
    assert.ok(report.perguntas_unicas >= 1000);
    assert.ok(fs.existsSync(amostra));
  });
});
