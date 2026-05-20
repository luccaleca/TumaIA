"use client";

import { useRef, useState } from "react";
import {
  fetchPastaUploadRaiz,
  uploadImagemMidia,
} from "../../../lib/identidadeMarcaUi";

const BTN =
  "rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-60";

/**
 * @param {{
 *   empresaId: string,
 *   canEdit: boolean,
 *   idMidiaLogo: string | null,
 *   midias: Array<Record<string, unknown>>,
 *   onChange: (idMidia: string | null) => void,
 *   onReloadMidias?: () => void,
 *   onMsg?: (text: string, kind: 'ok' | 'err') => void,
 * }} props
 */
export default function IdentidadeMarcaLogoField({
  empresaId,
  canEdit,
  idMidiaLogo,
  midias,
  onChange,
  onReloadMidias,
  onMsg,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const logoMidia = idMidiaLogo
    ? midias.find((m) => String(m.id_midia) === String(idMidiaLogo))
    : null;
  const previewUrl = logoMidia?.url_arquivo ? String(logoMidia.url_arquivo) : "";

  async function uploadFile(file) {
    if (!empresaId || !canEdit || busy) return;
    const mime = String(file.type || "").toLowerCase();
    if (!mime.startsWith("image/")) {
      onMsg?.("Envie uma imagem. PNG com fundo transparente é o ideal.", "err");
      return;
    }
    setBusy(true);
    try {
      const idPasta = await fetchPastaUploadRaiz(empresaId);
      const midia = await uploadImagemMidia(empresaId, file, idPasta);
      onChange(String(midia.id_midia));
      onReloadMidias?.();
      onMsg?.("Logo enviada. Salve a identidade para confirmar.", "ok");
    } catch (err) {
      onMsg?.(err instanceof Error ? err.message : "Falha ao enviar logo.", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-elevated/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Logo para artes</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            PNG sem fundo é o ideal. Essa logo entra nas postagens da sua marca.
          </p>
        </div>
        {idMidiaLogo ? (
          <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-foreground ring-1 ring-accent/25">
            ✓ Definida
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40"
          style={
            previewUrl
              ? {
                  backgroundImage:
                    "linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)",
                  backgroundSize: "12px 12px",
                  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
                }
              : undefined
          }
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Logo da marca" className="max-h-full max-w-full object-contain p-1" />
          ) : (
            <span className="px-2 text-center text-[11px] text-muted-foreground">Sem logo</span>
          )}
        </div>

        {canEdit ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/webp,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadFile(file);
              }}
            />
            <button type="button" disabled={busy} className={BTN} onClick={() => inputRef.current?.click()}>
              {busy ? "Enviando…" : idMidiaLogo ? "Trocar logo" : "Enviar logo"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
