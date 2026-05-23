import EmpresaLogoAvatar from "./EmpresaLogoAvatar";
import EmpresaUsoToggle from "./EmpresaUsoToggle";

export default function EmpresaWorkspaceCard({
  empresa,
  papel,
  cargoLabel,
  emUsoNoPainel,
  onSelect,
  onToggleUso,
}) {
  const fotoUrl = empresa.foto_perfil_url ? String(empresa.foto_perfil_url).trim() : "";
  const nome = empresa.nome_fantasia || "Sem nome";

  return (
    <div
      className={`flex w-full gap-3 rounded-xl border p-4 shadow-sm transition-[border-color,background-color,box-shadow] duration-150 ${
        emUsoNoPainel
          ? "border-accent/45 bg-accent-muted ring-1 ring-accent/25"
          : "border-border bg-surface hover:border-accent/40 hover:bg-muted/50 hover:shadow-md"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(empresa.id_empresa)}
        aria-label={`Abrir workspace ${nome}`}
        className="flex min-w-0 flex-1 gap-4 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        <EmpresaLogoAvatar fotoUrl={fotoUrl} nome={nome} size="md" />

        <div className="min-w-0 flex-1 self-center">
          <p className="text-base font-semibold text-foreground">{nome}</p>
          <p className="mt-1 text-sm text-muted-foreground">{cargoLabel(papel)}</p>
        </div>
      </button>

      <EmpresaUsoToggle
        ativo={emUsoNoPainel}
        onClick={() => onToggleUso(empresa.id_empresa)}
      />
    </div>
  );
}
