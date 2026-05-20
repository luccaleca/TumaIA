import { z } from "zod";
import { env } from "../config.js";
import { llamaChatCompletionJson } from "./llamaOpenAiClient.js";
import { recordLlamaTextCall } from "./llamaUsage.js";
import {
  loadContextosEmpresaAtivos,
  loadEmpresaResumoParaImagem,
  loadMidiasEmpresaResumo,
} from "./imagePreviewPrompt.js";
import { partitionContextosIdentidade } from "../modules/empresas/identidadeMarca.js";
import { deriveFraseNaImagemFromHistory, normalizeFraseNaImagem } from "./imageHeadline.js";
import { pickBestProductMidiaId, rankReferenceMidiaIds } from "./referenceMidiaRanking.js";

const linkItemSchema = z.object({
  kind: z.enum(["contexto", "midia"]),
  id: z.string().uuid(),
  label: z.string().min(1).max(160),
});

const CONFIRMATION_MESSAGE_MAX = 320;

const proposalOutSchema = z.object({
  confirmation_message: z.string().min(12).max(CONFIRMATION_MESSAGE_MAX),
  links: z.array(linkItemSchema).max(8).optional().default([]),
  post_context_proposal: z.record(z.string(), z.unknown()).optional().default({}),
});

/**
 * Preenche `label` ausente e descarta itens inválidos antes do Zod (modelos pequenos omitem campos).
 *
 * @param {unknown} parsed
 * @param {Array<Record<string, unknown>>} contextoRows
 * @param {Array<Record<string, unknown>>} midiaRows
 */
function coerceProposalParsed(parsed, contextoRows, midiaRows) {
  if (!parsed || typeof parsed !== "object") return parsed;
  const out = { ...parsed };
  const ctxLabel = new Map(
    contextoRows.map((r) => [
      String(r.id_contexto_empresa ?? "").trim(),
      String(r.nome ?? "").trim() || "Contexto",
    ]),
  );
  const midLabel = new Map(
    midiaRows.map((r) => [
      String(r.id_midia ?? "").trim(),
      String(r.nome_exibicao ?? r.nome_arquivo ?? "").trim() || "Mídia",
    ]),
  );
  if (Array.isArray(out.links)) {
    out.links = out.links
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const kind = item.kind === "midia" || item.kind === "contexto" ? item.kind : null;
        const id = typeof item.id === "string" ? item.id.trim() : "";
        if (!kind || !id) return null;
        let label = typeof item.label === "string" ? item.label.trim().slice(0, 160) : "";
        if (!label) {
          label =
            kind === "contexto"
              ? ctxLabel.get(id) || "Contexto"
              : midLabel.get(id) || "Mídia do acervo";
        }
        return { kind, id, label };
      })
      .filter(Boolean);
  }
  if (typeof out.confirmation_message === "string" && out.confirmation_message.length > CONFIRMATION_MESSAGE_MAX) {
    out.confirmation_message = out.confirmation_message.trim().slice(0, CONFIRMATION_MESSAGE_MAX - 1) + "…";
  } else if (typeof out.confirmation_message !== "string") {
    out.confirmation_message = "";
  }
  if (!out.post_context_proposal || typeof out.post_context_proposal !== "object") {
    out.post_context_proposal = {};
  }
  const frase = normalizeFraseNaImagem(out.post_context_proposal.frase_na_imagem);
  if (frase) {
    out.post_context_proposal.frase_na_imagem = frase;
  }
  return out;
}

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
  const tail = history.slice(-8);
  return tail
    .map((m) => `${m.role === "user" ? "Cliente" : "Assistente"}: ${String(m.content).slice(0, 1200)}`)
    .join("\n---\n");
}

