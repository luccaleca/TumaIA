/**
 * Respostas sobre cadastro da empresa em sessão.
 */

import { loadEmpresaResumoParaImagem } from "./imagePreviewPrompt.js";

/**
 * @param {Record<string, unknown> | null} row
 */
export function formatEmpresaInfoAnswer(row) {
  if (!row) {
    return "Ainda não carreguei o cadastro da empresa — confira se há uma empresa ativa no painel.";
  }

  const nome = String(row.nome_fantasia ?? "").trim() || "Empresa";
  const segmento = String(row.segmento ?? "").trim();
  const desc = String(row.descricao ?? "").trim();
  const insta = String(row.instagram_empresa ?? "").trim();

  const parts = [`Trabalho com a **${nome}**`];
  if (segmento) parts.push(`segmento: ${segmento}`);
  if (desc) parts.push(desc.length > 220 ? `${desc.slice(0, 217)}…` : desc);
  if (insta) parts.push(`Instagram: @${insta.replace(/^@/, "")}`);

  return parts.join(". ").replace(/\*\*/g, "") + ".";
}

/**
 * @param {Record<string, unknown> | null} row
 */
export function buildEmpresaPromptBlock(row) {
  if (!row) return "";
  const nome = String(row.nome_fantasia ?? "").trim();
  if (!nome) return "";

  const lines = [`[DADOS CADASTRAIS DA EMPRESA EM SESSÃO]`, `Nome fantasia: ${nome}`];
  const segmento = String(row.segmento ?? "").trim();
  const desc = String(row.descricao ?? "").trim();
  const insta = String(row.instagram_empresa ?? "").trim();
  if (segmento) lines.push(`Segmento: ${segmento}`);
  if (desc) lines.push(`Descrição: ${desc.slice(0, 600)}`);
  if (insta) lines.push(`Instagram: ${insta}`);
  lines.push(
    "Use estes dados ao falar da marca. Tom de funcionário de marketing — não diga «empresa em sessão».",
  );
  return lines.join("\n");
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 */
export async function loadEmpresaChatFacts(db, idEmpresa) {
  return loadEmpresaResumoParaImagem(db, idEmpresa);
}
