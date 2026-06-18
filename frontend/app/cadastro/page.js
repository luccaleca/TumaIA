"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  authApiFetch,
  formatAuthError,
  hasValidSession,
  normalizeEmailClient,
  normalizeSenhaClient,
} from "../../lib/auth";
import AuthLayout, { AuthField, AuthMessage, AuthSubmitButton } from "../components/AuthLayout";

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("ok");
  const [loading, setLoading] = useState(false);

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
    const senhaNorm = normalizeSenhaClient(senha);
    const senhaConfirmNorm = normalizeSenhaClient(senhaConfirm);
    if (senhaNorm.length < 8) {
      setMsg("A senha deve ter no mínimo 8 caracteres.");
      setMsgKind("err");
      return;
    }
    if (senhaNorm !== senhaConfirmNorm) {
      setMsg("Senha e confirmação não conferem.");
      setMsgKind("err");
      return;
    }

    const telDigits = telefone.replace(/\D/g, "");
    if (telDigits.length < 10) {
      setMsg("Informe seu telefone com DDD (mínimo 10 dígitos). É o mesmo número usado no WhatsApp.");
      setMsgKind("err");
      return;
    }

    const body = {
      nome: nome.trim(),
      email: normalizeEmailClient(email),
      senha: senhaNorm,
      telefone: telefone.trim(),
    };

    if (!body.nome || !body.email) {
      setMsg("Preencha nome e e-mail.");
      setMsgKind("err");
      return;
    }

    setLoading(true);
    setMsg("Enviando cadastro...");
    setMsgKind("ok");
    try {
      const result = await authApiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!result.ok || result.networkError) {
        const detail =
          result.networkError?.message ||
          formatAuthError(result.json) ||
          "Não foi possível concluir o cadastro.";
        setMsg(detail);
        setMsgKind("err");
        return;
      }
      const emailCad = result.json?.email || body.email;
      router.push(`/login?cadastro=ok&email=${encodeURIComponent(emailCad)}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
      setMsgKind("err");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      variant="cadastro"
      title="Criar conta"
      subtitle="Preencha seus dados para começar a usar o TumaIA."
      switchHref="/login"
      switchLabel="Entrar"
      switchAriaLabel="Ir para login"
    >
      <form className="auth-form-compact flex flex-col gap-2" onSubmit={onSubmit}>
        <AuthField
          id="nome"
          label="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
        <AuthField
          id="email"
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <AuthField
          id="telefone"
          label="Telefone (WhatsApp)"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          required
        />
        <AuthField
          id="senha"
          label="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <AuthField
          id="senhaConfirm"
          label="Confirmar senha"
          type="password"
          value={senhaConfirm}
          onChange={(e) => setSenhaConfirm(e.target.value)}
          required
        />

        <div className="pt-1">
          <AuthSubmitButton loading={loading} loadingLabel="Enviando...">
            Cadastrar
          </AuthSubmitButton>
        </div>
      </form>

      <AuthMessage kind={msgKind}>{msg}</AuthMessage>

      <p className="auth-mobile-switch mt-5 text-center text-sm text-slate-600 md:hidden">
        Já tem conta?{" "}
        <Link className="auth-link-accent" href="/login">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
