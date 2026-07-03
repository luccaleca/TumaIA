"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  authApiFetch,
  formatAuthError,
  hasValidSession,
  normalizeEmailClient,
  normalizeSenhaClient,
  saveToken,
} from "../../lib/auth";
import AuthLayout, { AuthField, AuthMessage, AuthPasswordField, AuthSubmitButton } from "../components/AuthLayout";

function LoginForm() {
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

  useEffect(() => {
    if (!emailFromQuery) return;
    const next = normalizeEmailClient(emailFromQuery);
    if (!next) return;
    setEmail((prev) => (prev.trim() ? prev : next));
  }, [emailFromQuery]);

  async function onSubmit(event) {
    event.preventDefault();
    const normalizedEmail = normalizeEmailClient(email || emailFromQuery);
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
        saveToken(null, null);
        return;
      }
      const token = result.json?.access_token;
      const refreshToken = result.json?.refresh_token;
      if (!token || !refreshToken) {
        setMsg("Resposta inválida do servidor.");
        setMsgKind("err");
        saveToken(null, null);
        return;
      }
      saveToken(token, refreshToken);
      router.push("/painel");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
      setMsgKind("err");
      saveToken(null, null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      variant="login"
      title="Entrar no TumaIA"
      subtitle="Use seu e-mail e senha para acessar o painel."
      switchHref="/cadastro"
      switchLabel="Criar conta"
      switchAriaLabel="Ir para cadastro"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <AuthField
          id="email"
          label="E-mail"
          type="email"
          value={email || emailFromQuery}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <AuthPasswordField
          id="senha"
          label="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />

        <div className="flex items-center justify-end pt-1">
          <button type="button" className="auth-link-accent text-sm">
            Esqueceu a senha?
          </button>
        </div>

        <AuthSubmitButton loading={loading} loadingLabel="Entrando...">
          Entrar
        </AuthSubmitButton>
      </form>

      <AuthMessage kind={displayKind}>{displayMsg}</AuthMessage>

      <p className="auth-mobile-switch mt-5 text-center text-sm text-slate-600 md:hidden">
        Ainda não tem conta?{" "}
        <Link className="auth-link-accent" href="/cadastro">
          Criar cadastro
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page relative flex min-h-screen items-center justify-center">
          <div className="auth-page-bg absolute inset-0" aria-hidden />
          <p className="relative z-10 text-sm text-white/90">Carregando…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
