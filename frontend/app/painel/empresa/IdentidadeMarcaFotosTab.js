"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import {
  IDENTIDADE_ANALISE_TIMEOUT_MS,
  MAX_FOTOS_IDENTIDADE,
  calcCompletudeLocal,
  fetchPastaUploadRaiz,
  mergeIdentidadeSugestao,
  temConteudoIdentidade,
  uploadImagemMidia,
} from "../../../lib/identidadeMarcaUi";
import IdentidadeMarcaComoFunciona from "./IdentidadeMarcaComoFunciona";
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
 *   id_midia?: string,
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
 *   midias: Array<Record<string, unknown>>,
 *   onReloadMidias: () => Promise<void>,
 *   onMsg: (text: string, kind: 'ok' | 'err') => void,
 *   temConteudoInicial?: boolean,
 * }} props
 */
export default function IdentidadeMarcaFotosTab({
  empresaId,
  canEdit,
  dados,
  setDados,
  onFieldChange,
  lockedFields,
  completude,
  setCompletude,
  midias,
  onReloadMidias,
  onMsg,
  temConteudoInicial = false,
}) {
  const fileRef = useRef(null);
  const pendingFilesRef = useRef(/** @type {Map<string, File>} */ (new Map()));
  const [fila, setFila] = useState(/** @type {FotoFilaItem[]} */ ([]));
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchLabel, setBatchLabel] = useState(/** @type {string | null} */ (null));
  const [showAcervo, setShowAcervo] = useState(false);
  const [zoneHover, setZoneHover] = useState(false);
  const [pastaRaiz, setPastaRaiz] = useState(/** @type {string | null} */ (null));
  const [temResultado, setTemResultado] = useState(temConteudoInicial);

  useEffect(() => {
    if (temConteudoIdentidade(dados)) setTemResultado(true);
  }, [dados]);

  useEffect(() => {
    if (!empresaId) return;
    void fetchPastaUploadRaiz(empresaId).then(setPastaRaiz);
  }, [empresaId]);

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

  const addAcervo = useCallback(
    (midia) => {
      const id = String(midia.id_midia || "");
      if (!id) return;
      if (fila.length >= MAX_FOTOS_IDENTIDADE) {
        onMsg(`Máximo de ${MAX_FOTOS_IDENTIDADE} fotos por vez.`, "err");
        return;
      }
      if (fila.some((f) => f.id_midia === id)) return;
      setFila((prev) => [
        ...prev,
        {
          clientId: newClientId(),
          id_midia: id,
          nome: String(midia.nome_exibicao || midia.nome_arquivo || "Imagem"),
          previewUrl: typeof midia.url_arquivo === "string" ? midia.url_arquivo : null,
          status: "pending",
        },
      ]);
    },
    [fila, onMsg],
  );

  const addFiles = useCallback(
    (files) => {
      const list = Array.from(files || []).filter(isImageFile);
      if (!list.length) {
        onMsg("Envie apenas imagens (JPEG, PNG, WebP…).", "err");
        return;
      }
      setFila((prev) => {
        const room = MAX_FOTOS_IDENTIDADE - prev.length;
        const slice = list.slice(0, Math.max(0, room));
        if (slice.length < list.length) {
          onMsg(`Só ${MAX_FOTOS_IDENTIDADE} fotos por vez — algumas foram ignoradas.`, "err");
        }
        const added = slice.map((file) => {
          const clientId = newClientId();
          pendingFilesRef.current.set(clientId, file);
          return {
            clientId,
            nome: file.name,
            previewUrl: URL.createObjectURL(file),
            status: /** @type {FotoStatus} */ ("pending"),
            revokeOnUnmount: true,
          };
        });
        return [...prev, ...added];
      });
    },
    [onMsg],
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

  async function analyzeOneMidia(idMidia, clientId) {
    updateFilaItem(clientId, { status: "analyzing", error: undefined });
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/identidade/analisar`, {
      method: "POST",
      body: JSON.stringify({ id_midia: idMidia }),
      timeoutMs: IDENTIDADE_ANALISE_TIMEOUT_MS,
      timeoutLabel: "identidade",
    });
    if (!result.ok || result.networkError) {
      const err =
        result.networkError?.message ||
        formatAuthError(result.json) ||
        (result.status ? `Erro ${result.status}` : "A análise não concluiu.");
      updateFilaItem(clientId, { status: "error", error: err });
      return { error: err };
    }
    if (!result.json?.sugestao) {
      const err = "O Tuma não retornou sugestões para esta foto.";
      updateFilaItem(clientId, { status: "error", error: err });
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
    onMsg("O Tuma está analisando suas fotos — isso pode levar alguns minutos.", "ok");

    let merged = { ...dados };
    let okCount = 0;
    let firstError = null;

    for (let i = 0; i < toRun.length; i++) {
      const item = toRun[i];
      setBatchLabel(`Tuma analisando foto ${i + 1} de ${toRun.length}…`);

      let idMidia = item.id_midia;
      try {
        if (!idMidia) {
          const file = pendingFilesRef.current.get(item.clientId);
          if (!file) {
            updateFilaItem(item.clientId, { status: "error", error: "Arquivo ausente." });
            continue;
          }
          updateFilaItem(item.clientId, { status: "uploading", error: undefined });
          const created = await uploadImagemMidia(empresaId, file, pastaRaiz);
          idMidia = String(created.id_midia);
          updateFilaItem(item.clientId, {
            id_midia: idMidia,
            previewUrl: created.url_arquivo || item.previewUrl,
            status: "pending",
          });
        }

        const out = await analyzeOneMidia(idMidia, item.clientId);
        if (out?.error) {
          if (!firstError) firstError = out.error;
          continue;
        }

        const payload = out?.data;
        merged = mergeIdentidadeSugestao(merged, payload.sugestao, lockedFields);
        if (idMidia) merged.id_midia_referencia_analise = idMidia;
        const comp = calcCompletudeLocal(merged);
        setDados(() => merged);
        setCompletude(payload.completude || comp);
        updateFilaItem(item.clientId, { status: "done", error: undefined });
        okCount++;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Erro ao processar foto.";
        if (!firstError) firstError = errMsg;
        updateFilaItem(item.clientId, { status: "error", error: errMsg });
      }
    }

    await onReloadMidias();

    const siteUrl = merged.site_url?.trim();
    if (siteUrl && okCount > 0) {
      setBatchLabel("Tuma lendo o site…");
      const siteRes = await authApiFetchWithToken(`/empresas/${empresaId}/identidade/analisar`, {
        method: "POST",
        body: JSON.stringify({ site_url: siteUrl }),
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
          ? "Análise concluída. Revise o resultado abaixo e salve."
          : `${okCount} foto(s) analisada(s). Veja o resultado — envie mais fotos ou ajuste os campos.`,
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

    setBatchLabel(null);
    setBatchRunning(false);
  }

  return (
    <div className="space-y-5">
      <IdentidadeMarcaComoFunciona />

      <IdentidadeMarcaProgressBar
        percentual={pct}
        prontoParaImagem={pronto}
        dados={dados}
        batchLabel={batchLabel}
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
            addFiles(e.dataTransfer?.files);
          }}
        >
          <p className="text-sm font-medium text-foreground">Suas fotos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Arraste ou escolha imagens — até {MAX_FOTOS_IDENTIDADE} por análise
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
            <button
              type="button"
              className={BTN_SECUNDARIO}
              disabled={batchRunning}
              onClick={() => setShowAcervo((v) => !v)}
            >
              {showAcervo ? "Ocultar acervo" : "Escolher do acervo"}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {showAcervo && midias.length > 0 ? (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Toque para incluir na fila de análise</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {midias.slice(0, 24).map((m) => {
              const id = String(m.id_midia);
              const selected = fila.some((f) => f.id_midia === id);
              const thumb = typeof m.url_arquivo === "string" ? m.url_arquivo : null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    disabled={!canEdit || batchRunning || selected}
                    onClick={() => addAcervo(m)}
                    className={`relative aspect-square w-full overflow-hidden rounded-lg border transition ${
                      selected
                        ? "border-accent ring-2 ring-accent/30"
                        : "border-border hover:border-accent/40"
                    } disabled:opacity-50`}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center bg-muted text-xs text-muted-foreground">
                        IMG
                      </span>
                    )}
                    {selected ? (
                      <span className="absolute right-1 top-1 rounded bg-accent px-1 text-[10px] text-accent-foreground">
                        ✓
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
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

      <div>
        <label htmlFor="site_url_fotos" className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Site da empresa (opcional)
        </label>
        <input
          id="site_url_fotos"
          type="url"
          value={dados.site_url}
          disabled={!canEdit || batchRunning}
          onChange={(e) => setDados((s) => ({ ...s, site_url: e.target.value }))}
          placeholder="https://suaempresa.com.br — ajuda a preencher o “sobre” depois das fotos"
          className={INPUT_CLASS}
        />
      </div>

      <IdentidadeMarcaResultado
        dados={dados}
        canEdit={canEdit}
        onFieldChange={onFieldChange}
        visible={temResultado}
      />
    </div>
  );
}
