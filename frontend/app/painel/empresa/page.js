"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import Modal from "../../components/Modal";
import IdentidadeMarcaSection from "./IdentidadeMarcaSection";
import EmpresaZonaPerigosa from "./EmpresaZonaPerigosa";
import EmpresaFotoPerfil from "./EmpresaFotoPerfil";
import EmpresaWorkspaceCard from "./EmpresaWorkspaceCard";
import EmpresaUsoToggle from "./EmpresaUsoToggle";
import EmpresaDadosSection from "./EmpresaDadosSection";
import EmpresaMembrosSection from "./EmpresaMembrosSection";
import EmpresaAcoesInicio from "./EmpresaAcoesInicio";
import EmpresaFormulario from "./EmpresaFormulario";
import {
  emptyEmpresaFields,
  empresaToFormFields,
  formatCnpj,
  formatTelefone,
  normalizeCnpjForApi,
  normalizeInstagramForApi,
  normalizeSiteEmpresaForApi,
  normalizeTelefoneForApi,
} from "../../../lib/empresaFormMasks";
import {
  EMPRESA_ATIVA_CHANGE_EVENT,
  clearEmpresaAtiva,
  getEmpresaAtivaId,
  idEmpresaUltimaFromMinhasPayload,
  resolveEmpresaAtivaId,
  setEmpresaAtiva,
} from "../../../lib/empresaAtiva";

const emptyEmpresa = { ...emptyEmpresaFields };

function empresaRowFromList(list, idEmpresa) {
  if (!idEmpresa || !Array.isArray(list)) return null;
  return list.find((row) => row?.empresa?.id_empresa === idEmpresa) || null;
}

function cargoLabel(papel) {
  if (papel === "administrador") return "Administrador";
  if (papel === "editor") return "Editor";
  return "Membro";
}

