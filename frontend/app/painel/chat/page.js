"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../../components/Modal";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import { shouldOfferPostContext } from "../../../lib/chatDeliveryUi";

/** Alinhado ao polling da Replicate no backend (~120s) + margem. */
const IMAGE_PREVIEW_TIMEOUT_MS = 150_000;
/** Ollama com contextos + mídias no prompt (backend: 120s). */
const POST_CONTEXT_TIMEOUT_MS = 130_000;

function looksLikeImageCreationCommand(text) {
  const t = String(text || "")
    .trim()
    .toLowerCase();
  if (t.length < 6) return false;
  return (
    /\bcri(a|ar|e)\s+(a\s+)?im(agem)?\b/.test(t) ||
    /\bgera(r)?\s+(a\s+)?(pr[eé]via|arte)\b/.test(t) ||
    /\bpr[eé]via\s+(da\s+)?im(agem)?\b/.test(t) ||
    /\bmont(a|ar)\s+(a\s+)?(arte|imagem)\b/.test(t)
  );
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

/** UUIDs de mídias de imagem para referência na Replicate (máx. 3: 1ª = pixels no FLUX Pro; 2ª e 3ª = texto). */
function referenceMidiaIdsFromProposal(proposal, supplementLinks) {
  const ids = [];
  const push = (id) => {
    const t = typeof id === "string" ? id.trim() : "";
    if (t && UUID_RE.test(t) && !ids.includes(t)) ids.push(t);
  };
  if (proposal && typeof proposal === "object") {
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

function buildImagePreviewRequestBody({ history, empresaId, proposal, supplementLinks }) {
  const reference_midia_ids = referenceMidiaIdsFromProposal(proposal, supplementLinks);
  const linksForApi = Array.isArray(supplementLinks)
    ? supplementLinks
        .filter((l) => l && (l.kind === "midia" || l.kind === "contexto") && typeof l.id === "string")
        .map((l) => ({ kind: l.kind, id: l.id.trim() }))
        .filter((l) => UUID_RE.test(l.id))
    : [];
  return {
    history,
    id_empresa: empresaId,
    ...(proposal && typeof proposal === "object" && Object.keys(proposal).length
      ? { post_context_proposal: proposal }
      : {}),
    ...(linksForApi.length ? { post_supplement_links: linksForApi } : {}),
    ...(reference_midia_ids.length ? { reference_midia_ids } : {}),
  };
}

function formatFraseNaImagemFromProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  const direct = proposal.frase_na_imagem;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const facts = proposal.facts_for_image;
  if (facts && typeof facts === "object" && typeof facts.frase_na_imagem === "string") {
    const f = facts.frase_na_imagem.trim();
    if (f) return f;
  }
  return null;
}

function buildImageContextNote(cg) {
  if (!cg || typeof cg !== "object") return "";
  const lines = [];
  const frase =
    typeof cg.frase_na_imagem === "string" && cg.frase_na_imagem.trim()
      ? cg.frase_na_imagem.trim()
      : null;
  if (frase) lines.push(`Frase na imagem: «${frase}»`);
  const n = Number(cg.contextos_carregados) || 0;
  const nomes = Array.isArray(cg.contextos)
    ? cg.contextos.map((c) => (c && typeof c.nome === "string" ? c.nome.trim() : "")).filter(Boolean)
    : [];
  if (n === 0) {
    lines.push("Contextos do painel: nenhum ativo (usou cadastro + conversa).");
  } else {
    const lista = nomes.slice(0, 6).join(", ");
    const mais = nomes.length > 6 ? "…" : "";
    lines.push(
      `Contextos considerados: ${n}${lista ? ` (${lista}${mais})` : ""}`,
    );
  }
  return lines.length ? `\n\n(${lines.join(" · ")})` : "";
}

function appendImageGenerationModeNote(contextoLinha, json) {
  const ig = json?.image_generation;
  if (ig && ig.mode === "flux-1.1-pro-reference") {
    return (
      contextoLinha +
      "\n\n(Referência visual do acervo: FLUX 1.1 Pro com image_prompt — custo na Replicate costuma ser maior que prévia só com texto.)"
    );
  }
  return contextoLinha;
}

function lastConversaStorageKey(empresaId) {
  return `tuma_chat_last_conversa_${empresaId || "none"}`;
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
      post_supplement = { confirmation_message: cm, links, post_context_proposal };
    }
  }
  const post_context_proposal =
    meta && typeof meta === "object" && meta.post_context_proposal && typeof meta.post_context_proposal === "object"
      ? meta.post_context_proposal
      : undefined;
  const out = {
    id: typeof m.id_mensagem === "string" ? m.id_mensagem : crypto.randomUUID(),
    role: papel,
    content: conteudo,
    sources,
    ui_actions: ui_actions.length ? ui_actions : undefined,
    image_urls: image_urls.length ? image_urls : undefined,
  };
  if (post_supplement) out.post_supplement = post_supplement;
  if (post_context_proposal && Object.keys(post_context_proposal).length > 0 && !post_supplement) {
    out.post_context_proposal = post_context_proposal;
  }
  return out;
}

