import { z } from "zod";
import { env } from "../config.js";
import { DEFAULT_OLLAMA_CHAT_MODEL } from "../ollamaDefaults.js";
import { llamaChatCompletionJson } from "./llamaOpenAiClient.js";
import { recordLlamaTextCall } from "./llamaUsage.js";
import {
  loadContextosEmpresaAtivos,
  loadEmpresaResumoParaImagem,
  loadMidiasEmpresaResumo,
} from "./imagePreviewPrompt.js";
import {
  allBrandColorsFromIdentidade,
  formatBrandIdentityBlockForFlux,
  partitionContextosIdentidade,
} from "../modules/empresas/identidadeMarca.js";
import {
  buildResumoVisual,
  collectMandatoryImageFacts,
  deriveFraseNaImagemFromHistory,
  extractFraseFromUserText,
  isPanelNoiseMessage,
  looksLikeRawUserCopy,
  normalizeFraseNaImagem,
  recentUserTexts,
  resolveActivePedidoHint,
  resolvePedidoCliente,
} from "./imageHeadline.js";
import { pickBestProductMidiaId, pickHeroProductMidiaId, rankReferenceMidiaIds } from "./referenceMidiaRanking.js";
import {
  applyProductMediaGate,
  extractProductMentions,
  narrowImageRowsByProductMention,
  parseProductMentionSpec,
  scoreRowForProductSpec,
  pruneProposalMidiasToPedido,
  reconcileProposalMidias,
  resolveMidiaRowsForPedido,
  scoreRowProductMention,
} from "./productMentionMatch.js";
import {
  extractPedidoCampanhaLabels,
  inferPreferredPlaybookSlug,
} from "./cadastroMeaningful.js";
import { playbookSlugFromContextoRow } from "../modules/empresas/postModelosCatalog.js";
import { applyBriefingGate, listMissingBriefingSlots } from "./postBriefingSlots.js";
import { buildArteBriefFromHistory, mergeArteBriefUserEdits } from "./rawImageArteBrief.js";
import { TUMA_IA_REGRAS_RESUMO_IMAGEM } from "./tumaIaRegrasResumo.js";

const linkItemSchema = z.object({
  kind: z.enum(["contexto", "midia"]),
  id: z.string().uuid(),
  label: z.string().min(1).max(160),
});

const CONFIRMATION_MESSAGE_MAX = 320;
const PRODUCT_MATCH_HINT = /whey|creatina|suplement|produto|pote|embalagem|packshot|refil|monster|pro\s*force/i;
const MONTAGEM_STOP = new Set([
  "com",
  "para",
  "uma",
  "umas",
  "uns",
  "arte",
  "post",
  "foto",
  "fotos",
  "imagem",
  "imagens",
  "pedido",
  "painel",
  "cliente",
  "marca",
  "produto",
  "produtos",
  "foco",
  "principal",
  "centro",
  "lado",
  "ladoa",
  "ladob",
  "fundo",
  "compre",
  "agora",
  "melhore",
  "desempenho",
  "integral",
  "growth",
  "max",
  "oi",
  "ola",
  "olá",
  "amigao",
  "amigão",
  "novo",
  "nova",
  "bem",
  "evidencia",
  "evidência",
  "das",
  "dos",
  "de",
  "do",
  "da",
  "em",
  "na",
  "no",
  "pro",
  "pra",
  "por",
  "que",
]);

const proposalOutSchema = z.object({
  confirmation_message: z.string().min(12).max(CONFIRMATION_MESSAGE_MAX),
  links: z.array(linkItemSchema).max(8).optional().default([]),
  post_context_proposal: z.record(z.string(), z.unknown()).optional().default({}),
});

