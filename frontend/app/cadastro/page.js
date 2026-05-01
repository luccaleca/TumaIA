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
      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Criar conta no TumaIA</h1>
        <p className="mt-1 text-sm text-zinc-600">Cadastro rápido para começar a usar.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800" htmlFor="nome">
              Nome
            </label>
            <input
              id="nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-800"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-800"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800" htmlFor="telefone">
              Telefone (opcional)
            </label>
            <input
              id="telefone"
              type="text"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800" htmlFor="senha">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-800"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800" htmlFor="senhaConfirm">
              Confirmar senha
            </label>
            <input
              id="senhaConfirm"
              type="password"
              value={senhaConfirm}
              onChange={(e) => setSenhaConfirm(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-800"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Cadastrar"}
          </button>
        </form>

        {msg ? (
          <p
            className={`mt-4 rounded-lg px-3 py-2 text-sm ${
              msgKind === "err" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
            }`}
          >
            {msg}
          </p>
        ) : null}

        <p className="mt-5 text-sm text-zinc-600">
          Já tem conta?{" "}
          <Link className="font-medium text-zinc-900 underline" href="/login">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
