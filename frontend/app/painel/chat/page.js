"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../../components/Modal";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import {
  detectImageGenerationIntent,
  detectImageGenerationIntentFromHistory,
} from "../../../lib/chatDeliveryUi";
import { buildWagnerPostImageMockResult, isWagnerPostImageMock } from "../../../lib/devChatShortcuts";
import {
  findLatestCaptionMessageId,
  isCaptionAssistantMessage,
  parseTypedDeliveryCommand,
  resolveImageUrlForRevision,
} from "../../../lib/chatDeliveryCommands";
import {
  clearChatSession,
  loadChatSession,
  saveChatSession,
} from "../../../lib/chatSessionPersistence";
import { IDENTIDADE_CONTEXTO_NOME, isIdentidadeMarcaContextoRow } from "../../../lib/identidadeMarcaUi";
import { resolveEmpresaAtivaId, setEmpresaAtiva, empresaRowFromMinhas, idEmpresaUltimaFromMinhasPayload } from "../../../lib/empresaAtiva";
import ChatImageConfirmBlock from "./ChatImageConfirmBlock";
import ChatFormatoBar from "./ChatFormatoBar";
import ChatGeneratedImagePreview from "./ChatGeneratedImagePreview";
import ChatSlashMenu from "./ChatSlashMenu";
import ChatSlashInput from "./ChatSlashInput";
import {
  countChipsBefore,
  emptySlashChips,
  formatSlashInputForSend,
  insertChipCharAtSlash,
  listSlashChipMidiaIds,
  reconcileSlashChipsWithText,
  removeModeloChipFromState,
  slashChipsToApiPicks,
  SLASH_MENU_MAX_MIDIAS,
  parseSlashTrigger,
  stripLegacyChatInputMarkers,
} from "../../../lib/chatSlashMenu";
import { arteBriefReady, emptyArteBrief, normalizeArteBrief } from "../../../lib/arteFormatPresets";
import {
  CHAT_PEDIDO_AGUARDE_MSG,
  CHAT_PEDIDO_COLETANDO_INTRO,
  CHAT_PEDIDO_RESUMO_MSG,
  patchMessageContextoSelection,
} from "./chatImageConfirmUtils";

/** Alinhado a REPLICATE_GPT_IMAGE_TIMEOUT_MS no backend (300s) + margem. */
const IMAGE_PREVIEW_TIMEOUT_MS = 310_000;
/** Salvar conversa durante geração longa de imagem. */
const SYNC_MENSAGENS_TIMEOUT_MS = 90_000;
/** Painel imediato ~3s; com Llama no .env até ~32s + margem. */
const POST_CONTEXT_TIMEOUT_MS = 55_000;
/** Legenda + hashtags (Llama). */
const POST_CAPTION_TIMEOUT_MS = 55_000;
const POST_IMAGE_UI = [
  { id: "revise_image", label: "Alterar imagem" },
  { id: "generate_caption", label: "Gerar legenda" },
];
const POST_CAPTION_UI = [
  { id: "adjust_caption", label: "Mudar legenda" },
  { id: "publish_instagram", label: "Publicar no Instagram" },
];
/**
 * POST /ia/chat: boot do worker (Chroma, até ~8 min) + pergunta (até ~6 min) + margem.
 * Alinhar com CHAT_WORKER_* no backend/.env e proxyTimeout no next.config.mjs.
 */
const CHAT_IA_TIMEOUT_MS = 900_000;
const CONFIRM_IMAGE_USER_LINE = "Confirmar e gerar imagem.";
const HIDDEN_USER_LINES = new Set([
  CONFIRM_IMAGE_USER_LINE,
  "Gerar imagem.",
  "Gerar prévia da imagem.",
]);
const WEAK_ARTE_THEME_RE =
  /^(oi+|ol[aá]+|opa+|e\s*a[ií]+|bom dia|boa tarde|boa noite|tudo bem|blz+|ok+|teste+)$/i;

function isWeakArteTheme(value) {
  const t = String(value || "").trim();
  return !t || t.length < 6 || WEAK_ARTE_THEME_RE.test(t);
}

function modeloSlugFromContextoRow(row) {
  if (!row) return "";
  if (
    row.schema_json &&
    typeof row.schema_json === "object" &&
    typeof row.schema_json.playbook_slug === "string"
  ) {
    return row.schema_json.playbook_slug.trim();
  }
  if (
    row.dados_json &&
    typeof row.dados_json === "object" &&
    typeof row.dados_json.playbook_slug === "string"
  ) {
    return row.dados_json.playbook_slug.trim();
  }
  return "";
}

function friendlyUiActionLabel(action) {
  if (action?.id === "confirm_generate_image") return "Gerar imagem";
  if (action?.id === "generate_caption") return "Gerar legenda";
  if (action?.id === "revise_image") return "Alterar imagem";
  if (action?.id === "adjust_caption") return "Mudar legenda";
  if (action?.id === "publish_instagram") return "Publicar no Instagram";
  const label = String(action?.label ?? "").trim();
  return label.replace(/\s*\(Replicate\s*\/\s*créditos\)\s*/gi, "").trim() || "Continuar";
}

/** Texto enviado no chat ao tocar botão pós-imagem (estilo WhatsApp). */
function quickReplyUserLineForAction(actionId) {
  if (actionId === "generate_caption") return "Gerar legenda";
  if (actionId === "revise_image") return "Alterar imagem";
  if (actionId === "adjust_caption") return "Mudar legenda";
  if (actionId === "publish_instagram") return "Publicar no Instagram";
  return null;
}

/**
 * @param {Array<object>} prev
 * @param {string} fromAssistantMessageId
 * @param {string} userLine
 * @param {(m: object) => object} [patchSourceMessage]
 */
function appendQuickReplyUserMessage(prev, fromAssistantMessageId, userLine, patchSourceMessage) {
  const patched = prev.map((m) => {
    if (m.id !== fromAssistantMessageId) return m;
    return patchSourceMessage ? patchSourceMessage(m) : { ...m, ui_actions: undefined };
  });
  const userMsg = { id: crypto.randomUUID(), role: "user", content: userLine };
  return { msgs: [...patched, userMsg], userMsg };
}

function isHiddenUserMessage(message) {
  if (message?.role === "user" && HIDDEN_USER_LINES.has(String(message.content ?? "").trim())) return true;
  if (message?.role === "user" && isWagnerPostImageMock(message.content)) return true;
  return false;
}

/**
 * Só gera direto se o usuário pediu para GERAR a prévia (resumo já exibido).
 * "Montar arte", "criar post" etc. sempre passam pelo chat + confirmação.
 */
function shouldGenerateImagePreviewDirectly(text) {
  const raw = String(text || "").trim();
  if (HIDDEN_USER_LINES.has(raw)) return true;
  const t = raw.toLowerCase();
  if (t.length < 8) return false;
  return (
    (/\bconfirm(ar|o)\b/.test(t) && /\b(imagem|arte)\b/.test(t)) ||
    /\bgera(r)?\s+(a\s+)?imagem\b/.test(t) ||
    /\bgera(r)?\s+(a\s+)?pr[eé]via\b/.test(t) ||
    /\bpr[eé]via\s+(da\s+)?im(agem)?\b/.test(t)
  );
}

/** Mensagem da IA que já tem resumo confirmável (evita pular confirmação com proposta antiga). */
function findLatestConfirmedProposalAnchor(msgs, arteDraft) {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role !== "assistant") continue;
    const sup = m.post_supplement;
    const proposal = sup?.post_context_proposal;
    const hasConfirmText =
      typeof sup?.confirmation_message === "string" && sup.confirmation_message.trim().length >= 8;
    const hasImageAction = Array.isArray(m.ui_actions) && m.ui_actions.some((a) => a?.id === "confirm_generate_image");
    const confirmed = hasConfirmText || hasImageAction;
    if (confirmed && proposal && typeof proposal === "object" && Object.keys(proposal).length > 0) {
      return {
        proposal: proposalWithArteDraft(proposal, arteDraft),
        supplement: sup,
        messageId: m.id,
        selected_contexto_id: m.selected_contexto_id,
      };
    }
  }
  if (arteDraft && arteBriefReady(arteDraft)) {
    return {
      proposal: proposalWithArteDraft({}, arteDraft),
      supplement: null,
      messageId: null,
      selected_contexto_id: null,
    };
  }
  return null;
}

function normalizeSupplementLink(l) {
  if (!l || typeof l !== "object") return null;
  const kind = l.kind === "midia" || l.kind === "contexto" ? l.kind : null;
  const id = typeof l.id === "string" ? l.id.trim() : "";
  const label = typeof l.label === "string" ? l.label.trim() : "";
  if (!kind || !id || !label) return null;
  const href =
    typeof l.href === "string" && l.href.startsWith("/")
      ? l.href
      : kind === "contexto"
        ? `/painel/contextos?contexto=${encodeURIComponent(id)}`
        : `/painel/midias?midia=${encodeURIComponent(id)}`;
  return { kind, id, label, href };
}

/** Alinhado ao limite do POST /ia/chat (backend/src/services/chatHistoryLimit.js). */
const CHAT_HISTORY_API_MAX = 80;

function historyFromMessages(msgs) {
  const full = msgs
    .filter((m) => m && !m.hidden && !isHiddenUserMessage(m))
    .map((m) => ({ role: m.role, content: messageConteudoForApi(m) }));
  return full.length > CHAT_HISTORY_API_MAX ? full.slice(-CHAT_HISTORY_API_MAX) : full;
}

function historyThroughMessage(msgs, messageId) {
  const idx = msgs.findIndex((m) => m.id === messageId);
  const slice = idx >= 0 ? msgs.slice(0, idx + 1) : msgs;
  return historyFromMessages(slice);
}

function formatCaptionAssistantContent({ legenda, hashtags }) {
  const body = String(legenda || "").trim();
  const tags = (Array.isArray(hashtags) ? hashtags : []).filter(Boolean).join(" ");
  return tags ? `${body}\n\n${tags}` : body;
}

function findLatestImageUrlInMessages(msgs) {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const urls = msgs[i]?.image_urls;
    if (Array.isArray(urls) && typeof urls[0] === "string" && urls[0].trim()) {
      return urls[0].trim();
    }
  }
  return null;
}

function findLatestImageMessageId(msgs) {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role === "assistant" && Array.isArray(m.image_urls) && m.image_urls.length) {
      return m.id;
    }
  }
  return null;
}

function buildImagePreviewAssistantMessage(out, contextoLinha, contentSuffix = "") {
  const base =
    imagePreviewSuccessLine(out.urls, out.model, out.imageGeneration) + contextoLinha + contentSuffix;
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: base,
    sources: [],
    image_urls: out.urls.length ? out.urls : undefined,
    image_midia_ids: out.imageMidiaIds?.length ? out.imageMidiaIds : undefined,
    ui_actions: out.urls.length ? POST_IMAGE_UI : undefined,
  };
}

