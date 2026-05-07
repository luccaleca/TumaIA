"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { authApiFetchWithToken } from "../../../lib/auth";

const INITIAL_MESSAGES = [];

export default function PainelChatPage() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const historyForApi = useMemo(
    () => messages.map((m) => ({ role: m.role, content: m.content })),
    [messages]
  );

  async function onSubmit(event) {
    event.preventDefault();
    const question = input.trim();
    if (!question || sending) return;

    setInput("");
    setSending(true);
    const nextMessages = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);

    const result = await authApiFetchWithToken("/ia/chat", {
      method: "POST",
      body: JSON.stringify({
        question,
        history: historyForApi,
      }),
      timeoutMs: 90000,
    });

    if (!result.ok || result.networkError) {
      const msg =
        result.networkError?.message ||
        result.json?.error ||
        "Não foi possível responder agora. Tente novamente.";
      setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      setSending(false);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: String(result.json?.answer || "Sem resposta no momento."),
      },
    ]);
    setSending(false);
  }

  function onNewChat() {
    if (sending) return;
    setMessages(INITIAL_MESSAGES);
    setInput("");
  }

  return (
    <main className="flex h-[calc(100vh-180px)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="border-b border-border bg-white px-6 py-4">
        <div className="flex items-center gap-0">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white">
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
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">
              Tuma <span className="text-accent">IA</span>
            </h1>
            <p className="mt-1 text-base font-medium tracking-wide text-emerald-700">Assistente oficial da sua marca</p>
          </div>
        </div>
      </header>

      <section className="flex-1 p-4">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <button
              type="button"
              onClick={onNewChat}
              className="rounded-xl border border-emerald-400 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
            >
              + Novo chat
            </button>
            <div className="flex min-w-[220px] items-center justify-between rounded-xl border border-border bg-white px-3 py-2 text-sm text-emerald-900">
              <span>Chat atual</span>
              <span>⌄</span>
            </div>
            <button className="rounded-xl border border-border px-3 py-2 text-sm text-emerald-700">✎</button>
            <button className="rounded-xl border border-border px-3 py-2 text-sm text-emerald-700">🗑</button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              {messages.map((message, idx) => {
                if (message.role === "user") {
                  return (
                    <article key={`m-${idx}`} className="flex justify-end">
                      <div className="rounded-2xl bg-accent px-4 py-3 text-base font-medium text-accent-foreground shadow-[0_8px_20px_-10px_rgba(16,185,129,0.7)]">
                        {message.content}
                      </div>
                    </article>
                  );
                }

                return (
                  <article key={`m-${idx}`} className="flex items-start gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-emerald-300 bg-gradient-to-b from-white to-emerald-50 shadow-[0_10px_18px_-10px_rgba(16,185,129,0.55)] ring-2 ring-emerald-100">
                      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.95),transparent_45%)]" />
                      <Image
                        src="/imagens/TUMA_CROPPED.png"
                        alt="Avatar do Tuma"
                        fill
                        className="object-contain p-[1px] drop-shadow-[0_5px_7px_rgba(20,83,45,0.22)]"
                        sizes="48px"
                      />
                    </div>
                    <div className="max-w-[85%] rounded-2xl border border-border bg-white px-4 py-3 text-emerald-900 shadow-sm md:max-w-[70%]">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Assistente Tuma</p>
                      <p className="mt-1 text-base leading-relaxed">{message.content}</p>
                    </div>
                  </article>
                );
              })}
              {sending ? <p className="text-sm text-emerald-700">Tuma IA está pensando...</p> : null}
            </div>
          </div>

          <footer className="border-t border-border bg-surface-elevated/70 p-4">
            <form className="flex items-center gap-3" onSubmit={onSubmit}>
              <button
                type="button"
                className="h-10 w-10 rounded-full border border-emerald-300 bg-white text-xl font-semibold text-emerald-700"
              >
                +
              </button>
              <textarea
                rows={2}
                placeholder="Escreva aqui..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                disabled={sending}
                className="min-h-[52px] flex-1 resize-none rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-base text-emerald-900 outline-none transition-colors placeholder:text-emerald-500 focus:border-accent/70"
              />
              <button
                type="submit"
                disabled={sending}
                className="rounded-2xl bg-emerald-200 px-6 py-2.5 text-base font-semibold text-white transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sending ? "Enviando..." : "Enviar"}
              </button>
            </form>
          </footer>
        </div>
      </section>
    </main>
  );
}
