"use client";

import { useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import Modal from "../../components/Modal";

const LINK_CLASS =
  "text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-60";

export default function EmpresaZonaPerigosa({
  empresaId,
  nomeFantasia,
  isAdministrador,
  onEmpresaRemovida,
  onNotify,
}) {
  const [sairOpen, setSairOpen] = useState(false);
  const [desativarOpen, setDesativarOpen] = useState(false);
  const [confirmNome, setConfirmNome] = useState("");
  const [busy, setBusy] = useState(false);

  if (!empresaId) return null;

  async function onSair() {
    setBusy(true);
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/sair`, { method: "POST" });
    setBusy(false);
    if (!result.ok || result.networkError) {
      onNotify(
        result.networkError?.message || formatAuthError(result.json) || "Não foi possível sair da empresa.",
        "err",
      );
      return;
    }
    setSairOpen(false);
    onNotify("Você saiu da empresa.", "ok");
    onEmpresaRemovida();
  }

  async function onDesativar() {
    const esperado = (nomeFantasia || "").trim();
    if (confirmNome.trim() !== esperado) {
      onNotify(`Digite exatamente: ${esperado}`, "err");
      return;
    }
    setBusy(true);
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/desativar`, {
      method: "POST",
      body: JSON.stringify({ confirmacao_nome: confirmNome.trim() }),
    });
    setBusy(false);
    if (!result.ok || result.networkError) {
      onNotify(
        result.networkError?.message || formatAuthError(result.json) || "Não foi possível desativar a empresa.",
        "err",
      );
      return;
    }
    setDesativarOpen(false);
    setConfirmNome("");
    onNotify("Empresa desativada.", "ok");
    onEmpresaRemovida();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-6">
        <button type="button" onClick={() => setSairOpen(true)} className={LINK_CLASS}>
          Sair desta empresa
        </button>
        {isAdministrador ? (
          <>
            <span aria-hidden className="text-border">
              ·
            </span>
            <button
              type="button"
              onClick={() => {
                setConfirmNome("");
                setDesativarOpen(true);
              }}
              className={LINK_CLASS}
            >
              Desativar empresa
            </button>
          </>
        ) : null}
      </div>

      <Modal open={sairOpen} onClose={() => !busy && setSairOpen(false)} title="Sair da empresa">
        <p className="mt-2 text-sm text-muted-foreground">
          Você perde o acesso a <span className="font-medium text-foreground">{nomeFantasia || "esta empresa"}</span>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSair()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {busy ? "Saindo…" : "Sair"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setSairOpen(false)}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal
        open={desativarOpen}
        onClose={() => !busy && setDesativarOpen(false)}
        title="Desativar empresa"
        maxWidthClass="max-w-lg"
      >
        <p className="mt-2 text-sm text-muted-foreground">
          Todos perdem o acesso. Digite o nome fantasia para confirmar:
        </p>
        <p className="mt-1 font-mono text-sm font-medium text-foreground">{nomeFantasia || "—"}</p>
        <input
          type="text"
          value={confirmNome}
          onChange={(e) => setConfirmNome(e.target.value)}
          disabled={busy}
          placeholder="Nome fantasia"
          className="mt-3 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          autoComplete="off"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !confirmNome.trim()}
            onClick={() => void onDesativar()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {busy ? "Desativando…" : "Desativar"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setDesativarOpen(false)}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </>
  );
}
