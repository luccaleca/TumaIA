"use client";

/**
 * Filtro de período compartilhado nas abas TumaCore.
 * @param {{
 *   period: number,
 *   from: string,
 *   to: string,
 *   onChange: (next: { period: number, from: string, to: string }) => void,
 * }} props
 */
export default function PlataformaPeriodFilter({ period, from, to, onChange }) {
  const custom = Boolean(from && to);

  function setPreset(p) {
    onChange({ period: p, from: "", to: "" });
  }

  function setFrom(v) {
    onChange({ period: custom ? period : 7, from: v, to: to || v });
  }

  function setTo(v) {
    onChange({ period: custom ? period : 7, from: from || v, to: v });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
        {[
          { value: 1, label: "24h" },
          { value: 7, label: "7 dias" },
          { value: 30, label: "30 dias" },
        ].map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPreset(p.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              !custom && period === p.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        De
        <input
          type="date"
          value={from || ""}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Até
        <input
          type="date"
          value={to || ""}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      {custom ? (
        <button
          type="button"
          onClick={() => setPreset(7)}
          className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          Limpar datas
        </button>
      ) : null}
    </div>
  );
}

/** Monta querystring de período para /plataforma/*. */
export function plataformaRangeQuery({ period = 7, from = "", to = "" } = {}) {
  if (from && to) {
    return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }
  return `period=${Number(period) || 7}`;
}
