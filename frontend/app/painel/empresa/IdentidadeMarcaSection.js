"use client";

import { useCallback, useEffect, useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import {
  calcCompletudeLocal,
  dadosFromApi,
  emptyDados,
  fetchMidiasIdentidade,
  temConteudoIdentidade,
} from "../../../lib/identidadeMarcaUi";
import IdentidadeMarcaFotosTab from "./IdentidadeMarcaFotosTab";
import IdentidadeMarcaManualTab from "./IdentidadeMarcaManualTab";
import IdentidadeMarcaProgressBar from "./IdentidadeMarcaProgressBar";
import IdentidadeMarcaResumo from "./IdentidadeMarcaResumo";
import IdentidadeMarcaLogoField from "./IdentidadeMarcaLogoField";
import EmpresaSectionPanel from "./EmpresaSectionPanel";
import ConfirmModal from "../../components/ConfirmModal";

const BTN_SECUNDARIO =
  "rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-60";

/**
 * @param {{ empresaId: string, canEdit: boolean, siteEmpresa?: string }} props
 */
export default function IdentidadeMarcaSection({ empresaId, canEdit, siteEmpresa = "" }) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState(/** @type {'tuma' | 'manual'} */ ("tuma"));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState(/** @type {'ok' | 'err'} */ ("ok"));
  const [dados, setDados] = useState(emptyDados);
  const [completude, setCompletude] = useState(null);
  const [midiasIdentidade, setMidiasIdentidade] = useState([]);
  const [lockedFields, setLockedFields] = useState(() => new Set());
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

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
    onMsg("Identidade salva.", "ok");
  }

  function requestClearIdentidade() {
    if (!empresaId || !canEdit || saving) return;
    setClearConfirmOpen(true);
  }

  async function confirmClearIdentidade() {
    if (!empresaId || !canEdit || saving) return;
    setClearConfirmOpen(false);
    setSaving(true);
    onMsg("Limpando identidade...", "ok");
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/identidade`, {
      method: "DELETE",
    });
    setSaving(false);
    if (!result.ok || result.networkError) {
      onMsg(
        result.networkError?.message || formatAuthError(result.json) || "Não foi possível limpar a identidade.",
        "err",
      );
      return;
    }

    const id = result.json?.identidade;
    setDados(dadosFromApi(id?.dados));
    setCompletude(id?.completude || calcCompletudeLocal(emptyDados));
    setLockedFields(new Set());
    setOpen(false);
    setModo("tuma");
    void loadMidiasIdentidade();
    onMsg("Identidade da marca limpa.", "ok");
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
    <EmpresaSectionPanel
      step={2}
      id="identidade-marca"
      title="Identidade"
      description="Paleta, logo, estilo e mood — o que o Tuma usa nas artes."
      actions={
        <button type="button" onClick={() => setOpen((v) => !v)} className={BTN_SECUNDARIO}>
          {open ? "Recolher" : temConteudo ? "Editar" : "Configurar"}
        </button>
      }
    >
      {!open ? (
        <>
          <IdentidadeMarcaResumo
            dados={dados}
            midias={midiasIdentidade}
            percentual={pct}
            prontoParaImagem={pronto}
            loading={loading}
          />
          {msg && !loading ? (
            <div className="border-t border-border px-4 pb-4 sm:px-5">
              <p
                className={`rounded-lg border px-3 py-2 text-sm ${
                  msgKind === "err"
                    ? "border-red-300 bg-red-50 text-red-900 dark:border-red-500/35 dark:bg-red-950/40 dark:text-red-100"
                    : "border-accent/30 bg-accent-muted text-foreground"
                }`}
              >
                {msg}
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      {open ? (
        <>
          <div className="space-y-5 p-4 sm:p-5">
            {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}

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

            <section className="rounded-xl border border-border/80 bg-surface-elevated/25 p-4">
              <p className="text-sm font-medium text-foreground">Como deseja montar a identidade?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Primeiro envie a logo. Depois escolha se o Tuma vai analisar fotos para montar a base ou se você quer
                preencher tudo manualmente.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setModo("tuma")}
                  className={`rounded-xl border p-4 text-left transition ${
                    modo === "tuma"
                      ? "border-accent bg-accent-muted/40 ring-1 ring-accent/25"
                      : "border-border bg-background hover:bg-muted/40"
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">Criar com o Tuma</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Envie fotos, o Tuma analisa os padrões da marca e monta a base da identidade para você revisar.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setModo("manual")}
                  className={`rounded-xl border p-4 text-left transition ${
                    modo === "manual"
                      ? "border-accent bg-accent-muted/40 ring-1 ring-accent/25"
                      : "border-border bg-background hover:bg-muted/40"
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">Preencher manualmente</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Abra os campos para escrever a identidade da marca na mão, do seu jeito.
                  </p>
                </button>
              </div>
            </section>

            {modo === "tuma" ? (
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
                onMsg={onMsg}
                temConteudoInicial={temConteudoIdentidade(dados)}
              />
            ) : (
              <div className="space-y-4">
                <IdentidadeMarcaProgressBar
                  percentual={pct}
                  prontoParaImagem={pronto}
                  dados={dados}
                  batchLabel={progressSummary}
                />
                <IdentidadeMarcaManualTab dados={dados} canEdit={canEdit} onFieldChange={onManualFieldChange} />
              </div>
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
                onClick={requestClearIdentidade}
                className="rounded-lg border border-red-400/70 px-4 py-2 text-sm font-medium text-red-800 transition disabled:opacity-60 hover:bg-red-100 dark:border-red-500/45 dark:font-normal dark:text-red-300 dark:hover:bg-red-950/45"
              >
                Limpar identidade
              </button>
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
      <ConfirmModal
        open={clearConfirmOpen}
        onClose={() => !saving && setClearConfirmOpen(false)}
        title="Limpar identidade da marca"
        description="Isso remove os dados preenchidos e a logo salva nesta seção. Não dá para desfazer."
        confirmLabel="Limpar identidade"
        onConfirm={confirmClearIdentidade}
        busy={saving}
        variant="danger"
      />
    </EmpresaSectionPanel>
  );
}


