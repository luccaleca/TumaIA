import { z } from "zod";
import { env } from "../config.js";
import { llamaChatCompletionJson } from "./llamaOpenAiClient.js";
import { recordLlamaTextCall } from "./llamaUsage.js";
import {
  loadContextosEmpresaAtivos,
  loadEmpresaResumoParaImagem,
  loadMidiasEmpresaResumo,
} from "./imagePreviewPrompt.js";

const linkItemSchema = z.object({
  kind: z.enum(["contexto", "midia"]),
  id: z.string().uuid(),
  label: z.string().min(1).max(160),
});

const proposalOutSchema = z.object({
  confirmation_message: z.string().min(12).max(8000),
  links: z.array(linkItemSchema).max(8).optional().default([]),
  post_context_proposal: z.record(z.string(), z.unknown()).optional().default({}),
});

/**
 * Só mantém links cujo id existe nas linhas do Supabase (nunca inventar).
 * @param {unknown} raw
 * @param {Array<Record<string, unknown>>} contextoRows
 * @param {Array<Record<string, unknown>>} midiaRows
 */
export function sanitizePostSupplementLinks(raw, contextoRows, midiaRows) {
  const allowedCtx = new Set(
    contextoRows.map((r) => String(r.id_contexto_empresa ?? "").trim()).filter(Boolean),
  );
  const allowedMid = new Set(midiaRows.map((r) => String(r.id_midia ?? "").trim()).filter(Boolean));
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const kind = item.kind === "midia" || item.kind === "contexto" ? item.kind : null;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const label = typeof item.label === "string" ? item.label.trim().slice(0, 160) : "";
    if (!kind || !id || !label) continue;
    if (kind === "contexto" && !allowedCtx.has(id)) continue;
    if (kind === "midia" && !allowedMid.has(id)) continue;
    out.push({
      kind,
      id,
      label,
      href:
        kind === "contexto"
          ? `/painel/contextos?contexto=${encodeURIComponent(id)}`
          : `/painel/midias?midia=${encodeURIComponent(id)}`,
    });
    if (out.length >= 8) break;
  }
  return out;
}

function formatHistoryForPrompt(history) {
  const tail = history.slice(-16);
  return tail
    .map((m) => `${m.role === "user" ? "Cliente" : "Assistente"}: ${String(m.content).slice(0, 3500)}`)
    .join("\n---\n");
}

function formatContextosForLlm(rows) {
  if (!rows.length) return "(nenhum contexto ativo no painel)";
  return rows
    .map((r, i) => {
      const id = r.id_contexto_empresa ?? `idx-${i}`;
      const nome = String(r.nome ?? "").trim() || "(sem nome)";
      const desc = String(r.descricao ?? "").trim();
      let dados = "";
      try {
        dados = JSON.stringify(r.dados_json ?? {}).slice(0, 1200);
      } catch {
        dados = "{}";
      }
      let schema = "";
      try {
        schema = JSON.stringify(r.schema_json ?? {}).slice(0, 400);
      } catch {
        schema = "{}";
      }
      return `### contexto_id=${id}\nnome: ${nome}\ndescricao: ${desc.slice(0, 600)}\nschema_json: ${schema}\ndados_json: ${dados}`;
    })
    .join("\n\n");
}

function formatMidiasForLlm(rows) {
  if (!rows.length) return "(nenhuma mídia ativa no acervo)";
  return rows
    .map((r, i) => {
      const id = r.id_midia ?? `m-${i}`;
      const nome = String(r.nome_exibicao ?? "").trim() || "(sem nome)";
      const arquivo = String(r.nome_arquivo ?? "").trim();
      const desc = String(r.descricao ?? "").trim();
      const alt = String(r.alt_text ?? "").trim();
      const tipo = String(r.tipo_midia ?? "").trim();
      const linhaArquivo =
        arquivo && arquivo !== nome ? `nome_arquivo: ${arquivo.slice(0, 200)}` : "";
      return `### midia_id=${id}\nnome_exibicao: ${nome}\n${linhaArquivo ? `${linhaArquivo}\n` : ""}tipo: ${tipo}\ndescricao: ${desc.slice(0, 400)}\nalt_text: ${alt.slice(0, 300)}`;
    })
    .join("\n\n");
}