function findLatestImageProposalObject(msgs) {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role !== "assistant") continue;
    const p = m.post_supplement?.post_context_proposal;
    if (p && typeof p === "object" && Object.keys(p).length > 0) return p;
    const legacy = m.post_context_proposal;
    if (legacy && typeof legacy === "object" && Object.keys(legacy).length > 0) return legacy;
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** UUIDs de mídias de imagem para referência visual (máx. 3). */
function referenceMidiaIdsFromProposal(proposal, supplementLinks) {
  const ids = [];
  const push = (id) => {
    const t = typeof id === "string" ? id.trim() : "";
    if (t && UUID_RE.test(t) && !ids.includes(t)) ids.push(t);
  };
  if (proposal && typeof proposal === "object") {
    if (
      proposal.hero_product &&
      typeof proposal.hero_product === "object" &&
      typeof proposal.hero_product.id_midia === "string"
    ) {
      push(proposal.hero_product.id_midia);
      if (ids.length >= 3) return ids;
    }
    const raw = proposal.midias_referenced;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item && typeof item.id_midia === "string") push(item.id_midia);
        if (ids.length >= 3) return ids;
      }
    }
    const plinks = proposal.links;
    if (Array.isArray(plinks)) {
      for (const l of plinks) {
        if (l && l.kind === "midia") push(l.id);
        if (ids.length >= 3) return ids;
      }
    }
  }
  if (Array.isArray(supplementLinks)) {
    for (const l of supplementLinks) {
      if (l && l.kind === "midia") push(l.id);
      if (ids.length >= 3) return ids;
    }
  }
  return ids.slice(0, 3);
}

function aspectRatioForImageApi(brief) {
  const r = String(brief?.formato?.ratio ?? "").trim();
  const map = { "4:5": "2:3", "4:3": "3:2" };
  const mapped = map[r] || r;
  const allowed = new Set(["1:1", "16:9", "9:16", "3:2", "2:3"]);
  return allowed.has(mapped) ? mapped : "1:1";
}

function proposalWithArteDraft(proposal, arteDraft) {
  const base = proposal && typeof proposal === "object" ? { ...proposal } : {};
  const draft = normalizeArteBrief(arteDraft);
  const merged = normalizeArteBrief({
    ...(base.arte_brief && typeof base.arte_brief === "object" ? base.arte_brief : {}),
    ...draft,
  });
  return { ...base, arte_brief: merged, intent_summary: base.intent_summary || merged.tema };
}

function buildImagePreviewRequestBody({
  history,
  empresaId,
  conversaId,
  proposal,
  supplementLinks,
  focusContextoId,
  arteDraft,
  revisionSourceUrl,
  revisionInstructions,
}) {
  const reference_midia_ids = referenceMidiaIdsFromProposal(proposal, supplementLinks);
  const linksForApi = Array.isArray(supplementLinks)
    ? supplementLinks
        .filter((l) => l && (l.kind === "midia" || l.kind === "contexto") && typeof l.id === "string")
        .map((l) => ({ kind: l.kind, id: l.id.trim() }))
        .filter((l) => UUID_RE.test(l.id))
    : [];
  const focus =
    focusContextoId && UUID_RE.test(String(focusContextoId).trim())
      ? String(focusContextoId).trim()
      : null;
  const prop =
    proposal && typeof proposal === "object" && Object.keys(proposal).length
      ? proposalWithArteDraft(proposal, arteDraft)
      : arteDraft
        ? proposalWithArteDraft({}, arteDraft)
        : null;
  const aspect = prop?.arte_brief ? aspectRatioForImageApi(prop.arte_brief) : null;
  return {
    history,
    id_empresa: empresaId,
    ...(conversaId && UUID_RE.test(String(conversaId)) ? { id_conversa: String(conversaId) } : {}),
    ...(prop && Object.keys(prop).length ? { post_context_proposal: prop } : {}),
    ...(aspect ? { aspect_ratio: aspect } : {}),
    ...(linksForApi.length ? { post_supplement_links: linksForApi } : {}),
    ...(reference_midia_ids.length ? { reference_midia_ids } : {}),
    ...(focus ? { focus_contexto_id: focus } : {}),
    ...(revisionSourceUrl && revisionInstructions
      ? {
          revision_source_url: revisionSourceUrl,
          revision_instructions: revisionInstructions,
        }
      : {}),
  };
}

function buildImageContextNote(cg) {
  if (!cg || typeof cg !== "object") return "";
  const lines = [];
  const pedido =
    typeof cg.pedido_resumo === "string" && cg.pedido_resumo.trim()
      ? cg.pedido_resumo.trim()
      : null;
  if (pedido) {
    const curto = pedido.length > 120 ? `${pedido.slice(0, 119)}…` : pedido;
    lines.push(`Pedido: ${curto}`);
  }
  const frase =
    typeof cg.frase_na_imagem === "string" && cg.frase_na_imagem.trim()
      ? cg.frase_na_imagem.trim()
      : null;
  if (frase) lines.push(`Frase na imagem: «${frase}»`);
  const hero =
    cg.hero_product &&
    typeof cg.hero_product === "object" &&
    typeof cg.hero_product.nome_exibicao === "string" &&
    cg.hero_product.nome_exibicao.trim()
      ? cg.hero_product.nome_exibicao.trim()
      : null;
  if (hero) lines.push(`Produto foco: ${hero}`);
  return lines.length ? `\n\n(${lines.join(" · ")})` : "";
}

function imagePreviewSuccessLine(urls, model, imageGeneration) {
  const modelLabel = typeof model === "string" && model.trim() ? ` (${model.trim()})` : "";
  if (urls.length <= 0) {
    return "A geração terminou sem imagem. Tente de novo ou ajuste o pedido no chat.";
  }
  if (imageGeneration?.composed_preview_error) {
    return `Prévia parcial do cenário${modelLabel} — não consegui aplicar os produtos e a logo do acervo nesta tentativa:`;
  }
  if (imageGeneration?.composed_preview) {
    const assetsLabel = imageGeneration?.composed_logo
      ? " com produtos e logo do acervo"
      : " com itens do acervo";
    return `Prévia da imagem${modelLabel}${assetsLabel}:`;
  }
  if (imageGeneration?.preview_revision) {
    return `Prévia atualizada${modelLabel}:`;
  }
  return `Prévia da imagem${modelLabel}:`;
}

function lastConversaStorageKey(empresaId) {
  return `tuma_chat_last_conversa_${empresaId || "none"}`;
}

function arteBriefStorageKey(empresaId) {
  return `tuma_arte_brief_${empresaId || "none"}`;
}

function formatoBarCollapsedStorageKey(empresaId) {
  return `tuma_chat_formato_collapsed_${empresaId || "none"}`;
}

function fromApiMensagem(m) {
  if (!m || typeof m !== "object") return null;
  const papel = m.papel === "user" || m.papel === "assistant" ? m.papel : null;
  const conteudo = typeof m.conteudo === "string" ? m.conteudo : "";
  if (!papel || !conteudo) return null;
  const meta = m.metadados_json;
  const sources =
    meta && typeof meta === "object" && Array.isArray(meta.sources)
      ? meta.sources.filter((s) => typeof s === "string" && s.trim())
      : [];
  const ui_actions =
    meta && typeof meta === "object" && Array.isArray(meta.ui_actions)
      ? meta.ui_actions.filter(
          (a) =>
            a &&
            typeof a === "object" &&
            typeof a.id === "string" &&
            a.id.trim() &&
            typeof a.label === "string" &&
            a.label.trim(),
        )
      : [];
  const image_urls =
    meta && typeof meta === "object" && Array.isArray(meta.image_urls)
      ? meta.image_urls.filter((u) => typeof u === "string" && u.trim())
      : [];
  const image_midia_ids =
    meta && typeof meta === "object" && Array.isArray(meta.image_midia_ids)
      ? meta.image_midia_ids.filter((id) => typeof id === "string" && UUID_RE.test(id.trim()))
      : [];
  const post_supplementRaw =
    meta && typeof meta === "object" && meta.post_supplement && typeof meta.post_supplement === "object"
      ? meta.post_supplement
      : null;
  let post_supplement;
  if (post_supplementRaw && typeof post_supplementRaw.confirmation_message === "string") {
    const cm = post_supplementRaw.confirmation_message.trim();
    if (cm) {
      const rawLinks = Array.isArray(post_supplementRaw.links) ? post_supplementRaw.links : [];
      const links = rawLinks.map(normalizeSupplementLink).filter(Boolean);
      const post_context_proposal =
        post_supplementRaw.post_context_proposal && typeof post_supplementRaw.post_context_proposal === "object"
          ? post_supplementRaw.post_context_proposal
          : {};
      post_supplement = {
        confirmation_message: cm,
        links,
        post_context_proposal,
        ...(post_supplementRaw.briefing_status === "collecting" || post_supplementRaw.briefing_status === "ready"
          ? { briefing_status: post_supplementRaw.briefing_status }
          : {}),
        ...(Array.isArray(post_supplementRaw.missing_slots)
          ? { missing_slots: post_supplementRaw.missing_slots }
          : {}),
      };
    } else if (
      post_supplementRaw.post_context_proposal &&
      typeof post_supplementRaw.post_context_proposal === "object" &&
      Object.keys(post_supplementRaw.post_context_proposal).length > 0
    ) {
      const rawLinks = Array.isArray(post_supplementRaw.links) ? post_supplementRaw.links : [];
      const links = rawLinks.map(normalizeSupplementLink).filter(Boolean);
      post_supplement = {
        confirmation_message:
          String(post_supplementRaw.confirmation_message ?? "").trim() || CHAT_PEDIDO_RESUMO_MSG,
        links,
        post_context_proposal: post_supplementRaw.post_context_proposal,
        ...(post_supplementRaw.briefing_status === "collecting" || post_supplementRaw.briefing_status === "ready"
          ? { briefing_status: post_supplementRaw.briefing_status }
          : {}),
        ...(Array.isArray(post_supplementRaw.missing_slots)
          ? { missing_slots: post_supplementRaw.missing_slots }
          : {}),
      };
    }
  }
  const post_context_proposal =
    meta && typeof meta === "object" && meta.post_context_proposal && typeof meta.post_context_proposal === "object"
      ? meta.post_context_proposal
      : undefined;
  const hidden = meta && typeof meta === "object" && meta.hidden === true;
  const selected_contexto_id =
    meta && typeof meta === "object" && typeof meta.selected_contexto_id === "string"
      ? meta.selected_contexto_id.trim()
      : null;
  const out = {
    id: typeof m.id_mensagem === "string" ? m.id_mensagem : crypto.randomUUID(),
    role: papel,
    content: conteudo,
    sources,
    ui_actions: ui_actions.length ? ui_actions : undefined,
    image_urls: image_urls.length ? image_urls : undefined,
    image_midia_ids: image_midia_ids.length ? image_midia_ids : undefined,
    ...(hidden ? { hidden: true } : {}),
    ...(selected_contexto_id && UUID_RE.test(selected_contexto_id)
      ? { selected_contexto_id }
      : {}),
  };
  if (post_supplement) out.post_supplement = post_supplement;
  if (post_context_proposal && Object.keys(post_context_proposal).length > 0 && !post_supplement) {
    out.post_context_proposal = post_context_proposal;
  }
  return out;
}

function messageConteudoForApi(m) {
  const raw = String(m?.content ?? "").trim();
  if (raw) return raw;
  const sup =
    m?.post_supplement &&
    typeof m.post_supplement.confirmation_message === "string" &&
    m.post_supplement.confirmation_message.trim();
  if (sup) return sup.slice(0, 50000);
  if (Array.isArray(m?.image_urls) && m.image_urls.length) {
    return "Prévia da imagem gerada.";
  }
  return "—";
}