function compactSupplementLabel(value, fallback = "") {
  let s = String(value || fallback || "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) s = String(fallback || "").trim();
  if (!s) return "";
  const words = s.split(" ").filter(Boolean);
  if (words.length > 4) s = words.slice(0, 4).join(" ");
  if (s.length > 36) s = `${s.slice(0, 35).trim()}…`;
  return s;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeSearchText(value) {
  const stop = new Set([
    "com",
    "para",
    "uma",
    "uns",
    "umas",
    "arte",
    "post",
    "foto",
    "quero",
    "usar",
    "sera",
    "seria",
    "mais",
    "muito",
    "dia",
    "dos",
    "das",
    "de",
    "do",
    "da",
    "e",
    "ou",
    "na",
    "no",
    "em",
    "por",
    "pra",
  ]);
  return [...new Set(normalizeSearchText(value).match(/[a-z0-9]+/g) || [])].filter(
    (token) => token.length >= 3 && !stop.has(token),
  );
}

function cleanShortSentence(value, max = 180) {
  let s = String(value || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length > max) s = `${s.slice(0, max - 1).trim()}…`;
  return s;
}

function titleWord(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function compactMontagemWords(value, max = 3) {
  const tokens = (normalizeSearchText(value).match(/[a-z0-9]+/g) || []).filter(
    (token) => token.length >= 3 && !MONTAGEM_STOP.has(token),
  );
  return [...new Set(tokens)].slice(0, max);
}

function detectMontagemScene(blob) {
  const text = normalizeSearchText(blob);
  if (/black\s*friday/.test(text)) return "black friday";
  if (/academia|fitness|treino|muscul|gym/.test(text)) return "academia";
  if (/institucional|branding|marca/.test(text)) return "institucional";
  if (/lancamento|lançamento|novo produto|novidade/.test(text)) return "lançamento";
  if (/dia dos|natal|pascoa|páscoa|comemor|seguidores|marco/.test(text)) return "campanha";
  return "";
}

function detectMontagemGoal(blob) {
  const text = normalizeSearchText(blob);
  if (/desconto|promo|promoc|oferta|off\b/.test(text)) return "promo";
  if (/institucional|branding|marca/.test(text)) return "institucional";
  if (/lancamento|lançamento|novidade/.test(text)) return "lançamento";
  return "";
}

function subjectFromReferencedNames(names, blob = "") {
  if (!Array.isArray(names) || !names.length) return "";
  const lists = names.map((name) => compactMontagemWords(name, 4));
  const counts = new Map();
  for (const tokens of lists) {
    for (const token of tokens) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }
  const common = [...counts.entries()]
    .filter(([, count]) => count >= Math.min(2, names.length))
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token)[0];
  if (common) {
    if (names.length > 1 && /a$/.test(common)) return `${common}s`;
    return common;
  }
  const fromBlob = compactMontagemWords(blob, 4).find((token) =>
    lists.some((tokens) => tokens.includes(token)),
  );
  if (fromBlob) return fromBlob;
  return lists[0]?.[0] || "";
}

function buildCompactMontagemLabel(proposal) {
  const p = proposal && typeof proposal === "object" ? proposal : {};
  const exactNames = exactReferencedMidiaNames(p);
  const matchedContexto =
    p.matched_contexto && typeof p.matched_contexto === "object" ? p.matched_contexto : null;
  const blob = [
    p.intent_summary,
    p.arte_brief?.tema,
    p.montagem_resumo,
    matchedContexto?.nome,
    ...exactNames,
  ]
    .filter(Boolean)
    .join(" ");
  const subject = subjectFromReferencedNames(exactNames, blob);
  const scene = detectMontagemScene(blob);
  const goal = detectMontagemGoal(blob);
  const words = [subject, scene, goal].filter(Boolean);
  if (words.length) {
    return cleanShortSentence(words.slice(0, 3).map(titleWord).join(" "), 42);
  }
  const fallback = compactMontagemWords(blob, 3).map(titleWord).join(" ");
  return fallback || "Arte";
}

function scoreTokenOverlap(blob, tokens) {
  const text = normalizeSearchText(blob);
  let score = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (text.includes(token)) score += token.length >= 6 ? 4 : 2;
  }
  return score;
}

function resolveContextoPlaybookSlug(row) {
  if (!row || typeof row !== "object") return null;
  const fromPlaybook = playbookSlugFromContextoRow(row);
  if (fromPlaybook) return fromPlaybook;
  const schema = row.schema_json && typeof row.schema_json === "object" ? row.schema_json : {};
  const slug = String(schema.playbook_slug ?? schema.tipo ?? "").trim();
  return slug || null;
}

function findCampanhaRowBySlug(campanhaRows, slug) {
  const target = String(slug ?? "").trim();
  if (!target || !Array.isArray(campanhaRows)) return null;
  const bySlug = campanhaRows.find((row) => resolveContextoPlaybookSlug(row) === target);
  if (bySlug) return bySlug;

  const nomePatterns = {
    produto: /^produto$/i,
    promocao: /^promo/i,
    lancamento: /^lan[cç]amento$/i,
    mensagens: /^mensagem/i,
  };
  const nomeRe = nomePatterns[target];
  if (!nomeRe) return null;
  return campanhaRows.find((row) => nomeRe.test(String(row?.nome ?? "").trim())) ?? null;
}

/**
 * Ajusta matched_contexto quando o pedido indica promoção/lançamento etc.
 * Não sobrescreve escolha explícita via focus_contexto_id (rodar antes de applyFocus).
 *
 * @param {Record<string, unknown>} proposal
 * @param {Array<Record<string, unknown>>} contextoRows
 * @param {string} [userHint]
 */
export function reconcileMatchedContextoFromPedido(proposal, contextoRows, userHint = "") {
  if (!proposal || typeof proposal !== "object") return proposal;
  const hint = String(userHint ?? proposal.intent_summary ?? "").trim();
  const preferredSlug = inferPreferredPlaybookSlug(hint);
  if (!preferredSlug) return proposal;

  const { campanhaRows } = partitionContextosIdentidade(contextoRows);
  const targetRow = findCampanhaRowBySlug(campanhaRows, preferredSlug);
  if (!targetRow) return proposal;

  const currentId = String(proposal.matched_contexto?.id_contexto_empresa ?? "").trim();
  const currentRow = currentId
    ? campanhaRows.find((r) => String(r.id_contexto_empresa ?? "").trim() === currentId)
    : null;
  const currentSlug = currentRow ? resolveContextoPlaybookSlug(currentRow) : null;
  if (currentSlug === preferredSlug) return proposal;

  return {
    ...proposal,
    matched_contexto: matchedContextoFromRow(targetRow, `pedido_${preferredSlug}`),
  };
}

function pickBestCampaignContext(contextoRows, userHint = "") {
  const { campanhaRows } = partitionContextosIdentidade(contextoRows);
  if (!campanhaRows.length) return null;

  const preferredSlug = inferPreferredPlaybookSlug(userHint);
  if (preferredSlug) {
    const byIntent = findCampanhaRowBySlug(campanhaRows, preferredSlug);
    if (byIntent) return byIntent;
  }

  const tokens = tokenizeSearchText(userHint);
  if (!tokens.length) return null;

  let best = null;
  let bestScore = -1;
  for (const row of campanhaRows) {
    const slug = resolveContextoPlaybookSlug(row) || "";
    const blob = `${row?.nome ?? ""} ${row?.descricao ?? ""} ${slug}`;
    const score = scoreTokenOverlap(blob, tokens);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

function pickReferencedMidias(midiaRows, userHint = "", limit = 3) {
  return resolveMidiaRowsForPedido(midiaRows, userHint, limit);
}

function buildHeroProductSelection(rows, userHint = "", fallbackToFirst = false) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!list.length) return null;
  const explicitId = pickHeroProductMidiaId(list, userHint);
  const chosen =
    (explicitId ? list.find((row) => String(row.id_midia ?? "").trim() === explicitId) : null) ||
    (fallbackToFirst ? list[0] : null);
  if (!chosen) return null;
  return {
    id_midia: String(chosen.id_midia ?? "").trim() || null,
    nome_exibicao: String(chosen.nome_exibicao ?? chosen.nome_arquivo ?? "Mídia").trim() || "Mídia",
    reason: explicitId ? "pedido_destacou_item" : "primeira_referencia",
  };
}

function normalizeHeroProductSelection(heroProduct, refItems) {
  const refs = Array.isArray(refItems) ? refItems : [];
  const raw = heroProduct && typeof heroProduct === "object" ? heroProduct : null;
  const refById = new Map(
    refs
      .filter((item) => item && typeof item === "object")
      .map((item) => [String(item.id_midia ?? "").trim(), item]),
  );
  const requestedId = raw && typeof raw.id_midia === "string" ? raw.id_midia.trim() : "";
  const requestedName = raw && typeof raw.nome_exibicao === "string" ? raw.nome_exibicao.trim() : "";
  const requestedReason = raw && typeof raw.reason === "string" ? raw.reason.trim() : "";
  const byId = requestedId ? refById.get(requestedId) : null;
  if (byId) {
    return {
      id_midia: requestedId,
      nome_exibicao: String(byId.nome_exibicao ?? requestedName ?? "Mídia").trim() || "Mídia",
      reason: requestedReason || "confirmado_no_fluxo",
    };
  }
  if (refs.length) {
    const first = refs[0];
    return {
      id_midia: String(first.id_midia ?? "").trim() || null,
      nome_exibicao: String(first.nome_exibicao ?? requestedName ?? "Mídia").trim() || "Mídia",
      reason: requestedReason || "primeira_referencia",
    };
  }
  if (requestedId || requestedName) {
    return {
      id_midia: requestedId || null,
      nome_exibicao: requestedName || "Mídia",
      reason: requestedReason || "confirmado_no_fluxo",
    };
  }
  return null;
}

function exactReferencedMidiaNames(proposal) {
  const refs =
    proposal && typeof proposal === "object" && Array.isArray(proposal.midias_referenced)
      ? proposal.midias_referenced
      : [];
  return refs
    .map((item) => {
      const nome = typeof item?.nome_exibicao === "string" ? item.nome_exibicao.trim() : "";
      return nome ? cleanShortSentence(nome, 42) : "";
    })
    .filter(Boolean)
    .slice(0, 3);
}

export function buildMontagemResumo(proposal) {
  const p = proposal && typeof proposal === "object" ? proposal : {};
  const custom = cleanShortSentence(p.montagem_resumo, 180);
  const exactNames = exactReferencedMidiaNames(p);
  const compact = buildCompactMontagemLabel(p);
  if (compact) return compact;
  if (custom) return custom;

  const arteBrief = p.arte_brief && typeof p.arte_brief === "object" ? p.arte_brief : null;
  const tema = cleanShortSentence(arteBrief?.tema || p.intent_summary || "", 120);
  const refs = Array.isArray(p.midias_referenced) ? p.midias_referenced.filter(Boolean) : [];
  const matchedContexto =
    p.matched_contexto && typeof p.matched_contexto === "object" ? p.matched_contexto : null;
  const ctxNome = cleanShortSentence(matchedContexto?.nome || "", 48);
  const base = tema || "Arte alinhada ao pedido";
  const itens =
    refs.length > 0
      ? ` com ${refs.length} ${refs.length === 1 ? "item do acervo" : "itens do acervo"} em destaque`
      : "";
  const contexto =
    ctxNome && !normalizeSearchText(base).includes(normalizeSearchText(ctxNome)) ? ` para ${ctxNome}` : "";
  return cleanShortSentence(`${base}${itens}${contexto}.`, 180);
}

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
  const pcp = out.post_context_proposal;
  const intent = String(pcp.intent_summary ?? "").trim();
  const rv = typeof pcp.resumo_visual === "string" ? pcp.resumo_visual.trim() : "";
  if (rv && intent && looksLikeRawUserCopy(rv, intent)) {
    delete pcp.resumo_visual;
  }
  if (Array.isArray(pcp.midias_referenced)) {
    const midById = new Map(
      midiaRows.map((r) => [String(r.id_midia ?? "").trim(), r]),
    );
    pcp.midias_referenced = pcp.midias_referenced
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const id = typeof item.id_midia === "string" ? item.id_midia.trim() : "";
        const row = id ? midById.get(id) : null;
        if (!row) return null;
        return {
          id_midia: id,
          nome_exibicao:
            String(item.nome_exibicao ?? row.nome_exibicao ?? row.nome_arquivo ?? "Mídia").trim() ||
            "Mídia",
          why:
            typeof item.why === "string" && item.why.trim()
              ? item.why.trim().slice(0, 240)
              : "PNG do acervo vinculado ao pedido.",
        };
      })
      .filter(Boolean)
      .slice(0, 3);
  }
  const frase = normalizeFraseNaImagem(out.post_context_proposal.frase_na_imagem);
  if (frase) {
    out.post_context_proposal.frase_na_imagem = frase;
  }
  const bs = String(out.briefing_status ?? "").trim();
  if (bs === "ready" || bs === "collecting") {
    out.briefing_status = bs;
  }
  if (Array.isArray(out.missing_slots)) {
    out.missing_slots = out.missing_slots.map((s) => String(s ?? "").trim()).filter(Boolean);
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

function matchedContextoFromRow(row, reason = "escolhido_no_chat") {
  if (!row) return null;
  const schema = row.schema_json && typeof row.schema_json === "object" ? row.schema_json : {};
  const id = String(row.id_contexto_empresa ?? row.id_empresa_modelo_post ?? "").trim();
  if (!id) return null;
  return {
    id_contexto_empresa: id,
    nome: String(row.nome ?? "").trim() || "Modelo",
    tipo_schema: String(schema.tipo ?? "").trim(),
    reason,
  };
}

function applyFocusContextoToProposal(proposal, contextoRows, focusContextoId) {
  const id = String(focusContextoId ?? "").trim();
  if (!id || !proposal || typeof proposal !== "object") return proposal;
  const row = (contextoRows || []).find(
    (r) =>
      String(r.id_contexto_empresa ?? "").trim() === id ||
      String(r.id_empresa_modelo_post ?? "").trim() === id,
  );
  if (!row) return proposal;
  return {
    ...proposal,
    matched_contexto: matchedContextoFromRow(row),
  };
}

/**
 * Garante links compactos e coerentes com o que a proposta realmente vai usar:
 * contexto escolhido + mídias referenciadas + links extras do modelo.
 *
 * @param {unknown} rawLinks
 * @param {Record<string, unknown> | null | undefined} postContextProposal
 * @param {Array<Record<string, unknown>>} contextoRows
 * @param {Array<Record<string, unknown>>} midiaRows
 */
export function resolvePostSupplementLinks(rawLinks, postContextProposal, contextoRows, midiaRows) {
  const proposal =
    postContextProposal && typeof postContextProposal === "object" ? postContextProposal : {};
  const ctxById = new Map(
    contextoRows.map((row) => [String(row.id_contexto_empresa ?? "").trim(), row]),
  );
  const midById = new Map(midiaRows.map((row) => [String(row.id_midia ?? "").trim(), row]));
  const extra = sanitizePostSupplementLinks(rawLinks, contextoRows, midiaRows);
  const out = [];
  const seen = new Set();

  function push(kind, id, label) {
    const cleanId = String(id || "").trim();
    if (!cleanId || seen.has(`${kind}:${cleanId}`)) return;
    const href =
      kind === "contexto"
        ? `/painel/contextos?contexto=${encodeURIComponent(cleanId)}`
        : `/painel/midias?midia=${encodeURIComponent(cleanId)}`;
    const compact = compactSupplementLabel(label, kind === "contexto" ? "Contexto" : "Mídia");
    if (!compact) return;
    seen.add(`${kind}:${cleanId}`);
    out.push({ kind, id: cleanId, label: compact, href });
  }

  const matchedContexto =
    proposal.matched_contexto && typeof proposal.matched_contexto === "object"
      ? proposal.matched_contexto
      : null;
  const matchedContextoId =
    matchedContexto && typeof matchedContexto.id_contexto_empresa === "string"
      ? matchedContexto.id_contexto_empresa.trim()
      : "";
  if (matchedContextoId && ctxById.has(matchedContextoId)) {
    const row = ctxById.get(matchedContextoId);
    push("contexto", matchedContextoId, String(row?.nome ?? matchedContexto?.nome ?? "Contexto"));
  }

  const refs = Array.isArray(proposal.midias_referenced) ? proposal.midias_referenced : [];
  for (const item of refs) {
    if (!item || typeof item !== "object") continue;
    const id = typeof item.id_midia === "string" ? item.id_midia.trim() : "";
    if (!id || !midById.has(id)) continue;
    const row = midById.get(id);
    push(
      "midia",
      id,
      String(item.nome_exibicao ?? row?.nome_exibicao ?? row?.nome_arquivo ?? "Mídia do acervo"),
    );
    if (out.length >= 8) return out;
  }

  for (const item of extra) {
    push(item.kind, item.id, item.label);
    if (out.length >= 8) break;
  }
  return out;
}

function proposalHasMidiaRefs(proposal) {
  const refs = proposal?.midias_referenced;
  return Array.isArray(refs) && refs.some((r) => r && typeof r === "object" && String(r.id_midia ?? "").trim());
}

function buildReadyConfirmationMessage(links, proposal) {
  const hasMidiaLink = Array.isArray(links) && links.some((l) => l?.kind === "midia");
  if (hasMidiaLink || proposalHasMidiaRefs(proposal)) {
    return "Confira o resumo e os PNGs do acervo abaixo antes de gerar.";
  }
  return "Revise o resumo antes de gerar.";
}

/**
 * Inclui imagens anexadas no chat como referências de mídia (prioridade sobre heurística).
 * @param {Record<string, unknown>} proposal
 * @param {string[]} attachmentIds
 * @param {Array<Record<string, unknown>>} midiaRows
 */
function mergeChatAttachmentMidiasIntoProposal(proposal, attachmentIds, midiaRows) {
  const p = proposal && typeof proposal === "object" ? { ...proposal } : {};
  const ids = [...new Set((attachmentIds || []).map((x) => String(x || "").trim()).filter(Boolean))].slice(
    0,
    3,
  );
  if (!ids.length) return p;

  const byId = new Map(midiaRows.map((r) => [String(r.id_midia ?? "").trim(), r]));
  const fromChat = ids
    .map((id) => {
      const row = byId.get(id);
      if (!row) return null;
      return {
        id_midia: id,
        nome_exibicao: String(row.nome_exibicao ?? row.nome_arquivo ?? "Imagem do chat").trim(),
        why: "Imagem anexada pelo cliente no chat.",
      };
    })
    .filter(Boolean);

  if (!fromChat.length) return p;

  const existing = Array.isArray(p.midias_referenced) ? p.midias_referenced : [];
  const seen = new Set(fromChat.map((r) => r.id_midia));
  const rest = existing.filter((item) => {
    const id = item && typeof item === "object" ? String(item.id_midia ?? "").trim() : "";
    return id && !seen.has(id);
  });
  p.midias_referenced = [...fromChat, ...rest].slice(0, 3);
  if (!p.hero_product) {
    p.hero_product = buildHeroProductSelection(
      fromChat.map((item) => byId.get(item.id_midia)).filter(Boolean),
      "",
      true,
    );
  }
  return p;
}

function ensureProposalMidiasReferenced(proposal, midiaRows, userHint) {
  const p = proposal && typeof proposal === "object" ? { ...proposal } : {};
  const picked = pickReferencedMidias(midiaRows, userHint, 3);
  if (!picked.length) return p;
  p.midias_referenced = picked.map((row) => ({
    id_midia: String(row.id_midia ?? "").trim(),
    nome_exibicao: String(row.nome_exibicao ?? row.nome_arquivo ?? "Mídia").trim() || "Mídia",
    nome_arquivo: String(row.nome_arquivo ?? "").trim() || undefined,
    why: "PNG do acervo selecionado conforme o pedido.",
  }));
  p.hero_product = buildHeroProductSelection(picked, userHint, true);
  return p;
}

function normalizeMidiasReferencedRows(proposal, midiaRows) {
  const p = proposal && typeof proposal === "object" ? proposal : {};
  const byId = new Map(midiaRows.map((r) => [String(r.id_midia ?? "").trim(), r]));
  const refs = Array.isArray(p.midias_referenced) ? p.midias_referenced : [];
  p.midias_referenced = refs
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const id = typeof item.id_midia === "string" ? item.id_midia.trim() : "";
      const row = id ? byId.get(id) : null;
      if (!row) return null;
      return {
        id_midia: id,
        nome_exibicao:
          String(item.nome_exibicao ?? row.nome_exibicao ?? row.nome_arquivo ?? "Mídia").trim() ||
          "Mídia",
        nome_arquivo: String(row.nome_arquivo ?? "").trim() || undefined,
        descricao: String(row.descricao ?? "").trim() || undefined,
        alt_text: String(row.alt_text ?? "").trim() || undefined,
        why:
          typeof item.why === "string" && item.why.trim()
            ? item.why.trim().slice(0, 240)
            : "PNG do acervo vinculado ao pedido.",
      };
    })
    .filter(Boolean)
    .slice(0, 3);
  return p;
}

