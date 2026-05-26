"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_FOTOS_IDENTIDADE,
  calcCompletudeLocal,
  fetchIdentidadeAnaliseJob,
  limparFotosAnaliseIdentidade,
  startIdentidadeAnaliseJob,
  temConteudoIdentidade,
  uploadImagemIdentidade,
} from "../../../lib/identidadeMarcaUi";
import IdentidadeMarcaAnaliseProgress from "./IdentidadeMarcaAnaliseProgress";
import IdentidadeMarcaProgressBar from "./IdentidadeMarcaProgressBar";
import IdentidadeMarcaResultado from "./IdentidadeMarcaResultado";

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
 *   removable?: boolean,
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

function mapJobItemToFila(item, idx) {
  return {
    clientId: String(item?.id_midia ?? `job-${idx}`),
    nome: String(item?.nome ?? `Imagem ${idx + 1}`).trim() || `Imagem ${idx + 1}`,
    previewUrl: String(item?.preview_url ?? "").trim() || null,
    status:
      item?.status === "uploading" ||
      item?.status === "analyzing" ||
      item?.status === "done" ||
      item?.status === "error"
        ? item.status
        : "pending",
    error: String(item?.error ?? "").trim() || undefined,
    revokeOnUnmount: false,
    removable: false,
  };
}

