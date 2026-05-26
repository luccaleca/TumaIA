/**
 * Painel de seção da página Empresa — cabeçalho marcante + conteúdo.
 */
export default function EmpresaSectionPanel({
  step,
  title,
  description,
  id,
  actions,
  tone = "default",
  children,
}) {
  const isDanger = tone === "danger";

  return (
    <section
      id={id}
      className={`overflow-hidden rounded-2xl border shadow-sm ${
        isDanger
          ? "border-red-300/50 bg-red-50/30 ring-1 ring-red-500/10 dark:border-red-500/25 dark:bg-red-950/20 dark:ring-red-500/10"
          : "border-border bg-surface ring-1 ring-black/[0.03] dark:bg-surface-elevated dark:ring-white/[0.04]"
      }`}
    >
      <div
        className={`border-b px-4 py-4 sm:px-5 ${
          isDanger
            ? "border-red-200/60 bg-red-100/40 dark:border-red-500/20 dark:bg-red-950/30"
            : "border-border bg-muted/35"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {step != null ? (
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                  isDanger
                    ? "bg-red-200/80 text-red-900 dark:bg-red-900/50 dark:text-red-100"
                    : "bg-accent/15 text-accent"
                }`}
                aria-hidden
              >
                {step}
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
              {description ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
