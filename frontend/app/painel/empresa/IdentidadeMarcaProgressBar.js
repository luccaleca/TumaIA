"use client";

import { PILARES_COMPLETUDE } from "../../../lib/identidadeMarcaUi";

export default function IdentidadeMarcaProgressBar({
  percentual,
  prontoParaImagem,
  dados,
  batchLabel,
}) {
  const pct = Math.min(100, Math.max(0, Number(percentual) || 0));

  return (
    <div className="rounded-xl border border-border bg-surface-elevated/60 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Progresso da identidade</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {batchLabel || "A barra sobe conforme a Tuma entende cores, estilo e tom da marca."}
          </p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{pct}%</p>
      </div>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
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
        <p className="mt-2 text-xs font-medium text-accent">Pronto para gerar artes</p>
      ) : null}

      <ul className="mt-3 flex flex-wrap gap-2">
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
      </ul>
    </div>
  );
}