function toApiMensagens(messages) {
  return messages.map((m) => {
    const meta = {};
    if (m.sources && m.sources.length) meta.sources = m.sources;
    if (m.ui_actions && m.ui_actions.length) meta.ui_actions = m.ui_actions;
    if (m.image_urls && m.image_urls.length) meta.image_urls = m.image_urls;
    if (m.image_midia_ids && m.image_midia_ids.length) meta.image_midia_ids = m.image_midia_ids;
    if (m.post_supplement && typeof m.post_supplement === "object") {
      const hasConfirm =
        typeof m.post_supplement.confirmation_message === "string" &&
        m.post_supplement.confirmation_message.trim();
      const hasBrief = m.post_supplement.post_context_proposal?.arte_brief;
      const hasLinks = Array.isArray(m.post_supplement.links) && m.post_supplement.links.length > 0;
      if (hasConfirm || hasBrief || hasLinks) meta.post_supplement = m.post_supplement;
    }
    if (m.post_context_proposal && typeof m.post_context_proposal === "object" && Object.keys(m.post_context_proposal).length > 0) {
      meta.post_context_proposal = m.post_context_proposal;
    }
    if (m.hidden) meta.hidden = true;
    if (m.selected_contexto_id && UUID_RE.test(String(m.selected_contexto_id))) {
      meta.selected_contexto_id = String(m.selected_contexto_id);
    }
    return {
      papel: m.role,
      conteudo: messageConteudoForApi(m),
      metadados_json: Object.keys(meta).length ? meta : null,
    };
  });
}

/** Bolha “digitando…” estilo WhatsApp (lado da IA). */
function AssistantTypingBubble({ statusLabel }) {
  const label = statusLabel?.trim() || "Tuma IA está digitando";
  return (
    <article
      className="flex items-start gap-3"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-background">
        <Image
          src="/imagens/TUMA_CROPPED.png"
          alt=""
          fill
          className="object-contain p-0.5"
          sizes="40px"
        />
      </div>
      <div className="flex min-h-[44px] min-w-[52px] items-center justify-center gap-1 rounded-2xl border border-border bg-muted/55 px-4 py-3 shadow-sm dark:bg-muted/35">
        <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-muted-foreground/75 [animation-duration:0.55s] [animation-delay:0ms]" />
        <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-muted-foreground/75 [animation-duration:0.55s] [animation-delay:0.12s]" />
        <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-muted-foreground/75 [animation-duration:0.55s] [animation-delay:0.24s]" />
      </div>
    </article>
  );
}