function finalizePostContextProposal(proposal, midiaRows, history, userHint, cadastroCtx = null) {
  const hint = resolveActivePedidoHint(history, {
    proposal,
    question: userHint,
  });
  let p = proposal && typeof proposal === "object" ? { ...proposal } : {};
  if (!String(p.intent_summary ?? "").trim() && hint) {
    p.intent_summary = hint.slice(0, 500);
  }
  const productMissing = p.product_media_status === "missing";
  if (productMissing) {
    p.midias_referenced = [];
    p.hero_product = null;
  } else {
    p = reconcileProposalMidias(p, midiaRows, hint);
    p = ensureProposalMidiasReferenced(p, midiaRows, hint);
    p = normalizeMidiasReferencedRows(p, midiaRows);
    p.hero_product = normalizeHeroProductSelection(p.hero_product, p.midias_referenced);
  }
  const mandatoryFacts = collectMandatoryImageFacts(history, p);
  if (Object.keys(mandatoryFacts).length) {
    if (!p.facts_for_image || typeof p.facts_for_image !== "object") {
      p.facts_for_image = {};
    }
    Object.assign(p.facts_for_image, mandatoryFacts);
  }

  const cadastro = cadastroCtx && typeof cadastroCtx === "object" ? cadastroCtx : {};
  const pedidoText = hint || String(p.intent_summary ?? "").trim();
  if (Array.isArray(cadastro.contextoRows) && cadastro.contextoRows.length) {
    p = reconcileMatchedContextoFromPedido(p, cadastro.contextoRows, pedidoText);
  }
  p.pedido_campanha = extractPedidoCampanhaLabels(pedidoText);
  p.resumo_visual = buildResumoVisual(p, history, hint, {
    empresaRow: cadastro.empresaRow || null,
    identidadeDados: cadastro.identidadeDados || null,
  });
  p.montagem_resumo = buildMontagemResumo(p);
  return p;
}

