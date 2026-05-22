"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import {
  IDENTIDADE_ANALISE_TIMEOUT_MS,
  MAX_FOTOS_IDENTIDADE,
  calcCompletudeLocal,
  mergeIdentidadeSugestao,
  temConteudoIdentidade,
  toBase64WithoutPrefix,
} from "../../../lib/identidadeMarcaUi";
import IdentidadeMarcaAnaliseProgress from "./IdentidadeMarcaAnaliseProgress";
import IdentidadeMarcaProgressBar from "./IdentidadeMarcaProgressBar";
import IdentidadeMarcaResultado from "./IdentidadeMarcaResultado";

const INPUT_CLASS =
  "w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus:border-accent/55 focus:ring-2 focus:ring-accent/15 dark:focus:ring-accent/25 disabled:opacity-60";

const BTN_SECUNDARIO =
  "rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-60";

const BTN_PRIMARIO =
  "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition disabled:opacity-60 enabled:hover:scale-[1.02] enabled:active:scale-[0.98]";

/**
 * @typedef {'pending' | 'uploading' | 'analyzing' | 'done' | 'error'} FotoStatus
 * @typedef {{
 *   clientId: string,
 *   nome: string,
 *   previewUrl?: string | null,
 *   status: FotoStatus,
 *   error?: string,
 *   revokeOnUnmount?: boolean,
 * }} FotoFilaItem
 */