function formatEmpresaForLlm(emp) {
  if (!emp) return "(cadastro da empresa não encontrado)";
  const parts = [];
  if (emp.nome_fantasia) parts.push(`nome_fantasia: ${emp.nome_fantasia}`);
  if (emp.segmento) parts.push(`segmento: ${emp.segmento}`);
  if (emp.instagram_empresa) parts.push(`instagram: ${emp.instagram_empresa}`);
  if (emp.descricao) parts.push(`descricao: ${String(emp.descricao).slice(0, 1200)}`);
  return parts.join("\n") || "(vazio)";
}

/**
 * @param {string} promptUser
 */
async function llamaGenerateJson(promptUser) {
  if (!(env.LLAMA_BASE_URL?.trim() || env.LLAMA_MODEL?.trim())) {
    throw new Error(
      "Configure LLAMA_BASE_URL e/ou LLAMA_MODEL no .env do backend (API OpenAI-compatível, ex. Ollama).",
    );
  }
  return llamaChatCompletionJson(promptUser, { temperature: 0.35 });
}

/**
 * Llama (API compatível com OpenAI) + dados do Supabase (empresa, contexto_empresa, midia) para propor a pergunta de confirmação ao usuário.
 *
 * @param {{
 *   history: Array<{ role: string, content: string }>,
 *   idEmpresa: string,
 *   db: import("@supabase/supabase-js").SupabaseClient,
 * }} opts
 */
