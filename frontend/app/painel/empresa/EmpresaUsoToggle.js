/** Botão compacto: empresa ativa para chat, contextos e mídias. */
export default function EmpresaUsoToggle({ ativo, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-pressed={ativo}
      title={ativo ? "Ativa — clique para desativar" : "Usar no chat e na IA"}
      className={`shrink-0 self-start rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        ativo
          ? "bg-accent text-accent-foreground shadow-sm hover:opacity-90"
          : "border border-border bg-surface-elevated text-muted-foreground hover:border-accent/40 hover:bg-muted hover:text-foreground"
      } ${className}`.trim()}
    >
      Uso
    </button>
  );
}
