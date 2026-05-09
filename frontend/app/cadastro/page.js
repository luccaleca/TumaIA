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

    const body = {
      nome: nome.trim(),
      email: normalizeEmailClient(email),
      senha: senhaNorm,
      telefone: telefone.trim() ? telefone.trim() : null,
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
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-border bg-surface p-6 shadow-[0_12px_36px_-20px_rgba(15,23,42,0.3)]">
        <h1 className="text-2xl font-semibold text-foreground">
          Criar conta no <span className="text-foreground">Tuma</span>
          <span className="text-accent">IA</span>
        </h1>
        <p className="mt-1 text-sm text-slate-600">Cadastro rápido para começar a usar.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="nome">
              Nome
            </label>
            <input
              id="nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground outline-none ring-accent/0 transition-[border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/25"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground outline-none ring-accent/0 transition-[border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/25"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="telefone">
              Telefone (opcional)
            </label>
            <input
              id="telefone"
              type="text"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground outline-none ring-accent/0 transition-[border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/25"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="senha">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground outline-none ring-accent/0 transition-[border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/25"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="senhaConfirm">
              Confirmar senha
            </label>
            <input
              id="senhaConfirm"
              type="password"
              value={senhaConfirm}
              onChange={(e) => setSenhaConfirm(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground outline-none ring-accent/0 transition-[border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/25"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Cadastrar"}
          </button>
        </form>

        {msg ? (
          <p
            className={`mt-4 rounded-lg px-3 py-2 text-sm ${
              msgKind === "err"
                ? "border border-red-500/30 bg-red-950/40 text-red-300"
                : "border border-accent/30 bg-accent-muted text-[#009638]"
            }`}
          >
            {msg}
          </p>
        ) : null}

        <p className="mt-5 text-sm text-slate-600">
          Já tem conta?{" "}
          <Link className="font-medium text-accent underline-offset-2 hover:underline" href="/login">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
