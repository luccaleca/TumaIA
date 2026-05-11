"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../../components/Modal";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";

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
  return {
    id: typeof m.id_mensagem === "string" ? m.id_mensagem : crypto.randomUUID(),
    role: papel,
    content: conteudo,
    sources,
  };
}

function toApiMensagens(messages) {
  return messages.map((m) => ({
    papel: m.role,
    conteudo: m.content,
    metadados_json: m.sources && m.sources.length ? { sources: m.sources } : null,
  }));
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

      const body = {
        question,
        history: historyForApi,
        id_empresa: empresaId,
      };

      const result = await authApiFetchWithToken("/ia/chat", {
        method: "POST",
        body: JSON.stringify(body),
        timeoutMs: 90000,
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

      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer,
        sources,
      };
      const finalMsgs = [...msgsComUsuario, assistantMsg];
      setMessages(finalMsgs);
      await syncMensagens(idChat, finalMsgs);
      setSending(false);
    },
    [input, sending, empresaId, messages, conversaId, historyForApi, syncMensagens],
  );

  function onNewChat() {
    if (sending || deleting || loadingConversa) return;
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
    <main className="flex h-[calc(100vh-180px)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-border bg-background">
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center gap-0">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-background">
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
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              Tuma <span className="text-accent">IA</span>
            </h1>
          </div>
        </div>
      </header>

      {!empresaReady ? (
        <p className="px-6 py-3 text-sm text-slate-600">Carregando…</p>
      ) : !empresaId ? (
        <p className="mx-6 my-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Sua conta precisa estar ligada a um negócio para usar o chat.
        </p>
      ) : null}

      {errMsg ? (
        <p className="mx-6 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{errMsg}</p>
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

      <section className="flex-1 p-4">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-background">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
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
                disabled={loadingList || loadingConversa || sending}
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

          <div className="flex-1 overflow-y-auto px-4 py-4">
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
              {sending ? (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  Respondendo…
                </p>
              ) : null}
              <div ref={bottomRef} />
            </div>
          </div>

          <footer className="border-t border-border bg-surface-elevated/70 p-3">
            <form className="flex items-center gap-2" onSubmit={onSubmit}>
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
                disabled={sending || !empresaId}
                className="min-h-[48px] flex-1 resize-none rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-accent/70 disabled:bg-muted"
              />
              <button
                type="submit"
                disabled={sending || !empresaId}
                className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                {sending ? "…" : "Enviar"}
              </button>
            </form>
          </footer>
        </div>
      </section>
    </main>
  );
}
