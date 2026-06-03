/**
 * Gera 1000+ contextualizações pergunta → resposta para treino do Tuma IA.
 *
 *   node backend/scripts/gerar-repertorio-1000.mjs
 *   node backend/scripts/gerar-repertorio-1000.mjs --target 1200
 *   node backend/scripts/gerar-repertorio-1000.mjs --llm --llm-limit 50
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { generateRepertorioCatalog, generateMultiTurnSessions } from "./lib/repertorioCatalog.mjs";
import {
  simulateTurn,
  auditAnswer,
  buildTreinoTxt,
  buildStratifiedSample,
} from "./lib/repertorioSimulate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

function escCsv(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      target: { type: "string", default: "1000" },
      llm: { type: "boolean", default: false },
      "llm-limit": { type: "string", default: "0" },
      "sample-size": { type: "string", default: "150" },
    },
  });

  const target = Math.max(1000, parseInt(values.target, 10) || 1000);
  const sampleSize = Math.max(80, parseInt(values["sample-size"], 10) || 150);
  const useLlm = values.llm;
  const llmLimit = parseInt(values["llm-limit"], 10) || 0;
  let llmUsed = 0;

  const catalog = generateRepertorioCatalog(target);
  const sessions = generateMultiTurnSessions(120);

  console.log(`Catálogo: ${catalog.length} perguntas únicas + ${sessions.length} sessões multi-turno`);

  /** @type {Array<Record<string, unknown>>} */
  const entries = [];
  let id = 0;

  for (const { categoria, pergunta } of catalog) {
    id += 1;
    const wantLlm = useLlm && (llmLimit <= 0 || llmUsed < llmLimit);
    const out = await simulateTurn(pergunta, [], { useLlm: wantLlm, categoria });
    if (wantLlm && out.source === "llm") llmUsed += 1;
    const issues = auditAnswer(out.answer, pergunta);
    entries.push({
      id,
      categoria,
      session: "single",
      question: pergunta,
      history: [],
      ...out,
      issues,
      ok: issues.length === 0,
    });
    if (id % 100 === 0) console.log(`  ${id}/${catalog.length}...`);
  }

  for (const session of sessions) {
    const history = [];
    for (const pergunta of session) {
      id += 1;
      const out = await simulateTurn(pergunta, history, { useLlm: false, categoria: "MULTI_TURNO" });
      const issues = auditAnswer(out.answer, pergunta);
      entries.push({
        id,
        categoria: "MULTI_TURNO",
        session: session.join(" → "),
        question: pergunta,
        history: [...history],
        ...out,
        issues,
        ok: issues.length === 0,
      });
      history.push({ role: "user", content: pergunta });
      history.push({ role: "assistant", content: out.answer });
    }
  }

  const okCount = entries.filter((e) => e.ok).length;
  const byRoute = {};
  const byCat = {};
  for (const e of entries) {
    byRoute[e.route] = (byRoute[e.route] || 0) + 1;
    byCat[e.categoria] = (byCat[e.categoria] || 0) + 1;
  }

  const sample = buildStratifiedSample(entries, sampleSize);
  const report = {
    generated_at: new Date().toISOString(),
    target,
    total: entries.length,
    perguntas_unicas: catalog.length,
    ok: okCount,
    taxa_ok: `${((okCount / entries.length) * 100).toFixed(1)}%`,
    rotas: byRoute,
    categorias: byCat,
    amostra_prompt: sampleSize,
    entries,
  };

  const jsonOut = path.join(ROOT, "docs/ia/repertorio-1000.json");
  const csvOut = path.join(ROOT, "docs/ia/repertorio-1000.csv");
  const txtFull = path.join(ROOT, "backend/ia/python/conversa/instrucoes/treino_repertorio_1000.txt");
  const txtPrompt = path.join(ROOT, "backend/ia/python/conversa/instrucoes/treino_repertorio_amostra.txt");
  const txtLegacy = path.join(ROOT, "backend/ia/python/conversa/instrucoes/treino_repertorio_conversas.txt");

  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2), "utf8");

  const csvLines = [
    "id,categoria,pergunta,resposta,rota,ok,fonte",
    ...entries.map((e) =>
      [e.id, e.categoria, e.question, e.answer, e.route, e.ok, e.source].map(escCsv).join(","),
    ),
  ];
  fs.writeFileSync(csvOut, csvLines.join("\n") + "\n", "utf8");

  const fullTxt = buildTreinoTxt(entries, { title: "[Repertório 1000+ — completo]" });
  const sampleTxt = buildTreinoTxt(sample, {
    title: `[Repertório amostra ${sample.length} — injetado no prompt RAG]`,
  });

  fs.writeFileSync(txtFull, fullTxt, "utf8");
  fs.writeFileSync(txtPrompt, sampleTxt, "utf8");
  fs.writeFileSync(txtLegacy, sampleTxt, "utf8");

  console.log("\n--- Relatório ---");
  console.log(`Total turnos: ${report.total} | OK: ${report.ok} (${report.taxa_ok})`);
  console.log(`Perguntas únicas: ${report.perguntas_unicas}`);
  console.log("Rotas:", byRoute);
  console.log("Categorias:", Object.keys(byCat).length, "tipos");
  console.log(`\nJSON: ${jsonOut}`);
  console.log(`CSV:  ${csvOut}`);
  console.log(`TXT completo (${entries.filter((e) => e.answer).length}): ${txtFull}`);
  console.log(`TXT prompt (${sample.length}): ${txtPrompt}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
