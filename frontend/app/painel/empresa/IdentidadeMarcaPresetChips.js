"use client";

const CHIP =
  "rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-foreground disabled:opacity-50";

/**
 * @param {{
 *   presets: string[],
 *   disabled?: boolean,
 *   onSelect: (value: string) => void,
 * }} props
 */
export default function IdentidadeMarcaPresetChips({ presets, disabled, onSelect }) {
  if (!presets.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" role="list" aria-label="Sugestões">
      {presets.map((p) => (
        <button key={p} type="button" disabled={disabled} className={CHIP} onClick={() => onSelect(p)}>
          {p.length > 52 ? `${p.slice(0, 50)}…` : p}
        </button>
      ))}
    </div>
  );
}
