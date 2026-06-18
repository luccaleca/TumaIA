"use client";

/**
 * @param {{
 *   modelo: { nome: string } | null,
 *   midias: Array<{ id: string, label: string }>,
 *   onClearModelo: () => void,
 *   onRemoveMidia: (id: string) => void,
 * }} props
 */
export default function ChatSlashPicksBar({ modelo, midias, onClearModelo, onRemoveMidia }) {
  if (!modelo && !midias.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-border/60 px-2 py-1.5 md:px-3">
      {modelo ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
          <span className="text-muted-foreground">Modelo</span>
          {modelo.nome}
          <button
            type="button"
            aria-label="Remover modelo"
            className="ml-0.5 rounded-full px-1 text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={onClearModelo}
          >
            ×
          </button>
        </span>
      ) : null}
      {midias.map((m) => (
        <span
          key={m.id}
          className="inline-flex max-w-[14rem] items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-foreground"
        >
          <span className="shrink-0 text-muted-foreground">Mídia</span>
          <span className="truncate">{m.label}</span>
          <button
            type="button"
            aria-label="Remover mídia"
            className="ml-0.5 shrink-0 rounded-full px-1 text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={() => onRemoveMidia(m.id)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
