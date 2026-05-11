"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { authApiFetchWithToken, formatAuthError } from "../../../lib/auth";

const TIPOS = [
  { value: "promocao", label: "Promoção" },
  { value: "lancamento", label: "Lançamento" },
  { value: "data_comemorativa", label: "Data comemorativa" },
  { value: "personalizado", label: "Personalizado" },
];

function emptyForm() {
  return {
    tipo: "promocao",
    nome: "",
    descricao: "",
    promocao: {
      nome: "",
      produto: "",
      beneficio: "",
      tipo: "",
      detalhe: "",
      precoOferta: "",
      validade: "",
      onde: "",
      publico: "",
      cta: "",
      restricoes: "",
    },
    lancamento: {
      nome: "",
      oQue: "",
      problema: "",
      novidades: "",
      diferencial: "",
      publico: "",
      disponibilidade: "",
      dataMomento: "",
      tom: "",
      cta: "",
      restricoes: "",
    },
    dataComemorativa: {
      nome: "",
      ocasiao: "",
      periodo: "",
      mensagem: "",
      tom: "",
      publico: "",
      conexaoMarca: "",
      cta: "",
      restricoes: "",
    },
    personalizado: {
      titulo: "",
      campos: [{ nome: "", valor: "" }],
    },
  };
}

function normalizeFromApi(row) {
  const dados = row?.dados_json && typeof row.dados_json === "object" ? row.dados_json : {};
  const tipoRaw = String(dados?.tipo || row?.schema_json?.tipo || "personalizado")
    .trim()
    .toLowerCase();
  const tipo = TIPOS.some((t) => t.value === tipoRaw) ? tipoRaw : "personalizado";
  return {
    id: row?.id_contexto_empresa,
    nome: row?.nome || "",
    descricao: row?.descricao || "",
    tipo,
    dados,
    row,
  };
}

function summarizeContexto(item) {
  if (item.tipo === "promocao") {
    const p = item.dados?.promocao || {};
    return [p.nome, p.produto, p.beneficio].filter(Boolean).join(" · ");
  }
  if (item.tipo === "lancamento") {
    const l = item.dados?.lancamento || {};
    return [l.nome, l.oQue, l.diferencial].filter(Boolean).join(" · ");
  }
  if (item.tipo === "data_comemorativa") {
    const d = item.dados?.dataComemorativa || {};
    return [d.nome, d.ocasiao, d.periodo].filter(Boolean).join(" · ");
  }
  const p = item.dados?.personalizado || {};
  if (p.titulo) return p.titulo;
  const primeiro = Array.isArray(p.campos) ? p.campos[0] : null;
  if (primeiro) return [primeiro.nome, primeiro.valor].filter(Boolean).join(": ");
  return "";
}