export default function EmpresaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("ok");
  const [empresasMinhas, setEmpresasMinhas] = useState([]);
  const [empresaId, setEmpresaId] = useState(null);
  const [form, setForm] = useState(emptyEmpresa);
  const [membros, setMembros] = useState([]);
  const [meuCargo, setMeuCargo] = useState("");
  const [savingMembroId, setSavingMembroId] = useState("");
  const [empresaDetalhesOpen, setEmpresaDetalhesOpen] = useState(false);
  const [empresaEditOpen, setEmpresaEditOpen] = useState(false);
  const [criandoNovaEmpresa, setCriandoNovaEmpresa] = useState(false);
  const [conviteCodigo, setConviteCodigo] = useState("");
  const [creatingConvite, setCreatingConvite] = useState(false);
  const [conviteModalOpen, setConviteModalOpen] = useState(false);
  const [conviteCargo, setConviteCargo] = useState("membro");
  const [membroToRemove, setMembroToRemove] = useState(null);
  const [codigoEntradaConvite, setCodigoEntradaConvite] = useState("");
  const [resgatandoConvite, setResgatandoConvite] = useState(false);
  const [entrandoComConvite, setEntrandoComConvite] = useState(false);
  const empresaIdRef = useRef(null);
  const [empresaAtivaPainelId, setEmpresaAtivaPainelId] = useState(null);

  useEffect(() => {
    function syncAtiva() {
      setEmpresaAtivaPainelId(getEmpresaAtivaId());
    }
    syncAtiva();
    window.addEventListener(EMPRESA_ATIVA_CHANGE_EVENT, syncAtiva);
    return () => window.removeEventListener(EMPRESA_ATIVA_CHANGE_EVENT, syncAtiva);
  }, []);

  const hasEmpresa = useMemo(() => Boolean(empresaId), [empresaId]);

  const canEditEmpresa = useMemo(() => {
    if (criandoNovaEmpresa) return true;
    if (!hasEmpresa) return true;
    return meuCargo === "administrador" || meuCargo === "editor";
  }, [criandoNovaEmpresa, hasEmpresa, meuCargo]);

  const canManageMembros = useMemo(() => meuCargo === "administrador", [meuCargo]);

  const aplicarLinhaSelecionada = useCallback((list, idEmpresa) => {
    const row = empresaRowFromList(list, idEmpresa);
    const empresa = row?.empresa || null;
    setMeuCargo(row?.papel || "");
    if (empresa?.id_empresa) {
      setEmpresaId(empresa.id_empresa);
      setForm(empresaToFormFields(empresa));
    } else {
      setEmpresaId(null);
      setForm(emptyEmpresa);
    }
  }, []);

  useEffect(() => {
    empresaIdRef.current = empresaId;
  }, [empresaId]);

  const applyMinhasPayload = useCallback(
    (json, options = {}) => {
      const list = Array.isArray(json?.empresas) ? json.empresas : [];
      setEmpresasMinhas(list);
      const ids = list.map((row) => row?.empresa?.id_empresa).filter(Boolean);
      if (options.voltarParaLista) {
        aplicarLinhaSelecionada(list, null);
        return;
      }
      const fromForce = options.forceEmpresaId;
      const atual =
        options.empresaIdAtual !== undefined ? options.empresaIdAtual : empresaIdRef.current;
      const autoFirst = options.autoSelectFirst !== false;
      const selectRow = options.selectRow !== false;
      const selectedId = resolveEmpresaAtivaId(list, {
        preferId: fromForce || atual || null,
        idEmpresaUltimaPerfil: idEmpresaUltimaFromMinhasPayload(json),
        fallbackFirst: selectRow && autoFirst,
      });
      if (selectedId) {
        const row = empresaRowFromList(list, selectedId);
        if (row?.empresa) setEmpresaAtiva(row.empresa);
      }
      if (selectRow) aplicarLinhaSelecionada(list, selectedId);
      else if (!getEmpresaAtivaId() && ids.length) {
        const row = empresaRowFromList(list, ids[0]);
        if (row?.empresa) setEmpresaAtiva(row.empresa);
      }
    },
    [aplicarLinhaSelecionada],
  );

  const onNotifyZonaPerigosa = useCallback((text, kind) => {
    setMsg(text);
    setMsgKind(kind === "err" ? "err" : "ok");
  }, []);

  const onEmpresaRemovidaZonaPerigosa = useCallback(async () => {
    const minhas = await authApiFetchWithToken("/empresas/minhas");
    if (!minhas.ok) return;
    applyMinhasPayload(minhas.json, { autoSelectFirst: false, voltarParaLista: true });
  }, [applyMinhasPayload]);

  const refreshEmpresasLista = useCallback(async () => {
    const minhas = await authApiFetchWithToken("/empresas/minhas");
    if (!minhas.ok) return;
    const idAtual = empresaIdRef.current;
    applyMinhasPayload(minhas.json, {
      autoSelectFirst: false,
      ...(idAtual ? { forceEmpresaId: idAtual } : {}),
    });
  }, [applyMinhasPayload]);

  useEffect(() => {
    let active = true;
    authApiFetchWithToken("/empresas/minhas").then((result) => {
      if (!active) return;
      if (result.ok) {
        applyMinhasPayload(result.json, { autoSelectFirst: false, selectRow: false });
        const vazia = !Array.isArray(result.json?.empresas) || result.json.empresas.length === 0;
        if (vazia) {
          setMsg("");
        }
      } else {
        setMsg(
          result.networkError?.message ||
            formatAuthError(result.json) ||
            "Não foi possível carregar suas empresas.",
        );
        setMsgKind("err");
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [applyMinhasPayload]);

  useEffect(() => {
    if (!empresaId) setMembros([]);
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    let active = true;
    authApiFetchWithToken(`/empresas/${empresaId}/membros`).then((result) => {
      if (!active) return;
      if (!result.ok || result.networkError) return;
      setMembros(Array.isArray(result.json?.membros) ? result.json.membros : []);
    });
    return () => {
      active = false;
    };
  }, [empresaId]);

  function onSelectEmpresa(id) {
    if (!id) return;
    const row = empresaRowFromList(empresasMinhas, id);
    if (row?.empresa) {
      setEmpresaAtiva(row.empresa);
    }
    aplicarLinhaSelecionada(empresasMinhas, id);
    setEmpresaEditOpen(false);
    setCriandoNovaEmpresa(false);
    setEmpresaDetalhesOpen(false);
  }

  function onToggleUsoPainel(id) {
    if (!id) return;
    if (empresaAtivaPainelId === id) {
      clearEmpresaAtiva();
      setMsg("Empresa desativada. Clique em Uso em outra quando quiser usá-la no chat.");
      setMsgKind("ok");
      return;
    }
    const row = empresaRowFromList(empresasMinhas, id);
    if (row?.empresa) {
      setEmpresaAtiva(row.empresa);
    }
  }

  function onNovaEmpresa() {
    setEntrandoComConvite(false);
    setCriandoNovaEmpresa(true);
    setEmpresaEditOpen(true);
    aplicarLinhaSelecionada(empresasMinhas, null);
    setForm({ ...emptyEmpresa });
    setMsg("");
  }

  function onCancelarFormulario() {
    setEmpresaEditOpen(false);
    setCriandoNovaEmpresa(false);
    if (empresaId) {
      const row = empresaRowFromList(empresasMinhas, empresaId);
      const empresa = row?.empresa;
      if (empresa) {
        setForm(empresaToFormFields(empresa));
      }
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    const nomeFantasia = form.nome_fantasia.trim();
    if (!nomeFantasia) {
      setMsg("Nome é obrigatório.");
      setMsgKind("err");
      return;
    }
    if (!canEditEmpresa) {
      setMsg("Seu cargo não permite editar os dados da empresa.");
      setMsgKind("err");
      return;
    }

    const postNova = criandoNovaEmpresa || !hasEmpresa;
    setSaving(true);
    setMsg(postNova ? "Criando empresa..." : "Salvando empresa...");
    setMsgKind("ok");

    const telDigits = normalizeTelefoneForApi(form.telefone_principal);
    const cnpjDigits = normalizeCnpjForApi(form.cnpj);

    const body = {
      nome_fantasia: nomeFantasia,
      razao_social: form.razao_social.trim() || null,
      descricao: form.descricao.trim() || null,
      instagram_empresa: normalizeInstagramForApi(form.instagram_empresa),
      telefone_principal: telDigits ? formatTelefone(telDigits) : null,
      segmento: form.segmento.trim() || null,
      cnpj: cnpjDigits ? formatCnpj(cnpjDigits) : null,
      email_principal: form.email_principal.trim() || null,
      site_empresa: normalizeSiteEmpresaForApi(form.site_empresa),
    };

    const path = postNova ? "/empresas" : `/empresas/${empresaId}`;
    const method = postNova ? "POST" : "PATCH";

    try {
      const result = await authApiFetchWithToken(path, {
        method,
        body: JSON.stringify(body),
      });
      if (!result.ok || result.networkError) {
        setMsg(
          result.networkError?.message ||
            formatAuthError(result.json) ||
            "Não foi possível salvar os dados da empresa.",
        );
        setMsgKind("err");
        return;
      }
      const empresa = result.json?.empresa;
      setMsg(postNova ? "Empresa criada com sucesso." : "Empresa atualizada.");
      setMsgKind("ok");
      setEmpresaEditOpen(false);
      setCriandoNovaEmpresa(false);

      const minhas = await authApiFetchWithToken("/empresas/minhas");
      if (minhas.ok) {
        applyMinhasPayload(minhas.json, {
          forceEmpresaId: postNova && empresa?.id_empresa ? empresa.id_empresa : undefined,
          autoSelectFirst: false,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function loadMembros() {
    if (!empresaId) return;
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/membros`);
    if (!result.ok || result.networkError) return;
    setMembros(Array.isArray(result.json?.membros) ? result.json.membros : []);
  }

  async function onChangeCargo(idUsuario, cargo) {
    if (!empresaId || !canManageMembros) return;
    setSavingMembroId(idUsuario);
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/membros/${idUsuario}`, {
      method: "PATCH",
      body: JSON.stringify({ cargo }),
    });
    setSavingMembroId("");
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao alterar cargo.");
      setMsgKind("err");
      return;
    }
    setMsg("Cargo atualizado.");
    setMsgKind("ok");
    await loadMembros();
  }

  async function onRemoveMembro(idUsuario) {
    if (!empresaId || !canManageMembros) return;
    setSavingMembroId(idUsuario);
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/membros/${idUsuario}`, {
      method: "DELETE",
    });
    setSavingMembroId("");
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao remover membro.");
      setMsgKind("err");
      return;
    }
    setMsg("Membro removido.");
    setMsgKind("ok");
    await loadMembros();
    setMembroToRemove(null);
  }

  async function onCreateConvite() {
    if (!empresaId || !canManageMembros) return;
    setCreatingConvite(true);
    setConviteCodigo("");
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/convites`, {
      method: "POST",
      body: JSON.stringify({ cargo: conviteCargo }),
    });
    setCreatingConvite(false);
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao gerar convite.");
      setMsgKind("err");
      return;
    }
    setConviteCodigo(result.json?.convite?.codigo || "");
    setMsg("");
  }

  async function onCopyConvite() {
    if (!conviteCodigo) return;
    try {
      await navigator.clipboard.writeText(conviteCodigo);
      setMsg("Código de convite copiado.");
      setMsgKind("ok");
    } catch {
      setMsg("Não foi possível copiar o código automaticamente.");
      setMsgKind("err");
    }
  }

  async function onResgatarConvite() {
    const codigo = String(codigoEntradaConvite || "").trim();
    if (codigo.length < 4) {
      setMsg("Informe o código do convite (mínimo 4 caracteres).");
      setMsgKind("err");
      return;
    }

    setResgatandoConvite(true);
    const result = await authApiFetchWithToken("/empresas/convites/resgatar", {
      method: "POST",
      body: JSON.stringify({ codigo }),
    });
    setResgatandoConvite(false);

    if (!result.ok || result.networkError) {
      setMsg(
        result.networkError?.message ||
          formatAuthError(result.json) ||
          "Não foi possível usar este convite.",
      );
      setMsgKind("err");
      return;
    }

    const empresa = result.json?.empresa;
    const mensagem =
      result.json?.mensagem ||
      (result.json?.ja_membro
        ? "Você já faz parte desta empresa."
        : "Você entrou na empresa com sucesso.");
    setMsg(mensagem);
    setMsgKind("ok");
    setCodigoEntradaConvite("");
    setEntrandoComConvite(false);

    if (empresa?.id_empresa) {
      setEmpresaAtiva(empresa);
    }

    const minhas = await authApiFetchWithToken("/empresas/minhas");
    if (minhas.ok) {
      applyMinhasPayload(minhas.json, {
        forceEmpresaId: empresa?.id_empresa || null,
        autoSelectFirst: !empresa?.id_empresa,
      });
    }
  }

  const mostrarFormulario = criandoNovaEmpresa || (hasEmpresa && empresaEditOpen);

  const dadosResumoCard = useMemo(() => {
    if (criandoNovaEmpresa && empresaId) {
      return empresaRowFromList(empresasMinhas, empresaId)?.empresa || null;
    }
    return {
      nome_fantasia: form.nome_fantasia,
      segmento: form.segmento,
      email_principal: form.email_principal,
      razao_social: form.razao_social,
      cnpj: form.cnpj,
      instagram_empresa: form.instagram_empresa,
      telefone_principal: form.telefone_principal,
      descricao: form.descricao,
      site_empresa: form.site_empresa,
    };
  }, [criandoNovaEmpresa, empresasMinhas, empresaId, form]);

  const mostrarListaWorkspaces = useMemo(
    () => empresasMinhas.length > 0 && !empresaId && !criandoNovaEmpresa,
    [empresasMinhas.length, empresaId, criandoNovaEmpresa],
  );

  const acoesInicioProps = {
    mostrarCodigo: entrandoComConvite,
    onCriarEmpresa: onNovaEmpresa,
    onAbrirEntrar: () => {
      setEntrandoComConvite(true);
      setMsg("");
    },
    onVoltar: () => {
      setEntrandoComConvite(false);
      setCodigoEntradaConvite("");
    },
    codigo: codigoEntradaConvite,
    onCodigoChange: setCodigoEntradaConvite,
    onSubmitConvite: () => void onResgatarConvite(),
    loading: resgatandoConvite,
  };

  const mostrarBotaoVoltarLista =
    criandoNovaEmpresa || (Boolean(empresaId) && empresasMinhas.length > 0);

  const empresaAtivaRow = useMemo(
    () => (empresaId ? empresaRowFromList(empresasMinhas, empresaId) : null),
    [empresaId, empresasMinhas],
  );
  const empresaAtiva = empresaAtivaRow?.empresa ?? null;
  const fotoPerfilUrl = empresaAtiva?.foto_perfil_url ? String(empresaAtiva.foto_perfil_url).trim() : "";

  if (loading) {
    return (
      <main className="rounded-xl border border-border bg-background p-6 text-muted-foreground">Carregando empresa...</main>
    );
  }

  return (
    <main className="rounded-xl border border-border bg-background p-6">
      {msg ? (
        <p
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            msgKind === "err"
              ? "border-red-400/60 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100"
              : "border-border bg-muted/40 text-foreground"
          }`}
          role="status"
        >
          {msg}
        </p>
      ) : null}

      {mostrarListaWorkspaces ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Suas empresas</h1>
            </div>
            <EmpresaAcoesInicio {...acoesInicioProps} />
          </div>
          <div
            className="mt-6 grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" }}
          >
            {empresasMinhas.map((row) => {
              const e = row?.empresa;
              if (!e?.id_empresa) return null;
              return (
                <EmpresaWorkspaceCard
                  key={e.id_empresa}
                  empresa={e}
                  papel={row.papel}
                  cargoLabel={cargoLabel}
                  emUsoNoPainel={empresaAtivaPainelId === e.id_empresa}
                  onSelect={onSelectEmpresa}
                  onToggleUso={onToggleUsoPainel}
                />
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              {mostrarBotaoVoltarLista ? (
                <button
                  type="button"
                  onClick={() => {
                    if (criandoNovaEmpresa) onCancelarFormulario();
                    else {
                      aplicarLinhaSelecionada(empresasMinhas, null);
                      setEmpresaEditOpen(false);
                      setEmpresaDetalhesOpen(false);
                    }
                  }}
                  className="shrink-0 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                >
                  ← {criandoNovaEmpresa ? "Cancelar" : "Suas empresas"}
                </button>
              ) : null}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold text-foreground">
                    {criandoNovaEmpresa
                      ? "Nova empresa"
                      : hasEmpresa
                        ? dadosResumoCard?.nome_fantasia || "Empresa"
                        : "Empresas"}
                  </h1>
                  {hasEmpresa && !criandoNovaEmpresa ? (
                    <EmpresaUsoToggle
                      ativo={empresaAtivaPainelId === empresaId}
                      onClick={() => onToggleUsoPainel(empresaId)}
                    />
                  ) : null}
                </div>
                {!hasEmpresa && !criandoNovaEmpresa ? (
                  <div className="mt-4">
                    <EmpresaAcoesInicio {...acoesInicioProps} />
                  </div>
                ) : null}
                {hasEmpresa && !criandoNovaEmpresa ? (
                  <nav
                    className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground"
                    aria-label="Seções da empresa"
                  >
                    <a href="#dados-empresa" className="font-medium text-accent hover:underline">
                      Dados
                    </a>
                    <span aria-hidden className="text-border">
                      ·
                    </span>
                    <a href="#identidade-marca" className="font-medium text-accent hover:underline">
                      Identidade
                    </a>
                    <span aria-hidden className="text-border">
                      ·
                    </span>
                    <a href="#membros-empresa" className="font-medium text-accent hover:underline">
                      Membros
                    </a>
                  </nav>
                ) : null}
              </div>
            </div>
          </div>

      {!canEditEmpresa && hasEmpresa ? (
        <p className="mt-3 rounded-lg border border-amber-600/35 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/45 dark:font-normal dark:text-amber-100">
          Você pode visualizar os dados da empresa, mas não pode editá-los com o cargo atual.
        </p>
      ) : null}
      {hasEmpresa ? (
        <div className="mt-6 space-y-8">
          <EmpresaDadosSection
            empresaId={empresaId}
            fotoPerfilUrl={fotoPerfilUrl}
            dados={dadosResumoCard}
            meuCargo={meuCargo}
            cargoLabel={cargoLabel}
            canEdit={canEditEmpresa}
            detalhesOpen={empresaDetalhesOpen}
            onToggleDetalhes={() => setEmpresaDetalhesOpen((v) => !v)}
            onEditar={() => {
              setCriandoNovaEmpresa(false);
              setEmpresaEditOpen(true);
            }}
            onFotoUpdated={() => void refreshEmpresasLista()}
            onMsg={(text, kind) => {
              setMsg(text);
              setMsgKind(kind === "err" ? "err" : "ok");
            }}
          />

          {mostrarFormulario ? (
            <EmpresaFormulario
              form={form}
              setForm={setForm}
              canEdit={canEditEmpresa}
              saving={saving}
              criandoNovaEmpresa={criandoNovaEmpresa}
              hasEmpresa={hasEmpresa}
              empresaEditOpen={empresaEditOpen}
              onSubmit={onSubmit}
              onCancelar={onCancelarFormulario}
            />
          ) : null}

          {!criandoNovaEmpresa ? (
            <>
              <IdentidadeMarcaSection
                empresaId={empresaId}
                canEdit={canEditEmpresa}
                siteEmpresa={String(form.site_empresa || empresaAtiva?.site_empresa || "").trim()}
              />

              <EmpresaMembrosSection
                membros={membros}
                canManageMembros={canManageMembros}
                savingMembroId={savingMembroId}
                onConvidar={() => {
                  setConviteCodigo("");
                  setConviteCargo("membro");
                  setConviteModalOpen(true);
                }}
                onChangeCargo={(idUsuario, cargo) => void onChangeCargo(idUsuario, cargo)}
                onRemove={setMembroToRemove}
              />

              <EmpresaZonaPerigosa
                empresaId={empresaId}
                nomeFantasia={dadosResumoCard?.nome_fantasia || ""}
                isAdministrador={canManageMembros}
                onEmpresaRemovida={() => void onEmpresaRemovidaZonaPerigosa()}
                onNotify={onNotifyZonaPerigosa}
              />
            </>
          ) : null}
        </div>
      ) : mostrarFormulario ? (
        <EmpresaFormulario
          form={form}
          setForm={setForm}
          canEdit={canEditEmpresa}
          saving={saving}
          criandoNovaEmpresa={criandoNovaEmpresa}
          hasEmpresa={hasEmpresa}
          empresaEditOpen={empresaEditOpen}
          onSubmit={onSubmit}
          onCancelar={onCancelarFormulario}
        />
      ) : null}

        </>
      )}

      <Modal open={Boolean(membroToRemove)} onClose={() => setMembroToRemove(null)} title="Remover membro">
        {membroToRemove ? (
          <>
            <p className="mt-2 text-sm text-foreground">
              Deseja remover <strong>{membroToRemove.nome || membroToRemove.email || "este membro"}</strong> da empresa?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void onRemoveMembro(membroToRemove.id_usuario)}
                className="rounded-md border border-red-500/60 bg-red-100 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-200 dark:border-red-500/40 dark:bg-red-950/45 dark:font-normal dark:text-red-100 dark:hover:bg-red-950/65"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setMembroToRemove(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        open={conviteModalOpen}
        onClose={() => setConviteModalOpen(false)}
        title="Código de convite"
        maxWidthClass="max-w-md"
      >
        <>
          {conviteCodigo ? (
            <div className="mt-2 rounded-lg border border-border bg-background p-4">
              <p className="font-mono text-xl font-semibold tracking-wide text-foreground">{conviteCodigo}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Envie este código para a pessoa entrar em Empresas → Entrar.
              </p>
              <button
                type="button"
                onClick={() => void onCopyConvite()}
                className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-95"
              >
                Copiar código
              </button>
            </div>
          ) : (
            <>
              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-foreground">Cargo</label>
                <select
                  value={conviteCargo}
                  onChange={(e) => setConviteCargo(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground"
                >
                  <option value="membro">Membro</option>
                  <option value="editor">Editor</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => void onCreateConvite()}
                disabled={creatingConvite}
                className="mt-4 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                {creatingConvite ? "Gerando…" : "Gerar código"}
              </button>
            </>
          )}
        </>
      </Modal>
    </main>
  );
}
