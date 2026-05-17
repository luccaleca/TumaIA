"use client";

import { useCallback, useEffect, useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import {
  calcCompletudeLocal,
  dadosFromApi,
  emptyDados,
  temConteudoIdentidade,
} from "../../../lib/identidadeMarcaUi";
import IdentidadeMarcaFotosTab from "./IdentidadeMarcaFotosTab";
import IdentidadeMarcaManualTab from "./IdentidadeMarcaManualTab";

const BTN_SECUNDARIO =
  "rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-60";

const TAB_CLASS =
  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60";

/**
 * @param {{ empresaId: string, canEdit: boolean }} props
 */
export default function IdentidadeMarcaSection({ empresaId, canEdit }) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState(/** @type {'fotos' | 'manual'} */ ("fotos"));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState(/** @type {'ok' | 'err'} */ ("ok"));
  const [dados, setDados] = useState(emptyDados);
  const [completude, setCompletude] = useState(null);
  const [midias, setMidias] = useState([]);
  const [lockedFields, setLockedFields] = useState(() => new Set());

  const onMsg = useCallback((text, kind) => {
    setMsg(text);
    setMsgKind(kind);
  }, []);

  const loadIdentidade = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/identidade`);
    setLoading(false);
    if (!result.ok || result.networkError) {
      onMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao carregar identidade.", "err");
      return;
    }
    const id = result.json?.identidade;
    setDados(dadosFromApi(id?.dados));
    setCompletude(id?.completude || null);
  }, [empresaId, onMsg]);

  const loadMidias = useCallback(async () => {
    if (!empresaId) return;
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/midias`);
    if (!result.ok || result.networkError) return;
    const list = Array.isArray(result.json?.midias) ? result.json.midias : [];
    setMidias(list.filter((m) => String(m.tipo_midia || "").toLowerCase() === "imagem"));
  }, [empresaId]);

  useEffect(() => {
    void loadIdentidade();
    void loadMidias();
  }, [loadIdentidade, loadMidias]);

  function onManualFieldChange(key, value) {
    setLockedFields((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setDados((s) => {
      const next = { ...s, [key]: value };
      setCompletude(calcCompletudeLocal(next));
      return next;
    });
  }

  async function onSave() {
    if (!empresaId || !canEdit) return;
    setSaving(true);
    onMsg("Salvando identidade...", "ok");
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/identidade`, {
      method: "PUT",
      body: JSON.stringify(dados),
    });
    setSaving(false);
    if (!result.ok || result.networkError) {
      onMsg(result.networkError?.message || formatAuthError(result.json) || "Não foi possível salvar.", "err");
      return;
    }
    const id = result.json?.identidade;
    setDados(dadosFromApi(id?.dados));
    setCompletude(id?.completude || null);
    onMsg("Identidade da marca salva.", "ok");
  }

  if (!empresaId) return null;

  const pct = completude?.percentual ?? calcCompletudeLocal(dados).percentual;
  const pronto = completude?.pronto_para_imagem;

  return (
    <section className="mt-6 rounded-xl border border-border bg-background" id="identidade-marca">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Identidade da marca</h2>
          {completude || pct > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {pct}%{pronto ? " · pronto para artes" : ""}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className={BTN_SECUNDARIO}>
          {open ? "Recolher" : "Configurar"}
        </button>
      </div>

      {open ? (
        <>
          <div className="space-y-5 p-4 sm:p-5">
            {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}

            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Modo de configuração da identidade"
            >
              <button
                type="button"
                role="tab"
                aria-selected={modo === "fotos"}
                disabled={!canEdit && modo !== "fotos"}
                className={`${TAB_CLASS} ${
                  modo === "fotos"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setModo("fotos")}
              >
                Com fotos
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={modo === "manual"}
                className={`${TAB_CLASS} ${
                  modo === "manual"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setModo("manual")}
              >
                Preencher manualmente
              </button>
            </div>

            {modo === "fotos" ? (
              <IdentidadeMarcaFotosTab
                empresaId={empresaId}
                canEdit={canEdit}
                dados={dados}
                setDados={setDados}
                onFieldChange={onManualFieldChange}
                lockedFields={lockedFields}
                completude={completude}
                setCompletude={setCompletude}
                midias={midias}
                onReloadMidias={loadMidias}
                onMsg={onMsg}
                temConteudoInicial={temConteudoIdentidade(dados)}
              />
            ) : (
              <IdentidadeMarcaManualTab dados={dados} canEdit={canEdit} onFieldChange={onManualFieldChange} />
            )}

            {msg ? (
              <p
                className={`rounded-lg border px-3 py-2 text-sm ${
                  msgKind === "err"
                    ? "border-red-300 bg-red-50 text-red-900 dark:border-red-500/35 dark:bg-red-950/40 dark:text-red-100"
                    : "border-accent/30 bg-accent-muted text-foreground"
                }`}
              >
                {msg}
              </p>
            ) : null}
          </div>

          {canEdit ? (
            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3 sm:px-5">
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSave()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition duration-200 disabled:opacity-60 enabled:hover:scale-[1.02] enabled:active:scale-[0.98]"
              >
                {saving ? "Salvando…" : "Salvar identidade"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}