function toApiMensagens(messages) {
  return messages.map((m) => {
    const meta = {};
    if (m.sources && m.sources.length) meta.sources = m.sources;
    if (m.ui_actions && m.ui_actions.length) meta.ui_actions = m.ui_actions;
    if (m.image_urls && m.image_urls.length) meta.image_urls = m.image_urls;
    if (m.post_supplement && typeof m.post_supplement === "object" && m.post_supplement.confirmation_message) {
      meta.post_supplement = m.post_supplement;
    }
    if (m.post_context_proposal && typeof m.post_context_proposal === "object" && Object.keys(m.post_context_proposal).length > 0) {
      meta.post_context_proposal = m.post_context_proposal;
    }
    return {
      papel: m.role,
      conteudo: m.content,
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
  const errTimer = useRef(null);
  const conversaDropdownRef = useRef(null);
  const [conversaMenuOpen, setConversaMenuOpen] = useState(false);
  /** `assistantMessageId:actionId` enquanto processa clique em botão de entrega */
  const [actionBusy, setActionBusy] = useState(null);
  /** Mensagem da IA aguardando `POST /ia/post-context-proposal`. */
  const [postContextLoadingId, setPostContextLoadingId] = useState(null);
  const messagesRef = useRef(messages);

  const chatBusy = sending || !!actionBusy || !!postContextLoadingId;
  const busyStatusLabel = actionBusy
    ? actionBusy === "panel-image"
      ? "Gerando arte com contextos e fotos do painel"
      : "Gerando prévia da imagem na Replicate"
    : postContextLoadingId
      ? "Montando confirmação com contextos e fotos do painel"
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
      const primeira = Array.isArray(minhas.json?.empresas) ? minhas.json.empresas[0] : null;
      const idEmp = primeira?.empresa?.id_empresa ?? null;
      setEmpresaId(idEmp || null);
      setEmpresaReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

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
      setConversaId(id);
      if (options.remember && empresaId && typeof window !== "undefined") {
        try {
          sessionStorage.setItem(lastConversaStorageKey(empresaId), id);
        } catch {
          /* ignore */
        }
      }
    },
    [empresaId],
  );

  useEffect(() => {
    if (!empresaReady || !empresaId) return;
    let cancelled = false;
    (async () => {
      await loadListaConversas();
      if (cancelled) return;
      let last = null;
      try {
        last = sessionStorage.getItem(lastConversaStorageKey(empresaId));
      } catch {
        /* ignore */
      }
      if (last && /^[0-9a-f-]{36}$/i.test(last)) {
        const check = await authApiFetchWithToken(`/chat/conversas/${encodeURIComponent(last)}`);
        if (check.ok && !check.networkError && Array.isArray(check.json?.mensagens)) {
          await loadConversa(last, { remember: false });
          return;
        }
      }
      setConversaId(null);
      setMessages([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [empresaReady, empresaId, loadListaConversas, loadConversa]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const historyForApi = useMemo(
    () => messages.map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  const syncMensagens = useCallback(
    async (chatId, lista) => {
      const put = await authApiFetchWithToken(`/chat/conversas/${encodeURIComponent(chatId)}/mensagens`, {
        method: "PUT",
        body: JSON.stringify({ mensagens: toApiMensagens(lista) }),
      });
      if (!put.ok || put.networkError) {
        showErr(put.networkError?.message || formatAuthError(put.json) || "Não foi possível salvar a conversa.");
        return false;
      }
      void loadListaConversas();
      return true;
    },
    [loadListaConversas],
  );

  const attachPostContextSupplement = useCallback(
    async function attachPostContextSupplementFn(chatId, assistantMessageId, historyForProposal) {
      if (!empresaId || !chatId) return;
      setPostContextLoadingId(assistantMessageId);
      try {
        const prop = await authApiFetchWithToken("/ia/post-context-proposal", {
          method: "POST",
          body: JSON.stringify({
            history: historyForProposal,
            id_empresa: empresaId,
          }),
          timeoutMs: POST_CONTEXT_TIMEOUT_MS,
        });
        if (!prop.ok || prop.networkError) {
          const msg =
            prop.networkError?.message ||
            (typeof prop.json?.error === "string" ? prop.json.error : formatAuthError(prop.json)) ||
            "Não foi possível montar a confirmação com os dados do painel.";
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
        const post_supplement =
          rawSup &&
          typeof rawSup.confirmation_message === "string" &&
          rawSup.confirmation_message.trim()
            ? {
                confirmation_message: rawSup.confirmation_message.trim(),
                links: Array.isArray(rawSup.links)
                  ? rawSup.links.map(normalizeSupplementLink).filter(Boolean)
                  : [],
                post_context_proposal:
                  rawSup.post_context_proposal && typeof rawSup.post_context_proposal === "object"
                    ? rawSup.post_context_proposal
                    : {},
              }
            : undefined;
        const rawUi = rawSup?.ui_actions;
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
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  post_supplement,
                  ui_actions: ui_actions.length ? ui_actions : undefined,
                }
              : m,
          );
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
    [empresaId, syncMensagens],
  );

  const runDeliveryAction = useCallback(
    async function runDeliveryActionFn(fromAssistantMessageId, actionId) {
      const idChat = conversaId;
      if (!idChat || !empresaId || sending || actionBusy) return;
      if (actionId !== "confirm_generate_image") return;

      if (
        typeof window !== "undefined" &&
        !window.confirm(
          "Gerar a prévia cria uma imagem na Replicate e pode consumir créditos da conta ligada ao servidor. Só continue se isso for intencional.",
        )
      ) {
        return;
      }

      const userLine = "Confirmar e gerar prévia da imagem.";
      setActionBusy(`${fromAssistantMessageId}:${actionId}`);
      setSending(true);
      const prev = messagesRef.current;
      const cleared = prev.map((m) =>
        m.id === fromAssistantMessageId ? { ...m, ui_actions: undefined } : m,
      );
      const userMsg = { id: crypto.randomUUID(), role: "user", content: userLine };
      const msgsWithUser = [...cleared, userMsg];
      setMessages(msgsWithUser);

      const okSync1 = await syncMensagens(idChat, msgsWithUser);
      if (!okSync1) {
        setActionBusy(null);
        setSending(false);
        return;
      }

      const historyFull = msgsWithUser.map((m) => ({ role: m.role, content: m.content }));

      try {
        const anchor = msgsWithUser.find((m) => m.id === fromAssistantMessageId);
        const supplement = anchor?.post_supplement;
        const proposal =
          supplement?.post_context_proposal || anchor?.post_context_proposal;
        const supplementLinks = Array.isArray(supplement?.links) ? supplement.links : [];
        if (!proposal || typeof proposal !== "object" || !Object.keys(proposal).length) {
          const errBubble = {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "Não encontrei o pacote de confirmação nesta mensagem. Peça o post de novo no chat para a IA montar o resumo com links.",
            sources: [],
          };
          const comErro = [...msgsWithUser, errBubble];
          setMessages(comErro);
          await syncMensagens(idChat, comErro);
          return;
        }
        const result = await authApiFetchWithToken("/ia/image-preview", {
          method: "POST",
          body: JSON.stringify(
            buildImagePreviewRequestBody({
              history: historyFull,
              empresaId,
              proposal,
              supplementLinks,
            }),
          ),
          timeoutMs: IMAGE_PREVIEW_TIMEOUT_MS,
        });
        if (!result.ok || result.networkError) {
          const msg =
            result.networkError?.message ||
            result.json?.error ||
            "Não foi possível gerar a prévia agora.";
          const errText = typeof msg === "string" ? msg : formatAuthError(result.json) || "Erro desconhecido.";
          const errBubble = { id: crypto.randomUUID(), role: "assistant", content: String(errText), sources: [] };
          const comErro = [...msgsWithUser, errBubble];
          setMessages(comErro);
          await syncMensagens(idChat, comErro);
          return;
        }
        const urls = Array.isArray(result.json?.image_urls) ? result.json.image_urls.filter(Boolean) : [];
        const cg = result.json?.contexto_geracao;
        let contextoLinha = buildImageContextNote(cg);
        contextoLinha = appendImageGenerationModeNote(contextoLinha, result.json);
        const assistantFollowUp = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            (urls.length > 0
              ? "Prévia gerada (o link da imagem pode expirar na hospedagem da Replicate):"
              : "A geração retornou sem URLs de imagem.") + contextoLinha,
          sources: [],
          image_urls: urls.length ? urls : undefined,
        };
        const finalMsgs = [...msgsWithUser, assistantFollowUp];
        setMessages(finalMsgs);
        await syncMensagens(idChat, finalMsgs);
      } catch (err) {
        const errBubble = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Erro inesperado ao gerar a prévia.",
          sources: [],
        };
        const comErro = [...msgsWithUser, errBubble];
        setMessages(comErro);
        await syncMensagens(idChat, comErro);
      } finally {
        setActionBusy(null);
        setSending(false);
      }
    },
    [conversaId, empresaId, sending, actionBusy, syncMensagens],
  );

  const runGenerateImageFromPanel = useCallback(
    async function runGenerateImageFromPanelFn() {
      if (!empresaId || sending || actionBusy) return;
      const hist = messages.filter((m) => m.role === "user" || m.role === "assistant");
      if (!hist.length) {
        showErr("Envie pelo menos uma mensagem antes de gerar a arte, para a IA ter contexto da conversa.");
        return;
      }
      if (
        typeof window !== "undefined" &&
        !window.confirm(
          "Gerar a prévia usa os contextos ativos e fotos referenciadas no painel (Replicate pode consumir créditos). Continuar?",
        )
      ) {
        return;
      }

      let idChat = conversaId;
      const userLine = "Gerar arte com contextos e fotos do painel.";
      const userMsg = { id: crypto.randomUUID(), role: "user", content: userLine };
      const msgsWithUser = [...messages, userMsg];
      setActionBusy("panel-image");
      setSending(true);
      setMessages(msgsWithUser);

      if (!idChat) {
        const cr = await authApiFetchWithToken("/chat/conversas", {
          method: "POST",
          body: JSON.stringify({ id_empresa: empresaId }),
        });
        if (!cr.ok || cr.networkError) {
          setMessages(messages);
          setActionBusy(null);
          setSending(false);
          showErr(cr.networkError?.message || formatAuthError(cr.json) || "Não foi possível iniciar a conversa.");
          return;
        }
        const created = cr.json?.conversa?.id_conversa;
        if (!created || typeof created !== "string") {
          setMessages(messages);
          setActionBusy(null);
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

      const okSync1 = await syncMensagens(idChat, msgsWithUser);
      if (!okSync1) {
        setActionBusy(null);
        setSending(false);
        return;
      }

      const historyFull = msgsWithUser.map((m) => ({ role: m.role, content: m.content }));
      const proposal = findLatestImageProposalObject(msgsWithUser);
      let supplementLinks = [];
      for (let i = msgsWithUser.length - 1; i >= 0; i--) {
        const ps = msgsWithUser[i]?.post_supplement;
        if (ps && Array.isArray(ps.links) && ps.links.length) {
          supplementLinks = ps.links;
          break;
        }
      }

      try {
        const result = await authApiFetchWithToken("/ia/image-preview", {
          method: "POST",
          body: JSON.stringify(
            buildImagePreviewRequestBody({
              history: historyFull,
              empresaId,
              proposal: proposal || undefined,
              supplementLinks,
            }),
          ),
          timeoutMs: IMAGE_PREVIEW_TIMEOUT_MS,
        });
        if (!result.ok || result.networkError) {
          const msg =
            result.networkError?.message ||
            result.json?.error ||
            "Não foi possível gerar a prévia agora.";
          const errText = typeof msg === "string" ? msg : formatAuthError(result.json) || "Erro desconhecido.";
          const errBubble = { id: crypto.randomUUID(), role: "assistant", content: String(errText), sources: [] };
          const comErro = [...msgsWithUser, errBubble];
          setMessages(comErro);
          await syncMensagens(idChat, comErro);
          return;
        }
        const urls = Array.isArray(result.json?.image_urls) ? result.json.image_urls.filter(Boolean) : [];
        const cg = result.json?.contexto_geracao;
        let contextoLinha = buildImageContextNote(cg);
        contextoLinha = appendImageGenerationModeNote(contextoLinha, result.json);
        const assistantFollowUp = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            (urls.length > 0
              ? "Prévia gerada (o link da imagem pode expirar na hospedagem da Replicate):"
              : "A geração retornou sem URLs de imagem.") + contextoLinha,
          sources: [],
          image_urls: urls.length ? urls : undefined,
        };
        const finalMsgs = [...msgsWithUser, assistantFollowUp];
        setMessages(finalMsgs);
        await syncMensagens(idChat, finalMsgs);
      } catch (err) {
        const errBubble = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Erro inesperado ao gerar a arte.",
          sources: [],
        };
        const comErro = [...msgsWithUser, errBubble];
        setMessages(comErro);
        await syncMensagens(idChat, comErro);
      } finally {
        setActionBusy(null);
        setSending(false);
      }
    },
    [empresaId, sending, actionBusy, messages, conversaId, syncMensagens],
  );

  const onSubmit = useCallback(
    async function onSubmit(event) {
      event.preventDefault();
      const question = input.trim();
      if (!question || sending || !empresaId) return;

      const userMsg = { id: crypto.randomUUID(), role: "user", content: question };
      const msgsComUsuario = [...messages, userMsg];
      setInput("");
      setSending(true);
      setMessages(msgsComUsuario);

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

      const latestProposal = findLatestImageProposalObject(msgsComUsuario);
      if (looksLikeImageCreationCommand(question) && latestProposal) {
        if (
          typeof window !== "undefined" &&
          !window.confirm(
            "Gerar a prévia cria uma imagem na Replicate e pode consumir créditos da conta ligada ao servidor. Só continue se isso for intencional.",
          )
        ) {
          setSending(false);
          return;
        }
        let latestLinks = [];
        for (let i = msgsComUsuario.length - 1; i >= 0; i--) {
          const ps = msgsComUsuario[i]?.post_supplement;
          if (ps && Array.isArray(ps.links) && ps.links.length) {
            latestLinks = ps.links;
            break;
          }
        }
        const imgRes = await authApiFetchWithToken("/ia/image-preview", {
          method: "POST",
          body: JSON.stringify(
            buildImagePreviewRequestBody({
              history: msgsComUsuario.map((m) => ({ role: m.role, content: m.content })),
              empresaId,
              proposal: latestProposal,
              supplementLinks: latestLinks,
            }),
          ),
          timeoutMs: IMAGE_PREVIEW_TIMEOUT_MS,
        });
        if (!imgRes.ok || imgRes.networkError) {
          const msg =
            imgRes.networkError?.message ||
            imgRes.json?.error ||
            "Não foi possível gerar a prévia agora.";
          const errText = typeof msg === "string" ? msg : formatAuthError(imgRes.json) || "Erro desconhecido.";
          const errBubble = { id: crypto.randomUUID(), role: "assistant", content: String(errText), sources: [] };
          const comErro = [...msgsComUsuario, errBubble];
          setMessages(comErro);
          await syncMensagens(idChat, comErro);
          setSending(false);
          return;
        }
        const urls = Array.isArray(imgRes.json?.image_urls) ? imgRes.json.image_urls.filter(Boolean) : [];
        const cg = imgRes.json?.contexto_geracao;
        let contextoLinha = buildImageContextNote(cg);
        contextoLinha = appendImageGenerationModeNote(contextoLinha, imgRes.json);
        const assistantFollowUp = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            (urls.length > 0
              ? "Prévia gerada (o link da imagem pode expirar na hospedagem da Replicate):"
              : "A geração retornou sem URLs de imagem.") + contextoLinha,
          sources: [],
          image_urls: urls.length ? urls : undefined,
        };
        const finalMsgs = [...msgsComUsuario, assistantFollowUp];
        setMessages(finalMsgs);
        await syncMensagens(idChat, finalMsgs);
        setSending(false);
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
        timeoutMs: 180000,
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
      const post_supplement =
        rawSup &&
        typeof rawSup === "object" &&
        typeof rawSup.confirmation_message === "string" &&
        rawSup.confirmation_message.trim()
          ? {
              confirmation_message: rawSup.confirmation_message.trim(),
              links: Array.isArray(rawSup.links)
                ? rawSup.links.map(normalizeSupplementLink).filter(Boolean)
                : [],
              post_context_proposal:
                rawSup.post_context_proposal && typeof rawSup.post_context_proposal === "object"
                  ? rawSup.post_context_proposal
                  : {},
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
      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer,
        sources,
        post_supplement,
        ui_actions: ui_actions.length ? ui_actions : undefined,
      };
      const finalMsgs = [...msgsComUsuario, assistantMsg];
      setMessages(finalMsgs);
      await syncMensagens(idChat, finalMsgs);
      setSending(false);

      const needsPostContext =
        !post_supplement &&
        (Boolean(result.json?.offer_post_context) || shouldOfferPostContext(question));
      if (needsPostContext && empresaId) {
        const historyForProposal = finalMsgs.map((m) => ({ role: m.role, content: m.content }));
        void attachPostContextSupplement(idChat, assistantMsg.id, historyForProposal);
      }
    },
    [
      input,
      sending,
      empresaId,
      messages,
      conversaId,
      historyForApi,
      syncMensagens,
      attachPostContextSupplement,
    ],
  );

  function onNewChat() {
    if (sending || deleting || loadingConversa || actionBusy) return;
    setConversaId(null);
    setMessages([]);
    try {
      if (empresaId) sessionStorage.removeItem(lastConversaStorageKey(empresaId));
    } catch {
      /* ignore */
    }
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
    setConversaId(null);
    setMessages([]);
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
                      <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{message.content}</p>
                      {postContextLoadingId === message.id ? (
                        <div className="mt-3 rounded-xl border border-dashed border-accent/40 bg-accent-muted/15 px-3 py-2.5 text-sm text-muted-foreground">
                          Montando confirmação com contextos e fotos do painel…
                        </div>
                      ) : null}
                      {message.post_supplement &&
                      typeof message.post_supplement === "object" &&
                      typeof message.post_supplement.confirmation_message === "string" &&
                      message.post_supplement.confirmation_message.trim() ? (
                        <div className="mt-3 rounded-xl border border-accent/35 bg-accent-muted/20 px-3 py-2.5 text-sm leading-relaxed">
                          <p className="whitespace-pre-wrap text-foreground/95">
                            {message.post_supplement.confirmation_message}
                          </p>
                          {formatFraseNaImagemFromProposal(message.post_supplement.post_context_proposal) ? (
                            <p className="mt-2 text-sm font-medium text-foreground/90">
                              Frase na imagem: «
                              {formatFraseNaImagemFromProposal(message.post_supplement.post_context_proposal)}
                              »
                            </p>
                          ) : null}
                          {Array.isArray(message.post_supplement.links) && message.post_supplement.links.length > 0 ? (
                            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                              {message.post_supplement.links.map((l) => (
                                <li key={`${l.kind}-${l.id}`}>
                                  <Link
                                    href={l.href}
                                    className="font-semibold text-accent underline decoration-accent/45 underline-offset-2 hover:decoration-accent"
                                  >
                                    {l.label}
                                  </Link>
                                  <span className="ml-1.5 text-xs text-muted-foreground">
                                    {l.kind === "contexto" ? "· contexto" : "· mídia"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                      {hasImages ? (
                        <div className="mt-3 space-y-2">
                          {message.image_urls.map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block overflow-hidden rounded-xl border border-border bg-muted/30"
                            >
                              <img src={url} alt="Prévia gerada" className="max-h-72 w-full object-contain" />
                            </a>
                          ))}
                        </div>
                      ) : null}
                      {hasUiActions ? (
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          {message.ui_actions.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              disabled={!!actionBusy || sending}
                              onClick={() => void runDeliveryAction(message.id, a.id)}
                              className="rounded-xl border border-accent/40 bg-accent-muted px-3 py-2.5 text-left text-sm font-semibold text-[#009638] shadow-sm transition-[transform,box-shadow] hover:border-accent/60 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-100"
                            >
                              {a.label}
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

          <footer className="shrink-0 border-t border-border bg-surface-elevated/90 p-2 backdrop-blur-sm md:p-3">
            {busyStatusLabel ? (
              <p className="mb-2 text-center text-xs font-medium text-muted-foreground" aria-live="polite">
                {busyStatusLabel}… pode levar até 2 minutos.
              </p>
            ) : null}
            {empresaId && messages.length > 0 ? (
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  disabled={chatBusy}
                  onClick={() => void runGenerateImageFromPanel()}
                  className="rounded-lg border border-accent/35 bg-accent-muted/30 px-3 py-1.5 text-xs font-semibold text-[#009638] transition-colors hover:border-accent/55 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-100"
                >
                  Gerar arte (contextos + fotos do painel)
                </button>
              </div>
            ) : null}
            <form className="flex items-end gap-2" onSubmit={onSubmit}>
              <button
                type="button"
                disabled
                className="h-9 w-9 shrink-0 cursor-not-allowed rounded-full border border-border bg-muted text-muted-foreground"
                title="Em breve"
              >
                +
              </button>
              <textarea
                rows={2}
                placeholder={empresaId ? "Mensagem…" : "Indisponível"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                disabled={chatBusy || !empresaId}
                className="min-h-[44px] max-h-36 flex-1 resize-y overflow-y-auto rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-accent/70 disabled:bg-muted"
              />
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