/**
 * @param {{
 *   empresaId: string,
 *   canEdit: boolean,
 *   dados: Record<string, string>,
 *   setDados: (fn: (prev: Record<string, string>) => Record<string, string>) => void,
 *   onFieldChange: (key: string, value: string) => void,
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
  completude,
  setCompletude,
  onMsg,
  temConteudoInicial = false,
}) {
  const fileRef = useRef(null);
  const filaRef = useRef(/** @type {FotoFilaItem[]} */ ([]));
  const pendingFilesRef = useRef(/** @type {Map<string, File>} */ (new Map()));
  const pollingRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const notifiedJobRef = useRef("");
  const [fila, setFila] = useState(/** @type {FotoFilaItem[]} */ ([]));
  const [batchRunning, setBatchRunning] = useState(false);
  const [analiseProgress, setAnaliseProgress] = useState(
    /** @type {{ fotoTotal: number, fotoConcluidas: number, fotoAtual: number, fase: 'foto' | 'upload' | 'site', incluiSite: boolean } | null} */ (
      null
    ),
  );
  const [analiseFinishing, setAnaliseFinishing] = useState(false);
  const [zoneHover, setZoneHover] = useState(false);
  const [temResultado, setTemResultado] = useState(temConteudoInicial);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const applyJobSnapshot = useCallback(
    async (job, notifyTerminal = false) => {
      if (!job || typeof job !== "object") {
        setBatchRunning(false);
        setAnaliseProgress(null);
        stopPolling();
        return;
      }

      const running = job.status === "queued" || job.status === "running";
      const progress = job.progress && typeof job.progress === "object" ? job.progress : null;
      const items = Array.isArray(progress?.items) ? progress.items.map(mapJobItemToFila) : [];

      if (items.length) {
        setFila((prev) => {
          const hasLocalPending = prev.some((item) => item.removable);
          return running || !hasLocalPending ? items : prev;
        });
      }

      setBatchRunning(running);
      setAnaliseProgress(
        running && progress
          ? {
              fotoTotal: Number(progress.fotoTotal) || items.length,
              fotoConcluidas: Number(progress.fotoConcluidas) || 0,
              fotoAtual: Number(progress.fotoAtual) || 0,
              fase: progress.fase === "site" ? "site" : progress.fase === "upload" ? "upload" : "foto",
              incluiSite: progress.incluiSite === true,
            }
          : null,
      );

      if (!running && job.dados_resultado) {
        setDados(() => job.dados_resultado);
        setCompletude(job.completude || calcCompletudeLocal(job.dados_resultado));
        setTemResultado(true);
      }

      if (running) {
        setAnaliseFinishing(false);
        stopPolling();
        pollingRef.current = setTimeout(() => {
          void refreshJob(true);
        }, 2500);
      } else {
        stopPolling();
        if (notifyTerminal) {
          const terminalKey = `${job.id_job || "none"}:${job.status || "none"}`;
          if (notifiedJobRef.current !== terminalKey) {
            notifiedJobRef.current = terminalKey;
            if (job.status === "completed" && job.completude) {
              setAnaliseFinishing(true);
              setTimeout(() => setAnaliseFinishing(false), 700);
              onMsg(
                job.completude.pronto_para_imagem
                  ? "Análise concluída — revise abaixo e salve a identidade."
                  : "Análise concluída. Revise os campos abaixo ou envie mais fotos.",
                "ok",
              );
            } else if (job.status === "failed") {
              onMsg(job.error || "Nenhuma foto foi analisada com sucesso.", "err");
            }
          }
        }
      }
    },
    [onMsg, setCompletude, setDados, stopPolling],
  );

  const refreshJob = useCallback(
    async (quiet = false) => {
      if (!empresaId) return null;
      try {
        const job = await fetchIdentidadeAnaliseJob(empresaId);
        await applyJobSnapshot(job, !quiet);
        return job;
      } catch (err) {
        if (!quiet) {
          onMsg(err instanceof Error ? err.message : "Falha ao consultar análise em andamento.", "err");
        }
        return null;
      }
    },
    [applyJobSnapshot, empresaId, onMsg],
  );

  useEffect(() => {
    if (temConteudoIdentidade(dados)) setTemResultado(true);
  }, [dados]);

  useEffect(() => {
    filaRef.current = fila;
  }, [fila]);

  useEffect(() => {
    return () => {
      stopPolling();
      for (const item of filaRef.current) {
        if (item.revokeOnUnmount && item.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
  }, [stopPolling]);

  useEffect(() => {
    void refreshJob(true);
  }, [refreshJob]);

  const pct = completude?.percentual ?? calcCompletudeLocal(dados).percentual;
  const pronto = completude?.pronto_para_imagem ?? calcCompletudeLocal(dados).pronto_para_imagem;

  const pendingCount = fila.filter((f) => f.removable && (f.status === "pending" || f.status === "error")).length;
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
      const localCount = fila.filter((item) => item.removable).length;
      const room = Math.max(0, MAX_FOTOS_IDENTIDADE - localCount);
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
            removable: true,
          },
        ]);
      }
    },
    [fila, onMsg],
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

  async function onInterpretFotos() {
    if (!empresaId || !canEdit || batchRunning) return;

    const existing = await refreshJob(true);
    if (existing && (existing.status === "queued" || existing.status === "running")) {
      onMsg("Já existe uma análise em andamento. Vou retomar o acompanhamento dela.", "ok");
      return;
    }

    const toRun = fila.filter((f) => f.removable && (f.status === "pending" || f.status === "error"));
    if (!toRun.length) {
      onMsg("Adicione fotos na fila e toque em Analisar fotos.", "err");
      return;
    }

    setBatchRunning(true);
    setAnaliseFinishing(false);
    onMsg("Enviando fotos e iniciando a análise em background…", "ok");

    try {
      await limparFotosAnaliseIdentidade(empresaId).catch(() => {});

      const uploadedIds = [];
      for (const item of toRun) {
        updateFilaItem(item.clientId, { status: "uploading", error: undefined });
        const file = pendingFilesRef.current.get(item.clientId);
        if (!file) {
          updateFilaItem(item.clientId, { status: "error", error: "Arquivo ausente." });
          continue;
        }
        try {
          const midia = await uploadImagemIdentidade(empresaId, file, "foto");
          uploadedIds.push(String(midia.id_midia));
          updateFilaItem(item.clientId, {
            status: "analyzing",
            error: undefined,
            previewUrl: midia.url_arquivo || item.previewUrl || null,
            revokeOnUnmount: true,
          });
        } catch (err) {
          updateFilaItem(item.clientId, {
            status: "error",
            error: err instanceof Error ? err.message : "Falha ao enviar foto.",
          });
        }
      }

      if (!uploadedIds.length) {
        setBatchRunning(false);
        onMsg("Nenhuma foto pôde ser enviada para análise.", "err");
        return;
      }

      const siteUrl = String(siteEmpresa || "").trim();
      const job = await startIdentidadeAnaliseJob(empresaId, {
        midia_ids: uploadedIds,
        inclui_site: Boolean(siteUrl),
        site_url: siteUrl || undefined,
        dados_base: dados,
      });

      for (const item of toRun) {
        pendingFilesRef.current.delete(item.clientId);
      }
      setFila((prev) =>
        prev.filter((item) => !toRun.some((candidate) => candidate.clientId === item.clientId && item.removable)),
      );
      await applyJobSnapshot(job, false);
      onMsg("O Tuma segue analisando em background. Você pode sair da página e voltar depois.", "ok");
    } catch (err) {
      setBatchRunning(false);
      const existingJob = err && typeof err === "object" ? err.job : null;
      if (existingJob) {
        await applyJobSnapshot(existingJob, false);
        onMsg("Já existe uma análise em andamento. Vou acompanhar essa mesma análise.", "ok");
        return;
      }
      onMsg(err instanceof Error ? err.message : "Não foi possível iniciar a análise em background.", "err");
    }
  }

  return (
    <div className="space-y-5">
      <IdentidadeMarcaAnaliseProgress
        ativo={batchRunning || analiseFinishing}
        progress={analiseProgress}
        finishing={analiseFinishing}
      />

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
            As fotos sobem para o servidor e o Tuma continua a análise mesmo se você sair da página.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            A logo para aparecer nas artes é enviada separadamente acima, fora desta análise.
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
                {batchRunning ? "Análise em andamento…" : `Analisar ${pendingCount || fila.length} foto(s)`}
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
                {canEdit && !batchRunning && item.removable ? (
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

      {(batchRunning || temResultado) ? (
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
    </div>
  );
}
