import {
  SEGMENTO_OPCAO_PERSONALIZADA,
  SEGMENTOS_SUGERIDOS,
  formatCnpj,
  formatTelefone,
  segmentoEstaNaLista,
  stripInstagramAt,
} from "../../../lib/empresaFormMasks";

const INPUT_CLASS =
  "w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus:border-accent/55 focus:ring-2 focus:ring-accent/15 dark:focus:ring-accent/25 disabled:opacity-60";

function Field({ id, label, hint, children, className = "" }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function EmpresaFormulario({
  form,
  setForm,
  canEdit,
  saving,
  criandoNovaEmpresa,
  hasEmpresa,
  empresaEditOpen,
  onSubmit,
  onCancelar,
}) {
  function setField(key, value) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  const segmentoValor = (form.segmento || "").trim();
  const segmentoLista = segmentoEstaNaLista(segmentoValor);
  const segmentoSelectValor = segmentoLista
    ? segmentoValor
    : segmentoValor
      ? SEGMENTO_OPCAO_PERSONALIZADA
      : "";

  function onSegmentoSelectChange(e) {
    const v = e.target.value;
    if (v === SEGMENTO_OPCAO_PERSONALIZADA) {
      if (segmentoLista) setField("segmento", "");
      return;
    }
    setField("segmento", v);
  }

  return (
    <form
      className="mt-5 overflow-hidden rounded-xl border border-border bg-background"
      onSubmit={onSubmit}
    >
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">
          {criandoNovaEmpresa || !hasEmpresa ? "Cadastro da empresa" : "Editar dados"}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Informações básicas do workspace. Campos com * são obrigatórios.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 md:grid-cols-2">
        <Field id="nome_fantasia" label="Nome *" className="md:col-span-2">
          <input
            id="nome_fantasia"
            type="text"
            required
            autoComplete="organization"
            placeholder="Ex.: Ótica Santo Grau"
            value={form.nome_fantasia}
            onChange={(e) => setField("nome_fantasia", e.target.value)}
            disabled={!canEdit}
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="segmento" label="Segmento">
          <select
            id="segmento"
            value={segmentoSelectValor}
            onChange={onSegmentoSelectChange}
            disabled={!canEdit}
            className={INPUT_CLASS}
          >
            <option value="">Selecione uma categoria</option>
            {SEGMENTOS_SUGERIDOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={SEGMENTO_OPCAO_PERSONALIZADA}>Outra categoria…</option>
          </select>
          {segmentoSelectValor === SEGMENTO_OPCAO_PERSONALIZADA ? (
            <input
              id="segmento_personalizado"
              type="text"
              placeholder="Digite a categoria"
              value={form.segmento}
              onChange={(e) => setField("segmento", e.target.value)}
              disabled={!canEdit}
              className={`${INPUT_CLASS} mt-2`}
            />
          ) : null}
        </Field>

        <Field id="cnpj" label="CNPJ">
          <input
            id="cnpj"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0001-00"
            value={form.cnpj}
            onChange={(e) => setField("cnpj", formatCnpj(e.target.value))}
            disabled={!canEdit}
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="email_principal" label="E-mail">
          <input
            id="email_principal"
            type="email"
            autoComplete="email"
            placeholder="contato@empresa.com.br"
            value={form.email_principal}
            onChange={(e) => setField("email_principal", e.target.value)}
            disabled={!canEdit}
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="telefone_principal" label="Telefone">
          <input
            id="telefone_principal"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            value={form.telefone_principal}
            onChange={(e) => setField("telefone_principal", formatTelefone(e.target.value))}
            disabled={!canEdit}
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="site_empresa" label="Site da empresa" className="md:col-span-2">
          <input
            id="site_empresa"
            type="url"
            autoComplete="url"
            placeholder="https://suaempresa.com.br"
            value={form.site_empresa}
            onChange={(e) => setField("site_empresa", e.target.value)}
            disabled={!canEdit}
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="instagram_empresa" label="Instagram da empresa">
          <div className="flex overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-sm focus-within:border-accent/55 focus-within:ring-2 focus-within:ring-accent/15 dark:focus-within:ring-accent/25">
            <span className="flex items-center border-r border-border bg-muted/50 px-3 text-sm text-muted-foreground">
              @
            </span>
            <input
              id="instagram_empresa"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="sua_empresa"
              value={form.instagram_empresa}
              onChange={(e) => setField("instagram_empresa", stripInstagramAt(e.target.value))}
              disabled={!canEdit}
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground outline-none disabled:opacity-60"
            />
          </div>
        </Field>

        <Field id="razao_social" label="Razão social" className="md:col-span-2">
          <input
            id="razao_social"
            type="text"
            autoComplete="organization"
            placeholder="Opcional — nome jurídico"
            value={form.razao_social}
            onChange={(e) => setField("razao_social", e.target.value)}
            disabled={!canEdit}
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="descricao" label="Descrição" className="md:col-span-2">
          <textarea
            id="descricao"
            placeholder="Breve descrição do negócio (opcional)"
            value={form.descricao}
            onChange={(e) => setField("descricao", e.target.value)}
            disabled={!canEdit}
            className={`${INPUT_CLASS} min-h-24 resize-y`}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3 sm:px-5">
        <button
          type="submit"
          disabled={saving || !canEdit}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition duration-200 ease-out disabled:opacity-60 enabled:hover:scale-[1.02] enabled:active:scale-[0.98]"
        >
          {saving
            ? "Salvando..."
            : criandoNovaEmpresa || !hasEmpresa
              ? "Cadastrar empresa"
              : "Salvar empresa"}
        </button>
        {hasEmpresa && (empresaEditOpen || criandoNovaEmpresa) ? (
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