function newClientId() {
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function statusLabel(status, error) {
  if (status === "uploading") return "Enviando…";
  if (status === "analyzing") return "Tuma analisando…";
  if (status === "done") return "Analisada";
  if (status === "error") return error || "Falhou";
  return "Aguardando análise";
}

function isImageFile(file) {
  return String(file.type || "").startsWith("image/");
}

/**
 * @param {{
 *   empresaId: string,
 *   canEdit: boolean,
 *   dados: Record<string, string>,
 *   setDados: (fn: (prev: Record<string, string>) => Record<string, string>) => void,
 *   onFieldChange: (key: string, value: string) => void,
 *   lockedFields: Set<string>,
 *   completude: { percentual?: number, pronto_para_imagem?: boolean } | null,
 *   setCompletude: (c: ReturnType<typeof calcCompletudeLocal>) => void,
 *   onMsg: (text: string, kind: 'ok' | 'err') => void,
 *   temConteudoInicial?: boolean,
 *   siteEmpresa?: string,
 * }} props
 */
export default function IdentidadeMarcaFotosTab({
  empresaId,
  canEdit,
  siteEmpresa = "",
  dados,
  setDados,
  onFieldChange,
  lockedFields,
  completude,
  setCompletude,
  onMsg,
  temConteudoInicial = false,
}) {
  const fileRef = useRef(null);
  const pendingFilesRef = useRef(/** @type {Map<string, File>} */ (new Map()));
  const [fila, setFila] = useState(/** @type {FotoFilaItem[]} */ ([]));
  const [batchRunning, setBatchRunning] = useState(false);
  const [analiseProgress, setAnaliseProgress] = useState(
    /** @type {{ fotoTotal: number, fotoConcluidas: number, fotoAtual: number, fase: 'foto' | 'upload' | 'site', incluiSite: boolean } | null} */ (
      null,
    ),
  );
  const [analiseFinishing, setAnaliseFinishing] = useState(false);
  const [zoneHover, setZoneHover] = useState(false);
  const [temResultado, setTemResultado] = useState(temConteudoInicial);

  useEffect(() => {
    if (temConteudoIdentidade(dados)) setTemResultado(true);
  }, [dados]);

  useEffect(() => {
    return () => {
      for (const item of fila) {
        if (item.revokeOnUnmount && item.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
  }, [fila]);

  const pct = completude?.percentual ?? calcCompletudeLocal(dados).percentual;
  const pronto = completude?.pronto_para_imagem ?? calcCompletudeLocal(dados).pronto_para_imagem;

  const pendingCount = fila.filter((f) => f.status === "pending" || f.status === "error").length;
  const canInterpret = canEdit && pendingCount > 0 && !batchRunning;

  const updateFilaItem = useCallback((clientId, patch) => {
    setFila((prev) => prev.map((f) => (f.clientId === clientId ? { ...f, ...patch } : f)));
  }, []);

  const addFiles = useCallback(
    (files) => {
      const list = Array.from(files || []).filter(isImageFile);
      if (!list.length) {
        onMsg("Envie apenas imagens (JPEG, PNG, WebP…).", "err");
        return;
      }
      const room = Math.max(0, MAX_FOTOS_IDENTIDADE - fila.length);
      const slice = list.slice(0, room);
      if (slice.length < list.length) {
        onMsg(`Máximo de ${MAX_FOTOS_IDENTIDADE} fotos por análise — algumas foram ignoradas.`, "err");
      }
      if (!slice.length) return;

      for (const file of slice) {
        const clientId = newClientId();
        pendingFilesRef.current.set(clientId, file);
        setFila((prev) => [
          ...prev,
          {
            clientId,
            nome: file.name,
            previewUrl: URL.createObjectURL(file),
            status: "pending",
            revokeOnUnmount: true,
          },
        ]);
      }
    },
    [fila.length, onMsg],
  );

  function removeFromFila(clientId) {
    pendingFilesRef.current.delete(clientId);
    setFila((prev) => {
      const item = prev.find((f) => f.clientId === clientId);
      if (item?.revokeOnUnmount && item.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((f) => f.clientId !== clientId);
    });
  }

  async function analyzeOneItem(item) {
    updateFilaItem(item.clientId, { status: "analyzing", error: undefined });

    const file = pendingFilesRef.current.get(item.clientId);
    if (!file) {
      updateFilaItem(item.clientId, { status: "error", error: "Arquivo ausente." });
      return { error: "Arquivo ausente." };
    }
    /** @type {Record<string, string>} */
    const body = {
      image_base64: await toBase64WithoutPrefix(file),
      mime_type: file.type || "image/jpeg",
      nome_arquivo: file.name,
    };

    const result = await authApiFetchWithToken(`/empresas/${empresaId}/identidade/analisar`, {
      method: "POST",
      body: JSON.stringify(body),
      timeoutMs: IDENTIDADE_ANALISE_TIMEOUT_MS,
      timeoutLabel: "identidade",
    });
    if (!result.ok || result.networkError) {
      const err =
        result.networkError?.message ||
        formatAuthError(result.json) ||
        (result.status ? `Erro ${result.status}` : "A análise não concluiu.");
      updateFilaItem(item.clientId, { status: "error", error: err });
      return { error: err };
    }
    if (!result.json?.sugestao) {
      const err = "O Tuma não retornou sugestões para esta foto.";
      updateFilaItem(item.clientId, { status: "error", error: err });
      return { error: err };
    }
    return { data: result.json };
  }

  async function onInterpretFotos() {
    if (!empresaId || !canEdit || batchRunning) return;
    const toRun = fila.filter((f) => f.status === "pending" || f.status === "error");
    if (!toRun.length) {
      onMsg("Adicione fotos na fila e toque em Analisar fotos.", "err");
      return;
    }

    setBatchRunning(true);
    setAnaliseFinishing(false);
    onMsg("O Tuma está analisando suas fotos — isso pode levar alguns minutos.", "ok");

    let merged = { ...dados };
    const siteUrl = String(siteEmpresa || "").trim();
    const incluiSite = Boolean(siteUrl);
    let okCount = 0;
    let firstError = null;

    setAnaliseProgress({
      fotoTotal: toRun.length,
      fotoConcluidas: 0,
      fotoAtual: 1,
      fase: "foto",
      incluiSite,
    });

    for (let i = 0; i < toRun.length; i++) {
      const item = toRun[i];
      const fotoNum = i + 1;

      setAnaliseProgress({
        fotoTotal: toRun.length,
        fotoConcluidas: i,
        fotoAtual: fotoNum,
        fase: "foto",
        incluiSite,
      });

      try {
        const out = await analyzeOneItem(item);
        if (out?.error) {
          if (!firstError) firstError = out.error;
          continue;
        }

        const payload = out?.data;
        merged = mergeIdentidadeSugestao(merged, payload.sugestao, lockedFields);
        const comp = calcCompletudeLocal(merged);
        setDados(() => merged);
        setCompletude(payload.completude || comp);
        updateFilaItem(item.clientId, { status: "done", error: undefined });
        okCount++;
        setAnaliseProgress({
          fotoTotal: toRun.length,
          fotoConcluidas: fotoNum,
          fotoAtual: fotoNum,
          fase: "foto",
          incluiSite,
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Erro ao processar foto.";
        if (!firstError) firstError = errMsg;
        updateFilaItem(item.clientId, { status: "error", error: errMsg });
      }
    }

    if (siteUrl && okCount > 0) {
      setAnaliseProgress({
        fotoTotal: toRun.length,
        fotoConcluidas: toRun.length,
        fotoAtual: toRun.length,
        fase: "site",
        incluiSite: true,
      });
      const siteRes = await authApiFetchWithToken(`/empresas/${empresaId}/identidade/analisar`, {
        method: "POST",
        body: JSON.stringify({}),
        timeoutMs: IDENTIDADE_ANALISE_TIMEOUT_MS,
        timeoutLabel: "identidade",
      });
      if (siteRes.ok && siteRes.json?.sugestao) {
        merged = mergeIdentidadeSugestao(merged, siteRes.json.sugestao, lockedFields);
        setDados(() => merged);
        setCompletude(siteRes.json.completude || calcCompletudeLocal(merged));
      }
    }

    const finalComp = calcCompletudeLocal(merged);
    if (okCount > 0) {
      setTemResultado(true);
      onMsg(
        finalComp.pronto_para_imagem
          ? "Análise concluída — revise abaixo e salve a identidade."
          : `${okCount} foto(s) analisada(s). Revise os campos abaixo ou envie mais fotos.`,
        "ok",
      );
    } else {
      onMsg(
        firstError
          ? `Nenhuma foto concluiu: ${firstError}`
          : "Nenhuma foto foi analisada com sucesso. Veja o motivo em cada item da fila.",
        "err",
      );
    }

    if (okCount > 0) {
      setAnaliseFinishing(true);
      await new Promise((r) => setTimeout(r, 700));
    }
    setAnaliseProgress(null);
    setAnaliseFinishing(false);
    setBatchRunning(false);

    if (okCount > 0) {
      setFila([]);
      pendingFilesRef.current.clear();
    }
  }

  return (
    <div className="space-y-5">
      <IdentidadeMarcaAnaliseProgress
        ativo={batchRunning || analiseFinishing}
        progress={analiseProgress}
        finishing={analiseFinishing}
      />

      {!batchRunning ? (
        <IdentidadeMarcaProgressBar
          percentual={pct}
          prontoParaImagem={pronto}
          dados={dados}
          batchLabel={null}
        />
      ) : null}

      {temResultado && !batchRunning ? (
        <IdentidadeMarcaResultado
          dados={dados}
          canEdit={canEdit}
          onFieldChange={onFieldChange}
          visible
        />
      ) : null}

      {canEdit ? (
        <div
          className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            zoneHover ? "border-accent/50 bg-accent-muted/40" : "border-border bg-surface-elevated/40"
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            setZoneHover(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setZoneHover(false)}
          onDrop={(e) => {
            e.preventDefault();
            setZoneHover(false);
            void addFiles(e.dataTransfer?.files);
          }}
        >
          <p className="text-sm font-medium text-foreground">Suas fotos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Só para extrair cores e estilo — não fica salvo. Use Mídias se quiser guardar arquivos.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className={BTN_PRIMARIO}
              disabled={batchRunning}
              onClick={() => fileRef.current?.click()}
            >
              Escolher arquivos
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {fila.length > 0 ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Fila para análise ({fila.length})</p>
            {canEdit ? (
              <button
                type="button"
                className={BTN_PRIMARIO}
                disabled={!canInterpret}
                onClick={() => void onInterpretFotos()}
              >
                {batchRunning ? "Analisando…" : `Analisar ${pendingCount || fila.length} foto(s)`}
              </button>
            ) : null}
          </div>
          <ul className="space-y-2">
            {fila.map((item) => (
              <li
                key={item.clientId}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated/50 px-3 py-2"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                      ?
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{item.nome}</p>
                  <p
                    className={`text-xs ${
                      item.status === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                    }`}
                  >
                    {statusLabel(item.status, item.error)}
                  </p>
                </div>
                {canEdit && !batchRunning ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => removeFromFila(item.clientId)}
                    aria-label="Remover da fila"
                  >
                    Remover
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
