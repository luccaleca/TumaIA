"use client";

import { PILARES_COMPLETUDE, PILAR_LOGO } from "../../../lib/identidadeMarcaUi";

export default function IdentidadeMarcaProgressBar({
  percentual,
  prontoParaImagem,
  dados,
  batchLabel,
  compact = false,
}) {
  const pct = Math.min(100, Math.max(0, Number(percentual) || 0));
  return (
    <div
      className={
        compact
          ? "rounded-lg border border-border/80 bg-surface-elevated/50 p-3"
          : "rounded-xl border border-border bg-surface-elevated/60 p-4"
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={`font-medium text-foreground ${compact ? "text-xs" : "text-sm"}`}>
            Progresso da identidade
          </p>
          {batchLabel ? (
            <p className={`mt-0.5 text-muted-foreground ${compact ? "text-[11px] leading-snug" : "text-xs"}`}>
              {batchLabel}
            </p>
          ) : null}
        </div>
        <p className={`font-semibold tabular-nums text-foreground ${compact ? "text-lg" : "text-2xl"}`}>
          {pct}%
        </p>
      </div>

      <div
        className={`overflow-hidden rounded-full bg-muted ${compact ? "mt-2 h-2" : "mt-3 h-2.5"}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da identidade da marca"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {prontoParaImagem ? (
        <p className={`font-medium text-accent ${compact ? "mt-1.5 text-[11px]" : "mt-2 text-xs"}`}>
          Pronto para gerar artes
        </p>
      ) : null}

      <ul className={`flex flex-wrap gap-2 ${compact ? "mt-2" : "mt-3"}`}>
        {PILARES_COMPLETUDE.map(({ key, label }) => {
          const ok = Boolean(String(dados[key] ?? "").trim());
          return (
            <li
              key={key}
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                ok
                  ? "bg-accent/15 text-foreground ring-1 ring-accent/25"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {ok ? "✓ " : ""}
              {label}
            </li>
          );
        })}
        {(() => {
          const { key, label } = PILAR_LOGO;
          const ok = Boolean(String(dados[key] ?? "").trim());
          return (
            <li
              key={key}
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                ok
                  ? "bg-accent/15 text-foreground ring-1 ring-accent/25"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {ok ? "✓ " : ""}
              {label}
            </li>
          );
        })()}
      </ul>
    </div>
  );
}