function formatContextosForLlm(rows) {
  if (!rows.length) return "(nenhum contexto ativo no painel)";
  const { campanhaRows } = partitionContextosIdentidade(rows);
  const list = campanhaRows.length ? campanhaRows : rows;
  return list
    .slice(0, 10)
    .map((r, i) => {
      const id = r.id_contexto_empresa ?? `idx-${i}`;
      const nome = String(r.nome ?? "").trim() || "(sem nome)";
      const desc = String(r.descricao ?? "").trim();
      let dados = "";
      try {
        dados = JSON.stringify(r.dados_json ?? {}).slice(0, 380);
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
 * Monta confirmação + links a partir do painel quando o Llama devolve texto livre.
 *
 * @param {Array<{ role: string, content: string }>} history
 * @param {Array<Record<string, unknown>>} contextoRows
 * @param {Array<Record<string, unknown>>} midiaRows
 */
function buildFallbackProposalFromPanel(history, contextoRows, midiaRows) {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const ctx = contextoRows[0] ?? null;
  const hint = lastUser ? String(lastUser.content) : "";
  const bestId = pickBestProductMidiaId(midiaRows, hint);
  const mid = bestId
    ? (midiaRows.find((r) => String(r.id_midia ?? "").trim() === bestId) ?? null)
    : (midiaRows.find((r) => String(r.tipo_midia || "").trim().toLowerCase() === "imagem") ??
      midiaRows[0] ??
      null);
  const ctxNome = ctx ? String(ctx.nome ?? "").trim() || "contexto da marca" : "contexto da marca";
  const frase = deriveFraseNaImagemFromHistory(history, contextoRows);
  let confirmation_message = `Confira o resumo do seu pedido${ctx ? ` para «${ctxNome}»` : ""}${
    frase ? ` — frase na imagem: «${frase}»` : ""
  }. Quando estiver certo, gere a prévia.`;
  const links = [];
  if (ctx) {
    const id = String(ctx.id_contexto_empresa ?? "").trim();
    if (id) {
      links.push({
        kind: "contexto",
        id,
        label: String(ctx.nome ?? "Contexto").trim().slice(0, 160) || "Contexto",
      });
    }
  }
  if (mid) {
    const id = String(mid.id_midia ?? "").trim();
    if (id) {
      links.push({
        kind: "midia",
        id,
        label:
          String(mid.nome_exibicao ?? mid.nome_arquivo ?? "").trim().slice(0, 160) || "Mídia do acervo",
      });
    }
  }
  const midias_referenced = mid
    ? [
        {
          id_midia: String(mid.id_midia ?? "").trim(),
          nome_exibicao: String(mid.nome_exibicao ?? mid.nome_arquivo ?? "Mídia").trim(),
          why: "Principal referência visual do acervo (montagem automática).",
        },
      ]
    : [];
  return {
    confirmation_message,
    links,
    post_context_proposal: {
      intent_summary: lastUser ? String(lastUser.content).trim().slice(0, 500) : "",
      matched_contexto: ctx
        ? {
            id_contexto_empresa: String(ctx.id_contexto_empresa ?? "").trim() || null,
            nome: String(ctx.nome ?? "").trim(),
            tipo_schema: "",
            reason: "fallback_painel",
          }
        : null,
      facts_for_image: frase ? { frase_na_imagem: frase } : {},
      frase_na_imagem: frase,
      midias_referenced,
    },
  };
}

function shouldUsePanelProposalFallback(err) {
  if (err?.rawContent) return true;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "O modelo retornou JSON inválido") return true;
  if (/Configure LLAMA_BASE_URL/i.test(msg)) return true;
  return /tempo esgotado|timed?\s*out|abort|ECONNREFUSED|fetch failed|network/i.test(msg);
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
  const proposalModel = (env.LLAMA_PROPOSAL_MODEL || env.LLAMA_MODEL || "llama3.2:1b").trim();
  const timeoutMs = Number(env.LLAMA_PROPOSAL_TIMEOUT_MS) || 90_000;
  const strictSuffix =
    "\n\nIMPORTANTE: responda SOMENTE um objeto JSON válido, sem markdown.";

  return llamaChatCompletionJson(`${promptUser}${strictSuffix}`, {
    temperature: 0.2,
    responseFormatJson: true,
    model: proposalModel,
    timeoutMs,
    timeoutMessage:
      "Tempo esgotado aguardando o Llama (Ollama). O painel usará um resumo automático com os dados cadastrados.",
  });
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
    loadMidiasEmpresaResumo(db, idEmpresa, 20),
  ]);

  const instrucao = `Você é assistente de marketing da TumaIA. O cliente já conversou sobre um pedido de post/conteúdo.
Sua tarefa: (1) ler o histórico; (2) relacionar com os CONTEXTOS cadastrados no painel (tipos como data comemorativa, lançamento, promoção, personalizado, etc. vêm em schema_json/dados_json);
(3) usar o ACERVO DE MÍDIAS para links e para o campo JSON midias_referenced (nunca invente URLs de arquivo; use só ids listados em "### midia_id=");
(4) escrever UMA mensagem MUITO curta (máx. 2 frases, até ~280 caracteres) em português do Brasil pedindo confirmação, no estilo:
   "Confira o resumo do seu pedido para [contexto/campanha]…"
   Mencione números ou fatos que o cliente disse só se couber na frase — sem parágrafo extra.
   PROIBIDO citar testes, painel técnico, Llama, Ollama, Replicate ou erros internos.
(5) preencher post_context_proposal com resumo estruturado para a próxima etapa (geração de imagem), incluindo OBRIGATORIAMENTE "frase_na_imagem": frase curta que vai ESCRITA NA ARTE (não é legenda do post). Ex.: pedido de 500 mil seguidores → "Parabéns pelos 500k!" ou "500k seguidores!". Máx. 8 palavras, português BR, sem hashtags.
(6) preencher "links": palavras/frases clicáveis no painel — cada item com kind "contexto" ou "midia", "id" UUID que EXISTA na lista acima, e "label" curto (texto do link). Se o pedido envolver contexto comemorativo e uma mídia de referência, inclua os DOIS links. Se não houver encaixe no banco, use "links": [].
(7) Se o cliente pedir arte com produto, embalagem, armações/óculos PNG ou "inserir" elemento do acervo, preencha "midias_referenced" com até 3 ids EXISTENTES em "### midia_id=".
   ORDEM CRÍTICA: a 1ª posição vai para o FLUX como image_prompt — deve ser RECORTE/PNG DE PRODUTO, NUNCA logo da marca (logo fica só no cantinho da arte), NUNCA um post/arte/banner/festa/400k já pronto do acervo.
   Só coloque o id do LOGO em 1º lugar se o cliente pedir EXPLICITAMENTE logo em destaque/principal/protagonista/arte da marca.
   Não use como 1ª referência imagens que pareçam post de Instagram, comemoração de seguidores, balões ou layout completo.

Responda APENAS um JSON válido com exatamente estas chaves de primeiro nível:
{
  "confirmation_message": "string",
  "links": [ { "kind": "contexto" | "midia", "id": "uuid", "label": "string" } ],
  "post_context_proposal": {
    "intent_summary": "string",
    "matched_contexto": { "id_contexto_empresa": "uuid ou null", "nome": "string", "tipo_schema": "string", "reason": "string" } | null,
    "frase_na_imagem": "string curta na arte, ex. Parabéns pelos 500k!",
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
- frase_na_imagem: OBRIGATÓRIO quando o pedido tiver marco, promoção ou data — é o texto que aparece na imagem.
- facts_for_image: pares curtos opcionais (ex.: ocasiao, tom); repita frase_na_imagem em facts_for_image.frase_na_imagem se quiser.
- Tom profissional e cordial. Sem markdown na confirmation_message.
- PROIBIDO responder com parágrafos de post pronto, legenda ou texto fora do JSON. A confirmation_message é só a pergunta de confirmação (1–2 frases, máx. 280 caracteres).`;

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
  let usedPanelFallback = false;
  let fallbackMeta = null;

  const panelParsed = buildFallbackProposalFromPanel(history, contextoRows, midiaRows);

  if (!env.POST_CONTEXT_USE_LLAMA) {
    parsed = panelParsed;
    usedPanelFallback = true;
    fallbackMeta = "painel_imediato";
  } else {
    try {
      const out = await llamaGenerateJson(promptUser);
      parsed = out.parsed;
      usage = out.usage;
      model = out.model;
    } catch (err) {
      if (shouldUsePanelProposalFallback(err)) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(
          "[post-context-proposal] Llama indisponível ou lento; resumo automático do painel:",
          errMsg,
        );
        parsed = panelParsed;
        usedPanelFallback = true;
        fallbackMeta = /tempo esgotado/i.test(errMsg) ? "painel_timeout_llama" : "painel_sem_json_llama";
        usage = {
          inputTokens: err?.llmUsage?.inputTokens ?? 0,
          outputTokens: err?.llmUsage?.outputTokens ?? 0,
          totalTokens: err?.llmUsage?.totalTokens ?? 0,
        };
        model = err?.llmModel || model;
      } else {
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
    }
  }

  const coerced = coerceProposalParsed(parsed, contextoRows, midiaRows);
  const safe = proposalOutSchema.safeParse(coerced);
  if (!safe.success) {
    await recordLlamaTextCall({
      ok: false,
      status: 502,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      model,
    });
    const err = new Error("Resposta do modelo em formato inesperado");
    err.parsed = parsed;
    err.zod = safe.error.flatten();
    throw err;
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

  let post_context_proposal =
    safe.data.post_context_proposal && typeof safe.data.post_context_proposal === "object"
      ? { ...safe.data.post_context_proposal }
      : {};

  const { campanhaRows } = partitionContextosIdentidade(contextoRows);
  const derived = deriveFraseNaImagemFromHistory(history, campanhaRows);
  if (derived) {
    post_context_proposal.frase_na_imagem = derived;
    if (!post_context_proposal.facts_for_image || typeof post_context_proposal.facts_for_image !== "object") {
      post_context_proposal.facts_for_image = {};
    }
    post_context_proposal.facts_for_image.frase_na_imagem = derived;
  } else if (!post_context_proposal.frase_na_imagem) {
    const fallback = deriveFraseNaImagemFromHistory(history, campanhaRows);
    if (fallback) post_context_proposal.frase_na_imagem = fallback;
  }

  const rawRefs = post_context_proposal.midias_referenced;
  if (Array.isArray(rawRefs) && rawRefs.length > 1 && midiaRows.length) {
    const ids = rawRefs
      .map((item) => (item && typeof item.id_midia === "string" ? item.id_midia.trim() : ""))
      .filter(Boolean);
    const hint = history
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" ")
      .slice(-400);
    const ranked = rankReferenceMidiaIds(ids, midiaRows, hint);
    const byId = new Map(
      rawRefs
        .filter((item) => item && typeof item === "object")
        .map((item) => [String(item.id_midia ?? "").trim(), item]),
    );
    post_context_proposal.midias_referenced = ranked
      .map((id) => byId.get(id))
      .filter(Boolean)
      .slice(0, 3);
  }

  return {
    confirmation_message: safe.data.confirmation_message.trim(),
    links,
    post_context_proposal,
    _meta: {
      contextos_carregados: contextoRows.length,
      midias_carregadas: midiaRows.length,
      ...(fallbackMeta ? { fallback: fallbackMeta } : {}),
    },
  };
}
