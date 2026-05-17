import EmpresaLogoAvatar from "./EmpresaLogoAvatar";

export default function EmpresaWorkspaceCard({ empresa, papel, cargoLabel, onSelect }) {
  const fotoUrl = empresa.foto_perfil_url ? String(empresa.foto_perfil_url).trim() : "";
  const nome = empresa.nome_fantasia || "Sem nome";

  return (
    <button
      type="button"
      onClick={() => onSelect(empresa.id_empresa)}
      aria-label={`Abrir workspace ${nome}`}
      className="flex w-full gap-4 rounded-xl border border-border bg-background p-4 text-left shadow-sm transition-[border-color,background-color,box-shadow] duration-150 hover:border-accent/45 hover:bg-muted/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
    >
      <EmpresaLogoAvatar fotoUrl={fotoUrl} nome={nome} size="md" />

      <div className="min-w-0 flex-1 self-center">
        <p className="text-base font-semibold text-foreground">{nome}</p>
        <p className="mt-1 text-sm text-muted-foreground">{cargoLabel(papel)}</p>
      </div>
    </button>
  );
}
