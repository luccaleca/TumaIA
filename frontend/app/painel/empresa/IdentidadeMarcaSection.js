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
import IdentidadeMarcaCamposImagem from "./IdentidadeMarcaCamposImagem";
import IdentidadeMarcaProgressBar from "./IdentidadeMarcaProgressBar";
import IdentidadeMarcaLogoField from "./IdentidadeMarcaLogoField";
import EmpresaSectionPanel from "./EmpresaSectionPanel";
import ConfirmModal from "../../components/ConfirmModal";

/**
 * @param {{
 *   empresaId: string,
 *   canEdit: boolean,
 *   siteEmpresa?: string,
 *   onEmpresaLogoSynced?: () => void,
 * }} props
 */
export default function IdentidadeMarcaSection({
  empresaId,
  canEdit,
  siteEmpresa = "",
  onEmpresaLogoSynced,
}) {
  const [fotosOpen, setFotosOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState(/** @type {'ok' | 'err'} */ ("ok"));
  const [dados, setDados] = useState(emptyDados);
  const [completude, setCompletude] = useState(null);
  const [midiasIdentidade, setMidiasIdentidade] = useState([]);
  const [lockedFields, setLockedFields] = useState(() => new Set());
  const [showDetalhesAgente, setShowDetalhesAgente] = useState(false);
  const [agentePreview, setAgentePreview] = useState("");
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
      onMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao carregar.", "err");
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

  const loadAgenteMarca = useCallback(async () => {
    if (!empresaId) return;
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/agente-marca`);
    if (!result.ok || result.networkError) return;
    setAgentePreview(String(result.json?.agente?.markdown || "").trim());
  }, [empresaId]);

  useEffect(() => {
    void loadIdentidade();
    void loadMidiasIdentidade();
    void loadAgenteMarca();
  }, [loadIdentidade, loadMidiasIdentidade, loadAgenteMarca, empresaId]);

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

  async function persistIdentidade(nextDados, okMessage) {
    if (!empresaId || !canEdit) return false;
    setSaving(true);
    onMsg("Salvando…", "ok");
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/identidade`, {
      method: "PUT",
      body: JSON.stringify(nextDados),
    });
    setSaving(false);
    if (!result.ok || result.networkError) {
      onMsg(result.networkError?.message || formatAuthError(result.json) || "Não foi possível salvar.", "err");
      return false;
    }
    const id = result.json?.identidade;
    setDados(dadosFromApi(id?.dados));
    setCompletude(id?.completude || null);
    void loadAgenteMarca();
    onEmpresaLogoSynced?.();
    onMsg(okMessage || "Salvo — o agente já usa isso no chat e nas artes.", "ok");
    return true;
  }

  async function onLogoChange(idMidia) {
    setLockedFields((prev) => {
      const next = new Set(prev);
      next.add("id_midia_logo");
      return next;
    });
    const nextDados = { ...dados, id_midia_logo: idMidia };
    setDados(nextDados);
    setCompletude(calcCompletudeLocal(nextDados));
    await persistIdentidade(nextDados, "Logo salva — também aparece no painel.");
    void loadMidiasIdentidade();
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
      onMsg(del.networkError?.message || formatAuthError(del.json) || "Não foi possível remover a logo.", "err");
      return;
    }

    const nextDados = { ...dados, id_midia_logo: null };
    setSaving(false);
    const ok = await persistIdentidade(nextDados, "Logo removida.");
    if (ok) void loadMidiasIdentidade();
  }

  async function onSave() {
    await persistIdentidade(dados);
  }

  function requestClearIdentidade() {
    if (!empresaId || !canEdit || saving) return;
    setClearConfirmOpen(true);
  }

  async function confirmClearIdentidade() {
    if (!empresaId || !canEdit || saving) return;
    setClearConfirmOpen(false);
    setSaving(true);
    onMsg("Limpando…", "ok");
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/identidade`, {
      method: "DELETE",
    });
    setSaving(false);
    if (!result.ok || result.networkError) {
      onMsg(result.networkError?.message || formatAuthError(result.json) || "Não foi possível limpar.", "err");
      return;
    }

    const id = result.json?.identidade;
    setDados(dadosFromApi(id?.dados));
    setCompletude(id?.completude || calcCompletudeLocal(emptyDados));
    setLockedFields(new Set());
    setFotosOpen(false);
    setAgentePreview("");
    setShowDetalhesAgente(false);
    void loadMidiasIdentidade();
    void loadAgenteMarca();
    onEmpresaLogoSynced?.();
    onMsg("Visual da marca limpo.", "ok");
  }

  if (!empresaId) return null;

  const compLocal = calcCompletudeLocal(dados);
  const pct = completude?.percentual ?? compLocal.percentual;
  const pronto = completude?.pronto_para_imagem ?? compLocal.pronto_para_imagem;

  return (
    <EmpresaSectionPanel
      id="identidade-marca"
      title="Marca"
      description="Uma logo, cores e um papel em branco — o agente lê isso em toda arte."
    >
      <div className="space-y-5 p-4 sm:p-5">
        {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}

        <IdentidadeMarcaProgressBar
          percentual={pct}
          prontoParaImagem={pronto}
          dados={dados}
          batchLabel={
            pronto
              ? "Pronto para artes — logo, cores e jeito ok."
              : "Falta logo, cores ou um jeito (estilo ou papel)."
          }
        />

        <IdentidadeMarcaLogoField
          empresaId={empresaId}
          canEdit={canEdit}
          idMidiaLogo={dados.id_midia_logo}
          midias={midiasIdentidade}
          busy={saving}
          onChange={(id) => void onLogoChange(id)}
          onRemove={() => void onRemoveLogo()}
          onReloadMidias={loadMidiasIdentidade}
          onMsg={onMsg}
        />

        <IdentidadeMarcaCamposImagem
          dados={dados}
          canEdit={canEdit}
          onFieldChange={onManualFieldChange}
        />

        <section className="rounded-xl border border-dashed border-border/80">
          <button
            type="button"
            onClick={() => setFotosOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-medium text-foreground">Atalho: preencher com posts</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Opcional — envie fotos e o Tuma sugere cores/estilo. Depois você edita o papel.
              </span>
            </span>
            <span className="text-muted-foreground" aria-hidden>
              {fotosOpen ? "▾" : "▸"}
            </span>
          </button>
          {fotosOpen ? (
            <div className="border-t border-border px-4 pb-4 pt-3">
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
            </div>
          ) : null}
        </section>

        {agentePreview ? (
          <div>
            <button
              type="button"
              className="text-xs font-medium text-accent hover:underline"
              onClick={() => setShowDetalhesAgente((v) => !v)}
            >
              {showDetalhesAgente ? "Ocultar o que o agente lê" : "Ver o que o agente lê"}
            </button>
            {showDetalhesAgente ? (
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
                {agentePreview}
              </pre>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Produto em ótimo estado:{" "}
          <a href="/painel/midias" className="font-medium text-accent hover:underline">
            Mídias
          </a>{" "}
          (PNG fiel).
        </p>

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
            Limpar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition duration-200 disabled:opacity-60 enabled:hover:scale-[1.02] enabled:active:scale-[0.98]"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      ) : null}
      <ConfirmModal
        open={clearConfirmOpen}
        onClose={() => !saving && setClearConfirmOpen(false)}
        title="Limpar visual da marca"
        description="Remove logo, cores e o papel escrito. Não dá para desfazer."
        confirmLabel="Limpar"
        onConfirm={confirmClearIdentidade}
        busy={saving}
        variant="danger"
      />
    </EmpresaSectionPanel>
  );
}
