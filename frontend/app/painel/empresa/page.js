"use client";

import { useEffect, useMemo, useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";
import Modal from "../../components/Modal";

const emptyEmpresa = {
  nome_fantasia: "",
  razao_social: "",
  descricao: "",
  instagram_empresa: "",
  telefone_principal: "",
  segmento: "",
  cnpj: "",
  email_principal: "",
  nome_contato_principal: "",
};

export default function EmpresaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("ok");
  const [empresaId, setEmpresaId] = useState(null);
  const [form, setForm] = useState(emptyEmpresa);
  const [membros, setMembros] = useState([]);
  const [meuCargo, setMeuCargo] = useState("");
  const [savingMembroId, setSavingMembroId] = useState("");
  const [empresaDetalhesOpen, setEmpresaDetalhesOpen] = useState(false);
  const [empresaEditOpen, setEmpresaEditOpen] = useState(false);
  const [conviteCodigo, setConviteCodigo] = useState("");
  const [conviteExpiraEm, setConviteExpiraEm] = useState("");
  const [creatingConvite, setCreatingConvite] = useState(false);
  const [conviteModalOpen, setConviteModalOpen] = useState(false);
  const [conviteCargo, setConviteCargo] = useState("membro");
  const [conviteEmail, setConviteEmail] = useState("");
  const [membroToRemove, setMembroToRemove] = useState(null);

  const hasEmpresa = useMemo(() => Boolean(empresaId), [empresaId]);
  const canEditEmpresa = useMemo(
    () => meuCargo === "administrador" || meuCargo === "editor",
    [meuCargo],
  );
  const canManageMembros = useMemo(() => meuCargo === "administrador", [meuCargo]);

  useEffect(() => {
    let active = true;
    authApiFetchWithToken("/empresas/minhas").then((result) => {
      if (!active) return;
      if (result.ok) {
        const primeira = Array.isArray(result.json?.empresas) ? result.json.empresas[0] : null;
        const empresa = primeira?.empresa || null;
        setMeuCargo(primeira?.papel || "");
        if (empresa?.id_empresa) {
          setEmpresaId(empresa.id_empresa);
          setForm({
            nome_fantasia: empresa.nome_fantasia || "",
            razao_social: empresa.razao_social || "",
            descricao: empresa.descricao || "",
            instagram_empresa: empresa.instagram_empresa || "",
            telefone_principal: empresa.telefone_principal || "",
            segmento: empresa.segmento || "",
            cnpj: empresa.cnpj || "",
            email_principal: empresa.email_principal || "",
            nome_contato_principal: empresa.nome_contato_principal || "",
          });
        }
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

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

  async function onSubmit(event) {
    event.preventDefault();
    const nomeFantasia = form.nome_fantasia.trim();
    if (!nomeFantasia) {
      setMsg("Nome fantasia é obrigatório.");
      setMsgKind("err");
      return;
    }
    if (!canEditEmpresa) {
      setMsg("Seu cargo não permite editar os dados da empresa.");
      setMsgKind("err");
      return;
    }

    setSaving(true);
    setMsg(hasEmpresa ? "Salvando empresa..." : "Criando empresa...");
    setMsgKind("ok");

    const body = {
      nome_fantasia: nomeFantasia,
      razao_social: form.razao_social.trim() || null,
      descricao: form.descricao.trim() || null,
      instagram_empresa: form.instagram_empresa.trim() || null,
      telefone_principal: form.telefone_principal.trim() || null,
      segmento: form.segmento.trim() || null,
      cnpj: form.cnpj.trim() || null,
      email_principal: form.email_principal.trim() || null,
      nome_contato_principal: form.nome_contato_principal.trim() || null,
    };

    const path = hasEmpresa ? `/empresas/${empresaId}` : "/empresas";
    const method = hasEmpresa ? "PATCH" : "POST";

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
      if (empresa?.id_empresa) {
        setEmpresaId(empresa.id_empresa);
      }
      setMsg(hasEmpresa ? "Empresa atualizada." : "Empresa criada com sucesso.");
      setMsgKind("ok");
      setEmpresaEditOpen(false);
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
    setConviteExpiraEm("");
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/convites`, {
      method: "POST",
      body: JSON.stringify({
        cargo: conviteCargo,
        email_destino: conviteEmail.trim() || null,
      }),
    });
    setCreatingConvite(false);
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao gerar convite.");
      setMsgKind("err");
      return;
    }
    setConviteCodigo(result.json?.convite?.codigo || "");
    setConviteExpiraEm(result.json?.convite?.data_expiracao || "");
    setMsg("Convite gerado com sucesso.");
    setMsgKind("ok");
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

  if (loading) {
    return <main className="rounded-xl border border-zinc-200 bg-white p-6">Carregando empresa...</main>;
  }

  return (
    <main className="rounded-xl border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold text-zinc-900">Empresa</h1>
      {hasEmpresa ? (
        <p className="mt-1 text-xs text-zinc-500">
          Seu cargo: <strong>{meuCargo || "membro"}</strong>
        </p>
      ) : null}
      {!canEditEmpresa && hasEmpresa ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Você pode visualizar os dados da empresa, mas não pode editá-los com o cargo atual.
        </p>
      ) : null}

      {hasEmpresa ? (
        <section className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => setEmpresaDetalhesOpen((v) => !v)}
              className="flex-1 text-left"
            >
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Empresa</p>
                <p className="text-base font-semibold text-zinc-900">{form.nome_fantasia || "Sem nome fantasia"}</p>
                <p className="mt-1 text-sm text-zinc-600">
                  {form.segmento || "Sem segmento"} · {form.email_principal || "Sem e-mail principal"}
                </p>
              </div>
              <div className="text-xs text-zinc-500">{empresaDetalhesOpen ? "Ocultar detalhes" : "Ver detalhes"}</div>
            </button>
            {canEditEmpresa ? (
              <button
                type="button"
                onClick={() => setEmpresaEditOpen((v) => !v)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-100"
                title="Editar empresa"
                aria-label="Editar empresa"
              >
                ⚙
              </button>
            ) : null}
          </div>
          {empresaDetalhesOpen ? (
            <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-zinc-200 bg-white p-3 md:grid-cols-2">
              <p className="text-sm text-zinc-700"><strong>Razão social:</strong> {form.razao_social || "—"}</p>
              <p className="text-sm text-zinc-700"><strong>CNPJ:</strong> {form.cnpj || "—"}</p>
              <p className="text-sm text-zinc-700"><strong>Instagram:</strong> {form.instagram_empresa || "—"}</p>
              <p className="text-sm text-zinc-700"><strong>Telefone:</strong> {form.telefone_principal || "—"}</p>
              <p className="text-sm text-zinc-700"><strong>Contato:</strong> {form.nome_contato_principal || "—"}</p>
              <p className="text-sm text-zinc-700"><strong>Descrição:</strong> {form.descricao || "—"}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {!hasEmpresa || empresaEditOpen ? (
      <form className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        {Object.entries({
          nome_fantasia: "Nome fantasia",
          razao_social: "Razão social",
          instagram_empresa: "Instagram",
          telefone_principal: "Telefone principal",
          segmento: "Segmento",
          cnpj: "CNPJ",
          email_principal: "E-mail principal",
          nome_contato_principal: "Nome do contato principal",
        }).map(([key, label]) => (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-zinc-800" htmlFor={key}>
              {label}
            </label>
            <input
              id={key}
              type="text"
              value={form[key]}
              onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
              disabled={!canEditEmpresa}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-800"
            />
          </div>
        ))}

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-zinc-800" htmlFor="descricao">
            Descrição
          </label>
          <textarea
            id="descricao"
            value={form.descricao}
            onChange={(e) => setForm((s) => ({ ...s, descricao: e.target.value }))}
            disabled={!canEditEmpresa}
            className="min-h-24 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-800"
          />
        </div>

        <div className="md:col-span-2">
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !canEditEmpresa}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Salvando..." : hasEmpresa ? "Salvar empresa" : "Cadastrar empresa"}
            </button>
            {hasEmpresa ? (
              <button
                type="button"
                onClick={() => setEmpresaEditOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      </form>
      ) : null}

      {hasEmpresa ? (
        <section className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Membros da empresa</h2>
            <div className="flex items-center gap-2">
              {canManageMembros ? (
                <button
                  type="button"
                  onClick={() => {
                    setConviteCodigo("");
                    setConviteExpiraEm("");
                    setConviteEmail("");
                    setConviteCargo("membro");
                    setConviteModalOpen(true);
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
                >
                  Convidar
                </button>
              ) : null}
            </div>
          </div>
          {!membros.length ? <p className="text-sm text-zinc-600">Nenhum membro encontrado.</p> : null}
          <div className="space-y-2">
            {membros.map((m) => (
              <article
                key={m.id_usuario}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">{m.nome || "Usuário sem nome"}</p>
                  <p className="text-xs text-zinc-600">{m.email || "Sem e-mail"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.cargo || "membro"}
                    onChange={(e) => void onChangeCargo(m.id_usuario, e.target.value)}
                    disabled={!canManageMembros || savingMembroId === m.id_usuario}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm disabled:opacity-60"
                  >
                    <option value="membro">Membro</option>
                    <option value="editor">Editor</option>
                    <option value="administrador">Administrador</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setMembroToRemove(m)}
                    disabled={!canManageMembros || savingMembroId === m.id_usuario}
                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <Modal open={Boolean(membroToRemove)} onClose={() => setMembroToRemove(null)} title="Remover membro">
        {membroToRemove ? (
          <>
            <p className="mt-2 text-sm text-zinc-700">
              Deseja remover <strong>{membroToRemove.nome || membroToRemove.email || "este membro"}</strong> da empresa?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void onRemoveMembro(membroToRemove.id_usuario)}
                className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setMembroToRemove(null)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
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
        title="Convidar para a empresa"
        maxWidthClass="max-w-lg"
      >
        <>
            <p className="mt-2 text-sm text-zinc-600">
              Gere um convite com perfil de acesso e compartilhe o codigo com a pessoa.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-800">Cargo</label>
                <select
                  value={conviteCargo}
                  onChange={(e) => setConviteCargo(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="membro">Membro</option>
                  <option value="editor">Editor</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-800">E-mail (opcional)</label>
                <input
                  value={conviteEmail}
                  onChange={(e) => setConviteEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void onCreateConvite()}
                disabled={creatingConvite}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {creatingConvite ? "Gerando convite..." : "Gerar convite"}
              </button>
            </div>
            {conviteCodigo ? (
              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Codigo do convite</p>
                <p className="mt-1 font-mono text-lg font-semibold text-zinc-900">{conviteCodigo}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Expira em: {conviteExpiraEm ? new Date(conviteExpiraEm).toLocaleString("pt-BR") : "-"}
                </p>
                <button
                  type="button"
                  onClick={() => void onCopyConvite()}
                  className="mt-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  Copiar codigo
                </button>
              </div>
            ) : null}
        </>
      </Modal>

      {msg ? (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            msgKind === "err" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {msg}
        </p>
      ) : null}
    </main>
  );
}