function formatTituloLista(c) {
  const t = c?.titulo && String(c.titulo).trim();
  if (t) return t.length > 48 ? `${t.slice(0, 48)}…` : t;
  const d = c?.data_atualizacao || c?.data_criacao;
  if (typeof d === "string") {
    try {
      return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch {
      /* ignore */
    }
  }
  return "Conversa";
}

export default function PainelChatPage() {
  const [empresaId, setEmpresaId] = useState(null);
  const [empresaReady, setEmpresaReady] = useState(false);
  const [conversaId, setConversaId] = useState(null);
  const [conversas, setConversas] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingConversa, setLoadingConversa] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const errTimer = useRef(null);
  const conversaDropdownRef = useRef(null);
  const [conversaMenuOpen, setConversaMenuOpen] = useState(false);
  /** `assistantMessageId:actionId` enquanto processa clique em botão de entrega */
  const [actionBusy, setActionBusy] = useState(null);
  /** Mensagem da IA aguardando `POST /ia/post-context-proposal`. */
  const [postContextLoadingId, setPostContextLoadingId] = useState(null);
  /** Resposta do Llama após a qual a Replicate está gerando a imagem (pipeline raw). */
  const [imageGeneratingAfterId, setImageGeneratingAfterId] = useState(null);
  const [contextosCampanha, setContextosCampanha] = useState([]);
  const [slashMenu, setSlashMenu] = useState({
    open: false,
    query: "",
    tokenStart: -1,
    tokenEnd: -1,
  });
  const [slashChips, setSlashChips] = useState(() => emptySlashChips());
  const slashChipsRef = useRef(slashChips);
  const inputCursorRef = useRef(0);
  const pendingInputCursorRef = useRef(null);
  const [arteBriefDraft, setArteBriefDraft] = useState(() => emptyArteBrief());
  const [brandColors, setBrandColors] = useState([]);
  const [arteBriefLoading, setArteBriefLoading] = useState(false);
  const [captionEditingId, setCaptionEditingId] = useState(null);
  const [captionEditDraft, setCaptionEditDraft] = useState("");
  const messagesRef = useRef(messages);
  const arteBriefDraftRef = useRef(arteBriefDraft);
  const sessionPersistRef = useRef({ empresaId: null, conversaId: null, input: "", messages: [] });

  useEffect(() => {
    arteBriefDraftRef.current = arteBriefDraft;
  }, [arteBriefDraft]);

  useEffect(() => {
    slashChipsRef.current = slashChips;
  }, [slashChips]);

  useEffect(() => {
    if (pendingInputCursorRef.current == null) return;
    const cursor = pendingInputCursorRef.current;
    pendingInputCursorRef.current = null;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const c = Math.min(Math.max(0, cursor), String(input ?? "").length);
      el.setSelectionRange(c);
      inputCursorRef.current = c;
    });
  }, [input, slashChips]);

  useEffect(() => {
    sessionPersistRef.current = { empresaId, conversaId, input, messages };
  }, [empresaId, conversaId, input, messages]);

  const selectedSlashMidiaIds = useMemo(() => listSlashChipMidiaIds(slashChips), [slashChips]);

  const modelosAtivos = useMemo(
    () =>
      contextosCampanha
        .map((row) => {
          const id = String(row.id_contexto_empresa ?? row.id_empresa_modelo_post ?? "").trim();
          const nome = String(row.nome ?? "").trim() || "Modelo";
          const slug = modeloSlugFromContextoRow(row);
          return id ? { id, nome, slug } : null;
        })
        .filter(Boolean),
    [contextosCampanha],
  );

  const closeSlashMenu = useCallback(() => {
    setSlashMenu({ open: false, query: "", tokenStart: -1, tokenEnd: -1 });
  }, []);

  const syncSlashMenuFromInput = useCallback(
    (text, cursorPos) => {
      const trigger = parseSlashTrigger(text, cursorPos);
      if (trigger) {
        setSlashMenu({
          open: true,
          query: trigger.query,
          tokenStart: trigger.tokenStart,
          tokenEnd: trigger.tokenEnd,
        });
      } else {
        setSlashMenu((prev) => (prev.open ? { ...prev, open: false } : prev));
      }
    },
    [],
  );

  const handleChatInputChange = useCallback(
    (event) => {
      const value = stripLegacyChatInputMarkers(event.target.value);
      const pos = event.target.selectionStart ?? value.length;
      inputCursorRef.current = pos;
      const domChips = Array.isArray(event.target.chips) ? event.target.chips : null;
      setSlashChips((prev) => domChips ?? reconcileSlashChipsWithText(value, prev));
      setInput(value);
      syncSlashMenuFromInput(value, pos);
    },
    [syncSlashMenuFromInput],
  );

  const focusInputAt = useCallback((cursor) => {
    pendingInputCursorRef.current = cursor;
  }, []);

  const readLiveSlashInput = useCallback(() => {
    const editor = inputRef.current;
    const domState = editor?.getEditorState?.();
    if (domState) {
      return {
        text: stripLegacyChatInputMarkers(domState.text),
        chips: Array.isArray(domState.chips) ? domState.chips : slashChipsRef.current,
      };
    }
    return { text: stripLegacyChatInputMarkers(input), chips: slashChipsRef.current };
  }, [input]);

  const handlePickSlashModelo = useCallback(
    (modelo) => {
      const slug = modelo.slug || String(modelo.nome ?? "modelo").toLowerCase().replace(/\s+/g, "-");
      const chip = { type: "modelo", id: modelo.id, nome: modelo.nome, slug };
      const cleaned = removeModeloChipFromState(
        stripLegacyChatInputMarkers(input),
        slashChipsRef.current,
      );
      const inserted = insertChipCharAtSlash(cleaned.text, slashMenu);
      const chipAt = countChipsBefore(
        cleaned.text,
        Math.min(slashMenu.tokenStart, cleaned.text.length),
      );
      const nextChips = [...cleaned.chips];
      nextChips.splice(chipAt, 0, chip);
      setInput(inserted.text);
      setSlashChips(nextChips);
      focusInputAt(inserted.cursor);
      closeSlashMenu();
    },
    [input, slashMenu, closeSlashMenu, focusInputAt],
  );

  const handlePickSlashMidia = useCallback(
    (midia) => {
      const label = String(midia.label ?? "midia")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w.-]/g, "")
        .slice(0, 40);
      const current = slashChipsRef.current;
      if (current.some((c) => c.type === "midia" && c.id === midia.id)) return;
      if (current.filter((c) => c.type === "midia").length >= SLASH_MENU_MAX_MIDIAS) return;

      const chip = { type: "midia", id: midia.id, label: label || "midia" };
      const base = stripLegacyChatInputMarkers(input);
      const inserted = insertChipCharAtSlash(base, slashMenu);
      const chipAt = countChipsBefore(base, Math.min(slashMenu.tokenStart, base.length));
      const nextChips = [...slashChipsRef.current];
      nextChips.splice(chipAt, 0, chip);
      setInput(inserted.text);
      setSlashChips(nextChips);
      focusInputAt(inserted.cursor);
      closeSlashMenu();
    },
    [input, slashMenu, closeSlashMenu, focusInputAt],
  );

  const flushChatSession = useCallback(() => {
    const snap = sessionPersistRef.current;
    if (!snap.empresaId) return;
    saveChatSession(snap.empresaId, {
      conversaId: snap.conversaId,
      input: snap.input,
      messages: snap.messages,
    });
  }, []);

  useEffect(() => {
    if (!empresaId) return;
    const timer = setTimeout(() => {
      saveChatSession(empresaId, { conversaId, input, messages });
    }, 400);
    return () => clearTimeout(timer);
  }, [empresaId, conversaId, input, messages]);

  useEffect(() => {
    function onPageHide() {
      flushChatSession();
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") onPageHide();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flushChatSession();
    };
  }, [flushChatSession]);

  const chatBusy = sending || !!actionBusy || !!postContextLoadingId || !!imageGeneratingAfterId;
  const busyStatusLabel = actionBusy
    ? actionBusy === "image:auto"
      ? "Gerando imagem"
      : "Gerando imagem"
    : postContextLoadingId
      ? "Preparando resumo para a imagem"
      : imageGeneratingAfterId
        ? "Gerando imagem"
        : null;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  function showErr(text) {
    if (errTimer.current) clearTimeout(errTimer.current);
    setErrMsg(text);
    if (text)
      errTimer.current = setTimeout(() => {
        setErrMsg("");
      }, 6000);
  }

  useEffect(() => {
    return () => {
      if (errTimer.current) clearTimeout(errTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!conversaMenuOpen) return;
    function onPointerDown(ev) {
      if (conversaDropdownRef.current && !conversaDropdownRef.current.contains(ev.target)) {
        setConversaMenuOpen(false);
      }
    }
    function onKey(ev) {
      if (ev.key === "Escape") setConversaMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [conversaMenuOpen]);

  useEffect(() => {
    if (sending || loadingConversa) setConversaMenuOpen(false);
  }, [sending, loadingConversa]);

  useEffect(() => {
    let active = true;
    (async () => {
      const minhas = await authApiFetchWithToken("/empresas/minhas");
      if (!active) return;
      if (!minhas.ok || minhas.networkError) {
        setEmpresaId(null);
        setEmpresaReady(true);
        return;
      }
      const list = Array.isArray(minhas.json?.empresas) ? minhas.json.empresas : [];
      const idEmp = resolveEmpresaAtivaId(list, {
        idEmpresaUltimaPerfil: idEmpresaUltimaFromMinhasPayload(minhas.json),
      });
      if (idEmp) {
        const row = empresaRowFromMinhas(list, idEmp);
        if (row?.empresa) setEmpresaAtiva(row.empresa);
      }
      setEmpresaId(idEmp || null);
      setEmpresaReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!empresaId) {
      setContextosCampanha([]);
      return;
    }
    let active = true;
    authApiFetchWithToken(`/empresas/${encodeURIComponent(empresaId)}/contextos`).then((r) => {
      if (!active) return;
      if (!r.ok || r.networkError) {
        setContextosCampanha([]);
        return;
      }
      const rows = Array.isArray(r.json?.contextos) ? r.json.contextos : [];
      setContextosCampanha(rows.filter((c) => !isIdentidadeMarcaContextoRow(c)));
    });
    return () => {
      active = false;
    };
  }, [empresaId]);

  const loadArteBriefDefaults = useCallback(async () => {
    if (!empresaId) return;
    setArteBriefLoading(true);
    try {
      let stored = null;
      try {
        const raw = sessionStorage.getItem(arteBriefStorageKey(empresaId));
        if (raw) stored = JSON.parse(raw);
      } catch {
        /* ignore */
      }
      const r = await authApiFetchWithToken(
        `/ia/arte-brief-defaults?id_empresa=${encodeURIComponent(empresaId)}`,
      );
      if (r.ok && !r.networkError) {
        const colors = Array.isArray(r.json?.brand_colors) ? r.json.brand_colors : [];
        setBrandColors(colors);
        const base = normalizeArteBrief(r.json?.arte_brief, colors);
        setArteBriefDraft(stored ? normalizeArteBrief(stored, colors) : base);
      } else if (stored) {
        setArteBriefDraft(normalizeArteBrief(stored));
      }
    } finally {
      setArteBriefLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    void loadArteBriefDefaults();
  }, [loadArteBriefDefaults]);

  function persistArteBriefDraft(brief) {
    if (!empresaId || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(arteBriefStorageKey(empresaId), JSON.stringify(brief));
    } catch {
      /* ignore */
    }
  }

  const resetArteBriefDraft = useCallback(
    (persist = true) => {
      const fresh = emptyArteBrief(brandColors);
      setArteBriefDraft(fresh);
      if (persist) persistArteBriefDraft(fresh);
      return fresh;
    },
    [brandColors, empresaId],
  );

  const loadListaConversas = useCallback(async () => {
    if (!empresaId) return;
    setLoadingList(true);
    const r = await authApiFetchWithToken(`/chat/conversas?id_empresa=${encodeURIComponent(empresaId)}`);
    setLoadingList(false);
    if (!r.ok || r.networkError) {
      showErr(r.networkError?.message || formatAuthError(r.json) || "Não foi possível carregar a lista.");
      setConversas([]);
      return;
    }
    const list = Array.isArray(r.json?.conversas) ? r.json.conversas : [];
    setConversas(list);
  }, [empresaId]);

  const loadConversa = useCallback(
    async (id, options = { remember: true }) => {
      if (!id) return;
      setLoadingConversa(true);
      const r = await authApiFetchWithToken(`/chat/conversas/${encodeURIComponent(id)}`);
      setLoadingConversa(false);
      if (!r.ok || r.networkError) {
        showErr(r.networkError?.message || formatAuthError(r.json) || "Conversa indisponível.");
        return;
      }
      const raw = Array.isArray(r.json?.mensagens) ? r.json.mensagens : [];
      const mapped = raw.map(fromApiMensagem).filter(Boolean);
      setMessages(mapped);
      let foundArteBrief = false;
      for (let i = mapped.length - 1; i >= 0; i--) {
        const ab = mapped[i]?.post_supplement?.post_context_proposal?.arte_brief;
        if (ab && typeof ab === "object") {
          foundArteBrief = true;
          setArteBriefDraft(normalizeArteBrief(ab, brandColors));
          persistArteBriefDraft(normalizeArteBrief(ab, brandColors));
          break;
        }
      }
      if (!foundArteBrief) resetArteBriefDraft();
      setConversaId(id);
      if (options.remember && empresaId && typeof window !== "undefined") {
        try {
          sessionStorage.setItem(lastConversaStorageKey(empresaId), id);
        } catch {
          /* ignore */
        }
      }
    },
    [empresaId, brandColors, resetArteBriefDraft],
  );

  useEffect(() => {
    if (!empresaReady || !empresaId) return;
    let cancelled = false;
    (async () => {
      const cached = loadChatSession(empresaId);
      if (cached?.input) setInput(cached.input);

      await loadListaConversas();
      if (cancelled) return;

      let last = null;
      try {
        last = sessionStorage.getItem(lastConversaStorageKey(empresaId));
      } catch {
        /* ignore */
      }

      const targetId =
        (last && /^[0-9a-f-]{36}$/i.test(last) ? last : null) ||
        (cached?.conversaId && /^[0-9a-f-]{36}$/i.test(cached.conversaId) ? cached.conversaId : null);

      if (targetId) {
        if (cached?.conversaId === targetId && cached.messages?.length) {
          setConversaId(targetId);
          setMessages(cached.messages);
        }
        const check = await authApiFetchWithToken(`/chat/conversas/${encodeURIComponent(targetId)}`);
        if (cancelled) return;
        if (check.ok && !check.networkError && Array.isArray(check.json?.mensagens)) {
          await loadConversa(targetId, { remember: false });
          if (cached?.input) setInput(cached.input);
          return;
        }
      }

      if (cached?.input) {
        setInput(cached.input);
      }
      setConversaId(null);
      setMessages([]);
      resetArteBriefDraft();
    })();
    return () => {
      cancelled = true;
    };
  }, [empresaReady, empresaId, loadListaConversas, loadConversa, resetArteBriefDraft]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const historyForApi = useMemo(() => historyFromMessages(messages), [messages]);

  const syncMensagens = useCallback(
    async (chatId, lista) => {
      const body = JSON.stringify({ mensagens: toApiMensagens(lista) });
      for (let attempt = 0; attempt < 2; attempt++) {
        const put = await authApiFetchWithToken(`/chat/conversas/${encodeURIComponent(chatId)}/mensagens`, {
          method: "PUT",
          body,
          timeoutMs: SYNC_MENSAGENS_TIMEOUT_MS,
        });
        if (put.ok && !put.networkError) {
          void loadListaConversas();
          return true;
        }
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 450));
          continue;
        }
        showErr(put.networkError?.message || formatAuthError(put.json) || "Não foi possível salvar a conversa.");
        return false;
      }
      return false;
    },
    [loadListaConversas, showErr],
  );

  const invokeImagePreview = useCallback(
    async function invokeImagePreviewFn({
      msgs,
      proposal,
      supplementLinks,
      focusContextoId,
      conversaId: conversaIdOverride,
      revisionSourceUrl,
      revisionInstructions,
    }) {
      if (!empresaId) return { ok: false, error: "Empresa não selecionada." };
      const historyFull = historyFromMessages(msgs);
      if (!historyFull.length) return { ok: false, error: "Histórico vazio para gerar a imagem." };
      const prop =
        proposal && typeof proposal === "object" && Object.keys(proposal).length > 0
          ? proposal
          : findLatestImageProposalObject(msgs) || {};
      const idConversa =
        conversaIdOverride && UUID_RE.test(String(conversaIdOverride))
          ? String(conversaIdOverride)
          : conversaId && UUID_RE.test(String(conversaId))
            ? String(conversaId)
            : null;
      const result = await authApiFetchWithToken("/ia/image-preview", {
        method: "POST",
        body: JSON.stringify(
          buildImagePreviewRequestBody({
            history: historyFull,
            empresaId,
            conversaId: idConversa,
            proposal: prop,
            supplementLinks: supplementLinks || [],
            focusContextoId,
            arteDraft: arteBriefDraftRef.current,
            revisionSourceUrl,
            revisionInstructions,
          }),
        ),
        timeoutMs: IMAGE_PREVIEW_TIMEOUT_MS,
        timeoutLabel: "image-preview",
      });
      if (!result.ok || result.networkError) {
        const qualitySummary =
          result.json?.quality_review &&
          typeof result.json.quality_review === "object" &&
          typeof result.json.quality_review.summary === "string"
            ? result.json.quality_review.summary.trim()
            : "";
        const msg =
          result.networkError?.message ||
          (typeof result.json?.error === "string" ? result.json.error : null) ||
          (qualitySummary && result.json?.rejected_preview ? qualitySummary : null) ||
          formatAuthError(result.json) ||
          (result.status === 422
            ? "A imagem foi barrada na revisão automática. Ajuste o pedido ou tente de novo."
            : null) ||
          "Não foi possível gerar a imagem agora.";
        const errText = typeof msg === "string" ? msg : "Erro desconhecido.";
        return { ok: false, error: String(errText), status: result.status };
      }
      const urls = Array.isArray(result.json?.image_urls) ? result.json.image_urls.filter(Boolean) : [];
      const imageMidiaIds = Array.isArray(result.json?.image_midia_ids)
        ? result.json.image_midia_ids.filter((id) => typeof id === "string" && UUID_RE.test(id.trim()))
        : [];
      return {
        ok: true,
        urls,
        imageMidiaIds,
        model: result.json?.model,
        contexto: result.json?.contexto_geracao,
        imageGeneration:
          result.json?.image_generation && typeof result.json.image_generation === "object"
            ? result.json.image_generation
            : null,
      };
    },
    [empresaId, conversaId],
  );

  const attachPostContextSupplement = useCallback(
    async function attachPostContextSupplementFn(
      chatId,
      assistantMessageId,
      historyForProposal,
      slashPicksAtSend = null,
    ) {
      if (!empresaId || !chatId) return;
      const picks = slashPicksAtSend || slashChipsToApiPicks(slashChipsRef.current);
      const userLast =
        [...historyForProposal].reverse().find((h) => h.role === "user")?.content || "";
      const detailedRequest = String(userLast).trim().length >= 24;
      const slashModeloId = picks.modelo?.id ? String(picks.modelo.id).trim() : null;
      setPostContextLoadingId(assistantMessageId);
      try {
        const proposalBody = {
          history: historyForProposal,
          id_empresa: empresaId,
          arte_brief: arteBriefDraftRef.current,
        };
        if (slashModeloId) proposalBody.focus_contexto_id = slashModeloId;
        if (picks.midias?.length) {
          proposalBody.reference_midia_ids = picks.midias.map((m) => m.id).filter(Boolean);
        }
        const prop = await authApiFetchWithToken("/ia/post-context-proposal", {
          method: "POST",
          body: JSON.stringify(proposalBody),
          timeoutMs: POST_CONTEXT_TIMEOUT_MS,
          timeoutLabel: "post-context",
        });
        if (!prop.ok || prop.networkError) {
          const msg =
            prop.networkError?.message ||
            (typeof prop.json?.error === "string" ? prop.json.error : formatAuthError(prop.json)) ||
            "Não foi possível preparar o resumo agora. Tente novamente em instantes.";
          const note = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: String(msg),
            sources: [],
          };
          const comErro = [...messagesRef.current, note];
          setMessages(comErro);
          await syncMensagens(chatId, comErro);
          return;
        }
        const rawSup = prop.json;
        const isRawPipeline = rawSup?.meta?.pipeline === "raw";
        const proposalFromApi =
          rawSup?.post_context_proposal && typeof rawSup.post_context_proposal === "object"
            ? rawSup.post_context_proposal
            : {};
        const confirmFromApi =
          typeof rawSup?.confirmation_message === "string" ? rawSup.confirmation_message.trim() : "";
        const briefingStatus =
          rawSup?.briefing_status === "collecting" ? "collecting" : "ready";
        const collecting = briefingStatus === "collecting";
        if (proposalFromApi.arte_brief && typeof proposalFromApi.arte_brief === "object") {
          const merged = normalizeArteBrief(proposalFromApi.arte_brief, brandColors);
          setArteBriefDraft(merged);
          persistArteBriefDraft(merged);
        }

        const hasArteBrief = Boolean(proposalFromApi.arte_brief);
        const post_supplement =
          rawSup && (hasArteBrief || confirmFromApi.length >= 8 || Object.keys(proposalFromApi).length > 0)
            ? {
                confirmation_message:
                  confirmFromApi.length >= 1
                    ? confirmFromApi
                    : isRawPipeline && hasArteBrief
                      ? "Ajuste se precisar antes de gerar."
                      : CHAT_PEDIDO_RESUMO_MSG,
                links: Array.isArray(rawSup.links)
                  ? rawSup.links.map(normalizeSupplementLink).filter(Boolean)
                  : [],
                post_context_proposal: proposalFromApi,
                briefing_status: briefingStatus,
                missing_slots: Array.isArray(rawSup.missing_slots) ? rawSup.missing_slots : [],
              }
            : undefined;
        const rawUi = rawSup?.ui_actions;
        let ui_actions = Array.isArray(rawUi)
          ? rawUi.filter(
              (a) =>
                a &&
                typeof a === "object" &&
                typeof a.id === "string" &&
                a.id.trim() &&
                typeof a.label === "string" &&
                a.label.trim(),
            )
          : [];
        if (!collecting && !ui_actions.length && post_supplement) {
          ui_actions = [{ id: "confirm_generate_image", label: "Gerar imagem" }];
        }
        const proposalObj =
          post_supplement?.post_context_proposal && typeof post_supplement.post_context_proposal === "object"
            ? post_supplement.post_context_proposal
            : {};
        let selectedId =
          proposalObj?.matched_contexto &&
          typeof proposalObj.matched_contexto === "object" &&
          typeof proposalObj.matched_contexto.id_contexto_empresa === "string"
            ? proposalObj.matched_contexto.id_contexto_empresa.trim()
            : null;
        if (slashModeloId) {
          selectedId = slashModeloId;
        } else if (
          selectedId &&
          contextosCampanha.length &&
          !contextosCampanha.some((c) => String(c.id_contexto_empresa) === selectedId)
        ) {
          selectedId = detailedRequest
            ? null
            : String(contextosCampanha[0]?.id_contexto_empresa ?? "") || null;
        } else if (!selectedId && !detailedRequest && contextosCampanha.length) {
          selectedId = String(contextosCampanha[0]?.id_contexto_empresa ?? "") || null;
        }

        setMessages((prev) => {
          const anchorPrev = prev.find((m) => m.id === assistantMessageId);
          const currentContent =
            anchorPrev && typeof anchorPrev.content === "string" ? anchorPrev.content.trim() : "";
          const keepContent =
            currentContent &&
            currentContent !== CHAT_PEDIDO_AGUARDE_MSG &&
            currentContent !== CHAT_PEDIDO_RESUMO_MSG &&
            currentContent !== CHAT_PEDIDO_COLETANDO_INTRO
              ? currentContent
              : collecting
                ? CHAT_PEDIDO_COLETANDO_INTRO
                : CHAT_PEDIDO_RESUMO_MSG;
          let next = prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: collecting ? CHAT_PEDIDO_COLETANDO_INTRO : keepContent,
                  post_supplement,
                  ui_actions: collecting ? undefined : ui_actions.length ? ui_actions : undefined,
                  ...(selectedId && UUID_RE.test(selectedId) ? { selected_contexto_id: selectedId } : {}),
                }
              : m,
          );
          if (selectedId && contextosCampanha.length) {
            const anchor = next.find((m) => m.id === assistantMessageId);
            if (anchor) {
              next = next.map((m) =>
                m.id === assistantMessageId
                  ? patchMessageContextoSelection(anchor, selectedId, contextosCampanha)
                  : m,
              );
            }
          }
          void syncMensagens(chatId, next);
          return next;
        });
      } catch (err) {
        const note = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Erro ao carregar confirmação de contexto.",
          sources: [],
        };
        const comErro = [...messagesRef.current, note];
        setMessages(comErro);
        await syncMensagens(chatId, comErro);
      } finally {
        setPostContextLoadingId(null);
      }
    },
    [empresaId, syncMensagens, contextosCampanha, brandColors],
  );

  const onConfirmContextoChange = useCallback(
    (messageId, ctxId) => {
      if (!ctxId || !UUID_RE.test(ctxId)) return;
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === messageId ? patchMessageContextoSelection(m, ctxId, contextosCampanha) : m,
        );
        if (conversaId) void syncMensagens(conversaId, next);
        return next;
      });
    },
    [contextosCampanha, conversaId, syncMensagens],
  );

  const runGenerateCaptionForImage = useCallback(
    async function runGenerateCaptionForImageFn(imageMessageId, msgs, { fromButton = false } = {}) {
      const idChat = conversaId;
      if (!idChat || !empresaId) return false;

      setActionBusy(`${imageMessageId}:generate_caption`);
      let msgsWithUser = msgs;
      if (fromButton) {
        const userLine = quickReplyUserLineForAction("generate_caption");
        if (!userLine) {
          setActionBusy(null);
          return false;
        }
        msgsWithUser = appendQuickReplyUserMessage(msgs, imageMessageId, userLine, (m) => ({
          ...m,
          ui_actions: undefined,
        })).msgs;
        setMessages(msgsWithUser);
        const okSync = await syncMensagens(idChat, msgsWithUser);
        if (!okSync) {
          setActionBusy(null);
          return false;
        }
      } else {
        msgsWithUser = msgs.map((m) =>
          m.id === imageMessageId ? { ...m, ui_actions: undefined } : m,
        );
        setMessages(msgsWithUser);
      }

      try {
        const history = historyFromMessages(msgsWithUser);
        const proposal = findLatestImageProposalObject(msgsWithUser) || {};
        const result = await authApiFetchWithToken("/ia/post-caption", {
          method: "POST",
          body: JSON.stringify({
            history,
            id_empresa: empresaId,
            post_context_proposal: proposal,
          }),
          timeoutMs: POST_CAPTION_TIMEOUT_MS,
          timeoutLabel: "post-caption",
        });
        if (!result.ok || result.networkError) {
          const msg =
            result.networkError?.message ||
            (typeof result.json?.error === "string" ? result.json.error : null) ||
            formatAuthError(result.json) ||
            "Não foi possível gerar a legenda agora.";
          const errBubble = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: String(msg),
            sources: [],
          };
          const comErro = [...msgsWithUser, errBubble];
          setMessages(comErro);
          await syncMensagens(idChat, comErro);
          return false;
        }
        const legenda = result.json?.legenda;
        const hashtags = result.json?.hashtags;
        const captionMsg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: formatCaptionAssistantContent({ legenda, hashtags }),
          sources: [],
          ui_actions: POST_CAPTION_UI,
        };
        const finalMsgs = [...msgsWithUser, captionMsg];
        setMessages(finalMsgs);
        await syncMensagens(idChat, finalMsgs);
        return true;
      } catch (err) {
        const errBubble = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Erro inesperado ao gerar legenda.",
          sources: [],
        };
        const comErro = [...msgsWithUser, errBubble];
        setMessages(comErro);
        await syncMensagens(idChat, comErro);
        return false;
      } finally {
        setActionBusy(null);
      }
    },
    [conversaId, empresaId, syncMensagens],
  );

  const runRegenerateCaption = useCallback(
    async function runRegenerateCaptionFn(msgs) {
      const idChat = conversaId;
      if (!idChat || !empresaId) return false;
      const priorMsgs = msgs.slice(0, -1);
      const captionId = findLatestCaptionMessageId(priorMsgs);
      const busyId = captionId || "caption";
      setActionBusy(`${busyId}:generate_caption`);
      const msgsPrepared = captionId
        ? msgs.map((m) => (m.id === captionId ? { ...m, ui_actions: undefined } : m))
        : msgs;
      setMessages(msgsPrepared);

      try {
        const history = historyFromMessages(msgsPrepared);
        const proposal = findLatestImageProposalObject(msgsPrepared) || {};
        const result = await authApiFetchWithToken("/ia/post-caption", {
          method: "POST",
          body: JSON.stringify({
            history,
            id_empresa: empresaId,
            post_context_proposal: proposal,
          }),
          timeoutMs: POST_CAPTION_TIMEOUT_MS,
          timeoutLabel: "post-caption",
        });
        if (!result.ok || result.networkError) {
          const msg =
            result.networkError?.message ||
            (typeof result.json?.error === "string" ? result.json.error : null) ||
            formatAuthError(result.json) ||
            "Não foi possível atualizar a legenda agora.";
          const errBubble = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: String(msg),
            sources: [],
          };
          const comErro = [...msgsPrepared, errBubble];
          setMessages(comErro);
          await syncMensagens(idChat, comErro);
          return false;
        }
        const legenda = result.json?.legenda;
        const hashtags = result.json?.hashtags;
        const captionMsg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: formatCaptionAssistantContent({ legenda, hashtags }),
          sources: [],
          ui_actions: POST_CAPTION_UI,
        };
        const finalMsgs = [...msgsPrepared, captionMsg];
        setMessages(finalMsgs);
        await syncMensagens(idChat, finalMsgs);
        return true;
      } catch (err) {
        const errBubble = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Erro inesperado ao atualizar legenda.",
          sources: [],
        };
        const comErro = [...msgsPrepared, errBubble];
        setMessages(comErro);
        await syncMensagens(idChat, comErro);
        return false;
      } finally {
        setActionBusy(null);
      }
    },
    [conversaId, empresaId, syncMensagens],
  );

  const runPublishInstagramForCaption = useCallback(
    async function runPublishInstagramForCaptionFn(captionMessageId, msgs, { fromButton = false } = {}) {
      const idChat = conversaId;
      if (!idChat || !empresaId) return false;

      const captionMsg = msgs.find((m) => m.id === captionMessageId);
      const captionText = typeof captionMsg?.content === "string" ? captionMsg.content.trim() : "";
      let msgsWithUser = msgs;
      if (fromButton) {
        const userLine = quickReplyUserLineForAction("publish_instagram");
        if (!userLine) return false;
        msgsWithUser = appendQuickReplyUserMessage(msgs, captionMessageId, userLine).msgs;
      } else {
        msgsWithUser = msgs.map((m) =>
          m.id === captionMessageId ? { ...m, ui_actions: undefined } : m,
        );
      }
      setMessages(msgsWithUser);

      let copied = false;
      if (captionText && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(captionText);
          copied = true;
        } catch {
          /* ignore */
        }
      }
      const hasImage = Boolean(findLatestImageUrlInMessages(msgsWithUser));
      const assistMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: copied
          ? hasImage
            ? "Legenda copiada! Abra o Instagram, selecione a imagem gerada e cole o texto para publicar."
            : "Legenda copiada! Abra o Instagram e cole o texto para publicar."
          : hasImage
            ? "Abra o Instagram, use a imagem gerada e cole a legenda acima para publicar."
            : "Abra o Instagram e cole a legenda acima para publicar.",
        sources: [],
      };
      const finalMsgs = [...msgsWithUser, assistMsg];
      setMessages(finalMsgs);
      await syncMensagens(idChat, finalMsgs);
      if (typeof window !== "undefined") {
        window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      }
      return true;
    },
    [conversaId, empresaId, syncMensagens],
  );

  const cancelCaptionEdit = useCallback(() => {
    setCaptionEditingId(null);
    setCaptionEditDraft("");
  }, []);

  const saveCaptionEdit = useCallback(
    async function saveCaptionEditFn(messageId) {
      const idChat = conversaId;
      const text = String(captionEditDraft ?? "").trim();
      if (!idChat || !messageId) return;
      if (!text) {
        showErr("A legenda não pode ficar vazia.");
        return;
      }
      const next = messagesRef.current.map((m) =>
        m.id === messageId ? { ...m, content: text } : m,
      );
      setMessages(next);
      setCaptionEditingId(null);
      setCaptionEditDraft("");
      await syncMensagens(idChat, next);
    },
    [conversaId, captionEditDraft, syncMensagens],
  );

  const startCaptionEdit = useCallback((messageId, content) => {
    setCaptionEditingId(messageId);
    setCaptionEditDraft(String(content ?? ""));
    requestAnimationFrame(() => {
      const el = document.getElementById(`caption-edit-${messageId}`);
      el?.focus();
    });
  }, []);

  const runDeliveryAction = useCallback(
    async function runDeliveryActionFn(fromAssistantMessageId, actionId) {
      const idChat = conversaId;
      if (!idChat || !empresaId || sending || actionBusy) return;

      if (actionId === "adjust_caption") {
        const captionMsg = messagesRef.current.find((m) => m.id === fromAssistantMessageId);
        if (!captionMsg || !isCaptionAssistantMessage(captionMsg)) return;
        startCaptionEdit(fromAssistantMessageId, captionMsg.content);
        return;
      }

      if (actionId === "revise_image") {
        const userLine = quickReplyUserLineForAction(actionId);
        if (!userLine) return;
        const prev = messagesRef.current;
        const { msgs: msgsWithUser } = appendQuickReplyUserMessage(prev, fromAssistantMessageId, userLine);
        setMessages(msgsWithUser);
        await syncMensagens(idChat, msgsWithUser);
        setInput("Quero alterar a imagem: ");
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      if (actionId === "publish_instagram") {
        await runPublishInstagramForCaption(fromAssistantMessageId, messagesRef.current, {
          fromButton: true,
        });
        return;
      }

      if (actionId === "generate_caption") {
        await runGenerateCaptionForImage(fromAssistantMessageId, messagesRef.current, {
          fromButton: true,
        });
        return;
      }

      if (actionId !== "confirm_generate_image") return;
      if (!arteBriefReady(arteBriefDraftRef.current)) {
        showErr("Preencha o tema no resumo da arte (no topo do chat) antes de gerar.");
        return;
      }

      if (
        typeof window !== "undefined" &&
        !window.confirm("Gerar a imagem? Pode consumir créditos do seu plano.")
      ) {
        return;
      }

      setActionBusy(`${fromAssistantMessageId}:${actionId}`);
      setImageGeneratingAfterId(fromAssistantMessageId);
      setSending(true);
      const prev = messagesRef.current;
      const cleared = prev.map((m) =>
        m.id === fromAssistantMessageId ? { ...m, ui_actions: undefined } : m,
      );
      const userMsg = { id: crypto.randomUUID(), role: "user", content: CONFIRM_IMAGE_USER_LINE, hidden: true };
      const msgsWithUser = [...cleared, userMsg];
      setMessages(msgsWithUser);

      const okSync1 = await syncMensagens(idChat, msgsWithUser);
      if (!okSync1) {
        setActionBusy(null);
        setSending(false);
        return;
      }

      try {
        const anchor = msgsWithUser.find((m) => m.id === fromAssistantMessageId);
        const supplement = anchor?.post_supplement;
        const proposal =
          supplement?.post_context_proposal ||
          anchor?.post_context_proposal ||
          findLatestImageProposalObject(msgsWithUser) ||
          {};
        const supplementLinks = Array.isArray(supplement?.links) ? supplement.links : [];
        const focusContextoId =
          anchor?.selected_contexto_id ||
          proposal?.matched_contexto?.id_contexto_empresa ||
          null;
        const out = await invokeImagePreview({
          msgs: msgsWithUser,
          proposal,
          supplementLinks,
          focusContextoId,
        });
        if (!out.ok) {
          const errBubble = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: out.error || "Não foi possível gerar a imagem agora.",
            sources: [],
          };
          const comErro = [...msgsWithUser, errBubble];
          setMessages(comErro);
          await syncMensagens(idChat, comErro);
          return;
        }
        const contextoLinha = buildImageContextNote(out.contexto);
        const assistantFollowUp = buildImagePreviewAssistantMessage(out, contextoLinha);
        const finalMsgs = [...msgsWithUser, assistantFollowUp];
        setMessages(finalMsgs);
        await syncMensagens(idChat, finalMsgs);
      } catch (err) {
        const errBubble = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Erro inesperado ao gerar a imagem.",
          sources: [],
        };
        const comErro = [...msgsWithUser, errBubble];
        setMessages(comErro);
        await syncMensagens(idChat, comErro);
      } finally {
        setImageGeneratingAfterId(null);
        setActionBusy(null);
        setSending(false);
      }
    },
    [conversaId, empresaId, sending, actionBusy, syncMensagens, invokeImagePreview, showErr, runGenerateCaptionForImage, runPublishInstagramForCaption, startCaptionEdit],
  );

  const onSubmit = useCallback(
    async function onSubmit(event) {
      event.preventDefault();
      inputRef.current?.flushToParent?.();
      const live = readLiveSlashInput();
      const question = formatSlashInputForSend(live.text, live.chips);
      if (!question || sending || !empresaId) return;

      const picksAtSend = slashChipsToApiPicks(live.chips);
      const userMsg = { id: crypto.randomUUID(), role: "user", content: question };
      const msgsComUsuario = [...messages, userMsg];
      setInput("");
      setSlashChips(emptySlashChips());
      closeSlashMenu();
      setSending(true);
      setMessages(msgsComUsuario);
      if (!isWagnerPostImageMock(question) && !parseTypedDeliveryCommand(question)) {
        setArteBriefDraft((prev) => {
          const next = { ...prev };
          if (detectImageGenerationIntent(question) && isWeakArteTheme(next.tema)) {
            next.tema = question.slice(0, 200);
          }
          const merged = normalizeArteBrief(next, brandColors);
          persistArteBriefDraft(merged);
          return merged;
        });
      }

      let idChat = conversaId;
      if (!idChat) {
        const cr = await authApiFetchWithToken("/chat/conversas", {
          method: "POST",
          body: JSON.stringify({ id_empresa: empresaId }),
        });
        if (!cr.ok || cr.networkError) {
          setMessages(messages);
          setSending(false);
          showErr(cr.networkError?.message || formatAuthError(cr.json) || "Não foi possível iniciar a conversa.");
          return;
        }
        const created = cr.json?.conversa?.id_conversa;
        if (!created || typeof created !== "string") {
          setMessages(messages);
          setSending(false);
          showErr("Algo saiu errado. Tente de novo.");
          return;
        }
        idChat = created;
        setConversaId(created);
        try {
          sessionStorage.setItem(lastConversaStorageKey(empresaId), created);
        } catch {
          /* ignore */
        }
      }

      const okSyncUser = await syncMensagens(idChat, msgsComUsuario);
      if (!okSyncUser) {
        setSending(false);
        return;
      }

      if (isWagnerPostImageMock(question)) {
        const out = buildWagnerPostImageMockResult();
        const contextoLinha = buildImageContextNote(out.contexto);
        const wagnerNote =
          "\n\n(Simulação dev «wagner» — imagem fictícia para testar legenda e ajustes, sem consumir créditos.)";
        const assistantFollowUp = buildImagePreviewAssistantMessage(out, contextoLinha, wagnerNote);
        const finalMsgs = [...msgsComUsuario, assistantFollowUp];
        setMessages(finalMsgs);
        await syncMensagens(idChat, finalMsgs);
        setSending(false);
        return;
      }

      const typedCmd = parseTypedDeliveryCommand(question);
      if (typedCmd) {
        const priorMsgs = msgsComUsuario.slice(0, -1);

        if (typedCmd.type === "adjust_caption_prompt") {
          const captionId = findLatestCaptionMessageId(priorMsgs);
          const captionMsg = captionId ? priorMsgs.find((m) => m.id === captionId) : null;
          setMessages(priorMsgs);
          if (captionMsg) {
            startCaptionEdit(captionId, captionMsg.content);
          }
          setSending(false);
          return;
        }
        if (typedCmd.type === "revise_image_prompt") {
          setInput("Quero alterar a imagem: ");
          setSending(false);
          requestAnimationFrame(() => inputRef.current?.focus());
          return;
        }
        if (typedCmd.type === "generate_caption") {
          const imageMsgId = findLatestImageMessageId(priorMsgs);
          if (!imageMsgId) {
            setSending(false);
            showErr("Gere uma imagem antes de pedir a legenda.");
            return;
          }
          await runGenerateCaptionForImage(imageMsgId, msgsComUsuario, { fromButton: false });
          setSending(false);
          return;
        }
        if (typedCmd.type === "regenerate_caption") {
          if (!findLatestCaptionMessageId(priorMsgs) && !findLatestImageMessageId(priorMsgs)) {
            setSending(false);
            showErr("Gere uma legenda antes de pedir alterações.");
            return;
          }
          await runRegenerateCaption(msgsComUsuario);
          setSending(false);
          return;
        }
        if (typedCmd.type === "publish_instagram") {
          const captionId = findLatestCaptionMessageId(priorMsgs);
          if (!captionId) {
            setSending(false);
            showErr("Gere a legenda antes de publicar no Instagram.");
            return;
          }
          await runPublishInstagramForCaption(captionId, msgsComUsuario, { fromButton: false });
          setSending(false);
          return;
        }
        if (typedCmd.type === "revise_image" && typedCmd.instructions) {
          const rawSource = findLatestImageUrlInMessages(priorMsgs);
          const sourceUrl = resolveImageUrlForRevision(
            rawSource,
            typeof window !== "undefined" ? window.location.origin : "",
          );
          if (!sourceUrl) {
            setSending(false);
            showErr(
              "Não encontrei uma imagem gerada para alterar. Gere uma imagem real antes (a simulação wagner não serve de base).",
            );
            return;
          }
          if (
            typeof window !== "undefined" &&
            !window.confirm("Alterar a imagem com base na anterior? Pode consumir créditos do seu plano.")
          ) {
            setSending(false);
            return;
          }
          const imageMsgId = findLatestImageMessageId(priorMsgs);
          if (imageMsgId) setImageGeneratingAfterId(imageMsgId);
          const confirmAnchor = findLatestConfirmedProposalAnchor(priorMsgs, arteBriefDraftRef.current);
          const latestProposal =
            confirmAnchor?.proposal || findLatestImageProposalObject(priorMsgs) || {};
          const latestLinks = Array.isArray(confirmAnchor?.supplement?.links)
            ? confirmAnchor.supplement.links
            : [];
          const out = await invokeImagePreview({
            msgs: msgsComUsuario,
            proposal: latestProposal,
            supplementLinks: latestLinks,
            focusContextoId: confirmAnchor?.selected_contexto_id,
            revisionSourceUrl: sourceUrl,
            revisionInstructions: typedCmd.instructions,
          });
          setImageGeneratingAfterId(null);
          if (!out.ok) {
            const errBubble = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: out.error || "Não foi possível alterar a imagem agora.",
              sources: [],
            };
            const comErro = [...msgsComUsuario, errBubble];
            setMessages(comErro);
            await syncMensagens(idChat, comErro);
            setSending(false);
            return;
          }
          const contextoLinha = buildImageContextNote(out.contexto);
          const assistantFollowUp = buildImagePreviewAssistantMessage(out, contextoLinha);
          const finalMsgs = [...msgsComUsuario, assistantFollowUp];
          setMessages(finalMsgs);
          await syncMensagens(idChat, finalMsgs);
          setSending(false);
          return;
        }
      }

      const confirmAnchor = findLatestConfirmedProposalAnchor(msgsComUsuario, arteBriefDraftRef.current);
      if (shouldGenerateImagePreviewDirectly(question) && confirmAnchor) {
        const latestProposal = confirmAnchor.proposal;
        if (
          typeof window !== "undefined" &&
          !window.confirm("Gerar a imagem? Pode consumir créditos do seu plano.")
        ) {
          setSending(false);
          return;
        }
        setImageGeneratingAfterId(confirmAnchor.messageId);
        const latestLinks = Array.isArray(confirmAnchor.supplement?.links)
          ? confirmAnchor.supplement.links
          : [];
        const out = await invokeImagePreview({
          msgs: msgsComUsuario,
          proposal: latestProposal,
          supplementLinks: latestLinks,
          focusContextoId:
            confirmAnchor.selected_contexto_id ||
            latestProposal?.matched_contexto?.id_contexto_empresa,
        });
        if (!out.ok) {
          const errBubble = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: out.error || "Não foi possível gerar a imagem agora.",
            sources: [],
          };
          const comErro = [...msgsComUsuario, errBubble];
          setMessages(comErro);
          await syncMensagens(idChat, comErro);
          setSending(false);
          setImageGeneratingAfterId(null);
          return;
        }
        const contextoLinha = buildImageContextNote(out.contexto);
        const assistantFollowUp = buildImagePreviewAssistantMessage(out, contextoLinha);
        const finalMsgs = [...msgsComUsuario, assistantFollowUp];
        setMessages(finalMsgs);
        await syncMensagens(idChat, finalMsgs);
        setSending(false);
        setImageGeneratingAfterId(null);
        return;
      }

      const body = {
        question,
        history: historyForApi,
        id_empresa: empresaId,
      };

      const result = await authApiFetchWithToken("/ia/chat", {
        method: "POST",
        body: JSON.stringify(body),
        timeoutMs: CHAT_IA_TIMEOUT_MS,
        timeoutLabel: "chat",
      });

      if (!result.ok || result.networkError) {
        const msg =
          result.networkError?.message ||
          result.json?.error ||
          "Não foi possível responder agora. Tente novamente.";
        const errText = typeof msg === "string" ? msg : formatAuthError(result.json) || "Erro desconhecido.";
        const errBubble = { id: crypto.randomUUID(), role: "assistant", content: String(errText), sources: [] };
        const comErro = [...msgsComUsuario, errBubble];
        setMessages(comErro);
        await syncMensagens(idChat, comErro);
        setSending(false);
        return;
      }

      const answer = String(result.json?.answer ?? "Sem resposta no momento.");
      const rawSources = result.json?.source_documents;
      const sources = Array.isArray(rawSources)
        ? [
            ...new Set(
              rawSources
                .map((d) => (d && typeof d.source === "string" ? d.source.trim() : ""))
                .filter(Boolean),
            ),
          ]
        : [];

      const rawSup = result.json?.post_supplement;
      const hasRawSupLinks = rawSup && typeof rawSup === "object" && Array.isArray(rawSup.links) && rawSup.links.length > 0;
      const hasRawSupProposal =
        rawSup &&
        typeof rawSup === "object" &&
        rawSup.post_context_proposal &&
        typeof rawSup.post_context_proposal === "object" &&
        Object.keys(rawSup.post_context_proposal).length > 0;
      const post_supplement =
        rawSup &&
        typeof rawSup === "object" &&
        ((typeof rawSup.confirmation_message === "string" && rawSup.confirmation_message.trim()) ||
          hasRawSupLinks ||
          hasRawSupProposal)
          ? {
              confirmation_message: String(rawSup.confirmation_message ?? "").trim(),
              links: Array.isArray(rawSup.links)
                ? rawSup.links.map(normalizeSupplementLink).filter(Boolean)
                : [],
              post_context_proposal:
                rawSup.post_context_proposal && typeof rawSup.post_context_proposal === "object"
                  ? rawSup.post_context_proposal
                  : {},
              ...(rawSup.briefing_status === "collecting" || rawSup.briefing_status === "ready"
                ? { briefing_status: rawSup.briefing_status }
                : {}),
            }
          : undefined;

      const rawUi = result.json?.ui_actions;
      const ui_actions = Array.isArray(rawUi)
        ? rawUi.filter(
            (a) =>
              a &&
              typeof a === "object" &&
              typeof a.id === "string" &&
              a.id.trim() &&
              typeof a.label === "string" &&
              a.label.trim(),
          )
        : [];
      const routeImage =
        Boolean(result.json?.route_image_generation) ||
        Boolean(result.json?.offer_post_context) ||
        detectImageGenerationIntentFromHistory(historyForApi, question);
      const assistantContent = routeImage
        ? post_supplement?.briefing_status === "collecting"
          ? CHAT_PEDIDO_COLETANDO_INTRO
          : post_supplement
            ? CHAT_PEDIDO_RESUMO_MSG
            : CHAT_PEDIDO_AGUARDE_MSG
        : answer;

      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantContent,
        sources,
        post_supplement,
        ui_actions: ui_actions.length ? ui_actions : undefined,
      };
      const finalMsgs = [...msgsComUsuario, assistantMsg];
      setMessages(finalMsgs);
      await syncMensagens(idChat, finalMsgs);
      setSending(false);
      if (routeImage && empresaId && !post_supplement) {
        const historyForProposal = finalMsgs.map((m) => ({ role: m.role, content: m.content }));
        void attachPostContextSupplement(idChat, assistantMsg.id, historyForProposal, picksAtSend);
      }
    },
    [
      input,
      readLiveSlashInput,
      sending,
      empresaId,
      messages,
      conversaId,
      historyForApi,
      syncMensagens,
      attachPostContextSupplement,
      invokeImagePreview,
      showErr,
      runGenerateCaptionForImage,
      runRegenerateCaption,
      runPublishInstagramForCaption,
      startCaptionEdit,
      slashChips,
      closeSlashMenu,
    ],
  );

  function onNewChat() {
    if (sending || deleting || loadingConversa || actionBusy) return;
    cancelCaptionEdit();
    setConversaId(null);
    setMessages([]);
    setInput("");
    setSlashChips(emptySlashChips());
    closeSlashMenu();
    resetArteBriefDraft();
    try {
      if (empresaId) sessionStorage.removeItem(lastConversaStorageKey(empresaId));
    } catch {
      /* ignore */
    }
    clearChatSession(empresaId);
  }

  async function onDeleteChat() {
    if (sending || deleting) return;
    if (!conversaId) {
      setMessages([]);
      return;
    }
    if (!window.confirm("Apagar esta conversa?")) return;
    setDeleting(true);
    const r = await authApiFetchWithToken(`/chat/conversas/${encodeURIComponent(conversaId)}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!r.ok || r.networkError) {
      showErr(r.networkError?.message || formatAuthError(r.json) || "Não foi possível apagar.");
      return;
    }
    try {
      if (empresaId) sessionStorage.removeItem(lastConversaStorageKey(empresaId));
    } catch {
      /* ignore */
    }
    clearChatSession(empresaId);
    setConversaId(null);
    setMessages([]);
    setInput("");
    resetArteBriefDraft();
    await loadListaConversas();
  }

  async function pickConversa(value) {
    setConversaMenuOpen(false);
    if (!value) {
      onNewChat();
      return;
    }
    await loadConversa(value);
  }

  const conversaTriggerLabel = useMemo(() => {
    if (!conversaId) return "Nova conversa";
    const c = conversas.find((x) => x.id_conversa === conversaId);
    return c ? formatTituloLista(c) : "Conversa";
  }, [conversaId, conversas]);

  function openRename() {
    if (!conversaId) return;
    const c = conversas.find((x) => x.id_conversa === conversaId);
    setRenameInput((c?.titulo && String(c.titulo).trim()) || formatTituloLista(c) || "");
    setRenameOpen(true);
  }

  async function submitRename() {
    if (!conversaId) return;
    const t = renameInput.trim().slice(0, 200);
    if (!t) return;
    setRenameSaving(true);
    const r = await authApiFetchWithToken(`/chat/conversas/${encodeURIComponent(conversaId)}`, {
      method: "PATCH",
      body: JSON.stringify({ titulo: t }),
    });
    setRenameSaving(false);
    if (!r.ok || r.networkError) {
      showErr(r.networkError?.message || formatAuthError(r.json) || "Não foi possível renomear.");
      return;
    }
    setRenameOpen(false);
    await loadListaConversas();
  }

  return (
    <main className="flex h-[calc(100dvh-9rem)] min-h-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-background md:h-[calc(100dvh-8rem)]">
      <header className="shrink-0 border-b border-border bg-background px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-0">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-background md:h-24 md:w-24">
            <Image
              src="/imagens/TUMA_CROPPED.png"
              alt="Tuma mascote oficial"
              fill
              className="object-contain p-1"
              sizes="96px"
              priority
            />
          </div>
          <div className="min-w-0 py-1">
            <h1 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
              Tuma <span className="text-accent">IA</span>
            </h1>
          </div>
        </div>
      </header>

      {!empresaReady ? (
        <p className="shrink-0 px-4 py-2 text-sm text-slate-600 md:px-6">Carregando…</p>
      ) : !empresaId ? (
        <p className="mx-4 my-2 shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 md:mx-6">
          Sua conta precisa estar ligada a um negócio para usar o chat.
        </p>
      ) : null}

      {errMsg ? (
        <p className="mx-4 mt-1 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 md:mx-6">{errMsg}</p>
      ) : null}

      <Modal open={renameOpen} onClose={() => !renameSaving && setRenameOpen(false)} title="Nome da conversa">
        <div className="mt-3 space-y-3">
          <input
            type="text"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            maxLength={200}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            placeholder="Ex.: Ideias para o Instagram"
            disabled={renameSaving}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={renameSaving}
              onClick={() => setRenameOpen(false)}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={renameSaving || !renameInput.trim()}
              onClick={() => void submitRename()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
            >
              {renameSaving ? "…" : "OK"}
            </button>
          </div>
        </div>
      </Modal>

      <section className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-background">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <button
              type="button"
              onClick={onNewChat}
              disabled={sending || deleting || loadingConversa}
              className="rounded-lg border border-accent/45 bg-accent-muted px-3 py-1.5 text-sm font-semibold text-[#009638] disabled:opacity-50"
            >
              + Novo
            </button>
            <div
              ref={conversaDropdownRef}
              className="relative min-w-[180px] max-w-[min(100%,240px)] flex-1"
            >
              <button
                type="button"
                id="conversa-menu-trigger"
                className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-sm text-foreground shadow-sm transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
                aria-haspopup="listbox"
                aria-expanded={conversaMenuOpen}
                aria-label="Selecionar conversa"
                disabled={loadingList || loadingConversa || sending || !!actionBusy}
                onClick={() => setConversaMenuOpen((o) => !o)}
              >
                <span className="min-w-0 truncate">{conversaTriggerLabel}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${conversaMenuOpen ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {conversaMenuOpen ? (
                <ul
                  className="absolute left-0 right-0 z-50 mt-1 max-h-[min(60vh,280px)] overflow-y-auto rounded-lg border border-border bg-background py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10"
                  role="listbox"
                  aria-labelledby="conversa-menu-trigger"
                >
                  <li role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={!conversaId}
                      className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                        !conversaId
                          ? "bg-accent/15 font-medium text-accent dark:bg-accent/25"
                          : "text-foreground hover:bg-muted"
                      }`}
                      onClick={() => void pickConversa("")}
                    >
                      Nova conversa
                    </button>
                  </li>
                  {conversas.map((c) => {
                    const selected = c.id_conversa === conversaId;
                    return (
                      <li key={c.id_conversa} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                            selected
                              ? "bg-accent/15 font-medium text-accent dark:bg-accent/25"
                              : "text-foreground hover:bg-muted"
                          }`}
                          onClick={() => void pickConversa(c.id_conversa)}
                        >
                          <span className="min-w-0 truncate">{formatTituloLista(c)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
            <button
              type="button"
              onClick={openRename}
              disabled={!conversaId || sending || loadingConversa}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              title="Renomear"
              aria-label="Renomear conversa"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => void onDeleteChat()}
              disabled={sending || deleting}
              className="ml-auto rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 disabled:opacity-50"
            >
              {deleting ? "…" : "Apagar"}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 md:px-4 md:py-4">
            <div className="space-y-4">
              {messages.length === 0 && empresaId ? (
                <p className="text-center text-sm text-muted-foreground">Digite abaixo para começar.</p>
              ) : null}

              {messages.map((message) => {
                if (message.role === "user") {
                  if (isHiddenUserMessage(message)) return null;
                  return (
                    <article key={message.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl bg-accent px-4 py-3 text-base font-medium text-accent-foreground shadow-sm md:max-w-[70%]">
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                    </article>
                  );
                }

                const hasSources = Array.isArray(message.sources) && message.sources.length > 0;
                const hasUiActions = Array.isArray(message.ui_actions) && message.ui_actions.length > 0;
                const hasImages = Array.isArray(message.image_urls) && message.image_urls.length > 0;
                const supplementMsg =
                  message.post_supplement &&
                  typeof message.post_supplement.confirmation_message === "string"
                    ? message.post_supplement.confirmation_message.trim()
                    : "";
                const supplementLinks =
                  message.post_supplement && Array.isArray(message.post_supplement.links)
                    ? message.post_supplement.links
                    : [];
                const confirmProposal = message.post_supplement?.post_context_proposal;
                const hasProposalBody =
                  confirmProposal &&
                  typeof confirmProposal === "object" &&
                  ((typeof confirmProposal.resumo_visual === "string" &&
                    confirmProposal.resumo_visual.trim().length > 0) ||
                    (Array.isArray(confirmProposal.midias_referenced) &&
                      confirmProposal.midias_referenced.length > 0) ||
                    confirmProposal.product_media_status === "missing");
                const hasSupplement =
                  Boolean(supplementMsg) || supplementLinks.length > 0 || Boolean(hasProposalBody);
                const hasArteBrief =
                  message.post_supplement?.post_context_proposal?.arte_brief &&
                  typeof message.post_supplement.post_context_proposal.arte_brief === "object";
                return (
                  <article key={message.id} className="flex items-start gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-background">
                      <Image
                        src="/imagens/TUMA_CROPPED.png"
                        alt=""
                        fill
                        className="object-contain p-0.5"
                        sizes="40px"
                      />
                    </div>
                    <div className="min-w-0 max-w-[85%] rounded-2xl border border-border bg-background px-4 py-3 text-foreground shadow-sm md:max-w-[70%]">
                      {!hasSupplement ? (
                        captionEditingId === message.id ? (
                          <div className="space-y-2">
                            <textarea
                              id={`caption-edit-${message.id}`}
                              value={captionEditDraft}
                              onChange={(e) => setCaptionEditDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelCaptionEdit();
                                }
                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                  e.preventDefault();
                                  void saveCaptionEdit(message.id);
                                }
                              }}
                              rows={6}
                              disabled={!!actionBusy || sending}
                              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-base leading-relaxed text-foreground outline-none focus:border-accent/55 focus:ring-2 focus:ring-accent/15"
                              aria-label="Editar legenda"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={!!actionBusy || sending}
                                onClick={() => void saveCaptionEdit(message.id)}
                                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                              >
                                Salvar legenda
                              </button>
                              <button
                                type="button"
                                disabled={!!actionBusy || sending}
                                onClick={cancelCaptionEdit}
                                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                              >
                                Cancelar
                              </button>
                            </div>
                            <p className="text-xs text-muted-foreground">Ctrl+Enter para salvar</p>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{message.content}</p>
                        )
                      ) : String(message.content || "").trim() ? (
                        <p className="mb-2 text-sm text-muted-foreground">{message.content}</p>
                      ) : null}
                      {postContextLoadingId === message.id ? (
                        <div className="mt-3 rounded-xl border border-dashed border-accent/40 bg-accent-muted/15 px-3 py-2.5 text-sm text-muted-foreground">
                          Preparando o resumo…
                        </div>
                      ) : null}
                      {imageGeneratingAfterId === message.id ? (
                        <div className="mt-3 rounded-xl border border-dashed border-accent/40 bg-accent-muted/15 px-3 py-2.5 text-sm text-muted-foreground">
                          Gerando imagem (pode levar alguns minutos)…
                        </div>
                      ) : null}
                      {hasSupplement ? (
                        <ChatImageConfirmBlock
                          supplement={message.post_supplement}
                          collecting={message.post_supplement?.briefing_status === "collecting"}
                          hasArteBrief={Boolean(hasArteBrief)}
                          contextosCampanha={contextosCampanha}
                          selectedContextoId={
                            message.selected_contexto_id ||
                            message.post_supplement?.post_context_proposal?.matched_contexto
                              ?.id_contexto_empresa ||
                            ""
                          }
                          onContextoChange={(ctxId) => onConfirmContextoChange(message.id, ctxId)}
                          disabled={!!actionBusy || sending}
                        />
                      ) : null}
                      {hasArteBrief && supplementMsg && !hasSupplement ? (
                        <p className="mt-2 text-xs text-muted-foreground">{supplementMsg}</p>
                      ) : null}
                      {hasImages ? (
                        <div className="mt-3 space-y-2">
                          {message.image_urls.map((url, imgIdx) => (
                            <ChatGeneratedImagePreview key={url} url={url} index={imgIdx} />
                          ))}
                        </div>
                      ) : null}
                      {actionBusy === `${message.id}:generate_caption` ? (
                        <div className="mt-3 rounded-xl border border-dashed border-accent/40 bg-accent-muted/15 px-3 py-2.5 text-sm text-muted-foreground">
                          Gerando legenda…
                        </div>
                      ) : null}
                      {hasUiActions && captionEditingId !== message.id ? (
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          {message.ui_actions.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              disabled={!!actionBusy || sending}
                              onClick={() => void runDeliveryAction(message.id, a.id)}
                              className="rounded-xl border border-accent/40 bg-accent-muted px-3 py-2.5 text-left text-sm font-semibold text-[#009638] shadow-sm transition-[transform,box-shadow] hover:border-accent/60 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-100"
                            >
                              {friendlyUiActionLabel(a)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {hasSources ? (
                        <details className="mt-2 rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
                          <summary className="cursor-pointer text-muted-foreground">Mais detalhes ({message.sources.length})</summary>
                          <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
                            {message.sources.map((src) => (
                              <li key={src} className="break-all">
                                {src}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                  </article>
                );
              })}
              {chatBusy ? <AssistantTypingBubble statusLabel={busyStatusLabel} /> : null}
              <div ref={bottomRef} />
            </div>
          </div>

          <footer className="shrink-0 border-t border-border bg-surface-elevated/90 backdrop-blur-sm">
            {empresaId ? (
              arteBriefLoading ? (
                <p className="border-b border-border/60 px-3 py-2 text-center text-xs text-muted-foreground md:px-4">
                  Carregando formato…
                </p>
              ) : (
                <ChatFormatoBar
                  brief={arteBriefDraft}
                  brandColors={brandColors}
                  disabled={chatBusy}
                  collapseStorageKey={formatoBarCollapsedStorageKey(empresaId)}
                  onBriefChange={(b) => {
                    const next = normalizeArteBrief(b, brandColors);
                    setArteBriefDraft(next);
                    persistArteBriefDraft(next);
                  }}
                />
              )
            ) : null}
            {busyStatusLabel ? (
              <p className="px-3 py-2 text-center text-xs font-medium text-muted-foreground md:px-4" aria-live="polite">
                {busyStatusLabel}… pode levar até 2 minutos.
              </p>
            ) : null}
            <form className="flex items-end gap-2 p-2 md:p-3" onSubmit={onSubmit}>
              <button
                type="button"
                disabled
                className="h-9 w-9 shrink-0 cursor-not-allowed rounded-full border border-border bg-muted text-muted-foreground"
                title="Em breve"
              >
                +
              </button>
              <div className="relative flex min-h-[44px] min-w-0 flex-1 flex-col rounded-xl border border-border bg-surface-elevated focus-within:border-accent/70">
                <ChatSlashMenu
                  open={slashMenu.open && !chatBusy && !!empresaId}
                  query={slashMenu.query}
                  empresaId={empresaId}
                  modelosAtivos={modelosAtivos}
                  selectedMidiaIds={selectedSlashMidiaIds}
                  onPickModelo={handlePickSlashModelo}
                  onPickMidia={handlePickSlashMidia}
                  onClose={closeSlashMenu}
                />
                <ChatSlashInput
                  ref={inputRef}
                  rows={2}
                  chips={slashChips}
                  placeholder={empresaId ? "Mensagem…" : "Indisponível"}
                  value={input}
                  onChange={handleChatInputChange}
                  onSelect={(e) => {
                    const pos = e.currentTarget.selectionStart ?? 0;
                    inputCursorRef.current = pos;
                    const live = readLiveSlashInput();
                    syncSlashMenuFromInput(live.text, pos);
                  }}
                  onKeyDown={(e) => {
                    if (
                      slashMenu.open &&
                      (e.key === "Enter" ||
                        e.key === "ArrowDown" ||
                        e.key === "ArrowUp" ||
                        e.key === "Escape")
                    ) {
                      return;
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      inputRef.current?.flushToParent?.();
                      e.currentTarget.closest("form")?.requestSubmit();
                    }
                  }}
                  disabled={chatBusy || !empresaId}
                />
              </div>
              <button
                type="submit"
                disabled={chatBusy || !empresaId}
                className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                {chatBusy ? "…" : "Enviar"}
              </button>
            </form>
          </footer>
        </div>
      </section>
    </main>
  );
}