export default function ContextosPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contextos, setContextos] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("ok");
  const [form, setForm] = useState(emptyForm);
  const [editorOpen, setEditorOpen] = useState(false);
  const [canManageContextos, setCanManageContextos] = useState(false);
  const contextosCreatedSectionRef = useRef(null);

  const selected = useMemo(
    () => contextos.find((item) => item.id === selectedId) || null,
    [contextos, selectedId],
  );

  async function loadContextosData() {
    const minhas = await authApiFetchWithToken("/empresas/minhas");
    if (!minhas.ok || minhas.networkError) {
      setMsg(minhas.networkError?.message || formatAuthError(minhas.json) || "Falha ao carregar empresa.");
      setMsgKind("err");
      setLoading(false);
      return;
    }
    const primeira = Array.isArray(minhas.json?.empresas) ? minhas.json.empresas[0] : null;
    const idEmp = primeira?.empresa?.id_empresa || null;
    const papel = String(primeira?.papel || "").toLowerCase();
    setCanManageContextos(papel === "administrador" || papel === "editor");
    setEmpresaId(idEmp);
    if (!idEmp) {
      setContextos([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }

    const result = await authApiFetchWithToken(`/empresas/${idEmp}/contextos`);
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao carregar contextos.");
      setMsgKind("err");
      setLoading(false);
      return;
    }

    const items = Array.isArray(result.json?.contextos) ? result.json.contextos.map(normalizeFromApi) : [];
    setContextos(items);
    setLoading(false);
  }

  useEffect(() => {
    const tid = setTimeout(() => {
      void loadContextosData();
    }, 0);
    return () => clearTimeout(tid);
  }, []);

  useEffect(() => {
    function handleOutsideClick(ev) {
      if (!selectedId) return;
      const container = contextosCreatedSectionRef.current;
      if (!container) return;
      const target = ev.target;
      if (!(target instanceof Element)) return;
      if (container.contains(target)) return;
      setSelectedId(null);
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [selectedId]);

  function selectedDetailLines(item) {
    if (!item) return [];
    if (item.tipo === "promocao") {
      const p = item.dados?.promocao || {};
      return [
        ["Nome", p.nome],
        ["Produto", p.produto],
        ["Benefício", p.beneficio],
        ["Tipo", p.tipo],
        ["Detalhe", p.detalhe],
        ["Preço / oferta", p.precoOferta],
        ["Validade", p.validade],
        ["Onde", p.onde],
        ["Público", p.publico],
        ["CTA", p.cta],
        ["Restrições", p.restricoes],
      ];
    }
    if (item.tipo === "lancamento") {
      const l = item.dados?.lancamento || {};
      return [
        ["Nome", l.nome],
        ["O que está sendo lançado", l.oQue],
        ["Problema que resolve", l.problema],
        ["O que há de novo", l.novidades],
        ["Diferencial", l.diferencial],
        ["Público", l.publico],
        ["Disponibilidade", l.disponibilidade],
        ["Data / momento", l.dataMomento],
        ["Tom", l.tom],
        ["CTA", l.cta],
        ["Restrições", l.restricoes],
      ];
    }
    if (item.tipo === "data_comemorativa") {
      const d = item.dados?.dataComemorativa || {};
      return [
        ["Nome / tema", d.nome],
        ["Ocasião", d.ocasiao],
        ["Data / período", d.periodo],
        ["Mensagem central", d.mensagem],
        ["Tom", d.tom],
        ["Público", d.publico],
        ["Conexão com a marca", d.conexaoMarca],
        ["CTA", d.cta],
        ["Restrições", d.restricoes],
      ];
    }
    const p = item.dados?.personalizado || {};
    const campos = Array.isArray(p.campos) ? p.campos : [];
    const lines = [["Nome", p.titulo || "—"]];
    if (!campos.length) {
      lines.push(["Campos", "—"]);
      return lines;
    }
    campos.forEach((c, idx) => {
      lines.push([String(c?.nome || "").trim() || `Campo ${idx + 1}`, String(c?.valor || "").trim() || "—"]);
    });
    return lines;
  }

  function startCreate() {
    if (!canManageContextos) return;
    setEditingId(null);
    setForm(emptyForm());
    setEditorOpen(true);
  }

  function cancelEditor() {
    setEditingId(null);
    setForm(emptyForm());
    setEditorOpen(false);
  }

  function startEdit(item) {
    if (!canManageContextos) return;
    const next = emptyForm();
    if (item.tipo === "promocao") next.promocao = { ...next.promocao, ...(item.dados?.promocao || {}) };
    if (item.tipo === "lancamento") next.lancamento = { ...next.lancamento, ...(item.dados?.lancamento || {}) };
    if (item.tipo === "data_comemorativa") {
      next.dataComemorativa = { ...next.dataComemorativa, ...(item.dados?.dataComemorativa || {}) };
    }
    if (item.tipo === "personalizado") {
      const pers = item.dados?.personalizado || {};
      next.personalizado = {
        titulo: pers.titulo || "",
        campos:
          Array.isArray(pers.campos) && pers.campos.length
            ? pers.campos.map((c) => ({ nome: c?.nome || "", valor: c?.valor || "" }))
            : [{ nome: "", valor: "" }],
      };
    }
    setEditingId(item.id);
    setForm({ ...next, tipo: item.tipo, nome: item.nome || "", descricao: item.descricao || "" });
    setEditorOpen(true);
  }

  function buildDadosPayload() {
    if (form.tipo === "promocao") return { tipo: form.tipo, promocao: form.promocao };
    if (form.tipo === "lancamento") return { tipo: form.tipo, lancamento: form.lancamento };
    if (form.tipo === "data_comemorativa") {
      return { tipo: form.tipo, dataComemorativa: form.dataComemorativa };
    }
    const campos = (form.personalizado.campos || [])
      .map((c) => ({ nome: String(c.nome || "").trim(), valor: String(c.valor || "").trim() }))
      .filter((c) => c.nome || c.valor);
    return { tipo: form.tipo, personalizado: { titulo: form.personalizado.titulo.trim(), campos } };
  }

  async function saveContexto(event) {
    event.preventDefault();
    if (!empresaId) {
      setMsg("Cadastre uma empresa antes de criar contextos.");
      setMsgKind("err");
      return;
    }
    if (!canManageContextos) {
      setMsg("Seu cargo não permite criar ou editar contextos.");
      setMsgKind("err");
      return;
    }
    const payload = {
      tipo: form.tipo,
      nome: form.nome.trim() || null,
      descricao: form.descricao.trim() || "",
      dados: buildDadosPayload(),
    };
    setSaving(true);
    setMsg(editingId ? "Salvando contexto..." : "Criando contexto...");
    setMsgKind("ok");
    const path = editingId
      ? `/empresas/${empresaId}/contextos/${editingId}`
      : `/empresas/${empresaId}/contextos`;
    const method = editingId ? "PATCH" : "POST";
    const result = await authApiFetchWithToken(path, {
      method,
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao salvar contexto.");
      setMsgKind("err");
      return;
    }
    setMsg(editingId ? "Contexto atualizado." : "Contexto criado.");
    setMsgKind("ok");
    setEditingId(null);
    setForm(emptyForm());
    setEditorOpen(false);
    setLoading(true);
    await loadContextosData();
  }

  function updateTipoFields(tipoKey, field, value) {
    setForm((s) => ({ ...s, [tipoKey]: { ...s[tipoKey], [field]: value } }));
  }

  function addPersonalizadoCampo() {
    setForm((s) => ({
      ...s,
      personalizado: {
        ...s.personalizado,
        campos: [...(s.personalizado.campos || []), { nome: "", valor: "" }],
      },
    }));
  }

  function updatePersonalizadoCampo(index, field, value) {
    setForm((s) => ({
      ...s,
      personalizado: {
        ...s.personalizado,
        campos: (s.personalizado.campos || []).map((c, i) => (i === index ? { ...c, [field]: value } : c)),
      },
    }));
  }

  function removePersonalizadoCampo(index) {
    setForm((s) => {
      const campos = (s.personalizado.campos || []).filter((_, i) => i !== index);
      return {
        ...s,
        personalizado: {
          ...s.personalizado,
          campos: campos.length ? campos : [{ nome: "", valor: "" }],
        },
      };
    });
  }

  async function removeContexto(id) {
    if (!empresaId) return;
    if (!canManageContextos) {
      setMsg("Seu cargo não permite remover contextos.");
      setMsgKind("err");
      return;
    }
    const result = await authApiFetchWithToken(`/empresas/${empresaId}/contextos/${id}`, {
      method: "DELETE",
    });
    if (!result.ok || result.networkError) {
      setMsg(result.networkError?.message || formatAuthError(result.json) || "Falha ao remover contexto.");
      setMsgKind("err");
      return;
    }
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm());
    }
    setMsg("Contexto removido.");
    setMsgKind("ok");
    setLoading(true);
    await loadContextosData();
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-border bg-background p-6">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Contextos</h1>
          <button
            type="button"
            onClick={startCreate}
            disabled={!canManageContextos}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-60"
          >
            Novo contexto
          </button>
        </div>
        {!canManageContextos && empresaId ? (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Seu cargo permite apenas visualizar contextos.
          </p>
        ) : null}

        {!empresaId && !loading ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Você precisa cadastrar uma empresa antes de usar contextos.
          </p>
        ) : null}

        {editorOpen ? (
        <form className="mt-4 grid grid-cols-1 gap-4" onSubmit={saveContexto}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm((s) => ({ ...s, tipo: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground"
              >
                {TIPOS.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">Nome (opcional)</label>
              <input
                value={form.nome}
                onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Descrição (opcional)</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm((s) => ({ ...s, descricao: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground"
            />
          </div>

          {form.tipo === "promocao" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                ["nome", "Nome"],
                ["produto", "Produto"],
                ["beneficio", "Benefício"],
                ["tipo", "Tipo"],
                ["detalhe", "Detalhe"],
                ["precoOferta", "Preço / oferta"],
                ["validade", "Validade"],
                ["onde", "Onde"],
                ["publico", "Público"],
                ["cta", "CTA"],
                ["restricoes", "Restrições"],
              ].map(([field, label]) => (
                <div key={field}>
                  <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
                  <input
                    value={form.promocao[field]}
                    onChange={(e) => updateTipoFields("promocao", field, e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground"
                  />
                </div>
              ))}
            </div>
          ) : null}

          {form.tipo === "lancamento" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                ["nome", "Nome"],
                ["oQue", "O que está sendo lançado"],
                ["problema", "Problema que resolve"],
                ["novidades", "O que há de novo"],
                ["diferencial", "Diferencial"],
                ["publico", "Público"],
                ["disponibilidade", "Disponibilidade"],
                ["dataMomento", "Data / momento"],
                ["tom", "Tom"],
                ["cta", "CTA"],
                ["restricoes", "Restrições"],
              ].map(([field, label]) => (
                <div key={field}>
                  <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
                  <input
                    value={form.lancamento[field]}
                    onChange={(e) => updateTipoFields("lancamento", field, e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground"
                  />
                </div>
              ))}
            </div>
          ) : null}

          {form.tipo === "data_comemorativa" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                ["nome", "Nome / tema"],
                ["ocasiao", "Ocasião"],
                ["periodo", "Data / período"],
                ["mensagem", "Mensagem central"],
                ["tom", "Tom"],
                ["publico", "Público"],
                ["conexaoMarca", "Conexão com a marca"],
                ["cta", "CTA"],
                ["restricoes", "Restrições"],
              ].map(([field, label]) => (
                <div key={field}>
                  <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
                  <input
                    value={form.dataComemorativa[field]}
                    onChange={(e) => updateTipoFields("dataComemorativa", field, e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground"
                  />
                </div>
              ))}
            </div>
          ) : null}

          {form.tipo === "personalizado" ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Nome deste contexto</label>
                <input
                  value={form.personalizado.titulo}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      personalizado: { ...s.personalizado, titulo: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground"
                />
              </div>
              {(form.personalizado.campos || []).map((campo, idx) => (
                <div key={`campo-${idx}`} className="rounded-lg border border-border p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Nome do campo</label>
                      <input
                        value={campo.nome}
                        onChange={(e) => updatePersonalizadoCampo(idx, "nome", e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Valor</label>
                      <input
                        value={campo.valor}
                        onChange={(e) => updatePersonalizadoCampo(idx, "valor", e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-foreground"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePersonalizadoCampo(idx)}
                    className="mt-2 rounded border border-border px-2 py-1 text-xs text-foreground"
                  >
                    Remover campo
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addPersonalizadoCampo}
                className="rounded border border-border px-3 py-1.5 text-sm text-foreground"
              >
                + Adicionar campo
              </button>
            </div>
          ) : null}

          <div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !empresaId || !canManageContextos}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
              >
                {saving ? "Salvando..." : editingId ? "Salvar edição" : "Criar contexto"}
              </button>
              <button
                type="button"
                onClick={cancelEditor}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
        ) : null}
      </section>

      <section ref={contextosCreatedSectionRef} className="rounded-xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold text-foreground">Contextos criados</h2>
        {loading ? <p className="mt-3 text-sm text-muted-foreground">Carregando...</p> : null}
        {!loading && contextos.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum contexto criado ainda.</p>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          <ul className="space-y-2">
            {contextos.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted"
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="w-full text-left"
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.tipo}</p>
                  <p className="font-medium text-foreground">{item.nome || "Contexto sem nome"}</p>
                  {summarizeContexto(item) ? (
                    <p className="mt-1 text-xs text-muted-foreground">{summarizeContexto(item)}</p>
                  ) : null}
                </button>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    disabled={!canManageContextos}
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-border text-sm text-foreground hover:bg-muted"
                    title="Editar contexto"
                    aria-label="Editar contexto"
                  >
                    ⚙
                  </button>
                  <button
                    type="button"
                    onClick={() => removeContexto(item.id)}
                    disabled={!canManageContextos}
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-border text-sm font-medium text-muted-foreground hover:border-red-400 hover:bg-red-50 hover:text-red-800 dark:hover:border-red-500/50 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    title="Remover contexto"
                    aria-label="Remover contexto"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Detalhes</p>
              {selected ? (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-border text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Minimizar detalhes"
                  aria-label="Minimizar detalhes"
                >
                  −
                </button>
              ) : null}
            </div>
            {selected ? (
              <div className="mt-2 space-y-2 text-sm">
                <p>
                  <span className="font-medium text-foreground">Tipo:</span>{" "}
                  <span className="text-foreground">{selected.tipo}</span>
                </p>
                <p>
                  <span className="font-medium text-foreground">Nome:</span>{" "}
                  <span className="text-foreground">{selected.nome || "—"}</span>
                </p>
                <p>
                  <span className="font-medium text-foreground">Descrição:</span>{" "}
                  <span className="text-foreground">{selected.descricao || "—"}</span>
                </p>
                <div>
                  <p className="font-medium text-foreground">Campos:</p>
                  <div className="mt-2 space-y-2">
                    {selectedDetailLines(selected).map(([label, value]) => (
                      <div
                        key={`${label}-${String(value)}`}
                        className="rounded-lg border border-border bg-background px-3 py-2"
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="mt-1 text-sm text-foreground">{String(value || "").trim() || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Selecione um contexto para visualizar.</p>
            )}
          </div>
        </div>
      </section>

      {msg ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            msgKind === "err"
              ? "border border-red-200 bg-red-50 text-red-900"
              : "border border-accent/30 bg-accent-muted text-foreground"
          }`}
        >
          {msg}
        </p>
      ) : null}
    </main>
  );
}
