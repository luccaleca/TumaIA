"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authApiFetchWithToken } from "../../../lib/auth";
import {
  buildMidiasBreadcrumbs,
  isMidiasDesktop,
  midiasPastaIdToUi,
  resolveMidiasPastaAtivaId,
} from "../../../lib/midiasDesktop";
import { slashMenuMatch, SLASH_MENU_MAX_MIDIAS } from "../../../lib/chatSlashMenu";

function midiaLabel(row) {
  const nome = String(row?.nome_exibicao ?? "").trim();
  const arquivo = String(row?.nome_arquivo ?? "").trim();
  if (nome && arquivo && arquivo !== nome) return `${nome} · ${arquivo}`;
  return nome || arquivo || "Mídia";
}

function isImageMidia(row) {
  const tipo = String(row?.tipo_midia ?? "").toLowerCase();
  if (tipo === "imagem" || tipo === "image") return true;
  const fmt = String(row?.formato_arquivo ?? row?.mime_type ?? "").toLowerCase();
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(fmt) || fmt.startsWith("image/");
}

/**
 * @param {{
 *   open: boolean,
 *   query: string,
 *   empresaId: string | null,
 *   selectedMidiaIds: string[],
 *   onPickMidia: (midia: { id: string, label: string }) => void,
 *   onClose: () => void,
 * }} props
 */
