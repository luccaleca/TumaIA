"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  authApiFetch,
  formatAuthError,
  hasValidSession,
  normalizeEmailClient,
  normalizeSenhaClient,
  saveToken,
} from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("ok");
  const [loading, setLoading] = useState(false);
  const emailFromQuery = params.get("email") || "";
  const cadastroOk = params.get("cadastro") === "ok";
  const displayMsg = msg || (cadastroOk ? "Cadastro concluído. Entre com sua senha." : "");
  const displayKind = msg ? msgKind : "ok";

  useEffect(() => {
    let active = true;
    hasValidSession().then((isLogged) => {
      if (active && isLogged) router.replace("/painel");
    });
    return () => {
      active = false;
    };
  }, [router]);

  async function onSubmit(event) {
    event.preventDefault();
    const normalizedEmail = normalizeEmailClient(email);
    const normalizedSenha = normalizeSenhaClient(senha);
    setEmail(normalizedEmail);
    setLoading(true);
    setMsg("Entrando...");
    setMsgKind("ok");
    try {
      const result = await authApiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, senha: normalizedSenha }),
      });
      if (!result.ok || result.networkError) {
        const detail =
          result.networkError?.message ||
          formatAuthError(result.json) ||
          "Não foi possível entrar. Verifique e-mail e senha.";
        setMsg(detail);
        setMsgKind("err");
        saveToken(null);
        return;
      }
      const token = result.json?.access_token;
      if (!token) {
        setMsg("Resposta inválida do servidor.");
        setMsgKind("err");
        saveToken(null);
        return;
      }
      saveToken(token);
      router.push("/painel");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
      setMsgKind("err");
      saveToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-border bg-surface p-6 shadow-[0_0_40px_-12px_rgba(45,155,98,0.2)]">
        <h1 className="text-2xl font-semibold text-emerald-950">
          Entrar no <span className="text-emerald-900">Tuma</span>
          <span className="text-accent">IA</span>
        </h1>
        <p className="mt-1 text-sm text-emerald-700">Use sua conta para acessar a plataforma.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-emerald-800" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email || emailFromQuery}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-emerald-900 outline-none ring-accent/0 transition-[border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/25"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-emerald-800" htmlFor="senha">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-emerald-900 outline-none ring-accent/0 transition-[border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/25"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {displayMsg ? (
          <p
            className={`mt-4 rounded-lg px-3 py-2 text-sm ${
              displayKind === "err"
                ? "border border-red-500/30 bg-red-950/40 text-red-300"
                : "border border-accent/30 bg-accent-muted text-accent"
            }`}
          >
            {displayMsg}
          </p>
        ) : null}

        <p className="mt-5 text-sm text-emerald-700">
          Ainda não tem conta?{" "}
          <Link className="font-medium text-accent underline-offset-2 hover:underline" href="/cadastro">
            Criar cadastro
          </Link>
        </p>
      </section>
    </main>
  );
}
