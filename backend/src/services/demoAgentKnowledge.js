/**
 * Modo demo: carrega `.md` de conhecimento do agente (sem parser por frase).
 * Pasta canônica: `backend/ia/agente/`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config.js";
import { normalizeArteBrief } from "./rawImageArteBrief.js";
import { mergeReferenceMidiaIdsFromSlashText } from "./chatCreationInterpret.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENTE_DIR = path.resolve(__dirname, "../../ia/agente");

const KNOWLEDGE_FILES = [
  "comportamento.md",
  "criacao.md",
  "acervo-e-formatos.md",
  "guardrails.md",
];

/** @type {string | null} */
let cachedKnowledge = null;

export function isDemoAgentMode() {
  return env.CHAT_DEMO_AGENT === true;
}

/**
 * @returns {string}
 */
export function loadDemoAgentKnowledgeMarkdown() {
  if (cachedKnowledge != null) return cachedKnowledge;
  const parts = [];
  for (const name of KNOWLEDGE_FILES) {
    const full = path.join(AGENTE_DIR, name);
    try {
      const raw = fs.readFileSync(full, "utf8").trim();
      if (raw) parts.push(raw);
    } catch {
      /* arquivo opcional */
    }
  }
  cachedKnowledge = parts.length
    ? `## Conhecimento do agente (demo)\n\n${parts.join("\n\n---\n\n")}`
    : "";
  return cachedKnowledge;
}

/** @internal testes */
export function resetDemoAgentKnowledgeCache() {
  cachedKnowledge = null;
}

/**
 * Contexto determinístico da interface / canal (não é interpretação de linguagem).
 * @param {{
 *   arteBrief?: Record<string, unknown> | null,
 *   referenceMidiaIds?: string[],
 *   midias?: Array<Record<string, unknown>>,
 *   question?: string,
 *   history?: Array<{ role?: string, content?: string }>,
 *   canal?: string | null,
 * }} opts
 */
export function buildDemoUiContextBlock(opts = {}) {
  const lines = ["## Contexto da interface (fonte de verdade — não pergunte de novo)"];
  const canal = String(opts.canal || "").trim() || "web";
  lines.push(`- Canal: ${canal}`);

  const brief = opts.arteBrief && typeof opts.arteBrief === "object" ? normalizeArteBrief(opts.arteBrief) : null;
  if (brief?.formato?.ratio) {
    const label = [brief.formato.label, brief.formato.subtitle].filter(Boolean).join(" · ");
    lines.push(
      `- Formato selecionado: ${brief.formato.ratio}` +
        (label ? ` (${label})` : "") +
        ` · preset ${brief.formato.preset_id || "—"}`,
    );
  } else {
    lines.push("- Formato: não informado no painel (no WhatsApp, interprete do texto se houver).");
  }
  if (brief?.tema) lines.push(`- Tema já no resumo: ${brief.tema}`);
  if (brief?.estilo) lines.push(`- Estilo já no resumo: ${brief.estilo}`);
  if (brief?.texto) lines.push(`- Texto/oferta já no resumo: ${brief.texto}`);

  const midias = Array.isArray(opts.midias) ? opts.midias : [];
  const ids = mergeReferenceMidiaIdsFromSlashText(
    opts.referenceMidiaIds,
    [
      ...(Array.isArray(opts.history) ? opts.history : []),
      ...(opts.question ? [{ role: "user", content: opts.question }] : []),
    ],
    midias,
  );
  if (ids.length) {
    const byId = new Map(midias.map((r) => [String(r?.id_midia ?? "").trim(), r]));
    for (const id of ids) {
      const row = byId.get(id);
      const nome = String(row?.nome_exibicao ?? row?.nome_arquivo ?? "mídia").trim();
      lines.push(`- Mídia do acervo selecionada: ${nome} (id_midia=${id}) — usar esta embalagem real.`);
    }
  } else {
    lines.push("- Nenhuma mídia explícita anexada neste turno.");
  }

  lines.push(
    "",
    "Lembrete: perguntar só o que faltar de verdade. Não peça produto/formato/preço se já estão acima.",
  );
  return lines.join("\n");
}

/**
 * Bloco completo injetado no training do LLM (demo).
 * @param {{
 *   arteBrief?: Record<string, unknown> | null,
 *   referenceMidiaIds?: string[],
 *   midias?: Array<Record<string, unknown>>,
 *   question?: string,
 *   history?: Array<{ role?: string, content?: string }>,
 *   canal?: string | null,
 *   acervoLabels?: string[],
 * }} opts
 */
export function buildDemoAgentTrainingAppendix(opts = {}) {
  if (!isDemoAgentMode()) return "";
  const parts = [loadDemoAgentKnowledgeMarkdown(), buildDemoUiContextBlock(opts)];
  const labels = Array.isArray(opts.acervoLabels)
    ? opts.acervoLabels.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 40)
    : [];
  if (labels.length) {
    parts.push(`## Acervo disponível (nomes)\n${labels.map((l) => `- ${l}`).join("\n")}`);
  }
  return parts.filter(Boolean).join("\n\n");
}