export default function ChatSlashMenu({
  open,
  query,
  empresaId,
  selectedMidiaIds,
  onPickMidia,
  onClose,
}) {
  const [highlight, setHighlight] = useState(0);
  const [loadingMidias, setLoadingMidias] = useState(false);
  const [pastas, setPastas] = useState([]);
  const [midias, setMidias] = useState([]);
  const [pastaAtual, setPastaAtual] = useState("");
  const [pastaUploadRaiz, setPastaUploadRaiz] = useState(null);

  const loadMidiasTree = useCallback(async () => {
    if (!empresaId) return;
    setLoadingMidias(true);
    try {
      const [pastasRes, midiasRes] = await Promise.all([
        authApiFetchWithToken(`/empresas/${encodeURIComponent(empresaId)}/pastas`),
        authApiFetchWithToken(`/empresas/${encodeURIComponent(empresaId)}/midias`),
      ]);
      if (pastasRes.ok && !pastasRes.networkError) {
        setPastas(Array.isArray(pastasRes.json?.pastas) ? pastasRes.json.pastas : []);
        setPastaUploadRaiz(pastasRes.json?.id_pasta_upload_raiz || null);
      }
      if (midiasRes.ok && !midiasRes.networkError) {
        setMidias(Array.isArray(midiasRes.json?.midias) ? midiasRes.json.midias : []);
      }
    } finally {
      setLoadingMidias(false);
    }
  }, [empresaId]);

  useEffect(() => {
    if (!open) {
      setHighlight(0);
      return;
    }
    setHighlight(0);
  }, [open, query, pastaAtual]);

  useEffect(() => {
    if (open && empresaId && !pastas.length && !loadingMidias) {
      void loadMidiasTree();
    }
  }, [open, empresaId, pastas.length, loadingMidias, loadMidiasTree]);

  const pastaAtivaId = resolveMidiasPastaAtivaId(pastaAtual, pastaUploadRaiz);
  const isAtDesktop = isMidiasDesktop(pastaAtual, pastaUploadRaiz);

  const pastasFilhas = useMemo(() => {
    if (!pastaAtivaId) return [];
    return pastas.filter((p) => (p.id_pasta_pai || null) === pastaAtivaId);
  }, [pastas, pastaAtivaId]);

  const midiasDaPasta = useMemo(() => {
    if (!pastaAtivaId && !isAtDesktop) return [];
    return midias.filter((m) => {
      if (!isImageMidia(m)) return false;
      if (isAtDesktop) {
        return m.id_pasta === pastaAtivaId || m.id_pasta == null || m.id_pasta === "";
      }
      return m.id_pasta === pastaAtivaId;
    });
  }, [midias, pastaAtivaId, isAtDesktop]);

  const breadcrumbs = useMemo(
    () => buildMidiasBreadcrumbs(pastas, pastaAtual, pastaUploadRaiz),
    [pastas, pastaAtual, pastaUploadRaiz],
  );

  const items = useMemo(() => {
    const nav = [];
    if (!isAtDesktop || breadcrumbs.length) {
      nav.push({
        id: "midia-up",
        type: "folder-up",
        label: breadcrumbs.length ? "← Voltar" : "← Suas mídias",
        hint: "",
      });
    }
    for (const p of pastasFilhas) {
      if (!slashMenuMatch(p.nome, query)) continue;
      nav.push({
        id: `folder-${p.id_pasta}`,
        type: "folder",
        label: p.nome || "Pasta",
        hint: "Abrir pasta",
        pastaId: p.id_pasta,
      });
    }
    for (const m of midiasDaPasta) {
      const label = midiaLabel(m);
      if (!slashMenuMatch(label, query)) continue;
      const id = String(m.id_midia ?? "").trim();
      if (!id || selectedMidiaIds.includes(id)) continue;
      nav.push({
        id: `midia-${id}`,
        type: "midia",
        label,
        hint: "Usar neste post",
        midia: { id, label },
      });
    }
    return nav;
  }, [breadcrumbs.length, isAtDesktop, pastasFilhas, midiasDaPasta, query, selectedMidiaIds]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onClose();
        return;
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setHighlight((h) => (items.length ? (h + 1) % items.length : 0));
        return;
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setHighlight((h) => (items.length ? (h - 1 + items.length) % items.length : 0));
        return;
      }
      if (ev.key === "Enter" && items.length) {
        ev.preventDefault();
        ev.stopPropagation();
        activateItem(items[highlight]);
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, items, highlight, onClose]);

  function activateItem(item) {
    if (!item) return;
    if (item.type === "folder" && item.pastaId) {
      setPastaAtual(midiasPastaIdToUi(item.pastaId, pastaUploadRaiz));
      setHighlight(0);
      return;
    }
    if (item.type === "folder-up") {
      if (breadcrumbs.length) {
        const parent = breadcrumbs[breadcrumbs.length - 2];
        setPastaAtual(parent ? parent.id_pasta : "");
      } else {
        setPastaAtual("");
      }
      setHighlight(0);
      return;
    }
    if (item.type === "midia" && item.midia) {
      onPickMidia(item.midia);
      return;
    }
  }

  if (!open) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-20 mb-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      role="listbox"
      aria-label="Mídia do acervo"
    >
      <div className="flex items-center justify-between border-b border-border bg-surface-elevated/80 px-2.5 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Mídia do acervo
        </span>
      </div>

      {breadcrumbs.length ? (
        <div className="flex flex-wrap gap-1 border-b border-border/60 px-2 py-1 text-[10px] text-muted-foreground">
          <button type="button" className="hover:text-foreground" onClick={() => setPastaAtual("")}>
            Suas mídias
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id_pasta} className="flex items-center gap-1">
              <span>/</span>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => setPastaAtual(crumb.id_pasta)}
              >
                {crumb.nome}
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <ul className="max-h-52 overflow-y-auto py-1">
        {loadingMidias ? (
          <li className="px-3 py-2 text-xs text-muted-foreground">Carregando acervo…</li>
        ) : null}
        {!loadingMidias && !items.length ? (
          <li className="px-3 py-2 text-xs text-muted-foreground">
            {selectedMidiaIds.length >= SLASH_MENU_MAX_MIDIAS
              ? `Limite de ${SLASH_MENU_MAX_MIDIAS} mídias neste post.`
              : "Nenhuma imagem nesta pasta."}
          </li>
        ) : null}
        {items.map((item, idx) => (
          <li key={item.id}>
            <button
              type="button"
              role="option"
              aria-selected={idx === highlight}
              className={[
                "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm",
                idx === highlight ? "bg-accent/10 text-foreground" : "text-foreground hover:bg-muted/80",
              ].join(" ")}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => activateItem(item)}
            >
              <span className="min-w-0 truncate font-medium">{item.label}</span>
              {item.hint ? (
                <span className="shrink-0 text-[11px] text-muted-foreground">{item.hint}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <p className="border-t border-border/60 px-2.5 py-1 text-[10px] text-muted-foreground">
        ↑↓ navegar · Enter escolher · Esc fechar
      </p>
    </div>
  );
}
