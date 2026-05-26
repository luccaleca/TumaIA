import EmpresaFotoPerfil from "./EmpresaFotoPerfil";
import EmpresaSectionPanel from "./EmpresaSectionPanel";
import { formatCnpj, formatTelefone, stripInstagramAt } from "../../../lib/empresaFormMasks";

function valorDetalhe(key, value) {
  const v = String(value || "").trim();
  if (!v) return "—";
  if (key === "instagram_empresa") {
    const user = stripInstagramAt(v);
    return user ? `@${user}` : "—";
  }
  if (key === "cnpj") return formatCnpj(v) || "—";
  if (key === "telefone_principal") return formatTelefone(v) || "—";
  return v;
}

const DETALHE_CAMPOS = [
  ["Razão social", "razao_social"],
  ["CNPJ", "cnpj"],
  ["Site", "site_empresa"],
  ["Instagram", "instagram_empresa"],
  ["Telefone", "telefone_principal"],
  ["Descrição", "descricao"],
];

export default function EmpresaDadosSection({
  empresaId,
  fotoPerfilUrl,
  dados,
  meuCargo,
  cargoLabel,
  canEdit,
  detalhesOpen,
  onToggleDetalhes,
  onEditar,
  onFotoUpdated,
  onMsg,
}) {
  return (
    <EmpresaSectionPanel
      step={1}
      id="dados-empresa"
      title="Dados da empresa"
      description="Ícone, segmento, contato e informações cadastrais do workspace."
      actions={
        canEdit ? (
          <button
            type="button"
            onClick={onEditar}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
          >
            Editar dados
          </button>
        ) : null
      }
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-8 sm:p-5">
        {empresaId ? (
          <EmpresaFotoPerfil
            empresaId={empresaId}
            fotoUrl={fotoPerfilUrl}
            nomeFantasia={dados?.nome_fantasia}
            canEdit={canEdit}
            onUpdated={onFotoUpdated}
            onMsg={onMsg}
          />
        ) : null}

        <div className="min-w-0 flex-1 sm:pt-1">
          <p className="text-sm text-muted-foreground">
            {(dados?.segmento || "").trim() || "Sem segmento"}
            {" · "}
            {dados?.email_principal || "Sem e-mail principal"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Seu cargo: <span className="font-medium text-foreground">{cargoLabel(meuCargo) || "—"}</span>
          </p>
          <button
            type="button"
            onClick={onToggleDetalhes}
            className="mt-3 text-xs font-medium text-accent underline-offset-2 hover:underline"
          >
            {detalhesOpen ? "Ocultar detalhes cadastrais" : "Ver detalhes cadastrais"}
          </button>
        </div>
      </div>

      {detalhesOpen ? (
        <div className="border-t border-border bg-muted/15 px-4 pb-4 pt-3 sm:px-5">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
            {DETALHE_CAMPOS.map(([label, key]) => (
              <div key={key}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-sm text-foreground">{valorDetalhe(key, dados?.[key])}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </EmpresaSectionPanel>
  );
}
