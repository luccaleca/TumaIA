"use client";

import { useCallback, useRef, useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import EmpresaLogoAvatar from "./EmpresaLogoAvatar";

function toBase64WithoutPrefix(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const full = String(reader.result || "");
      const idx = full.indexOf(",");
      resolve(idx >= 0 ? full.slice(idx + 1) : full);
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function mimeFromFile(file) {
  const t = String(file.type || "").toLowerCase();
  if (t === "image/jpeg" || t === "image/png" || t === "image/webp") return t;
  return null;
}

export default function EmpresaFotoPerfil({
  empresaId,
  fotoUrl,
  nomeFantasia,
  canEdit,
  onUpdated,
  onMsg,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const notify = useCallback(
    (text, kind) => {
      if (onMsg) onMsg(text, kind);
    },
    [onMsg],
  );

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !empresaId || !canEdit || busy) return;

    const mime = mimeFromFile(file);
    if (!mime) {
      notify("Use uma imagem JPEG, PNG ou WebP.", "err");
      return;
    }

    setBusy(true);
    try {
      const b64 = await toBase64WithoutPrefix(file);
      const result = await authApiFetchWithToken(`/empresas/${empresaId}/foto-perfil`, {
        method: "POST",
        body: JSON.stringify({ base64_data: b64, mime_type: mime }),
      });
      if (!result.ok || result.networkError) {
        notify(
          result.networkError?.message || formatAuthError(result.json) || "Falha ao enviar a foto.",
          "err",
        );
        return;
      }
      notify("Ícone atualizado.", "ok");
      onUpdated?.();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao enviar.", "err");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!empresaId || !canEdit || busy) return;
    if (typeof window !== "undefined" && !window.confirm("Remover o ícone desta empresa?")) return;

    setBusy(true);
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/foto-perfil`, {
      method: "DELETE",
    });
    setBusy(false);

    if (!result.ok || result.networkError) {
      notify(
        result.networkError?.message || formatAuthError(result.json) || "Falha ao remover a foto.",
        "err",
      );
      return;
    }
    notify("Ícone removido.", "ok");
    onUpdated?.();
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-2 sm:items-start">
      <div className="group relative">
        <EmpresaLogoAvatar fotoUrl={fotoUrl} nome={nomeFantasia} size="lg" />

        {canEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center rounded-2xl bg-foreground/0 opacity-0 transition-all duration-200 group-hover:bg-foreground/45 group-hover:opacity-100 focus-visible:bg-foreground/45 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-label={fotoUrl ? "Alterar ícone da empresa" : "Enviar ícone da empresa"}
          >
            <span className="rounded-full bg-background/95 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm">
              {busy ? "Enviando…" : fotoUrl ? "Alterar" : "Adicionar"}
            </span>
          </button>
        ) : null}
      </div>

      {canEdit ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(ev) => void onPickFile(ev)}
          />
          {fotoUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRemove()}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              Remover
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