export async function generatePostContextProposal(opts) {
  const { history, idEmpresa, db } = opts;
  const [empresaRow, contextoRows, midiaRows] = await Promise.all([
    loadEmpresaResumoParaImagem(db, idEmpresa),
    loadContextosEmpresaAtivos(db, idEmpresa),
    loadMidiasEmpresaResumo(db, idEmpresa, 48),
  ]);

  const instrucao = `Você é assistente de marketing da TumaIA. O cliente já conversou sobre um pedido de post/conteúdo.
Sua tarefa: (1) ler o histórico; (2) relacionar com os CONTEXTOS cadastrados no painel (tipos como data comemorativa, lançamento, promoção, personalizado, etc. vêm em schema_json/dados_json);
(3) usar o ACERVO DE MÍDIAS para links e para o campo JSON midias_referenced (nunca invente URLs de arquivo; use só ids listados em "### midia_id=");
(4) escrever UMA mensagem curta em português do Brasil pedindo confirmação explícita, no estilo:
   "Então você quer um post com o contexto de \\"...\\" com ...?"
   Mencione números ou fatos que o cliente disse (ex.: 500 mil seguidores) quando couber.
(5) preencher post_context_proposal com resumo estruturado para a próxima etapa (geração de imagem).
(6) preencher "links": palavras/frases clicáveis no painel — cada item com kind "contexto" ou "midia", "id" UUID que EXISTA na lista acima, e "label" curto (texto do link). Se o pedido envolver contexto comemorativo e uma mídia de referência, inclua os DOIS links. Se não houver encaixe no banco, use "links": [].
(7) Se o cliente pedir arte com logo, produto, embalagem, variações de peça (ex.: armações) ou "só inserir" elementos do acervo, preencha "midias_referenced" com até 3 entradas { "id_midia", "nome_exibicao", "why" } usando ids EXISTENTES em "### midia_id=" (ordem importa: a 1ª será referência visual na Replicate; 2ª e 3ª entram como texto no prompt). Priorize as imagens mais importantes para composição na ordem.

Responda APENAS um JSON válido com exatamente estas chaves de primeiro nível:
{
  "confirmation_message": "string",
  "links": [ { "kind": "contexto" | "midia", "id": "uuid", "label": "string" } ],
  "post_context_proposal": {
    "intent_summary": "string",
    "matched_contexto": { "id_contexto_empresa": "uuid ou null", "nome": "string", "tipo_schema": "string", "reason": "string" } | null,
    "facts_for_image": { "chave": "valor" },
    "midias_referenced": [ { "id_midia": "uuid opcional", "nome_exibicao": "string", "why": "string" } ]
  }
}

Regras:
- matched_contexto.id_contexto_empresa DEVE ser um dos ids listados em "### contexto_id=" ou null se nenhum encaixar bem.
- Cada links[].id DEVE ser exatamente um id listado em "### contexto_id=" (se kind=contexto) ou "### midia_id=" (se kind=midia). NUNCA invente UUID.
- midias_referenced só pode citar ids listados em "### midia_id=".
- Interpretação do acervo (mídias) — o cliente pode citar nome de arquivo, apelido ou descrição imprecisa:
  - Compare o pedido com nome_exibicao, nome_arquivo, descricao e alt_text de cada mídia (não exija texto idêntico).
  - Trate como equivalentes: maiúsculas/minúsculas; underscore, hífen e espaço (ex.: "oculos_reto", "oculos-reto", "óculos reto"); pequenas variações de grafia ou singular/plural.
  - Use sobreposição de palavras-chave ou trechos: se o cliente disser "óculos reto" e existir arquivo "imagem-oculos-reto.jfif" ou nome_exibicao parecido, associe essa mídia.
  - Se houver várias candidatas, escolha a mais específica ao que foi pedido; na 1ª posição de midias_referenced coloque a principal para composição visual; em "why" explique brevemente o vínculo (ex.: "nome_arquivo contém oculos-reto como o cliente pediu").
  - Se nenhuma mídia for claramente relacionada, deixe midias_referenced vazio ou só contextos em links — não force UUID.
- facts_for_image: pares curtos (ex.: seguidores_alvo, ocasiao, tom).
- Tom profissional e cordial. Sem markdown na confirmation_message.`;

  const bloco = `
=== Cadastro da empresa ===
${formatEmpresaForLlm(empresaRow)}

=== Contextos ativos (tabela contexto_empresa) ===
${formatContextosForLlm(contextoRows)}

=== Mídias ativas (tabela midia — referência de identidade) ===
${formatMidiasForLlm(midiaRows)}

=== Histórico recente ===
${formatHistoryForPrompt(history)}
`;

  const promptUser = `${instrucao}\n\n${bloco}`;

  let parsed;
  let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let model = env.LLAMA_MODEL || "llama3.2:3b";
  try {
    const out = await llamaGenerateJson(promptUser);
    parsed = out.parsed;
    usage = out.usage;
    model = out.model;
  } catch (err) {
    await recordLlamaTextCall({
      ok: false,
      status: err?.status && Number(err.status) >= 400 ? Number(err.status) : 500,
      inputTokens: err?.llmUsage?.inputTokens,
      outputTokens: err?.llmUsage?.outputTokens,
      totalTokens: err?.llmUsage?.totalTokens,
      model: err?.llmModel || model,
    });
    throw err;
  }

  const safe = proposalOutSchema.safeParse(parsed);
  if (!safe.success) {
    await recordLlamaTextCall({
      ok: false,
      status: 502,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      model,
    });
    throw new Error("Resposta do modelo em formato inesperado");
  }

  await recordLlamaTextCall({
    ok: true,
    status: 200,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    model,
  });

  const links = sanitizePostSupplementLinks(safe.data.links, contextoRows, midiaRows);

  return {
    confirmation_message: safe.data.confirmation_message.trim(),
    links,
    post_context_proposal:
      safe.data.post_context_proposal && typeof safe.data.post_context_proposal === "object"
        ? safe.data.post_context_proposal
        : {},
    _meta: {
      contextos_carregados: contextoRows.length,
      midias_carregadas: midiaRows.length,
    },
  };
}
