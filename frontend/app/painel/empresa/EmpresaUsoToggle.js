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
      className={`shrink-0 self-start rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
        ativo
          ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
          : "border border-border bg-background text-muted-foreground hover:border-emerald-500/45 hover:bg-muted/60 hover:text-foreground"
      } ${className}`.trim()}
    >
      Uso
    </button>
  );
}
