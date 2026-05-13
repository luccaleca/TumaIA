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
    clearTelefone: false,
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
        clearTelefone: false,
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
      clearTelefone: form.clearTelefone,
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
          clearTelefone: false,
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
      <main className="rounded-xl border border-border bg-background p-6">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" aria-hidden />
        <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded-md bg-muted/80" aria-hidden />
        <div className="mt-8 space-y-4">
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted/70" aria-hidden />
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted/70" aria-hidden />
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted/70" aria-hidden />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Carregando seus dados…</p>
      </main>
    );
  }

  const initials = contaIniciais(form.nome, form.email);

  return (
    <main className="rounded-xl border border-border bg-background p-6 transition-colors">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sua conta</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Nome, e-mail e telefone usados no painel e nas comunicações. Alterar o e-mail também
            atualiza o login no sistema de autenticação.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent"
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-foreground">{form.nome.trim() || "—"}</p>
            <p className="truncate text-muted-foreground">{form.email || "—"}</p>
            {dataContaLabel ? (
              <p className="mt-0.5 text-xs text-muted-foreground">Conta desde {dataContaLabel}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <section className="rounded-lg border border-border bg-surface/40 px-4 py-5 dark:bg-surface/20">
          <h2 className="text-sm font-medium text-foreground">Dados pessoais</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Os mesmos dados aparecem no cabeçalho do painel após salvar.
          </p>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="contaNome">
                Nome completo
              </label>
              <input
                id="contaNome"
                type="text"
                autoComplete="name"
                value={form.nome}
                onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground outline-none ring-accent/0 transition-[border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/25"
                maxLength={150}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="contaEmail">
                E-mail
              </label>
              <input
                id="contaEmail"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground outline-none ring-accent/0 transition-[border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/25"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="contaTelefone">
                Telefone <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <input
                id="contaTelefone"
                type="tel"
                autoComplete="tel"
                value={form.clearTelefone ? "" : form.telefone}
                disabled={form.clearTelefone}
                onChange={(e) =>
                  setForm((s) => ({ ...s, telefone: e.target.value.slice(0, 20), clearTelefone: false }))
                }
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground outline-none ring-accent/0 transition-[border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Ex.: (11) 99999-9999"
                maxLength={20}
              />
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="rounded border-border text-accent focus:ring-accent/40"
                  checked={form.clearTelefone}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      clearTelefone: e.target.checked,
                      telefone: e.target.checked ? "" : s.telefone,
                    }))
                  }
                />
                Remover telefone do perfil
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition duration-200 ease-out will-change-transform disabled:opacity-60 enabled:hover:scale-[1.03] enabled:hover:shadow-md enabled:hover:shadow-accent/25 enabled:active:scale-[0.98]"
              >
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>
              <Link
                href="/painel/configuracao"
                className="text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Preferências do painel
              </Link>
            </div>
          </form>

          {msg ? (
            <p
              className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
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

        <section className="rounded-lg border border-border bg-background px-4 py-4">
          <h2 className="text-sm font-medium text-foreground">Senha e segurança</h2>
          <p className="mt-1 text-sm text-muted-foreground">
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
