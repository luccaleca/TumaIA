export default function TumaCorePlaceholder({ title, description }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">TumaCore</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
      <p className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        Em migração do repositório TumaCore — conteúdo chega nas próximas etapas.
      </p>
    </div>
  );
}
