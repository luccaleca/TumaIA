"use client";

import { useEffect, useState } from "react";
import {
  authApiFetchWithToken,
  fetchMe,
  formatAuthError,
  normalizeEmailClient,
} from "../../../lib/auth";

export default function ContaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("ok");
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
      if (ok && usuario) {
        setForm({
          nome: usuario.nome || "",
          email: usuario.email || "",
          telefone: usuario.telefone || "",
          clearTelefone: false,
        });
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    const nome = form.nome.trim();
    const email = normalizeEmailClient(form.email);
    const telefone = form.telefone.trim();
    if (!nome || !email) {
      setMsg("Nome e e-mail são obrigatórios.");
      setMsgKind("err");
      return;
    }
    setSaving(true);
    setMsg("Salvando...");
    setMsgKind("ok");
    const body = { nome, email };
    body.telefone = form.clearTelefone ? null : telefone || null;
    try {
      const result = await authApiFetchWithToken("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!result.ok || result.networkError) {
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
      }
      setMsg("Dados salvos com sucesso.");
      setMsgKind("ok");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="rounded-xl border border-border bg-background p-6 text-muted-foreground">Carregando conta...</main>
    );
  }

  return (
    <main className="rounded-xl border border-border bg-background p-6">
      <h1 className="text-xl font-semibold text-foreground">Seus dados</h1>
      <p className="mt-1 text-sm text-muted-foreground">Atualize seu perfil de acesso.</p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="contaNome">
            Nome
          </label>
          <input
            id="contaNome"
            type="text"
            value={form.nome}
            onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="contaEmail">
            E-mail
          </label>
          <input
            id="contaEmail"
            type="email"
            value={form.email}
            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="contaTelefone">
            Telefone
          </label>
          <input
            id="contaTelefone"
            type="text"
            value={form.telefone}
            onChange={(e) => setForm((s) => ({ ...s, telefone: e.target.value, clearTelefone: false }))}
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-accent"
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.clearTelefone}
              onChange={(e) => setForm((s) => ({ ...s, clearTelefone: e.target.checked }))}
            />
            Remover telefone
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>

      {msg ? (
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            msgKind === "err"
              ? "border-red-500/30 bg-red-950/30 text-red-200"
              : "border-accent/30 bg-accent-muted text-foreground"
          }`}
        >
          {msg}
        </p>
      ) : null}
    </main>
  );
}
