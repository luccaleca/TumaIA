"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { authApiFetchWithToken } from "../../../../lib/auth";

const SUGESTOES_INICIAIS = [
  "Quantas empresas temos cadastradas e qual o status delas?",
  "Quais são as empresas ativas no sistema?",
  "Top 5 empresas com maior volume de mensagens",
  "Últimos 10 usuários cadastrados na plataforma",
  "Volume de mídias cadastradas por tipo de arquivo",
  "Membros ativos vinculados por empresa",
  "Status das assinaturas e planos ativos",
];

function IconCopy() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5 text-emerald-400">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}

export default function TumaCoreChatSqlPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [sugestoes, setSugestoes] = useState(SUGESTOES_INICIAIS);
  const chatBottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let active = true;
    authApiFetchWithToken("/plataforma/chat-sql/sugestoes").then((r) => {
      if (!active) return;
      if (r.ok && Array.isArray(r.json?.sugestoes) && r.json.sugestoes.length > 0) {
        setSugestoes(r.json.sugestoes);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const copySql = useCallback(async (sql, id) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sql);
      } else {
        const ta = document.createElement("textarea");
        ta.value = sql;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  const handleSend = useCallback(
    async (textToSend) => {
      const queryText = String(textToSend || input || "").trim();
      if (!queryText || loading) return;

      setInput("");
      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `asst-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: queryText },
      ]);
      setLoading(true);

      try {
        const r = await authApiFetchWithToken("/plataforma/chat-sql", {
          method: "POST",
          body: JSON.stringify({ message: queryText }),
        });

        if (!r.ok) {
          const errText = r.json?.error || `Falha na requisição (${r.status || "rede"}).`;
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMsgId,
              role: "assistant",
              error: errText,
              content: "Não foi possível executar a consulta SQL no momento.",
            },
          ]);
          setLoading(false);
          return;
        }

        const data = r.json || {};
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: "assistant",
            content: data.answer || "Consulta executada com sucesso.",
            sql: data.sql,
            columns: data.columns || [],
            rows: data.rows || [],
            rowCount: data.rowCount ?? (data.rows ? data.rows.length : 0),
            executionMs: data.executionMs || 0,
            notice: data.notice,
            suggestions: data.suggestions || [],
          },
        ]);

        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSugestoes(data.suggestions);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: "assistant",
            error: err instanceof Error ? err.message : String(err),
            content: "Erro interno ao processar a consulta.",
          },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [input, loading],
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setSugestoes(SUGESTOES_INICIAIS);
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Top Header do Chat SQL */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Chat SQL
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pergunte em português ou envie um SELECT.
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
            title="Limpar mensagens da conversa"
          >
            <IconTrash />
            <span>Limpar chat</span>
          </button>
        )}
      </div>

      {/* Sugestões Rápidas (Pills) */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1 text-xs">
        <span className="font-medium text-muted-foreground">Sugestões:</span>
        {sugestoes.map((sug, idx) => (
          <button
            key={idx}
            type="button"
            disabled={loading}
            onClick={() => handleSend(sug)}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground/85 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Área da Conversa */}
      <div className="flex min-h-[460px] flex-col rounded-2xl border border-border bg-surface/60 p-4 shadow-sm md:p-6">
        {messages.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center py-8 text-center">
            <Image
              src="/imagens/tumacore-mascote.png"
              alt=""
              width={40}
              height={40}
              className="mb-3 h-10 w-10 object-contain opacity-80"
              aria-hidden
            />
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Consulte os dados da plataforma
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Pergunte sobre clientes, mensagens, mídias ou envie um SELECT.
            </p>

            <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGESTOES_INICIAIS.slice(0, 4).map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(item)}
                  className="rounded-xl border border-border/80 bg-background/80 p-3 text-left text-xs font-medium text-foreground transition hover:border-emerald-500/50 hover:bg-emerald-500/10"
                >
                  <p className="font-semibold text-emerald-400">Consulta {i + 1}</p>
                  <p className="mt-0.5 line-clamp-2 text-muted-foreground">{item}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Lista de Mensagens */
          <div className="space-y-6">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface p-1">
                    <Image
                      src="/imagens/tumacore-mascote.png"
                      alt=""
                      width={24}
                      height={24}
                      className="h-auto w-full object-contain"
                      aria-hidden
                    />
                  </div>
                )}

                <div
                  className={`max-w-[92%] rounded-2xl p-4 text-sm md:max-w-[85%] ${
                    m.role === "user"
                      ? "rounded-tr-none bg-emerald-600 text-white shadow"
                      : "rounded-tl-none border border-border bg-background shadow-sm"
                  }`}
                >
                  {/* Conteúdo textual da mensagem */}
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>

                  {/* Se houver erro */}
                  {m.error && (
                    <div className="mt-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                      {m.error}
                    </div>
                  )}

                  {/* Bloco de Código SQL gerado */}
                  {m.sql && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-emerald-500/25 bg-slate-950 text-slate-100">
                      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 py-1.5 text-[11px]">
                        <span className="font-mono font-bold uppercase tracking-wider text-emerald-400">
                          SQL Executado
                        </span>
                        <button
                          type="button"
                          onClick={() => copySql(m.sql, m.id)}
                          className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
                          title="Copiar SQL para a área de transferência"
                        >
                          {copiedId === m.id ? (
                            <>
                              <IconCheck />
                              <span className="text-emerald-400">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <IconCopy />
                              <span>Copiar SQL</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-emerald-300/95">
                        <code>{m.sql}</code>
                      </pre>
                    </div>
                  )}

                  {/* Aviso de Modo Demonstração se offline */}
                  {m.notice && (
                    <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                      ℹ {m.notice}
                    </div>
                  )}

                  {/* Tabela de Resultados retornados */}
                  {Array.isArray(m.rows) && m.rows.length > 0 && (
                    <div className="mt-3.5 space-y-2">
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-border bg-muted/60 text-[11px] font-semibold uppercase text-muted-foreground">
                            <tr>
                              {m.columns.map((col, i) => (
                                <th key={i} className="whitespace-nowrap px-3 py-2">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 bg-surface">
                            {m.rows.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                className="transition-colors hover:bg-muted/40"
                              >
                                {m.columns.map((col, cIdx) => {
                                  const val = row[col];
                                  const formatted =
                                    val === true
                                      ? "Sim"
                                      : val === false
                                        ? "Não"
                                        : val === null || val === undefined
                                          ? "—"
                                          : String(val);
                                  return (
                                    <td
                                      key={cIdx}
                                      className="max-w-[240px] truncate px-3 py-2 text-foreground/90 font-mono text-[11px]"
                                      title={String(val ?? "")}
                                    >
                                      {formatted}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer estatístico da consulta */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                        <span>
                          <strong>{m.rowCount}</strong>{" "}
                          {m.rowCount === 1 ? "resultado encontrado" : "resultados encontrados"}
                        </span>
                        <span>{m.executionMs}ms</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Indicador de carregamento */}
            {loading && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface p-1">
                  <Image
                    src="/imagens/tumacore-mascote.png"
                    alt=""
                    width={24}
                    height={24}
                    className="h-auto w-full object-contain"
                    aria-hidden
                  />
                </div>
                <div className="rounded-2xl rounded-tl-none border border-border bg-background p-3.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-accent" />
                    <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:0.2s]" />
                    <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:0.4s]" />
                    <span className="font-medium text-foreground">Consultando…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
        )}
      </div>

      {/* Caixa de Entrada de Mensagem */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="relative flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Faça uma pergunta sobre os dados da plataforma ou digite um SELECT..."
          rows={1}
          disabled={loading}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600"
          title="Enviar consulta (Enter)"
        >
          <IconSend />
        </button>
      </form>
    </div>
  );
}
