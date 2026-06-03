/**
 * Bateria 1000+ perguntas — perfil geral (vários temas, não só criador/origem).
 *
 *   node backend/scripts/gerar-perguntas-identidade-1000.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generatePerfilGeralQuestionCatalog } from "./lib/perfilGeralQuestionCatalog.mjs";
import { classifyPerfilGeralTheme } from "../src/services/chatPerfilGeralThemes.js";
import { tryChatIdentityResponse } from "../src/services/chatIdentityResponse.js";
import { analyzeChatTurn } from "../src/services/chatTurnIntent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const DOCS = path.join(ROOT, "docs/ia");

function escCsv(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function main() {
  const catalog = generatePerfilGeralQuestionCatalog(1000);
  const rows = [];
  let direct = 0;
  let llm = 0;
  /** @type {Record<string, number>} */
  const porTema = {};

  for (const { categoria, pergunta } of catalog) {
    const tema = classifyPerfilGeralTheme(pergunta) || categoria;
    porTema[tema] = (porTema[tema] || 0) + 1;
    const answer = tryChatIdentityResponse(pergunta, "FYT");
    const turn = analyzeChatTurn(pergunta, [], { nomeFantasia: "FYT" });
    if (turn.route === "identity") direct += 1;
    if (turn.route === "identity_llm") llm += 1;
    rows.push({
      categoria,
      pergunta,
      tema,
      route: turn.route,
      resposta_direta: answer ? answer.slice(0, 140) : "",
    });
  }

  const csv = [
    "categoria,pergunta,tema,route,resposta_direta",
    ...rows.map((r) =>
      [r.categoria, r.pergunta, r.tema, r.route, r.resposta_direta].map(escCsv).join(","),
    ),
  ].join("\n");

  const treino = rows
    .filter((r) => r.resposta_direta)
    .slice(0, 500)
    .map((r) => `[${r.tema}]\nP: ${r.pergunta}\nR: ${r.resposta_direta}\n`)
    .join("\n");

  fs.mkdirSync(DOCS, { recursive: true });
  fs.writeFileSync(path.join(DOCS, "bateria-perfil-geral-1000.csv"), csv, "utf8");
  fs.writeFileSync(
    path.join(DOCS, "treino_perfil_geral_perguntas.txt"),
    `# Treino perfil geral — ${rows.filter((r) => r.resposta_direta).length} respostas diretas\n\n${treino}`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(DOCS, "bateria-perfil-geral-stats.json"),
    JSON.stringify(
      {
        total: catalog.length,
        temas_catalogo: Object.keys(porTema).length,
        resposta_direta_route_identity: direct,
        identity_llm: llm,
        por_tema: porTema,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Perguntas: ${catalog.length} | Temas: ${Object.keys(porTema).length}`);
  console.log(`Direta (identity): ${direct} | LLM (identity_llm): ${llm}`);
  console.log(`→ ${path.join(DOCS, "bateria-perfil-geral-1000.csv")}`);
}

main();