function formatHistoryForPrompt(history) {
  const tail = history.slice(-8);
  const lines = [];
  for (const m of tail) {
    const role = m.role === "user" ? "Cliente" : "Assistente";
    const content = String(m.content ?? "").trim();
    if (isPanelNoiseMessage(m.role, content)) continue;
    lines.push(`${role}: ${content.slice(0, 1200)}`);
  }
  return lines.length ? lines.join("\n---\n") : "(sem mensagens úteis no histórico)";
}

function formatIdentidadeForLlm(rows) {
  const { identidadeDados } = partitionContextosIdentidade(rows);
  if (!identidadeDados) return "(identidade da marca não configurada no painel)";
  return formatBrandIdentityBlockForFlux(identidadeDados, 640);
}

/** Campanhas só para escolher matched_contexto / links — sem JSON pesado. */
function formatCampanhaResumoForLlm(rows) {
  const { campanhaRows } = partitionContextosIdentidade(rows);
  if (!campanhaRows.length) return "(nenhuma campanha ativa)";
  return campanhaRows
    .slice(0, 8)
    .map((r, i) => {
      const id = r.id_contexto_empresa ?? `idx-${i}`;
      const nome = String(r.nome ?? "").trim() || "(sem nome)";
      const desc = String(r.descricao ?? "").trim();
      return `### contexto_id=${id}\nnome: ${nome}\ndescricao: ${desc.slice(0, 400)}`;
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
function buildFallbackProposalFromPanel(history, contextoRows, midiaRows, empresaRow = null) {
  const hint = resolveActivePedidoHint(history);
  const { identidadeDados } = partitionContextosIdentidade(contextoRows);
  const ctx = pickBestCampaignContext(contextoRows, hint);
  const midias = pickReferencedMidias(midiaRows, hint, 3);
  const frase = deriveFraseNaImagemFromHistory(history, contextoRows);
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
  for (const mid of midias) {
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
  const midias_referenced = midias.map((mid) => ({
    id_midia: String(mid.id_midia ?? "").trim(),
    nome_exibicao: String(mid.nome_exibicao ?? mid.nome_arquivo ?? "Mídia").trim(),
    why: "Referência escolhida automaticamente a partir do pedido.",
  }));
  const intent = hint.slice(0, 500);
  const missing = listMissingBriefingSlots(history, { intent_summary: intent, frase_na_imagem: frase });
  let proposal = {
    intent_summary: intent,
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
    hero_product: buildHeroProductSelection(midias, hint, true),
  };
  const gate = applyProductMediaGate(proposal, midiaRows, hint, history);
  proposal = finalizePostContextProposal(gate.proposal, midiaRows, history, hint, {
    empresaRow,
    identidadeDados,
    contextoRows,
  });
  const resolvedLinks = resolvePostSupplementLinks(links, proposal, contextoRows, midiaRows);

  if (gate.blocked) {
    return {
      confirmation_message: gate.confirmation_message,
      briefing_status: "collecting",
      missing_slots: gate.missing_slots,
      links: resolvedLinks.filter((l) => l.kind === "contexto"),
      post_context_proposal: proposal,
    };
  }

  return {
    confirmation_message: buildReadyConfirmationMessage(resolvedLinks, proposal),
    briefing_status: missing.length ? "collecting" : "ready",
    missing_slots: missing,
    links: resolvedLinks,
    post_context_proposal: proposal,
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
  const proposalModel = (env.LLAMA_PROPOSAL_MODEL || env.LLAMA_MODEL || DEFAULT_OLLAMA_CHAT_MODEL).trim();
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
 * Pipeline cru: sem Llama nem regras de briefing — só repassa o pedido para GPT Image 2.
 *
 * @param {Array<{ role: string, content: string }>} history
 */
/**
 * @param {Array<{ role: string, content: string }>} history
 * @param {string[]} brandColors
 * @param {Record<string, unknown> | null} [existingBrief]
 */
function buildRawPostContextProposal(history, brandColors = [], existingBrief = null) {
  const intent = resolvePedidoCliente(null, history, 2000);
  const extracted = buildArteBriefFromHistory(history, brandColors, existingBrief);
  const arte_brief = existingBrief
    ? mergeArteBriefUserEdits(existingBrief, extracted)
    : extracted;
  if (intent && !arte_brief.tema) {
    const scene = detectMontagemScene(intent);
    const goal = detectMontagemGoal(intent);
    const temaParts = [goal, scene].filter(Boolean).map((part) => titleWord(part));
    arte_brief.tema = temaParts.length ? temaParts.join(" · ") : "Arte promocional";
  }
  const ready = Boolean(String(arte_brief.tema ?? "").trim());
  const proposal = {
    intent_summary: intent || arte_brief.tema,
    matched_contexto: null,
    frase_na_imagem: arte_brief.titulo || arte_brief.texto || "",
    facts_for_image: {
      frase_na_imagem: arte_brief.titulo || arte_brief.texto || "",
      titulo: arte_brief.titulo,
      subtitulo: arte_brief.subtitulo,
    },
    midias_referenced: [],
    hero_product: null,
    arte_brief,
  };
  proposal.montagem_resumo = buildMontagemResumo(proposal);
  return {
    confirmation_message: ready
      ? "Confira o resumo da arte abaixo e ajuste se precisar."
      : "Defina o tema e o formato antes de gerar a prévia.",
    briefing_status: ready ? "ready" : "collecting",
    missing_slots: ready ? [] : ["frase_imagem"],
    links: [],
    post_context_proposal: proposal,
  };
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
  const {
    history,
    idEmpresa,
    db,
    arteBriefDraft = null,
    attachmentMidiaIds = [],
    focusContextoId = null,
  } = opts;
  const attachmentIds = Array.isArray(attachmentMidiaIds)
    ? attachmentMidiaIds.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const focusId = String(focusContextoId ?? "").trim() || null;

  if ((env.IMAGE_PIPELINE || "raw") === "raw") {
    const [contextoRows, midiaRows, empresaRow] = await Promise.all([
      loadContextosEmpresaAtivos(db, idEmpresa),
      loadMidiasEmpresaResumo(db, idEmpresa, 72),
      loadEmpresaResumoParaImagem(db, idEmpresa),
    ]);
    const { identidadeDados } = partitionContextosIdentidade(contextoRows);
    const brandColors = identidadeDados ? allBrandColorsFromIdentidade(identidadeDados) : [];
    const raw = buildFallbackProposalFromPanel(
      history,
      contextoRows,
      midiaRows,
      empresaRow,
    );
    const rawBrief = buildRawPostContextProposal(
      history,
      brandColors,
      arteBriefDraft && typeof arteBriefDraft === "object" ? arteBriefDraft : null,
    );
    const rawProposal =
      raw.post_context_proposal && typeof raw.post_context_proposal === "object"
        ? raw.post_context_proposal
        : {};
    const briefProposal =
      rawBrief.post_context_proposal && typeof rawBrief.post_context_proposal === "object"
        ? rawBrief.post_context_proposal
        : {};
    const rawRefs = Array.isArray(rawProposal.midias_referenced) ? rawProposal.midias_referenced : [];
    const briefRefs = Array.isArray(briefProposal.midias_referenced) ? briefProposal.midias_referenced : [];
    const mergedRefs = rawRefs.length ? rawRefs : briefRefs;
    let mergedProposal = {
      ...briefProposal,
      ...rawProposal,
      matched_contexto: rawProposal.matched_contexto || briefProposal.matched_contexto || null,
      midias_referenced: mergedRefs,
      arte_brief: briefProposal.arte_brief || rawProposal.arte_brief,
      hero_product:
        rawProposal.hero_product ||
        briefProposal.hero_product ||
        buildHeroProductSelection(mergedRefs, resolveActivePedidoHint(history), true),
    };
    const rawHint = resolveActivePedidoHint(history, { proposal: mergedProposal });
    mergedProposal = mergeChatAttachmentMidiasIntoProposal(mergedProposal, attachmentIds, midiaRows);
    const rawGate = applyProductMediaGate(mergedProposal, midiaRows, rawHint, history);
    mergedProposal = finalizePostContextProposal(rawGate.proposal, midiaRows, history, rawHint, {
      empresaRow,
      identidadeDados,
      contextoRows,
    });
    if (focusId) {
      mergedProposal = applyFocusContextoToProposal(mergedProposal, contextoRows, focusId);
    }
    const links = resolvePostSupplementLinks(raw.links, mergedProposal, contextoRows, midiaRows);
    if (rawGate.blocked) {
      return {
        confirmation_message: rawGate.confirmation_message,
        links: links.filter((l) => l.kind === "contexto"),
        post_context_proposal: mergedProposal,
        briefing_status: "collecting",
        missing_slots: rawGate.missing_slots,
        _meta: { pipeline: "raw", provider: env.IMAGE_PROVIDER || "replicate" },
      };
    }
    return {
      confirmation_message:
        rawBrief.briefing_status === "ready"
          ? buildReadyConfirmationMessage(links, mergedProposal)
          : rawBrief.confirmation_message,
      links,
      post_context_proposal: mergedProposal,
      briefing_status: rawBrief.briefing_status,
      missing_slots: rawBrief.missing_slots,
      _meta: { pipeline: "raw", provider: env.IMAGE_PROVIDER || "replicate" },
    };
  }

  const [empresaRow, contextoRows, midiaRows] = await Promise.all([
    loadEmpresaResumoParaImagem(db, idEmpresa),
    loadContextosEmpresaAtivos(db, idEmpresa),
    loadMidiasEmpresaResumo(db, idEmpresa, 72),
  ]);

  const instrucao = `${TUMA_IA_REGRAS_RESUMO_IMAGEM}

Você é o Tuma, IA de conteúdo do TumaIA — funcionário de marketing da empresa em sessão. O cliente já conversou sobre um pedido de post/conteúdo.
O cliente pode escrever de forma informal, com erros, abreviações ou informações no meio da frase — INTERPRETE o pedido completo (não exija formato perfeito).
Sua tarefa: (1) ler o histórico; (2) relacionar com os CONTEXTOS cadastrados no painel (tipos como data comemorativa, lançamento, promoção, personalizado, etc. vêm em schema_json/dados_json);
(3) usar o ACERVO DE MÍDIAS para links e para o campo JSON midias_referenced (nunca invente URLs de arquivo; use só ids listados em "### midia_id=");
(4) escrever UMA mensagem MUITO curta (ideal até 60 caracteres) em português do Brasil pedindo confirmação.
   Exemplo bom: "Clique nos itens que vou usar na arte."
   NÃO liste contexto, produtos, frase ou detalhes longos na confirmation_message; isso vai nos links e no post_context_proposal.
   PROIBIDO citar testes, painel técnico, Llama, Ollama, Replicate ou erros internos.
(5) preencher post_context_proposal com resumo estruturado para a próxima etapa (geração de imagem), incluindo:
   - "resumo_visual": descrição da COMPOSIÇÃO (elementos, layout, clima). INTERPRETE o cadastro desta empresa: segmento, identidade da marca, descrição e alt_text das mídias — funciona para qualquer segmento (pet shop, papelaria, café, etc.). Não use regras genéricas fixas nem copie o pedido literal do chat.
   - "frase_na_imagem": SOMENTE se o cliente pediu frase/texto explícito na arte (ex.: "frase: …"). Caso contrário deixe vazio. Não preencha só "Promoção".
(5b) briefing_status: "ready" se já dá para gerar a imagem (tema + frase ou sem texto explícito); "collecting" só se faltar algo CRÍTICO (máx. 2 lacunas). missing_slots: lista vazia se ready, senão ids entre produto, beneficio, periodo, frase_imagem. Em collecting, confirmation_message pergunta de forma natural (não lista robótica de formulário).
(6) preencher "links": palavras clicáveis no painel — cada item com kind "contexto" ou "midia", "id" UUID que EXISTA na lista acima, e "label" CURTÍSSIMO (1 a 3 palavras, sem extensão de arquivo). Inclua o matched_contexto e TODAS as midias_referenced também em links. Se não houver encaixe no banco, use "links": [].
(7) Se o cliente pedir arte com produto, embalagem, armações/óculos PNG ou "inserir" elemento do acervo, preencha "midias_referenced" com até 3 ids EXISTENTES em "### midia_id=".
   ORDEM CRÍTICA: a 1ª posição vai para o FLUX como image_prompt — deve ser RECORTE/PNG DE PRODUTO, NUNCA logo da marca (logo fica só no cantinho da arte), NUNCA um post/arte/banner/festa/400k já pronto do acervo.
   Só coloque o id do LOGO em 1º lugar se o cliente pedir EXPLICITAMENTE logo em destaque/principal/protagonista/arte da marca.
   Não use como 1ª referência imagens que pareçam post de Instagram, comemoração de seguidores, balões ou layout completo.
(8) preencher "hero_product" quando o cliente pedir um item específico como foco, centro, principal, destaque ou protagonista da arte. Esse campo define QUAL produto real deve receber o maior destaque visual na composição final. Se houver midias_referenced, hero_product deve apontar para uma delas. Se o cliente não explicitar um item principal, use a 1ª mídia referenciada como hero_product.

Responda APENAS um JSON válido com exatamente estas chaves de primeiro nível:
{
  "confirmation_message": "string",
  "briefing_status": "ready" | "collecting",
  "missing_slots": [],
  "links": [ { "kind": "contexto" | "midia", "id": "uuid", "label": "string" } ],
  "post_context_proposal": {
    "intent_summary": "string",
    "montagem_resumo": "string curta explicando como a IA vai montar a arte",
    "matched_contexto": { "id_contexto_empresa": "uuid ou null", "nome": "string", "tipo_schema": "string", "reason": "string" } | null,
    "resumo_visual": "string — composição visual (elementos, layout, clima; não regras)",
    "frase_na_imagem": "string opcional — só se o cliente pediu texto explícito na arte",
    "facts_for_image": { "chave": "valor" },
    "midias_referenced": [ { "id_midia": "uuid opcional", "nome_exibicao": "string", "why": "string" } ],
    "hero_product": { "id_midia": "uuid ou null", "nome_exibicao": "string", "reason": "string" } | null
  }
}

Regras:
- matched_contexto.id_contexto_empresa DEVE ser um dos ids listados em "### contexto_id=" ou null se nenhum encaixar bem.
- Cada links[].id DEVE ser exatamente um id listado em "### contexto_id=" (se kind=contexto) ou "### midia_id=" (se kind=midia). NUNCA invente UUID.
- midias_referenced só pode citar ids listados em "### midia_id=".
- hero_product.id_midia, se vier preenchido, também deve ser um dos ids listados em "### midia_id=" e deve preferencialmente estar dentro de midias_referenced.
- Interpretação do acervo (mídias) — o cliente pode citar nome de arquivo, apelido ou descrição imprecisa:
  - Compare o pedido com nome_exibicao, nome_arquivo, descricao e alt_text de cada mídia (não exija texto idêntico).
  - Trate como equivalentes: maiúsculas/minúsculas; underscore, hífen e espaço (ex.: "oculos_reto", "oculos-reto", "óculos reto"); pequenas variações de grafia ou singular/plural.
  - Use sobreposição de palavras-chave ou trechos: se o cliente disser "óculos reto" e existir arquivo "imagem-oculos-reto.jfif" ou nome_exibicao parecido, associe essa mídia.
  - Se houver várias candidatas, escolha a mais específica ao que foi pedido; na 1ª posição de midias_referenced coloque a principal para composição visual; em "why" explique brevemente o vínculo (ex.: "nome_arquivo contém oculos-reto como o cliente pediu").
  - Se nenhuma mídia for claramente relacionada, deixe midias_referenced vazio ou só contextos em links — não force UUID.
  - PROIBIDO trocar o produto pedido por outro do acervo (ex.: cliente pediu "monster" → não use "pro force", creatina, whey, etc.).
  - Só inclua mídia cujo nome_exibicao ou nome_arquivo contenha o produto/marca citado pelo cliente.
- frase_na_imagem: OBRIGATÓRIO quando o pedido tiver marco, promoção ou data — é o texto que aparece na imagem.
- facts_for_image: preços e ocasião EXPLÍCITOS do cliente são OBRIGATÓRIOS (ex.: precos_promocao: "1 por R$ 99,99 | 2 por R$ 149,99", ocasiao: "Dia dos Namorados"). Se o cliente informou valor, inclua no resumo_visual como elemento visual (ex.: preço ao lado do produto) — nunca omita na arte.
- Tom profissional e cordial. Sem markdown na confirmation_message.
- PROIBIDO responder com parágrafos de post pronto, legenda ou texto fora do JSON. A confirmation_message é só a pergunta de confirmação (1–2 frases, máx. 280 caracteres).`;

  const bloco = `
=== Cadastro empresa (segmento — interpretar o tipo de negócio) ===
${formatEmpresaForLlm(empresaRow)}

=== Identidade da marca (cores, estilo, público, tom — fonte da verdade visual) ===
${formatIdentidadeForLlm(contextoRows)}

=== Pedido do cliente (histórico — intent_summary e frase_na_imagem) ===
${formatHistoryForPrompt(history)}

=== Campanhas ativas (opcional — só para matched_contexto e links) ===
${formatCampanhaResumoForLlm(contextoRows)}

=== Mídias ativas (acervo — use descricao e alt_text para compor a cena) ===
${formatMidiasForLlm(midiaRows)}
`;

  const promptUser = `${instrucao}\n\n${bloco}`;

  let parsed;
  let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let model = env.LLAMA_MODEL || DEFAULT_OLLAMA_CHAT_MODEL;
  let usedPanelFallback = false;
  let fallbackMeta = null;

  const panelParsed = buildFallbackProposalFromPanel(history, contextoRows, midiaRows, empresaRow);

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

  let post_context_proposal =
    safe.data.post_context_proposal && typeof safe.data.post_context_proposal === "object"
      ? { ...safe.data.post_context_proposal }
      : {};

  const { campanhaRows } = partitionContextosIdentidade(contextoRows);
  const hint = resolveActivePedidoHint(history, { proposal: post_context_proposal });

  const derived = deriveFraseNaImagemFromHistory(history, campanhaRows);
  const explicitFrase = extractFraseFromUserText(hint);
  if (derived && explicitFrase) {
    post_context_proposal.frase_na_imagem = derived;
    if (!post_context_proposal.facts_for_image || typeof post_context_proposal.facts_for_image !== "object") {
      post_context_proposal.facts_for_image = {};
    }
    post_context_proposal.facts_for_image.frase_na_imagem = derived;
  } else if (!explicitFrase) {
    post_context_proposal.frase_na_imagem = "";
  }

  post_context_proposal = mergeChatAttachmentMidiasIntoProposal(
    post_context_proposal,
    attachmentIds,
    midiaRows,
  );

  let mediaGate = applyProductMediaGate(post_context_proposal, midiaRows, hint, history);
  post_context_proposal = mediaGate.proposal;

  const rawRefs = post_context_proposal.midias_referenced;
  if (Array.isArray(rawRefs) && rawRefs.length > 1 && midiaRows.length) {
    const ids = rawRefs
      .map((item) => (item && typeof item.id_midia === "string" ? item.id_midia.trim() : ""))
      .filter(Boolean);
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
    mediaGate = applyProductMediaGate(post_context_proposal, midiaRows, hint, history);
    post_context_proposal = mediaGate.proposal;
  }
  post_context_proposal.hero_product = normalizeHeroProductSelection(
    post_context_proposal.hero_product,
    post_context_proposal.midias_referenced,
  );
  const { identidadeDados } = partitionContextosIdentidade(contextoRows);
  post_context_proposal = finalizePostContextProposal(post_context_proposal, midiaRows, history, hint, {
    empresaRow,
    identidadeDados,
    contextoRows,
  });
  if (focusId) {
    post_context_proposal = applyFocusContextoToProposal(post_context_proposal, contextoRows, focusId);
  }

  if (mediaGate.blocked) {
    const blockedLinks = resolvePostSupplementLinks(
      safe.data.links,
      post_context_proposal,
      contextoRows,
      midiaRows,
    ).filter((l) => l.kind === "contexto");
    return {
      confirmation_message: mediaGate.confirmation_message,
      links: blockedLinks,
      post_context_proposal,
      briefing_status: "collecting",
      missing_slots: mediaGate.missing_slots,
      _meta: { used_panel_fallback: usedPanelFallback, ...(fallbackMeta || {}) },
    };
  }

  const links = resolvePostSupplementLinks(safe.data.links, post_context_proposal, contextoRows, midiaRows);

  const base = {
    confirmation_message: safe.data.confirmation_message.trim(),
    briefing_status:
      typeof coerced?.briefing_status === "string" ? coerced.briefing_status : undefined,
    missing_slots: coerced?.missing_slots,
    links,
    post_context_proposal,
  };

  const gated = applyBriefingGate(history, base);

  const finalLinks = resolvePostSupplementLinks(
    gated.links,
    gated.post_context_proposal,
    contextoRows,
    midiaRows,
  );

  return {
    confirmation_message:
      gated.briefing_status === "ready"
        ? buildReadyConfirmationMessage(finalLinks, gated.post_context_proposal)
        : gated.confirmation_message,
    links: finalLinks,
    post_context_proposal: gated.post_context_proposal,
    briefing_status: gated.briefing_status,
    missing_slots: gated.missing_slots,
    _meta: {
      contextos_carregados: contextoRows.length,
      midias_carregadas: midiaRows.length,
      briefing_status: gated.briefing_status,
      missing_slots: gated.missing_slots,
      ...(fallbackMeta ? { fallback: fallbackMeta } : {}),
    },
  };
}
