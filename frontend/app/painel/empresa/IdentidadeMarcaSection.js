"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import {
  calcCompletudeLocal,
  dadosFromApi,
  emptyDados,
  fetchMidiasIdentidade,
  limparFotosAnaliseIdentidade,
  temConteudoIdentidade,
} from "../../../lib/identidadeMarcaUi";
import IdentidadeMarcaFotosTab from "./IdentidadeMarcaFotosTab";
import IdentidadeMarcaManualTab from "./IdentidadeMarcaManualTab";
import IdentidadeMarcaProgressBar from "./IdentidadeMarcaProgressBar";
import IdentidadeMarcaLogoField from "./IdentidadeMarcaLogoField";

const BTN_SECUNDARIO =
  "rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-60";

const TAB_CLASS =
  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60";

/**
 * @param {{ empresaId: string, canEdit: boolean, siteEmpresa?: string }} props
 */
export default function IdentidadeMarcaSection({ empresaId, canEdit, siteEmpresa = "" }) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState(/** @type {'fotos' | 'manual'} */ ("fotos"));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState(/** @type {'ok' | 'err'} */ ("ok"));
  const [dados, setDados] = useState(emptyDados);
  const [completude, setCompletude] = useState(null);
  const [midiasIdentidade, setMidiasIdentidade] = useState([]);
  const [lockedFields, setLockedFields] = useState(() => new Set());
  const limparFotosRef = useRef(/** @type {string | null} */ (null));

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

  const loadMidiasIdentidade = useCallback(async () => {
    if (!empresaId) return;
    setMidiasIdentidade(await fetchMidiasIdentidade(empresaId));
  }, [empresaId]);

  useEffect(() => {
    void loadIdentidade();
    void loadMidiasIdentidade();
    if (empresaId && limparFotosRef.current !== empresaId) {
      limparFotosRef.current = empresaId;
      void limparFotosAnaliseIdentidade(empresaId).then(() => loadMidiasIdentidade());
    }
  }, [loadIdentidade, loadMidiasIdentidade, empresaId]);

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

  function onLogoChange(idMidia) {
    setLockedFields((prev) => {
      const next = new Set(prev);
      next.add("id_midia_logo");
      return next;
    });
    setDados((s) => {
      const next = { ...s, id_midia_logo: idMidia };
      setCompletude(calcCompletudeLocal(next));
      return next;
    });
  }

  async function onRemoveLogo() {
    if (!empresaId || !canEdit || saving) return;
    const idMidia = String(dados.id_midia_logo ?? "").trim();
    if (!idMidia) return;

    setSaving(true);
    onMsg("Removendo logo…", "ok");

    const del = await authApiFetchWithToken(`/empresas/${empresaId}/midias/${idMidia}`, {
      method: "DELETE",
    });
    if (!del.ok && !del.networkError && del.status !== 404) {
      setSaving(false);
      onMsg(del.networkError?.message || formatAuthError(del.json) || "Não foi possível remover o arquivo da logo.", "err");
      return;
    }

    const nextDados = { ...dados, id_midia_logo: null };
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/identidade`, {
      method: "PUT",
      body: JSON.stringify(nextDados),
    });
    setSaving(false);

    if (!result.ok || result.networkError) {
      onMsg(result.networkError?.message || formatAuthError(result.json) || "Não foi possível atualizar a identidade.", "err");
      return;
    }

    const id = result.json?.identidade;
    setDados(dadosFromApi(id?.dados));
    setCompletude(id?.completude || null);
    setLockedFields((prev) => {
      const next = new Set(prev);
      next.add("id_midia_logo");
      return next;
    });
    void loadMidiasIdentidade();
    onMsg("Logo removida da identidade.", "ok");
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
    setOpen(false);
    onMsg("Identidade da marca salva.", "ok");
  }

  if (!empresaId) return null;

  const compLocal = calcCompletudeLocal(dados);
  const pct = completude?.percentual ?? compLocal.percentual;
  const pronto = completude?.pronto_para_imagem ?? compLocal.pronto_para_imagem;
  const temConteudo = temConteudoIdentidade(dados) || pct > 0;

  const progressSummary = pronto
    ? "Identidade pronta — o Tuma pode gerar artes alinhadas à sua marca."
    : pct >= 75
      ? "Quase lá — falta pouco para a identidade ficar completa."
      : pct > 0
        ? "O Tuma já entende parte da sua marca; complete ou analise mais fotos se quiser."
        : "Configure fotos ou preencha manualmente para o Tuma entender sua marca.";

  return (
    <section className="mt-6 rounded-xl border border-border bg-background" id="identidade-marca">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Identidade da marca</h2>
          {!open && temConteudo ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {pct}% completo{pronto ? " · pronto para artes" : ""}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className={BTN_SECUNDARIO}>
          {open ? "Recolher" : "Configurar"}
        </button>
      </div>

      {!open && !loading ? (
        <div className="space-y-3 border-b border-border px-4 py-4 sm:px-5">
          <IdentidadeMarcaProgressBar
            percentual={pct}
            prontoParaImagem={pronto}
            dados={dados}
            batchLabel={progressSummary}
            compact
          />
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
      ) : null}

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
                Tuma analisa (fotos)
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

            <IdentidadeMarcaLogoField
              empresaId={empresaId}
              canEdit={canEdit}
              idMidiaLogo={dados.id_midia_logo}
              midias={midiasIdentidade}
              busy={saving}
              onChange={onLogoChange}
              onRemove={onRemoveLogo}
              onReloadMidias={loadMidiasIdentidade}
              onMsg={onMsg}
            />

            {modo === "fotos" ? (
              <IdentidadeMarcaFotosTab
                empresaId={empresaId}
                canEdit={canEdit}
                siteEmpresa={siteEmpresa}
                dados={dados}
                setDados={setDados}
                onFieldChange={onManualFieldChange}
                lockedFields={lockedFields}
                completude={completude}
                setCompletude={setCompletude}
                onFieldChange={onManualFieldChange}
                onMsg={onMsg}
                temConteudoInicial={temConteudoIdentidade(dados)}
              />
            ) : (
              <>
                <IdentidadeMarcaProgressBar
                  percentual={pct}
                  prontoParaImagem={pronto}
                  dados={dados}
                  batchLabel={progressSummary}
                />
                <IdentidadeMarcaManualTab dados={dados} canEdit={canEdit} onFieldChange={onManualFieldChange} />
              </>
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


