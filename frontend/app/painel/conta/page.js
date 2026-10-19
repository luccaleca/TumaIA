"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  authApiFetchWithToken,
  clearToken,
  fetchMe,
  formatAuthError,
} from "../../../lib/auth";
import {
  contaIniciais,
  formatarDataContaPtBr,
  montarBodyPatchConta,
} from "../../../lib/contaProfile";

export default function ContaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("ok");
  const [usuarioMeta, setUsuarioMeta] = useState({ data_criacao: null });
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
  });

  useEffect(() => {
    let active = true;
    fetchMe().then(({ ok, usuario }) => {
      if (!active) return;
      if (!ok || !usuario) {
        clearToken();
        router.replace("/login");
        return;
      }
      setForm({
        nome: usuario.nome || "",
        email: usuario.email || "",
        telefone: usuario.telefone || "",
      });
      setUsuarioMeta({
        data_criacao: usuario.data_criacao ?? null,
      });
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const dataContaLabel = useMemo(
    () => formatarDataContaPtBr(usuarioMeta.data_criacao),
    [usuarioMeta.data_criacao],
  );

  async function onSubmit(event) {
    event.preventDefault();
    const prep = montarBodyPatchConta({
      nome: form.nome,
      email: form.email,
      telefone: form.telefone,
    });
    if (!prep.ok) {
      setMsg(prep.message);
      setMsgKind("err");
      return;
    }
    const { body } = prep;
    setSaving(true);
    setMsg("Salvando...");
    setMsgKind("ok");
    try {
      const result = await authApiFetchWithToken("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!result.ok || result.networkError) {
        if (result.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        setMsg(
          result.networkError?.message ||
            formatAuthError(result.json) ||
            "Não foi possível salvar seus dados.",
        );
        setMsgKind("err");
        return;
      }
      const usuario = result.json?.usuario;
      if (usuario) {
        setForm({
          nome: usuario.nome || "",
          email: usuario.email || "",
          telefone: usuario.telefone || "",
        });
        setUsuarioMeta((prev) => ({
          data_criacao: usuario.data_criacao ?? prev.data_criacao,
        }));
      }
      setMsg("Dados salvos com sucesso.");
      setMsgKind("ok");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="space-y-6" aria-busy="true">
        <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" aria-hidden />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded-md bg-muted/80" aria-hidden />
        </div>
        <div className="space-y-4 rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <div className="h-12 w-full animate-pulse rounded-xl bg-muted/70" aria-hidden />
          <div className="h-12 w-full animate-pulse rounded-xl bg-muted/70" aria-hidden />
          <div className="h-12 w-full animate-pulse rounded-xl bg-muted/70" aria-hidden />
          <p className="pt-2 text-sm text-muted-foreground">Carregando seus dados…</p>
        </div>
      </main>
    );
  }

  const initials = contaIniciais(form.nome, form.email);
  const inputClass =
    "min-h-12 w-full rounded-xl border border-border bg-surface-elevated px-4 text-[15px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 hover:border-foreground/25 focus:border-accent focus:ring-4 focus:ring-accent/20";
  const labelClass = "mb-1.5 block text-sm font-medium text-foreground";

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Painel</p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Sua conta
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Nome, e-mail e telefone usados no painel e nas comunicações. Alterar o e-mail também
              atualiza o login no sistema de autenticação.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-border bg-background/60 px-5 py-4 backdrop-blur">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-emerald-700 text-base font-bold text-white shadow-lg shadow-accent/25"
              aria-hidden
            >
              {initials}
            </div>
            <div className="min-w-0 text-sm">
              <p className="truncate text-base font-semibold text-foreground">{form.nome.trim() || "—"}</p>
              <p className="truncate text-muted-foreground">{form.email || "—"}</p>
              {dataContaLabel ? (
                <p className="mt-1 text-xs text-muted-foreground">Conta desde {dataContaLabel}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
            Dados pessoais
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            O telefone deve ser o mesmo do WhatsApp — é assim que o TumaIA reconhece você no bot.
          </p>

          <form className="mt-6 space-y-5" onSubmit={onSubmit}>
            <div>
              <label className={labelClass} htmlFor="contaNome">
                Nome completo
              </label>
              <input
                id="contaNome"
                type="text"
                autoComplete="name"
                value={form.nome}
                onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
                className={inputClass}
                maxLength={150}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="contaEmail">
                  E-mail
                </label>
                <input
                  id="contaEmail"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="contaTelefone">
                  Telefone (WhatsApp)
                </label>
                <input
                  id="contaTelefone"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={form.telefone}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, telefone: e.target.value.slice(0, 20) }))
                  }
                  className={inputClass}
                  placeholder="Ex.: (11) 99999-9999"
                  maxLength={20}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-7 text-[15px] font-bold text-[#06120c] shadow-[0_10px_24px_-12px] shadow-accent/80 transition duration-200 ease-out disabled:opacity-60 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_14px_28px_-12px] enabled:active:scale-[0.98]"
              >
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>
              <Link
                href="/painel/configuracao"
                className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Preferências do painel
              </Link>
            </div>
          </form>

          {msg ? (
            <p
              className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                msgKind === "err"
                  ? "border-red-300 bg-red-50 font-medium text-red-900 dark:border-red-500/35 dark:bg-red-950/40 dark:font-normal dark:text-red-100"
                  : "border-accent/30 bg-accent-muted text-foreground"
              }`}
              role={msgKind === "err" ? "alert" : "status"}
            >
              {msg}
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent"
            aria-hidden
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.75}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
              />
            </svg>
          </div>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
            Senha e segurança
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A senha de acesso não é alterada nesta tela. Use recuperação de senha na página de{" "}
            <Link href="/login" className="font-medium text-accent underline-offset-2 hover:underline">
              entrar
            </Link>{" "}
            quando disponível no seu ambiente, ou peça suporte para redefinir.
          </p>
        </section>
      </div>
    </main>
  );
}
